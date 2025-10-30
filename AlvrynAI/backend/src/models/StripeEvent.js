const mongoose = require('mongoose');

const StripeEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  type: String,
  processedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StripeEvent', StripeEventSchema);
