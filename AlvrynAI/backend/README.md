Backend Express API for Alvryn AI.

Quick start (local):

1. cd backend
2. npm install
3. copy .env.example to .env and fill values (MONGO_URI, JWT_SECRET, STRIPE_SECRET_KEY)
4. npm run dev

Worker and testing scripts

- Start the prediction worker (connects to MONGO_URI):

```bash
# from backend/
MONGO_URI=mongodb://localhost:27017/alvryn npm run worker
```

- Enqueue a test prediction and poll until it's done/failed:

```bash
MONGO_URI=mongodb://localhost:27017/alvryn npm run test:enqueue
```

Endpoints:
- POST /api/auth/signup { email, password }
- POST /api/auth/login { email, password }
- POST /api/content { creatorId, platform, url }
- GET /api/content/feed
- POST /api/engage/record { userId, contentId, watchSeconds }
- POST /api/payments/create-checkout-session { priceId }

Real implementation notes:
- Add Passport Google OAuth flow and secure callback handling
- Protect routes with JWT middleware
- Implement Stripe webhook handling to update subscription models
- Implement proper validation & rate-limiting to avoid abuse

Security & GDPR
----------------
- The server now uses Helmet for common HTTP header protections. Add `helmet` to your dependencies and restart the server.
- CORS is restricted by default to the environment variable `FRONTEND_URL` (defaults to http://localhost:3000). Set `FRONTEND_URL` in production to your frontend origin.
- Request body size is limited to 100kb. Adjust `express.json({ limit })` in `src/index.js` if needed.
- A global rate limiter is applied to `/api/*`. Configure `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` via env.
- GDPR endpoints are available:
	- `GET /api/gdpr/export` — returns a JSON package of the authenticated user's data (profile, contents, engagements, predictions).
	- `DELETE /api/gdpr/delete` — anonymizes and soft-deletes personal data for the authenticated user.

Security notes (production):
- Do NOT use query-string token transfers for OAuth callbacks in production. Instead, exchange provider codes server-side and set httpOnly, secure cookies.
- Store JWT secrets in a secure secret manager and rotate them periodically.
- Enforce HTTPS and use HSTS. Configure cookie cookies with `secure: true` and `httpOnly: true`.
- Consider moving refresh token storage to a separate store and implement refresh token rotation with revocation lists.
