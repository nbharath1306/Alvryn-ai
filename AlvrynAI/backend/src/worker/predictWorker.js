/* Simple Mongo-backed prediction worker
   - Polls Prediction collection for pending jobs
   - Marks job as processing, runs `ai/virality.py` with job input via stdin, parses JSON output
   - Saves result to the Prediction document and marks done/failed

   This is intentionally simple and runs inside the same Node process. For production, move to a separate worker process or use a queue system (Bull, RQ) with Redis.
*/

const { spawn } = require('child_process');
const Prediction = require('../models/Prediction');
const mongoose = require('mongoose');
const metrics = require('../metrics');

// Configurable via env
const MAX_ATTEMPTS = parseInt(process.env.WORKER_MAX_ATTEMPTS || '5', 10);
const BASE_BACKOFF_SEC = parseInt(process.env.WORKER_BASE_BACKOFF_SEC || '5', 10);

let running = false;

function jitter(ms) {
  // add +/- 20% jitter
  const pct = 0.2;
  const delta = Math.floor(ms * pct);
  return ms - delta + Math.floor(Math.random() * (delta * 2 + 1));
}

async function processOne() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    // Atomically pick one pending job that's due (nextRunAt is null or <= now)
    const job = await Prediction.findOneAndUpdate(
      { status: 'pending', $or: [ { nextRunAt: { $exists: false } }, { nextRunAt: { $lte: now } }, { nextRunAt: null } ] },
      { $set: { status: 'processing', processingAt: new Date() } },
      { new: true }
    );
    if (!job) { running = false; return; }

    job.attempts = (job.attempts || 0) + 1;
  await job.save();
  // record attempt
  try { metrics.incrAttempt(1); } catch (e) { /* ignore if metrics not available */ }

    // Run the python helper (extracted for testability)
    const payload = JSON.stringify(job.input || {});
    try {
  // Call the exported runPython so tests can stub `worker.runPython` by replacing the
  // exported function. Using module.exports.runPython ensures runtime indirection.
  const { code, out, err } = await module.exports.runPython(payload);
      if (err) console.warn('virality stderr', String(err).slice(0,1000));
      let parsed = null;
      try { parsed = JSON.parse(out); } catch (e) { parsed = { raw: out }; }

      if (code === 0) {
        job.result = parsed;
        job.status = 'done';
        job.processedAt = new Date();
        job.lastError = undefined;
        job.nextRunAt = undefined;
        await job.save();
  try { metrics.incrProcessed(); } catch (e) {}

        // If job references a content document and result contains a score, persist to Content.lastPrediction
        try {
          if (job.content && parsed && typeof parsed.score !== 'undefined') {
            const Content = require('../models/Content');
            await Content.findByIdAndUpdate(job.content, { $set: { lastPrediction: { score: parsed.score, best_hours_utc: parsed.best_hours_utc || [], hashtags: parsed.hashtags || [], generatedAt: new Date(), raw: parsed } } });
          }
        } catch (e) { console.warn('Failed to persist prediction to content', e.message); }
      } else {
        // non-zero exit -> treat as failure and possibly retry
        const errMsg = err || out || `Process exited with code ${code}`;
        job.lastError = String(errMsg).slice(0,2000);

        if ((job.attempts || 0) >= MAX_ATTEMPTS) {
          job.status = 'failed';
          job.processedAt = new Date();
          await job.save();
          console.warn(`Job ${job._id} failed after ${job.attempts} attempts`);
          try { metrics.incrFailed(); } catch (e) {}
        } else {
          // schedule next run with exponential backoff
          const backoffSec = BASE_BACKOFF_SEC * Math.pow(2, (job.attempts - 1));
          const backoffMs = jitter(backoffSec * 1000);
          job.nextRunAt = new Date(Date.now() + backoffMs);
          job.status = 'pending';
          await job.save();
          console.log(`Job ${job._id} will retry in ${Math.round(backoffMs/1000)}s (attempt ${job.attempts})`);
        }
      }
    } catch (e) {
      // treat helper errors as failure and possibly retry
      job.lastError = e.message;
      try {
        if ((job.attempts || 0) >= MAX_ATTEMPTS) {
          job.status = 'failed';
          job.processedAt = new Date();
        } else {
          const backoffSec = BASE_BACKOFF_SEC * Math.pow(2, (job.attempts - 1));
          job.nextRunAt = new Date(Date.now() + backoffSec * 1000);
          job.status = 'pending';
        }
        await job.save();
      } catch (ee) {
        console.error('Failed updating job after worker exception', ee);
      }
    }
    running = false;
  } catch (e) {
    console.error('Worker error', e);
    running = false;
  }
}

function startWorker(intervalMs = 5000) {
  setInterval(processOne, intervalMs);
}

// Extracted helper to run python script; exported so tests can stub it
async function runPython(payload) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [__dirname + '/../../../ai/virality.py', payload], { env: process.env });
    let out = '';
    let err = '';
    py.stdout.on('data', d => { out += d.toString(); });
    py.stderr.on('data', d => { err += d.toString(); });
    py.on('close', (code) => resolve({ code, out, err }));
    py.on('error', (e) => reject(e));
  });
}

module.exports = { startWorker, processOne, runPython };
