const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const Content = require('../models/Content');
const Engagement = require('../models/Engagement');

// GET /api/gdpr/export - export a user's data (JSON)
router.get('/export', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    // gather user profile, contents, engagements, predictions, subscriptions
    const contents = await Content.find({ creator: user._id }).lean();
    const engagements = await Engagement.find({ user: user._id }).lean();
    // Predictions where enqueuedBy user
    const Prediction = require('../models/Prediction');
    const predictions = await Prediction.find({ enqueuedBy: user._id }).lean();

    const exportData = {
      user: { email: user.email, name: user.name, createdAt: user.createdAt, role: user.role },
      contents,
      engagements,
      predictions
    };

    res.json({ ok: true, data: exportData });
  } catch (err) {
    console.error('gdpr export error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/gdpr/delete - delete or anonymize a user's data
// For safety, this will anonymize and soft-delete: remove personal fields, mark content as anonymous, and remove predictions and engagements
router.delete('/delete', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    // anonymize user
    await User.findByIdAndUpdate(user._id, { $set: { email: `deleted_${user._id}@deleted.local`, name: 'Deleted User', avatarUrl: null, oauth: [], refreshToken: null, role: 'deleted' } });

    // anonymize their content (remove creator link)
    await Content.updateMany({ creator: user._id }, { $set: { creator: null, title: '[deleted]', url: null } });

    // remove engagements and predictions referencing the user
    await Engagement.deleteMany({ user: user._id });
    const Prediction = require('../models/Prediction');
    await Prediction.deleteMany({ enqueuedBy: user._id });

    res.json({ ok: true, msg: 'User data anonymized/deleted (soft)' });
  } catch (err) {
    console.error('gdpr delete error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
