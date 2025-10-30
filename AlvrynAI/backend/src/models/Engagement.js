/* Engagement model
   - records individual user engagements with content (watch time, liked, commented)
   - used to validate authentic engagement
*/

const mongoose = require('mongoose');

const EngagementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
  platform: { type: String },
  watchSeconds: { type: Number, default: 0 },
  liked: { type: Boolean, default: false },
  commented: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  valid: { type: Boolean, default: true }, // set false if deemed invalid
});

module.exports = mongoose.model('Engagement', EngagementSchema);
