const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  content: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
  type: { type: String, enum: ['watch','like','comment','share'], default: 'watch' },
  metadata: { type: mongoose.Schema.Types.Mixed },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['unassigned','assigned','completed','expired'], default: 'unassigned' },
  assignedAt: { type: Date },
  completedAt: { type: Date },
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', TaskSchema);
