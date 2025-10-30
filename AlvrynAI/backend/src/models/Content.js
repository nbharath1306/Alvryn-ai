/* Content model
   - stores links to external content (YouTube, Instagram, TikTok)
   - stores metadata and creator reference
*/

const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: ['youtube','instagram','tiktok','other'], required: true },
  url: { type: String, required: true },
  title: { type: String },
  topics: [String],
  postedAt: { type: Date, default: Date.now },
  engagementScore: { type: Number, default: 0 },
  trending: { type: Boolean, default: false },
  // Cached metadata to avoid repeated external API calls
  durationSeconds: { type: Number },
  durationFetchedAt: { type: Date },
  // Last AI prediction summary (from virality model)
  lastPrediction: {
    score: Number,
    best_hours_utc: [Number],
    hashtags: [String],
    generatedAt: Date,
    raw: Object
  },
});

module.exports = mongoose.model('Content', ContentSchema);
