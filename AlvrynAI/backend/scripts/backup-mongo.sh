#!/usr/bin/env bash
# Simple MongoDB backup helper using mongodump (if available).
# Usage:
#   MONGO_URI="..." ./backup-mongo.sh /tmp/backups

set -euo pipefail
OUT_DIR=${1:-./mongo-backup-$(date +%Y%m%d%H%M%S)}
MONGO_URI=${MONGO_URI:-mongodb://localhost:27017/alvryn}

echo "Using MONGO_URI=$MONGO_URI"
echo "Backing up to $OUT_DIR"
mkdir -p "$OUT_DIR"

if ! command -v mongodump >/dev/null 2>&1; then
  echo "mongodump not found. Install MongoDB Database Tools or run backup manually." >&2
  exit 2
fi

mongodump --uri="$MONGO_URI" --out="$OUT_DIR"
echo "Backup complete: $OUT_DIR"
