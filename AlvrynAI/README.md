# Alvryn AI - Content Creator Platform MVP

A full-stack platform for content creators to manage their content, engage with their audience, and monetize their work.

## 🚀 Features

- **User Authentication**: Signup/login with JWT, OAuth (Google, Microsoft)
- **Content Management**: Create, publish, and manage content across platforms
- **Engagement Tracking**: Track views, likes, comments, and shares
- **AI-Powered Predictions**: Predict content virality using ML models
- **Gamification**: Points, streaks, and leaderboards for user engagement
- **Subscription Payments**: Stripe integration for paid subscriptions
- **Real-time Updates**: Socket.IO for live content feed updates
- **Admin Dashboard**: Manage users, subscriptions, and view analytics
- **GDPR Compliance**: Data export and deletion endpoints

## 📋 Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT, Passport.js, bcrypt
- **Payments**: Stripe
- **Real-time**: Socket.IO
- **Security**: Helmet, CORS, rate limiting
- **Monitoring**: Prometheus metrics

### Frontend
- **Framework**: React 18
- **Styling**: CSS3 (custom styles)
- **API**: Fetch API
- **State**: React Hooks (useState, useEffect)

### DevOps
- **Containerization**: Docker, Docker Compose
- **CI/CD**: GitHub Actions
- **Deployment**: Render (backend), Vercel (frontend)
- **Database Hosting**: MongoDB Atlas

## 🏗️ Project Structure

```
AlvrynAI/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── index.js        # Main server entry point
│   │   ├── routes/         # API route handlers
│   │   ├── models/         # Mongoose models
│   │   ├── middleware/     # Auth and other middleware
│   │   ├── utils/          # Helper functions (JWT, etc.)
│   │   ├── worker/         # Background job processors
│   │   └── lib/            # Libraries (encryption, S3, etc.)
│   ├── test/               # Mocha/Chai tests
│   ├── scripts/            # Utility scripts
│   ├── public/admin/       # Admin dashboard UI
│   ├── package.json
│   └── Dockerfile
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   ├── App.css        # Styles
│   │   └── index.js       # React entry point
│   ├── public/
│   ├── build/             # Production build output
│   └── package.json
├── scripts/
│   └── integration/       # Integration test scripts
├── docker-compose.yml     # Docker Compose configuration
├── render.yaml           # Render deployment config
├── DEPLOYMENT_GUIDE.md   # Detailed deployment instructions
└── README.md             # This file
```

## 🛠️ Local Development Setup

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- MongoDB (or use Docker)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/nbharath1306/Alvryn-ai.git
cd AlvrynAI
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and fill in your values
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local if needed (default points to localhost:4000)
```

### 4. Start MongoDB

Using Docker:
```bash
docker compose up -d mongo
```

Or install MongoDB locally and start it.

### 5. Start Backend

```bash
cd backend
npm run dev
# Backend will run on http://localhost:4000
```

### 6. Start Frontend

```bash
cd frontend
npm start
# Frontend will run on http://localhost:3000
```

### 7. Run Tests

```bash
cd backend
npm test
```

## 🔐 Environment Variables

### Backend (.env)

```bash
# Server
PORT=4000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/alvryn

# Authentication
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here

# OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret

# Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI
OPENAI_API_KEY=sk-...

# URLs
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000

# Security
FIELD_ENCRYPTION_KEY=your_32_byte_encryption_key
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
```

### Frontend (.env.local)

```bash
REACT_APP_API_URL=http://localhost:4000/api
```

## 📦 Docker Deployment

Start all services with Docker Compose:

```bash
docker compose up -d
```

This starts:
- MongoDB on port 27017
- Backend on port 4000
- Worker process for background jobs
- Frontend on port 3000

Stop all services:

```bash
docker compose down
```

## 🚀 Production Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions on deploying to:
- **Backend**: Render
- **Frontend**: Vercel
- **Database**: MongoDB Atlas

Quick steps:
1. Setup MongoDB Atlas cluster
2. Deploy backend to Render
3. Deploy frontend to Vercel
4. Configure environment variables
5. Test your deployment

## 📡 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user
- `GET /api/auth/session` - Refresh access token
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/microsoft` - Microsoft OAuth login

### Content
- `POST /api/content` - Create new content
- `GET /api/content/feed` - Get content feed
- `GET /api/content/queue/:userId` - Get user's content queue

### Engagement
- `POST /api/engage/record` - Record engagement event
- `GET /api/engage/stats/:contentId` - Get content stats

### Payments
- `POST /api/payments/create-checkout-session` - Create Stripe checkout
- `POST /api/payments/webhook` - Stripe webhook handler

### AI
- `POST /api/ai/predict` - Request prediction job
- `GET /api/ai/jobs` - List user's prediction jobs
- `DELETE /api/ai/jobs/:id` - Cancel prediction job

### Gamification
- `GET /api/gamification/leaderboard` - Get leaderboard

### GDPR
- `GET /api/gdpr/export` - Export user data
- `DELETE /api/gdpr/delete` - Delete user account

### Admin
- `GET /api/admin/users` - List users (admin only)
- `GET /api/admin/subscriptions` - List subscriptions (admin only)
- `GET /api/admin/stripe-events` - List Stripe events (admin only)

## 🧪 Testing

Run backend tests:
```bash
cd backend
npm test
```

Run integration tests:
```bash
# Make sure backend is running first
node scripts/integration/run_integration_test.js
```

## 🔒 Security Features

- **Helmet**: HTTP security headers
- **CORS**: Configurable origin restrictions
- **Rate Limiting**: Prevent abuse (300 requests/minute default)
- **JWT**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Field Encryption**: Sensitive data encryption at rest
- **Request Size Limits**: 100KB limit on request bodies
- **Input Validation**: Server-side validation on all endpoints

## 📊 Monitoring

- Prometheus metrics available at `/metrics`
- Monitor queue depth, request counts, and response times
- Use Grafana or similar tools to visualize metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 🐛 Troubleshooting

### MongoDB Connection Error
```
MongooseServerSelectionError: connect ECONNREFUSED
```
**Solution**: Make sure MongoDB is running. Use `docker compose up -d mongo` or start MongoDB locally.

### CORS Error in Browser
```
Access to fetch at 'http://localhost:4000/api/...' from origin 'http://localhost:3000' has been blocked by CORS
```
**Solution**: Check `FRONTEND_URL` in backend `.env` matches your frontend URL.

### JWT Token Invalid
```
401 Unauthorized - Invalid token
```
**Solution**: Check `JWT_SECRET` is set correctly in backend `.env`. Clear localStorage in browser and login again.

### Stripe Webhook Error
```
Webhook signature verification failed
```
**Solution**: Make sure `STRIPE_WEBHOOK_SECRET` matches the secret from Stripe dashboard.

## 📞 Support

- Create an issue on GitHub
- Email: support@alvryn.ai (update with your actual support email)

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Video content support
- [ ] AI content recommendations
- [ ] Social media integrations
- [ ] Team collaboration features
- [ ] Advanced reporting

---

Made with ❤️ by the Alvryn AI Team
