// Optional KMS provider helper. If an encrypted key is provided via
// FIELD_ENCRYPTION_KEY_ENC (base64 ciphertext produced by KMS Encrypt), this helper
// will attempt to call AWS KMS to decrypt it and return the plaintext buffer.

async function decryptWithKms(encryptedBase64) {
  if (!encryptedBase64) return null;
  // try to require AWS SDK v3 client; if not present, return null so caller falls back
  let KMSClient, DecryptCommand;
  try {
    const kms = require('@aws-sdk/client-kms');
    KMSClient = kms.KMSClient;
    DecryptCommand = kms.DecryptCommand;
  } catch (e) {
    // aws sdk not installed — caller should fall back to env key
    return null;
  }

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const client = new KMSClient({ region });
  try {
    const ciphertext = Buffer.from(encryptedBase64, 'base64');
    const cmd = new DecryptCommand({ CiphertextBlob: ciphertext });
    const resp = await client.send(cmd);
    if (resp && resp.Plaintext) return Buffer.from(resp.Plaintext);
    return null;
  } catch (e) {
    console.warn('kmsProvider.decryptWithKms error', e && e.message);
    return null;
  }
}

module.exports = { decryptWithKms };
