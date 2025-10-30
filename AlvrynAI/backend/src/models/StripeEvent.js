const mongoose = require('mongoose');

const StripeEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  type: String,
  // store the raw event payload for auditing and troubleshooting
  raw: { type: mongoose.Schema.Types.Mixed },
  // headers (useful to debug webhook signatures)
  headers: { type: mongoose.Schema.Types.Mixed },
  // optional S3 key where raw payload is archived
  s3Key: { type: String },
  receivedAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

module.exports = mongoose.model('StripeEvent', StripeEventSchema);
