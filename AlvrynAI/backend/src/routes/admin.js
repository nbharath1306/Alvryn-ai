const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Prediction = require('../models/Prediction');
const Subscription = require('../models/Subscription');
const StripeEvent = require('../models/StripeEvent');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_FAKE');

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

// Admin: list subscriptions
router.get('/subscriptions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const subs = await Subscription.find().populate('user', 'email name').limit(200).lean();
    res.json({ total: subs.length, subscriptions: subs });
  } catch (err) {
    console.error('admin subscriptions error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list recent stripe events
router.get('/stripe-events', requireAuth, requireAdmin, async (req, res) => {
  try {
    const events = await StripeEvent.find().sort({ processedAt: -1 }).limit(200).lean();
    res.json({ total: events.length, events });
  } catch (err) {
    console.error('admin stripe events error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: reconcile subscription by fetching remote subscription and updating local record
router.post('/subscriptions/:id/reconcile', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const sub = await Subscription.findById(id);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    if (!sub.stripeSubscriptionId) return res.status(400).json({ error: 'No stripe subscription id' });
    try {
      const remote = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      sub.status = remote.status;
      if (remote.current_period_end) sub.currentPeriodEnd = new Date(remote.current_period_end * 1000);
      // try to map plan
      if (remote.items && remote.items.data && remote.items.data.length > 0) {
        const priceId = remote.items.data[0].price && (remote.items.data[0].price.id || remote.items.data[0].price.product);
        if (priceId) sub.plan = priceId;
      }
      await sub.save();
      return res.json({ ok: true, sub });
    } catch (e) {
      console.warn('reconcile fetch failed', e && e.message);
      return res.status(502).json({ error: 'Could not fetch remote subscription', detail: e && e.message });
    }
  } catch (err) {
    console.error('admin reconcile error', err);
    res.status(500).json({ error: 'Server error' });
  }
});
