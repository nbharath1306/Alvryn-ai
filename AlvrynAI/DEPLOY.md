# Alvryn AI — Minimal Production Deploy Checklist

This checklist covers the minimal steps and environment needed to deploy the backend in production.

1) Environment variables (required)
   - MONGO_URI: MongoDB connection string (use a managed DB with TLS)
   - JWT_SECRET and JWT_REFRESH_SECRET: strong secrets for auth tokens
   - BACKEND_URL and FRONTEND_URL: canonical URLs
   - STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET
   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (if using Google OAuth)
   - MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET (if using Microsoft OAuth)
   - FIELD_ENCRYPTION_KEY: 32-byte key (raw or base64) used to encrypt provider refresh tokens

2) Secrets & key management
   - Prefer using a KMS (AWS KMS / GCP KMS / Azure Key Vault). Store only a wrapped key or fetch a data key at runtime.
   - Do NOT check secrets into git.

   KMS key flow (AWS example)
   ---------------------------------
   If you prefer not to store a raw 32-byte key in env, you can use AWS KMS to encrypt the key and set
   the encrypted blob as `FIELD_ENCRYPTION_KEY_ENC`. The app will attempt to decrypt it using KMS at
   startup (requires AWS credentials with kms:Decrypt permission).

   1) Generate and encrypt a random key locally (requires AWS CLI configured):

   ```bash
   cd backend
   KMS_KEY_ID="arn:aws:kms:...:key/xxxx" ./scripts/generate-encrypted-key.sh encrypted-key.b64
   ```

   The script prints the plaintext base64 key (save it somewhere secure) and writes `encrypted-key.b64`.

   2) In your environment, set:

   ```bash
   export FIELD_ENCRYPTION_KEY_ENC="$(cat encrypted-key.b64)"
   # Ensure the runtime environment has AWS credentials (instance role or AWS_ACCESS_KEY_ID) with kms:Decrypt
   ```

   3) Start the app; it will attempt to decrypt the encrypted blob using AWS KMS and use the resulting key
       for AES-256-GCM field encryption.

   Optional: archive raw Stripe webhook events to S3
   ------------------------------------------------
   To avoid storing very large raw Stripe webhook payloads in the database, you can set up S3 archival.

   1) Create an S3 bucket and policy that allows PutObject for the runtime role/credentials used by the app.
   2) Set the environment variable:

   ```bash
   export STRIPE_EVENT_S3_BUCKET="my-alvryn-stripe-events"
   ```

   At runtime the app will attempt to upload each received Stripe event JSON to S3 and store only the
   S3 key in the database. If the upload fails for any reason, the raw payload will be stored in the DB
   as a fallback.



3) Database
   - Use a managed MongoDB (Atlas, DocumentDB, etc.) with TLS and backups enabled.
   - Ensure user accounts have least privilege and IP/network restrictions.

4) Running the app
   - Recommended: run in Docker or behind a process manager (PM2, systemd).
   - Example (Docker): Build images for `backend` and `worker`, run behind a load balancer.

5) Stripe
   - Configure `STRIPE_PRICE_MAP` or `STRIPE_PRICE_MAP_JSON` to map price IDs to plan slugs.
   - Set `STRIPE_WEBHOOK_SECRET` and verify webhook signing in production.

6) Migrations
   - Before enabling encryption of provider refresh tokens, run the migration script:

     ```bash
     # Dry-run (reports how many users would be migrated)
     cd backend
     FIELD_ENCRYPTION_KEY="<base64-32-or-32byte-key>" npm run migrate:encrypt-refresh-tokens

     # Apply migration
     FIELD_ENCRYPTION_KEY="<...>" npm run migrate:encrypt-refresh-tokens -- --run
     ```

   - Take a DB backup before applying migrations (see `backend/scripts/backup-mongo.sh`).

7) Monitoring & logging
   - Expose `/metrics` and scrape with Prometheus.
   - Centralize logs (Papertrail / Datadog / ELK).

8) Security hardening
   - Rate limit public endpoints, enable helmet, and review CORS origins.
   - Rotate keys regularly and use short-lived service credentials where possible.

9) CI/CD
   - Open PRs for integration tests and allow GitHub Actions to run on protected branches.
   - Remove or manage large binary files (>50MB) via Git LFS or external storage.

10) Post-deploy checks
   - Smoke test auth flows, webhook handling, and background worker tasks.
   - Run `npm test` and review logs for errors.

If you want, I can expand any section into step-by-step scripts and add GitHub Action workflows to automate deploy and backups.
