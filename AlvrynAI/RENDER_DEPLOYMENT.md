# Render Deployment - Step by Step

## The Issue
Render was trying to use Docker but couldn't find a Dockerfile. We'll use Node.js deployment instead.

## Solution: Deploy Using Render Dashboard (Not Docker)

### Step 1: Go to Render Dashboard
1. Visit https://dashboard.render.com/
2. Click "New +" → "Web Service"

### Step 2: Connect GitHub Repository
1. Select your repository: `nbharath1306/Alvryn-ai`
2. Click "Connect"

### Step 3: Configure Service Settings

**IMPORTANT:** Fill these exactly:

- **Name**: `alvryn-backend` (or any name you want)
- **Region**: Oregon (US West) or closest to you
- **Branch**: `main`
- **Root Directory**: `backend` (NOT AlvrynAI/backend, just `backend`)
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: Free

### Step 4: Add Environment Variables

Click "Add Environment Variable" for each:

```
NODE_ENV=production
PORT=4000
MONGO_URI=<your_mongodb_atlas_connection_string>
JWT_SECRET=<generate_32_character_random_string>
JWT_REFRESH_SECRET=<generate_32_character_random_string>
FIELD_ENCRYPTION_KEY=<generate_32_character_random_string>
```

**Generate secure secrets with:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Optional (add if you need these features):**
```
FRONTEND_URL=<your_vercel_url_after_deployment>
BACKEND_URL=<your_render_url>
STRIPE_SECRET_KEY=<your_stripe_key>
GOOGLE_CLIENT_ID=<your_google_client_id>
GOOGLE_CLIENT_SECRET=<your_google_client_secret>
OPENAI_API_KEY=<your_openai_key>
```

### Step 5: Create Service
1. Click "Create Web Service"
2. Wait 5-10 minutes for build and deployment
3. Your backend will be live at: `https://your-service-name.onrender.com`

## Important Notes

### ❌ Don't Use Docker Mode
- The error you got was because Docker mode was selected
- Use **Node** environment instead

### ✅ Correct Root Directory
- Use `backend` (not `AlvrynAI/backend`)
- This points to the `/backend` folder in your repo

### 🔐 MongoDB Atlas Required
- Render free tier doesn't include MongoDB
- Use MongoDB Atlas free tier: https://www.mongodb.com/cloud/atlas
- Get connection string like: `mongodb+srv://user:pass@cluster.mongodb.net/alvryn`

## Testing Deployment

Once deployed, test your backend:

```bash
curl https://your-service-name.onrender.com/
```

Should return:
```json
{"ok":true,"msg":"Alvryn AI backend running"}
```

## Troubleshooting

### "Root Directory is missing"
- Make sure Root Directory is exactly: `backend`
- Not `AlvrynAI/backend`, not `/backend`, just `backend`

### "Build failed"
- Check build logs in Render dashboard
- Make sure `npm install` completes successfully
- Check that package.json exists in backend/ folder

### "Service won't start"
- Check environment variables are set
- Especially MONGO_URI and JWT_SECRET
- Check Render logs for error messages

### "MongoDB connection error"
- Check MONGO_URI is correct
- Check MongoDB Atlas IP whitelist includes `0.0.0.0/0`
- Check database user has correct permissions

## After Deployment

1. Note your backend URL: `https://your-service.onrender.com`
2. Update `FRONTEND_URL` in Render if deploying frontend
3. Deploy frontend to Vercel (see DEPLOYMENT_GUIDE.md)
4. Update frontend's `REACT_APP_API_URL` to your Render URL

---

**Your backend should now be deployed successfully! 🚀**
