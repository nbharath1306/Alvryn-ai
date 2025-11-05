/*
  Main Express server for Alvryn AI backend MVP.
  - Connects to MongoDB
  - Sets up Passport for auth (local + Google placeholders)
  - Mounts API routes for auth, content, engagement, payments
  - Socket.IO for real-time feed updates
*/

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const socketio = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new socketio.Server(server, {
  cors: { origin: '*' }
});

// Security middlewares
app.use(helmet());

// Restrictive CORS: prefer FRONTEND_URL in env; fall back to localhost:3000 for dev
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// Parse cookies (used for secure refresh token cookie in OAuth flows)
app.use(cookieParser());

// Body size limits to reduce abuse
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Global rate limiter for API endpoints (configurable via env)
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // window in ms
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10), // limit per window per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alvryn';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Mongo connect error', err));

// Simple socket.io usage: broadcast new-content events to connected clients
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected', socket.id));
});

// Make io accessible in routes via app.locals
app.locals.io = io;

// Routes (placeholders implemented in src/routes)
const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');
const engageRoutes = require('./routes/engage');
const paymentsRoutes = require('./routes/payments');
const aiRoutes = require('./routes/ai');
const gamificationRoutes = require('./routes/gamification');
const gdprRoutes = require('./routes/gdpr');
const adminRoutes = require('./routes/admin');
const tasksRoutes = require('./routes/tasks');
const metrics = require('./metrics');

app.use('/api/auth', authRoutes);

// Mount OAuth provider routes (passport) if available
if (typeof authRoutes.setupOAuth === 'function') {
  authRoutes.setupOAuth(app);
}
app.use('/api/content', contentRoutes);
app.use('/api/engage', engageRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tasks', tasksRoutes);

// Serve admin static UI (simple pages) at /admin
const path = require('path');
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));

app.get('/', (req, res) => res.json({ ok: true, msg: 'Alvryn AI backend running' }));

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  // refresh dynamic gauges
  try { await metrics.refreshQueueDepth(); } catch { /* ignore */ }
  res.set('Content-Type', metrics.register.contentType);
  res.send(await metrics.register.metrics());
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
