# Deployment Guide

## Quick Start

### 1. GitHub Setup

1. Initialize git repository (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: HY-Table backend"
   ```

2. Create a new repository on GitHub

3. Push to GitHub:
   ```bash
   git remote add origin https://github.com/yourusername/hy-table-backend.git
   git branch -M main
   git push -u origin main
   ```

### 2. Render.com Deployment

#### Step 1: Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account (if not already connected)
4. Select your repository: `hy-table-backend`

#### Step 2: Configure Service

**Basic Settings:**
- **Name**: `HY-table-backend` (or your preferred name)
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: Leave empty (or `./` if required)
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

**Environment Variables:**

Add the following environment variables in Render dashboard:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AIRTABLE_TOKEN` | ✅ Yes | Airtable API token | `pat...` |
| `AIRTABLE_BASE_ID` | ✅ Yes | Airtable base ID | `app...` |
| `AIRTABLE_TABLE_NAME` | ⚠️ Optional | Table name (default: "Courses") | `Courses` |
| `GEMINI_API_KEY` | ⚠️ Optional | Gemini API key (fallback if missing) | `AI...` |
| `GEMINI_MODEL` | ⚠️ Optional | Model name (default: "gemini-2.5-flash") | `gemini-2.5-flash` |
| `FRONTEND_ORIGIN` | ⚠️ Optional | CORS origin (default: "*") | `https://your-frontend.com` |
| `NODE_ENV` | ⚠️ Optional | Environment (default: "production") | `production` |

**Note**: `PORT` is automatically set by Render - do not override it.

#### Step 3: Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Install dependencies
   - Build the TypeScript project
   - Start the server
3. Wait for deployment to complete (usually 2-5 minutes)
4. Your service will be available at: `https://your-service-name.onrender.com`

#### Step 4: Verify Deployment

1. Check health endpoint:
   ```bash
   curl https://your-service-name.onrender.com/health
   ```

   Expected response:
   ```json
   {
     "ok": true,
     "version": "1.0.0"
   }
   ```

2. Check logs in Render dashboard for any errors

### 3. Environment Variables Setup

#### Getting Airtable Credentials

1. Go to [Airtable Account](https://airtable.com/account)
2. Generate API token:
   - Go to "Developer" → "Personal access tokens"
   - Create new token with `data.records:read` scope
   - Copy the token → `AIRTABLE_TOKEN`
3. Get Base ID:
   - Open your Airtable base
   - Go to "Help" → "API documentation"
   - Copy the Base ID → `AIRTABLE_BASE_ID`
4. Table name:
   - Use the exact table name from your base → `AIRTABLE_TABLE_NAME`

#### Getting Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create API key
3. Copy the key → `GEMINI_API_KEY`

### 4. Frontend Integration

#### Update Frontend Environment

Add to your frontend `.env` file:

```env
REACT_APP_API_URL=https://your-service-name.onrender.com
```

Or for Vite:
```env
VITE_API_URL=https://your-service-name.onrender.com
```

Or for Next.js:
```env
NEXT_PUBLIC_API_URL=https://your-service-name.onrender.com
```

#### Update CORS in Backend

In Render dashboard, set:
```
FRONTEND_ORIGIN=https://your-frontend-domain.com
```

For multiple origins or development, you may need to update the CORS configuration in `src/index.ts`.

### 5. Monitoring

#### Health Checks

Render automatically pings `/health` endpoint. Ensure it returns `200 OK`.

#### Logs

- View logs in Render dashboard
- Logs include request IDs for tracing
- All secrets are automatically redacted

#### Common Issues

**Issue**: Service fails to start
- **Solution**: Check build logs, ensure all dependencies install correctly
- Verify Node.js version (requires 18+)

**Issue**: Airtable connection fails
- **Solution**: Verify `AIRTABLE_TOKEN` and `AIRTABLE_BASE_ID` are correct
- Check token has read permissions
- Verify table name matches exactly

**Issue**: CORS errors from frontend
- **Solution**: Set `FRONTEND_ORIGIN` to exact frontend domain (no trailing slash)
- Check browser console for exact error

**Issue**: Gemini API errors
- **Solution**: Verify API key is valid
- Check API quota/limits
- Service will fallback to rule-based scoring if Gemini fails

### 6. Updates and Redeployment

Render automatically redeploys on:
- Push to `main` branch
- Manual redeploy from dashboard

To update:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

Render will automatically rebuild and redeploy.

### 7. Custom Domain (Optional)

1. In Render dashboard, go to your service
2. Click "Settings" → "Custom Domain"
3. Add your domain
4. Follow DNS configuration instructions

## Local Testing Before Deployment

1. Test locally:
   ```bash
   npm install
   npm run build
   npm start
   ```

2. Test endpoints:
   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3000/api/courses
   ```

3. Verify environment variables are loaded correctly

## Production Checklist

- [ ] All environment variables set in Render
- [ ] Health endpoint returns `200 OK`
- [ ] CORS configured for frontend domain
- [ ] Airtable connection working (test `/api/courses`)
- [ ] Gemini API key set (or fallback working)
- [ ] Frontend can connect to backend
- [ ] Logs show no errors
- [ ] Rate limiting working (test with multiple requests)

## Support

For issues:
1. Check Render logs
2. Verify environment variables
3. Test endpoints with `curl` or Postman
4. Review README.md for API documentation
