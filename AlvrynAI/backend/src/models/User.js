/* User model
   - supports local auth (email/password)
   - stores OAuth provider info (e.g., Google)
   - stores subscription & gamification fields
*/

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String }, // for local auth
  name: { type: String },
  avatarUrl: { type: String },
  // Support multiple OAuth providers and account linking
  oauth: [
    {
      provider: String, // e.g., 'google', 'apple', 'microsoft'
      providerId: String,
      email: String,
      name: String,
      avatarUrl: String,
      // providerRefreshToken: optional refresh token from the OAuth provider (stored for background refresh)
      providerRefreshToken: String,
      raw: {}
    }
  ],
  role: { type: String, default: 'creator' },
  subscription: {
    plan: String,
    status: String,
    expiresAt: Date,
  },
  // Refresh tokens (keep one active refresh token per user for simplicity in MVP)
  refreshToken: { type: String },
  engagementPoints: { type: Number, default: 0 },
  streakDays: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.methods.verifyPassword = async function(password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.statics.hashPassword = async function(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

module.exports = mongoose.model('User', UserSchema);
