/* Engagement routes
   - POST /api/engage/record to record a user's engagement
   - simple validation logic to mark engagements as valid/invalid
   - updates user points and content engagementScore
*/

const express = require('express');
const router = express.Router();
const Engagement = require('../models/Engagement');
const User = require('../models/User');
const Content = require('../models/Content');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');

// POST /api/engage/record
const { requireAuth } = require('../middleware/auth');

// Helper: parse YouTube ISO 8601 duration (e.g., PT1M30S) -> seconds
function parseISO8601Duration(iso) {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const hours = parseInt(m[1] || 0, 10);
  const minutes = parseInt(m[2] || 0, 10);
  const seconds = parseInt(m[3] || 0, 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Apply rate limiting to engagement reports to reduce abuse (30 requests per minute per IP)
const engageLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: 'Too many engagement reports, please slow down.' });

router.post('/record', requireAuth, engageLimiter, async (req, res) => {
  try {
    const userId = req.user._id;
    const { contentId, watchSeconds: rawWatch = 0, liked = false, commented = false } = req.body;
    if (!userId || !contentId) return res.status(400).json({ error: 'Missing fields' });

    const content = await Content.findById(contentId);
    if (!content) return res.status(404).json({ error: 'Content not found' });

    // Prevent duplicate valid engagements within 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await Engagement.findOne({ user: userId, content: contentId, valid: true, createdAt: { $gt: since } });
    if (existing) return res.status(400).json({ error: 'Engagement already recorded recently' });

    let watchSeconds = Math.max(0, Math.floor(rawWatch));
    let valid = true;

    // Platform-specific validation
    if (content.platform === 'instagram') {
      if (watchSeconds < 20) valid = false;
    } else if (content.platform === 'youtube') {
      // Try to get video duration using YouTube Data API if key provided
      const ytKey = process.env.YOUTUBE_API_KEY;
      let durationSeconds = null;
      try {
        // Extract video id
        let vid = null;
        try {
          const u = new URL(content.url);
          if (u.hostname.includes('youtube.com')) vid = u.searchParams.get('v');
          else if (u.hostname.includes('youtu.be')) vid = u.pathname.slice(1);
        } catch (e) { /* ignore */ }

          if (vid) {
            // Use cached duration if fresh (7 days)
            const sevenDays = 1000 * 60 * 60 * 24 * 7;
            if (content.durationSeconds && content.durationFetchedAt && (Date.now() - new Date(content.durationFetchedAt).getTime() < sevenDays)) {
              durationSeconds = content.durationSeconds;
            } else if (vid && ytKey) {
              const resp = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${vid}&key=${ytKey}`);
              if (resp.ok) {
                const j = await resp.json();
                if (j.items && j.items[0] && j.items[0].contentDetails && j.items[0].contentDetails.duration) {
                  durationSeconds = parseISO8601Duration(j.items[0].contentDetails.duration);
                  // Cache duration in Content for future validations
                  try {
                    content.durationSeconds = durationSeconds;
                    content.durationFetchedAt = new Date();
                    await content.save();
                  } catch (e) { console.warn('Failed to cache duration on content', e.message); }
                }
              }
            }
          }
      } catch (e) { console.warn('YouTube API error', e.message); }

      // If duration known, clamp unrealistic watchSeconds
      if (durationSeconds && watchSeconds > Math.ceil(durationSeconds * 1.2)) {
        // If client reports much more than duration, cap it to duration
        watchSeconds = durationSeconds;
      }

      // Validation rules:
      // - For videos <= 30s: require at least 20s
      // - For longer videos: require at least 30% of duration
      if (durationSeconds) {
        if (durationSeconds <= 30) {
          if (watchSeconds < 20) valid = false;
        } else {
          const minReq = Math.ceil(durationSeconds * 0.3);
          if (watchSeconds < minReq) valid = false;
        }
      } else {
        // Fallback conservative rule when duration unknown
        if (watchSeconds < 20) valid = false;
      }
    } else {
      // Generic rule for other platforms
      if (watchSeconds < 10) valid = false;
    }

    const engagement = new Engagement({ user: userId, content: contentId, watchSeconds, liked, commented, valid });
    await engagement.save();

    // If valid, increment user points and content score
    if (valid) {
      await User.findByIdAndUpdate(userId, { $inc: { engagementPoints: 10 } });
      await Content.findByIdAndUpdate(contentId, { $inc: { engagementScore: 1 } });
    }

    // Notify via sockets about engagement update
    const io = req.app.locals.io;
    io.emit('engagement-recorded', { engagementId: engagement._id, contentId, valid });

    res.json({ engagement });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
