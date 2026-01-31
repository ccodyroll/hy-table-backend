# Quick Start Guide

Get the HY-Table backend up and running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Airtable account with API token
- Google Gemini API key

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment

Create a `.env` file:

```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

AIRTABLE_TOKEN=your_token_here
AIRTABLE_BASE_ID=your_base_id_here
AIRTABLE_TABLE_NAME=Courses

GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

## Step 3: Build

```bash
npm run build
```

## Step 4: Run

```bash
npm start
```

Or for development with hot reload:

```bash
npm run dev
```

## Step 5: Test

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:3000/health
```

You should see:

```json
{
  "ok": true,
  "version": "1.0.0",
  "timestamp": "..."
}
```

## Next Steps

- See [README.md](README.md) for full documentation
- See [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md) for frontend integration examples
- Deploy to Render.com following the instructions in README.md

## Troubleshooting

**Error: AIRTABLE_TOKEN not set**
- Make sure your `.env` file exists and contains all required variables

**Error: Cannot connect to Airtable**
- Verify your Airtable token and base ID are correct
- Check that your Airtable base has the required fields

**Error: Gemini API failed**
- The service will continue to work without Gemini (graceful degradation)
- Verify your API key is correct for full functionality

**CORS errors**
- Make sure `CORS_ORIGIN` includes your frontend URL
- For local development, default origins are already allowed
