/* Auth routes: signup, login, and Google OAuth placeholder
   - Signup stores hashed password
   - Login returns JWT
   - Google OAuth is a placeholder demonstrating where to add Passport flows
*/

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');
// Passport-based social auth
const { setup: setupPassport, passport } = require('../auth/passport');
const crypto = require('crypto');

// Initialize passport with app later via a setup call. We'll export a function to attach routes to an express app.

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'User exists' });
    const passwordHash = await User.hashPassword(password);
    const user = new User({ email, passwordHash, name });
    await user.save();
    // Issue access and refresh tokens
    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);
    user.refreshToken = refreshToken;
    await user.save();
    res.json({ accessToken, refreshToken, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await user.verifyPassword(password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
      const accessToken = signAccess(user);
      const refreshToken = signRefresh(user);
      user.refreshToken = refreshToken;
      await user.save();
      res.json({ accessToken, refreshToken, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// TODO: Add Google OAuth flow using passport-google-oauth20
// Placeholder route removed to allow setupOAuth to attach provider routes at the app level.

// GET /api/auth/me - return current authenticated user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/session - exchange refresh cookie for an access token (and rotate refresh)
router.get('/session', async (req, res) => {
  try {
    const refreshToken = req.cookies && req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });
    const user = await User.findOne({ refreshToken });
    if (!user) return res.status(401).json({ error: 'Invalid session' });
    const payload = verifyRefresh(refreshToken);
    if (!payload || String(payload.id) !== String(user._id)) return res.status(401).json({ error: 'Invalid session' });

    const accessToken = signAccess(user);
    // Rotate refresh token
    const newRefresh = signRefresh(user);
    user.refreshToken = newRefresh;
    await user.save();

    const cookieOptions = {
      httpOnly: true,
      secure: (process.env.NODE_ENV === 'production'),
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    };
    res.cookie('refreshToken', newRefresh, cookieOptions);
    res.json({ accessToken, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/refresh - exchange refresh token for new access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });

    // Find user with this refresh token
    const user = await User.findOne({ refreshToken });
    if (!user) return res.status(401).json({ error: 'Invalid refresh token' });

    // Optionally verify signature too
    const payload = verifyRefresh(refreshToken);
    if (!payload || payload.id != String(user._id)) return res.status(401).json({ error: 'Invalid refresh token' });

    const accessToken = signAccess(user);
    // Issue a new refresh token rotating previous one
    const newRefresh = signRefresh(user);
    user.refreshToken = newRefresh;
    await user.save();
    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout - revoke refresh token server-side
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    user.refreshToken = null;
    await user.save();
    // Clear refresh token cookie as well
    const cookieOptions = { path: '/' };
    res.clearCookie('refreshToken', cookieOptions);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// Export a helper to mount passport and additional provider routes on an express app
module.exports.setupOAuth = function(app){
  // Implement server-side OAuth flows for Google and Microsoft without using Passport.
  // If provider client IDs/secrets are not configured, we skip adding routes.
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Helper: find or create user based on provider profile
  async function findOrCreateOAuthUser(provider, providerId, email, displayName, avatarUrl, raw) {
    let user = await User.findOne({ 'oauth.provider': provider, 'oauth.providerId': providerId });
    if (!user && email) user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name: displayName, avatarUrl });
      user.oauth = [{ provider, providerId, email, name: displayName, avatarUrl, raw }];
      await user.save();
      return user;
    }
    const has = (user.oauth || []).some(o => o.provider === provider && o.providerId === providerId);
    if (!has) {
      user.oauth = user.oauth || [];
      user.oauth.push({ provider, providerId, email, name: displayName, avatarUrl, raw });
      await user.save();
    }
    return user;
  }

  // Google
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get('/api/auth/google', (req, res) => {
      const state = crypto.randomBytes(18).toString('hex');
      const cookieOptions = { httpOnly: true, secure: (process.env.NODE_ENV==='production'), sameSite: 'lax', maxAge: 5*60*1000, path: '/' };
      res.cookie('oauth_state', state, cookieOptions);
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        response_type: 'code',
        scope: 'openid email profile',
        redirect_uri: `${BACKEND_URL}/api/auth/google/callback`,
        state,
        access_type: 'offline',
        prompt: 'consent',
      });
      return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    });

    app.get('/api/auth/google/callback', async (req, res) => {
      try {
        const cookieState = req.cookies && req.cookies.oauth_state;
        const paramState = req.query && req.query.state;
        if (!cookieState || !paramState || cookieState !== paramState) {
          console.warn('OAuth state mismatch for Google', { cookieState, paramState });
          return res.redirect(`${FRONTEND_URL}/?auth=failed`);
        }
        const code = req.query.code;
        if (!code) return res.redirect(`${FRONTEND_URL}/?auth=failed`);

        // Exchange code for tokens
        const fetch = require('node-fetch');
        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: `${BACKEND_URL}/api/auth/google/callback`,
            grant_type: 'authorization_code'
          })
        });
        const tokenJson = await tokenResp.json();
        const accessToken = tokenJson.access_token;
        if (!accessToken) return res.redirect(`${FRONTEND_URL}/?auth=failed`);
        const userinfoResp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
        const info = await userinfoResp.json();
        const providerId = info.sub || info.id;
        const email = info.email;
        const displayName = info.name;
        const avatarUrl = info.picture;

        const user = await findOrCreateOAuthUser('google', providerId, email, displayName, avatarUrl, info);

        // Issue app tokens and set httpOnly refresh cookie
        const aToken = signAccess(user);
        const rToken = signRefresh(user);
        user.refreshToken = rToken;
        await user.save();
        const cookieOptions = { httpOnly: true, secure: (process.env.NODE_ENV==='production'), sameSite: 'lax', maxAge: 30*24*60*60*1000, path: '/' };
        res.cookie('refreshToken', rToken, cookieOptions);
        res.clearCookie('oauth_state', { path: '/' });
        return res.redirect(`${FRONTEND_URL}/oauth-callback`);
      } catch (err) {
        console.error('Google callback error', err);
        return res.redirect(`${FRONTEND_URL}/?auth=failed`);
      }
    });
  }

  // Microsoft
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    app.get('/api/auth/microsoft', (req, res) => {
      const state = crypto.randomBytes(18).toString('hex');
      const cookieOptions = { httpOnly: true, secure: (process.env.NODE_ENV==='production'), sameSite: 'lax', maxAge: 5*60*1000, path: '/' };
      res.cookie('oauth_state', state, cookieOptions);
      const params = new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        response_type: 'code',
        scope: 'openid profile email',
        redirect_uri: `${BACKEND_URL}/api/auth/microsoft/callback`,
        response_mode: 'query',
        state,
      });
      return res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`);
    });

    app.get('/api/auth/microsoft/callback', async (req, res) => {
      try {
        const cookieState = req.cookies && req.cookies.oauth_state;
        const paramState = req.query && req.query.state;
        if (!cookieState || !paramState || cookieState !== paramState) {
          console.warn('OAuth state mismatch for Microsoft', { cookieState, paramState });
          return res.redirect(`${FRONTEND_URL}/?auth=failed`);
        }
        const code = req.query.code;
        if (!code) return res.redirect(`${FRONTEND_URL}/?auth=failed`);

        const fetch = require('node-fetch');
        const tokenResp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET,
            code,
            redirect_uri: `${BACKEND_URL}/api/auth/microsoft/callback`,
            grant_type: 'authorization_code'
          })
        });
        const tokenJson = await tokenResp.json();
        const accessToken = tokenJson.access_token;
        if (!accessToken) return res.redirect(`${FRONTEND_URL}/?auth=failed`);
        const userinfoResp = await fetch('https://graph.microsoft.com/oidc/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
        const info = await userinfoResp.json();
        const providerId = info.sub || info.oid || info.id;
        const email = (info.email || (info.preferred_username)) || null;
        const displayName = info.name || null;
        const avatarUrl = null;

        const user = await findOrCreateOAuthUser('microsoft', providerId, email, displayName, avatarUrl, info);

        const aToken = signAccess(user);
        const rToken = signRefresh(user);
        user.refreshToken = rToken;
        await user.save();
        const cookieOptions = { httpOnly: true, secure: (process.env.NODE_ENV==='production'), sameSite: 'lax', maxAge: 30*24*60*60*1000, path: '/' };
        res.cookie('refreshToken', rToken, cookieOptions);
        res.clearCookie('oauth_state', { path: '/' });
        return res.redirect(`${FRONTEND_URL}/oauth-callback`);
      } catch (err) {
        console.error('Microsoft callback error', err);
        return res.redirect(`${FRONTEND_URL}/?auth=failed`);
      }
    });
  }
};

