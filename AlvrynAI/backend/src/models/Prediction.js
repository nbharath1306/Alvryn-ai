/* Prediction model - holds queued AI prediction jobs and results */

const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema({
  content: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
  // echo of input for convenience
  input: { type: Object },
  // user who enqueued the job
  enqueuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending','processing','done','failed','cancelled'], default: 'pending' },
  result: { type: Object },
  // last error message (if any)
  lastError: { type: String },
  // number of attempts already made
  attempts: { type: Number, default: 0 },
  // next time this job is eligible to run (used for backoff)
  nextRunAt: { type: Date },
  // cancelled metadata
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  processedAt: Date
});

PredictionSchema.pre('save', function(next){ this.updatedAt = new Date(); next(); });

module.exports = mongoose.model('Prediction', PredictionSchema);
