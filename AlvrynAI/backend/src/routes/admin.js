const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Prediction = require('../models/Prediction');

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// GET /api/admin/jobs - list jobs with filters
router.get('/jobs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page || '0', 10));
    const limit = Math.min(200, parseInt(req.query.limit || '50', 10));
    const status = req.query.status;
    const query = {};
    if (status) query.status = status;
    const total = await Prediction.countDocuments(query);
    const jobs = await Prediction.find(query).sort({ createdAt: -1 }).skip(page * limit).limit(limit).lean();
    res.json({ total, page, limit, jobs });
  } catch (err) {
    console.error('admin list jobs error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/jobs/:id/cancel - force cancel any non-done job
router.post('/jobs/:id/cancel', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Prediction.findById(id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    if (job.status === 'done') return res.status(400).json({ error: 'Cannot cancel completed job' });
    job.status = 'cancelled';
    job.cancelledBy = req.user._id;
    job.cancelledAt = new Date();
    await job.save();
    res.json({ ok: true, job });
  } catch (err) {
    console.error('admin cancel error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
