Migration helper
----------------

The `migrate-encrypt-refresh-tokens.js` script scans users for plaintext
`oauth[].providerRefreshToken` values and migrates them into
`oauth[].providerRefreshTokenEncrypted` using the `FIELD_ENCRYPTION_KEY`.

Usage

1. Dry-run (shows how many users would be migrated):

```bash
cd backend
FIELD_ENCRYPTION_KEY="<base64-32-or-32byte-key>" npm run migrate:encrypt-refresh-tokens
```

2. Apply migration:

```bash
cd backend
FIELD_ENCRYPTION_KEY="<...>" npm run migrate:encrypt-refresh-tokens -- --run
```

Important:
- Take a backup before running the migration (see `backup-mongo.sh`).
- Ensure `FIELD_ENCRYPTION_KEY` matches the key you will use in production.
