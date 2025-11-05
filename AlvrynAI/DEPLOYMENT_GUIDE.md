# Deployment Guide - Alvryn AI MVP

This guide covers deploying your MVP to production using Vercel (frontend) and Render (backend).

## Prerequisites

1. GitHub repository with your code pushed
2. MongoDB Atlas account (free tier available)
3. Render account (free tier available)
4. Vercel account (free tier available)
5. Stripe account for payments (optional for MVP)

## Part 1: Setup MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free M0 tier)
3. Create a database user with password
4. Add `0.0.0.0/0` to IP whitelist (or restrict to your server IPs)
5. Get your connection string (should look like):
   ```
   mongodb+srv://username:password@cluster.mongodb.net/alvryn?retryWrites=true&w=majority
   ```

## Part 2: Deploy Backend to Render

### Option A: Using Render Dashboard (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `alvryn-backend`
   - **Root Directory**: `AlvrynAI/backend` (or `backend` if at root)
   - **Environment**: `Node`
   - **Region**: Oregon (US West) or closest to you
   - **Branch**: `main` or `fix/workflow-trigger`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (for MVP)

5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=4000
   MONGO_URI=<your_mongodb_atlas_connection_string>
   JWT_SECRET=<generate_random_string_32_chars>
   JWT_REFRESH_SECRET=<generate_random_string_32_chars>
   FRONTEND_URL=<will_add_after_vercel_deploy>
   BACKEND_URL=https://alvryn-backend.onrender.com
   STRIPE_SECRET_KEY=<your_stripe_secret_key>
   STRIPE_WEBHOOK_SECRET=<your_stripe_webhook_secret>
   FIELD_ENCRYPTION_KEY=<generate_random_string_32_chars>
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=300
   ```

6. Click "Create Web Service"
7. Wait for deployment to complete (5-10 minutes)
8. Note your backend URL: `https://alvryn-backend.onrender.com`

### Option B: Using render.yaml

1. Push the `render.yaml` file to your repo
2. Go to Render Dashboard → "New +" → "Blueprint"
3. Connect your repo and deploy

### Generate Secure Secrets

Use these commands to generate secure secrets:

```bash
# For JWT_SECRET, JWT_REFRESH_SECRET, FIELD_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Part 3: Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend` (or leave blank if at root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

5. Add Environment Variable:
   ```
   REACT_APP_API_URL=https://alvryn-backend.onrender.com/api
   ```

6. Click "Deploy"
7. Wait for deployment to complete (2-5 minutes)
8. Note your frontend URL: `https://alvryn-ai.vercel.app`

## Part 4: Update Backend with Frontend URL

1. Go back to Render Dashboard
2. Open your backend service
3. Go to "Environment" tab
4. Update `FRONTEND_URL` with your Vercel URL:
   ```
   FRONTEND_URL=https://alvryn-ai.vercel.app
   ```
5. Save changes (this will trigger a redeploy)

## Part 5: Configure Stripe Webhooks (Optional)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter webhook URL: `https://alvryn-backend.onrender.com/api/payments/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the webhook signing secret
6. Add to Render environment variables as `STRIPE_WEBHOOK_SECRET`

## Part 6: Test Your Deployment

1. Visit your frontend URL: `https://alvryn-ai.vercel.app`
2. Try signing up with a test account
3. Try logging in
4. Check that the content feed loads
5. Monitor Render logs for any errors

## Monitoring and Maintenance

### Check Logs

**Render Logs:**
- Go to your service in Render Dashboard
- Click "Logs" tab to see real-time logs

**Vercel Logs:**
- Go to your project in Vercel Dashboard
- Click on deployment → "View Function Logs"

### Common Issues

**Issue: Frontend can't connect to backend**
- Check CORS settings in backend (`FRONTEND_URL` env var)
- Check `REACT_APP_API_URL` in Vercel environment variables
- Check backend is running (visit `https://your-backend.onrender.com/`)

**Issue: MongoDB connection failed**
- Check `MONGO_URI` is correct in Render
- Check IP whitelist in MongoDB Atlas includes `0.0.0.0/0`
- Check database user credentials are correct

**Issue: 502 Bad Gateway on Render**
- Backend may be starting up (wait 30-60 seconds)
- Check Render logs for startup errors
- Check `PORT` environment variable is set to `4000`

**Issue: Render free tier sleeps after inactivity**
- Free tier services sleep after 15 minutes of inactivity
- First request after sleep takes 30-60 seconds to wake up
- Upgrade to paid tier ($7/month) for always-on service

## Scaling Considerations

When you're ready to scale beyond MVP:

1. **Database**: Upgrade MongoDB Atlas tier for more storage/connections
2. **Backend**: Upgrade Render to Starter ($7/mo) or Standard ($25/mo)
3. **CDN**: Vercel already includes global CDN
4. **Monitoring**: Add services like Sentry, DataDog, or New Relic
5. **Caching**: Add Redis for session storage and caching

## Cost Breakdown (Free Tier)

- MongoDB Atlas: Free (512MB storage, shared cluster)
- Render Backend: Free (512MB RAM, sleeps after inactivity)
- Vercel Frontend: Free (100GB bandwidth/month)
- **Total: $0/month**

## Cost Breakdown (Production Ready)

- MongoDB Atlas M10: $57/month (2GB RAM, 10GB storage)
- Render Starter: $7/month (512MB RAM, always-on)
- Vercel Pro: $20/month (unlimited bandwidth)
- **Total: ~$84/month**

## Next Steps

1. Set up custom domain (both Vercel and Render support this)
2. Enable SSL/TLS (automatically handled by both platforms)
3. Set up monitoring and error tracking
4. Configure backup strategy for MongoDB
5. Set up CI/CD pipelines (both platforms auto-deploy on git push)

## Support

- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com/

---

**Your MVP is now live and ready for users! 🚀**
