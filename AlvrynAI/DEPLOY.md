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
