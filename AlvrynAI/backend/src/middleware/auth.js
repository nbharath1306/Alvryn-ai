/* JWT authentication middleware
   - Verifies Bearer token from Authorization header
   - Attaches `req.user` (full User document) when valid
*/

const { verifyAccess } = require('../utils/jwt');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || req.headers.Authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.split(' ')[1];
  const payload = verifyAccess(token);
    if (!payload || !payload.id) return res.status(401).json({ error: 'Invalid token' });
    const user = await User.findById(payload.id).select('-passwordHash');
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    console.error('auth middleware error', err);
    res.status(401).json({ error: 'Auth error' });
  }
}

module.exports = { requireAuth };
