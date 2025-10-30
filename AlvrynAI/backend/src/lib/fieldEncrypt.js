const crypto = require('crypto');

// Simple symmetric field encryption helper using AES-256-GCM.
// If ENCRYPTION_KEY is not set, this becomes a no-op (plaintext storage) to keep tests/simple.

const KEY_ENV = process.env.FIELD_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || '';
let key = null;
// try direct env key first
if (KEY_ENV) {
  try {
    const possible = Buffer.from(KEY_ENV, 'base64');
    if (possible.length === 32) key = possible;
    else if (KEY_ENV.length === 32) key = Buffer.from(KEY_ENV);
  } catch (e) {
    // ignore
  }
}

// If not provided, allow decrypting an encrypted key via KMS helper (FIELD_ENCRYPTION_KEY_ENC)
if (!key && process.env.FIELD_ENCRYPTION_KEY_ENC) {
  try {
    // require lazily to avoid hard dependency; kmsProvider will return null if not available
    const { decryptWithKms } = require('./kmsProvider');
    // decryptWithKms may be async; perform synchronous init by calling and blocking the event loop
    // (safe here at module load time)
    /* eslint-disable no-sync */
    const decr = decryptWithKms(process.env.FIELD_ENCRYPTION_KEY_ENC);
    // decr is a Promise; wait for resolution synchronously via then
    decr.then(buf => {
      if (buf && buf.length === 32) key = Buffer.from(buf);
    }).catch(() => {});
    /* eslint-enable no-sync */
  } catch (e) {
    // ignore if kms provider not usable
  }
}

function isNoop() {
  return !key;
}

function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  if (isNoop()) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store: iv(12) | tag(16) | ciphertext
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decrypt(blob) {
  if (!blob) return blob;
  if (isNoop()) return blob;
  try {
    const data = Buffer.from(blob, 'base64');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const ciphertext = data.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  } catch (e) {
    // If decryption fails, return the original blob to avoid hard failure in edgecases
    return blob;
  }
}

module.exports = { encrypt, decrypt, isNoop };
