const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');

// Leaderboard endpoint
// GET /api/gamification/leaderboard?period=all|daily|monthly&limit=10
router.get('/leaderboard', async (req, res) => {
  try {
    const period = (req.query.period || 'all');
    const limit = Math.min(100, parseInt(req.query.limit || '10', 10));
    let match = { valid: true };
    if (period === 'daily') {
      const d = new Date(); d.setHours(0,0,0,0);
      match.createdAt = { $gte: d };
    } else if (period === 'monthly') {
      const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
      match.createdAt = { $gte: d };
    }

    // We'll compute a score heuristic from Engagement: watchSeconds/10 + liked*5 + commented*10
    const Engagement = mongoose.model('Engagement');
    const pipeline = [
      { $match: match },
      // bring in content to find the creator
      { $lookup: { from: 'contents', localField: 'content', foreignField: '_id', as: 'content' } },
      { $unwind: '$content' },
      // compute per-engagement score
      { $addFields: { score: { $add: [ { $floor: { $divide: ['$watchSeconds', 10] } }, { $cond: ['$liked', 5, 0] }, { $cond: ['$commented', 10, 0] } ] } } },
      // group by content.creator
      { $group: { _id: '$content.creator', totalScore: { $sum: '$score' }, engagements: { $sum: 1 } } },
      { $sort: { totalScore: -1 } },
      { $limit: limit },
      // lookup user info
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { userId: '$_id', name: '$user.name', email: '$user.email', avatarUrl: '$user.avatarUrl', totalScore: 1, engagements: 1 } }
    ];

    const rows = await Engagement.aggregate(pipeline).allowDiskUse(true);
    res.json({ ok: true, period, rows });
  } catch (err) {
    console.error('leaderboard error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
