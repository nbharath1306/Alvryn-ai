/* JWT helper: sign and verify tokens */

const jwt = require('jsonwebtoken');
const ACCESS_SECRET = process.env.JWT_SECRET || 'dev_access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';

function signAccess(user) {
  const payload = { id: user._id, email: user.email };
  // Short-lived access token (e.g., 15m)
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
}

function signRefresh(user) {
  const payload = { id: user._id };
  // Longer-lived refresh token (e.g., 30 days)
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '30d' });
}

function verifyAccess(token) {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch (err) {
    return null;
  }
}

function verifyRefresh(token) {
  try {
    return jwt.verify(token, REFRESH_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
