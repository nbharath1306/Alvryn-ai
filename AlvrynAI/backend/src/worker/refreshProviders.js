/* Background utility to refresh provider access tokens using stored provider refresh tokens.
   Exports refreshOnce() which refreshes tokens for users whose access_token is missing or expiring soon.
*/
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const User = require('../models/User');

async function refreshOnce({ graceMs = 5 * 60 * 1000 } = {}) {
  // assumes mongoose is already connected by the caller (tests or app)
  if (!mongoose.connection || mongoose.connection.readyState === 0) {
    throw new Error('mongoose not connected');
  }

  const now = Date.now();
  const dueUsers = await User.find({ 'oauth.providerRefreshToken': { $exists: true, $ne: null } });
  let updated = 0;
  for (const user of dueUsers) {
    let changed = false;
    for (let i = 0; i < (user.oauth || []).length; i++) {
      const entry = user.oauth[i];
      if (!entry || !entry.providerRefreshToken) continue;
      const raw = entry.raw || {};
      const expiresAt = raw.expires_at || 0;
      // refresh if no token or about to expire within grace window
      if (!raw.access_token || (expiresAt && expiresAt - now < graceMs)) {
        try {
          let tokenUrl, bodyParams;
          if (entry.provider === 'google') {
            tokenUrl = 'https://oauth2.googleapis.com/token';
            bodyParams = new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID || '',
              client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
              refresh_token: entry.providerRefreshToken,
              grant_type: 'refresh_token'
            });
          } else if (entry.provider === 'microsoft') {
            tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
            bodyParams = new URLSearchParams({
              client_id: process.env.MICROSOFT_CLIENT_ID || '',
              client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
              refresh_token: entry.providerRefreshToken,
              grant_type: 'refresh_token'
            });
          } else {
            continue; // unsupported provider for now
          }

          const resp = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: bodyParams });
          const json = await resp.json();
          if (json && json.access_token) {
            entry.raw = entry.raw || {};
            entry.raw.access_token = json.access_token;
            if (json.expires_in) entry.raw.expires_at = Date.now() + parseInt(json.expires_in, 10) * 1000;
            if (json.scope) entry.raw.scope = json.scope;
            changed = true;
          } else {
            console.warn('refreshProviders: no access_token for', entry.provider, json);
          }
        } catch (e) {
          console.warn('refreshProviders error for user', user._id, entry.provider, e && e.message);
        }
      }
    }
    if (changed) {
      await user.save();
      updated++;
    }
  }
  return { scanned: dueUsers.length, updated };
}

if (require.main === module) {
  // run once when invoked directly
  (async () => {
    require('dotenv').config();
    const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/alvryn';
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
      const res = await refreshOnce();
      console.log('refreshProviders result', res);
    } catch (e) {
      console.error('refreshProviders main error', e && e.message);
    } finally {
      await mongoose.disconnect();
      process.exit(0);
    }
  })();
}

module.exports = { refreshOnce };
