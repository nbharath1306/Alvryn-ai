const client = require('prom-client');
const Prediction = require('./models/Prediction');

// Create a Registry which registers the metrics
const register = new client.Registry();

// collect default metrics (nodejs_process_* etc)
client.collectDefaultMetrics({ register });

// Counters
const jobsProcessed = new client.Counter({
  name: 'alvryn_jobs_processed_total',
  help: 'Total number of prediction jobs processed (successful)'
});
const jobsFailed = new client.Counter({
  name: 'alvryn_jobs_failed_total',
  help: 'Total number of prediction jobs failed'
});
const jobAttempts = new client.Counter({
  name: 'alvryn_job_attempts_total',
  help: 'Total number of job attempts (including retries)'
});

// Gauge for queue depth (pending jobs)
const jobQueueDepth = new client.Gauge({
  name: 'alvryn_job_queue_depth',
  help: 'Number of pending prediction jobs in the queue'
});

register.registerMetric(jobsProcessed);
register.registerMetric(jobsFailed);
register.registerMetric(jobAttempts);
register.registerMetric(jobQueueDepth);

// Helper functions
async function refreshQueueDepth() {
  try {
    const count = await Prediction.countDocuments({ status: 'pending' });
    jobQueueDepth.set(count);
  } catch (e) {
    // If DB not available, set to NaN to indicate unknown
    jobQueueDepth.set(NaN);
  }
}

function incrProcessed() { jobsProcessed.inc(); }
function incrFailed() { jobsFailed.inc(); }
function incrAttempt(by = 1) { jobAttempts.inc(by); }

module.exports = { register, refreshQueueDepth, incrProcessed, incrFailed, incrAttempt };
