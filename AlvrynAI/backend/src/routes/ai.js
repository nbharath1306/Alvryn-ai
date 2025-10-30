const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const { requireAuth } = require('../middleware/auth');
const Prediction = require('../models/Prediction');

// POST /api/ai/queue - enqueue a prediction job for content
// body: { contentId, title, description, platform, topics }
router.post('/queue', requireAuth, async (req, res) => {
  try {
    const { contentId, title = '', description = '', platform = 'other', topics = [] } = req.body || {};
    if (!contentId) return res.status(400).json({ error: 'Missing contentId' });
    const job = new Prediction({ content: contentId, input: { title, description, platform, topics }, enqueuedBy: req.user._id });
    await job.save();
    res.json({ jobId: job._id, status: job.status });
  } catch (err) {
    console.error('queue error', err);
    res.status(500).json({ error: 'Queue error' });
  }
});

// GET /api/ai/queue/my - list current user's jobs (paginated)
router.get('/queue/my', requireAuth, async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page || '0', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const query = { enqueuedBy: req.user._id };
    const total = await Prediction.countDocuments(query);
    const jobs = await Prediction.find(query).sort({ createdAt: -1 }).skip(page * limit).limit(limit).lean();
    res.json({ total, page, limit, jobs });
  } catch (err) {
    console.error('list my jobs error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/ai/queue/:id - get job status/result (if requester is owner)
router.get('/queue/:id', requireAuth, async (req, res) => {
  try {
    const job = await Prediction.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    // Only allow owners or admins (admin role not implemented yet)
    if (job.enqueuedBy && String(job.enqueuedBy) !== String(req.user._id)) return res.status(403).json({ error: 'Forbidden' });
    res.json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/ai/queue/:id/cancel - allow owner to cancel a pending job
router.post('/queue/:id/cancel', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    // Atomically update only if job is pending and enqueued by requester
    const job = await Prediction.findOneAndUpdate(
      { _id: id, enqueuedBy: req.user._id, status: 'pending' },
      { $set: { status: 'cancelled', cancelledBy: req.user._id, cancelledAt: new Date() } },
      { new: true }
    );
    if (!job) {
      // If not found, check why
      const existing = await Prediction.findById(id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (String(existing.enqueuedBy) !== String(req.user._id)) return res.status(403).json({ error: 'Forbidden' });
      // if owner but not pending, return informative message
      return res.status(400).json({ error: 'Job not cancellable', status: existing.status });
    }
    res.json({ ok: true, job });
  } catch (err) {
    console.error('cancel job error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Keep a quick immediate predict endpoint for small demos (calls python synchronously)
router.post('/predict', requireAuth, async (req, res) => {
  try {
    const { title = '', description = '', platform = 'other', topics = [] } = req.body || {};
    const py = spawn('python3', [__dirname + '/../../../ai/virality.py', JSON.stringify({ title, description, platform, topics })], { env: process.env });
    let out = '';
    py.stdout.on('data', (data) => { out += data.toString(); });
    py.stderr.on('data', (data) => { console.error('virality.py err:', data.toString()); });
    py.on('close', (code) => {
      try { const parsed = JSON.parse(out); res.json({ result: parsed }); }
      catch (e) { res.json({ raw: out.slice(0,2000) }); }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI predict error' });
  }
});

module.exports = router;
