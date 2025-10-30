#!/usr/bin/env node
/*
  Migration utility: find users with plaintext `oauth[].providerRefreshToken` and
  move them into `oauth[].providerRefreshTokenEncrypted` using the fieldEncrypt helper.

  Usage:
    NODE_ENV=production MONGO_URI="..." FIELD_ENCRYPTION_KEY="..." node scripts/migrate-encrypt-refresh-tokens.js --run

  Without --run it performs a dry-run and reports how many entries would be migrated.
*/
const mongoose = require('mongoose');
const minimist = require('minimist');
const User = require('../src/models/User');
const { encrypt } = require('../src/lib/fieldEncrypt');

async function main() {
  const argv = minimist(process.argv.slice(2));
  const run = !!argv.run || !!argv.r;
  const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/alvryn';
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const users = await User.find({ 'oauth.providerRefreshToken': { $exists: true, $ne: null } });
    console.log(`Found ${users.length} users with plaintext providerRefreshToken`);
    let migrated = 0;
    for (const u of users) {
      let modified = false;
      for (const entry of (u.oauth || [])) {
        if (entry && entry.providerRefreshToken) {
          const enc = encrypt(entry.providerRefreshToken);
          entry.providerRefreshTokenEncrypted = enc;
          delete entry.providerRefreshToken;
          modified = true;
        }
      }
      if (modified) {
        migrated++;
        if (run) {
          await u.save();
          console.log('Migrated user', u._id.toString());
        }
      }
    }
    console.log(`Migration scan complete. Would migrate ${migrated} users.` + (run ? ' (applied)' : ' (dry-run)'));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
