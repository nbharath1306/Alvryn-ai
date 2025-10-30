#!/usr/bin/env bash
# Helper to generate a 32-byte symmetric key and encrypt it with AWS KMS.
# Requirements: AWS CLI configured with permissions to call kms:Encrypt for the specified key.
# Usage:
#   KMS_KEY_ID="arn:aws:kms:...:key/xxxx" ./generate-encrypted-key.sh

set -euo pipefail
KMS_KEY_ID=${KMS_KEY_ID:-}
OUT=${1:-encrypted-key.b64}

if [ -z "$KMS_KEY_ID" ]; then
  echo "Please set KMS_KEY_ID env var to your KMS key ARN or alias." >&2
  exit 2
fi

echo "Generating random 32-byte key..."
KEY=$(openssl rand -base64 32)
echo "Plain key (base64): $KEY"

echo "Encrypting with KMS key: $KMS_KEY_ID"
# AWS CLI encrypt expects plaintext as binary; decode base64 and pipe
printf '%s' "$KEY" | base64 --decode > /tmp/_key.bin
aws kms encrypt --key-id "$KMS_KEY_ID" --plaintext fileb:///tmp/_key.bin --output text --query CiphertextBlob > /tmp/_key.enc.b64
ENC=$(cat /tmp/_key.enc.b64)
echo "$ENC" > "$OUT"

echo "Wrote encrypted key to $OUT"
echo "Set FIELD_ENCRYPTION_KEY_ENC="]
echo "$ENC"

echo "IMPORTANT: Save the plain key shown above (base64) securely as FIELD_ENCRYPTION_KEY for recovery or rotation." 
