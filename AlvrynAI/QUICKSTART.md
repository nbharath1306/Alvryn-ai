# Quick Start Guide - Alvryn AI

Get your MVP up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose installed
- Git installed

## Step 1: Clone and Setup (2 minutes)

```bash
# Clone the repository
git clone https://github.com/nbharath1306/Alvryn-ai.git
cd AlvrynAI

# Install backend dependencies
cd backend
npm install

# Copy environment file and edit it
cp .env.example .env
# Edit .env with your text editor (at minimum, set JWT_SECRET)

# Install frontend dependencies
cd ../frontend
npm install
```

## Step 2: Start MongoDB (30 seconds)

```bash
# From project root
cd ..
docker compose up -d mongo
```

Wait a few seconds for MongoDB to start.

## Step 3: Start Backend (30 seconds)

```bash
cd backend
npm run dev
```

You should see:
```
Backend listening on 4000
Connected to MongoDB
```

## Step 4: Start Frontend (30 seconds)

Open a new terminal:

```bash
cd frontend
npm start
```

Browser will open automatically at http://localhost:3000

## Step 5: Test the App (1 minute)

1. Go to http://localhost:3000
2. Fill out the signup form:
   - Name: Test User
   - Email: test@example.com
   - Password: password123
3. Click "Sign Up"
4. You should see "Welcome, Test User"

## 🎉 Success!

Your MVP is now running locally:
- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- MongoDB: localhost:27017

## Next Steps

### Run Tests

```bash
cd backend
npm test
```

### Stop Services

```bash
# Stop MongoDB
docker compose down

# Stop backend and frontend with Ctrl+C in their terminals
```

### Deploy to Production

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for deploying to Render and Vercel.

### Explore Features

- Try logging in with your test account
- Check the content feed
- Create new content (requires auth token in headers - use Postman or similar)
- View admin dashboard at http://localhost:4000/admin

## Troubleshooting

### MongoDB won't start

```bash
# Check if Docker is running
docker ps

# If empty, start Docker Desktop
# Then try again:
docker compose up -d mongo
```

### Backend crashes on start

Check that:
1. MongoDB is running (`docker ps` should show mongo container)
2. .env file exists in backend/ directory
3. JWT_SECRET is set in .env

### Frontend won't load

Check that:
1. Backend is running on port 4000
2. No other app is using port 3000
3. npm install completed without errors

## Support

If you get stuck:
1. Check the logs in the terminal
2. Read the full [README.md](./README.md)
3. Review [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
4. Create an issue on GitHub

---

**Ready to ship your MVP? Follow the [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)!**
