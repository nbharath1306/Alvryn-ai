const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Content = require('../models/Content');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

function shuffle(arr){
  for (let i = arr.length -1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// POST /api/tasks/distribute?contentId=...&count=20&perUser=3
// Distribute generated tasks for a content across users fairly with randomness
router.post('/distribute', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.query;
    const count = parseInt(req.query.count || req.body.count || '20', 10);
    const perUserCap = parseInt(req.query.perUser || req.body.perUser || '3', 10);
    if (!contentId) return res.status(400).json({ error: 'Missing contentId' });
    const content = await Content.findById(contentId);
    if (!content) return res.status(404).json({ error: 'Content not found' });
    // Only creator or admin can distribute
    if (String(content.creator) !== String(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    // Generate task templates (random mix)
    const types = ['watch','like','comment','share'];
    const tasks = [];
    for (let i=0;i<count;i++){
      const t = types[Math.floor(Math.random()*types.length)];
      tasks.push({ content: content._id, type: t, metadata: {}, status: 'unassigned' });
    }
    // Insert tasks
    const created = await Task.insertMany(tasks);

    // Fetch eligible users (exclude creator)
    const users = await User.find({ _id: { $ne: content.creator } }).lean();
    if (!users || users.length === 0) return res.json({ distributed: 0, message: 'No eligible users to assign' });

    // Shuffle users for randomness
    shuffle(users);

    // Round-robin assign tasks respecting perUserCap
    const assignments = {};
    let userIndex = 0;
    for (const task of created){
      // find next user with available capacity
      let attempts = 0;
      while (attempts < users.length){
        const u = users[userIndex % users.length];
        const uid = String(u._id);
        const countAssigned = assignments[uid] || 0;
        userIndex++;
        attempts++;
        if (countAssigned < perUserCap){
          // assign
          await Task.findByIdAndUpdate(task._id, { $set: { assignedTo: u._id, status: 'assigned', assignedAt: new Date(), expiresAt: new Date(Date.now() + 7*24*60*60*1000) } });
          assignments[uid] = countAssigned + 1;
          break;
        }
      }
      // if everyone at cap, leave unassigned
    }

    return res.json({ ok: true, distributed: Object.values(assignments).reduce((a,b)=>a+b,0) });
  } catch (err) {
    console.error('distribute error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/my - list my assigned tasks
router.get('/my', requireAuth, async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id, status: 'assigned' }).populate('content').limit(50).lean();
    res.json({ tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/:id/complete - mark task completed
router.post('/:id/complete', requireAuth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    if (!task.assignedTo || String(task.assignedTo) !== String(req.user._id)) return res.status(403).json({ error: 'Forbidden' });
    if (task.status !== 'assigned') return res.status(400).json({ error: 'Task not in assigned state' });
    task.status = 'completed';
    task.completedAt = new Date();
    await task.save();
    res.json({ ok: true, task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
