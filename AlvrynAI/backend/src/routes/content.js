/* Content routes
   - POST new content (creator uploads a link)
   - GET feed: paginated list of content for community feed
   - GET /queue/:userId - content this user should engage with (simple placeholder logic)
*/

const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const User = require('../models/User');
const Task = require('../models/Task');

// POST /api/content - create content entry
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, async (req, res) => {
  try {
    const creatorId = req.user._id;
    const { platform, url, title, topics } = req.body;
    if (!platform || !url) return res.status(400).json({ error: 'Missing fields' });
    const content = new Content({ creator: creatorId, platform, url, title, topics });
    await content.save();

    // Broadcast to sockets that new content exists
    const io = req.app.locals.io;
    io.emit('new-content', { content });

    // Create tasks and distribute among users (non-blocking)
    try {
      const DEFAULT_TASK_COUNT = parseInt(process.env.DEFAULT_TASK_COUNT || '20', 10);
      const perUserCap = parseInt(process.env.TASK_PER_USER_CAP || '3', 10);
      // generate task documents
      const types = ['watch','like','comment','share'];
      const tasks = [];
      for (let i=0;i<DEFAULT_TASK_COUNT;i++){
        const t = types[Math.floor(Math.random()*types.length)];
        tasks.push({ content: content._id, type: t, metadata: {} });
      }
      const created = await Task.insertMany(tasks);
      // call distributor logic by posting to tasks/distribute endpoint would require an HTTP call; instead reuse logic inline to avoid circular require
      const users = await User.find({ _id: { $ne: content.creator } }).lean();
      if (users && users.length>0){
        // shuffle users
        for (let i = users.length -1; i>0; i--){
          const j = Math.floor(Math.random()*(i+1));
          [users[i], users[j]] = [users[j], users[i]];
        }
        const assignments = {};
        let userIndex = 0;
        for (const task of created){
          let attempts = 0;
          while (attempts < users.length){
            const u = users[userIndex % users.length];
            const uid = String(u._id);
            const countAssigned = assignments[uid] || 0;
            userIndex++;
            attempts++;
            if (countAssigned < perUserCap){
              await Task.findByIdAndUpdate(task._id, { $set: { assignedTo: u._id, status: 'assigned', assignedAt: new Date(), expiresAt: new Date(Date.now() + 7*24*60*60*1000) } });
              assignments[uid] = countAssigned + 1;
              break;
            }
          }
        }
      }
    } catch (e) { console.warn('task distribute failed', e.message); }

    res.json({ content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/content/feed
router.get('/feed', async (req, res) => {
  try {
    const items = await Content.find().sort({ postedAt: -1 }).limit(50).populate('creator', 'name avatarUrl');
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/content/queue/:userId - simple queue: latest items not by user
router.get('/queue/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const items = await Content.find({ creator: { $ne: userId } }).sort({ postedAt: -1 }).limit(20);
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
