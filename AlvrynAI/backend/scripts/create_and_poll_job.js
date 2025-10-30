/*
  Create a test Prediction job and poll status until done/failed or timeout.
  Usage: MONGO_URI=mongodb://localhost:27017/alvryn node backend/scripts/create_and_poll_job.js
*/

const mongoose = require('mongoose');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alvryn';

async function main(){
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to Mongo at', MONGO_URI);
  const Prediction = require('../src/models/Prediction');

  // create a simple job; choose an input likely to succeed or fail
  const job = new Prediction({ input: { title: 'Test job from automated script', text: 'This is a quick test.' } });
  await job.save();
  console.log('Created job', job._id.toString());

  const start = Date.now();
  const timeoutMs = 120000; // 2 minutes

  while (true) {
    const j = await Prediction.findById(job._id).lean();
    console.log('Status:', j.status, 'attempts:', j.attempts, 'nextRunAt:', j.nextRunAt, 'lastError:', j.lastError ? j.lastError.slice(0,200) : null);
    if (j.status === 'done' || j.status === 'failed') break;
    if (Date.now() - start > timeoutMs) {
      console.log('Timeout waiting for job to complete');
      break;
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  const final = await Prediction.findById(job._id).lean();
  console.log('Final job:', final.status, 'result:', final.result ? (final.result.score || '[has result]') : null);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
