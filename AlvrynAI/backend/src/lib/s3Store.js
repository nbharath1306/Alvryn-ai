// Optional S3 uploader helper. Uses AWS SDK v3 if installed and environment configured.
async function uploadJson(bucket, keyPrefix, obj) {
  if (!bucket) return null;
  // lazy-require to avoid hard dependency
  let S3Client, PutObjectCommand;
  try {
    const aws = require('@aws-sdk/client-s3');
    S3Client = aws.S3Client;
    PutObjectCommand = aws.PutObjectCommand;
  } catch (e) {
    console.warn('s3Store: @aws-sdk/client-s3 not installed; skipping S3 upload');
    return null;
  }

  try {
    const client = new S3Client({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    const key = `${keyPrefix}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.json`;
    const body = JSON.stringify(obj);
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/json' });
    await client.send(cmd);
    return key;
  } catch (e) {
    console.warn('s3Store upload error', e && e.message);
    return null;
  }
}

module.exports = { uploadJson };
