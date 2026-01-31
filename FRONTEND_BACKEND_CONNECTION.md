# Frontend-Backend Connection Guide

This guide explains how to connect your Figma Make frontend (React Router, iOS-style UI) with the HY-Table backend, including GitHub setup and deployment.

## Table of Contents

1. [Overview](#overview)
2. [GitHub Repository Setup](#github-repository-setup)
3. [Backend Setup](#backend-setup)
4. [Frontend Configuration](#frontend-configuration)
5. [Local Development (Both Services)](#local-development-both-services)
6. [Testing the Connection](#testing-the-connection)
7. [Deployment Strategy](#deployment-strategy)
8. [CORS Configuration](#cors-configuration)
9. [Environment Variables Setup](#environment-variables-setup)
10. [Troubleshooting Connection Issues](#troubleshooting-connection-issues)

---

## Overview

Your setup will have:
- **Frontend**: React app (Figma Make) running on one port (e.g., 5173, 3000, or 8080)
- **Backend**: Express API running on port 3000 (or configured port)
- **Connection**: Frontend makes HTTP requests to backend API

```
Frontend (React)          Backend (Express)
     |                           |
     |  HTTP Request (fetch)     |
     |-------------------------->|
     |                           |  Process Request
     |                           |  Query Airtable
     |                           |  Call Gemini AI
     |  JSON Response            |
     |<--------------------------|
     |                           |
```

---

## GitHub Repository Setup

### Option 1: Separate Repositories (Recommended)

**Backend Repository:**
1. Go to [GitHub](https://github.com) and sign in
2. Click "New repository" (green button or + icon)
3. Repository name: `hy-table-backend`
4. Description: "AI university timetable scheduler backend"
5. Visibility: Private (recommended) or Public
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

**Frontend Repository:**
1. Create another repository: `hy-table-frontend`
2. Follow same steps as above

### Option 2: Monorepo (Single Repository)

1. Create repository: `hy-table`
2. Structure:
   ```
   hy-table/
   ├── backend/     (current HY-Table folder)
   ├── frontend/    (your React app)
   └── README.md
   ```

### Step-by-Step: Push Backend to GitHub

**If you haven't initialized git yet:**

```bash
# Navigate to your backend folder
cd HY-Table

# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Backend setup complete"

# Add remote repository (replace with your GitHub repo URL)
git remote add origin https://github.com/YOUR_USERNAME/hy-table-backend.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**If you already have git initialized:**

```bash
git add .
git commit -m "Backend ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/hy-table-backend.git
git branch -M main
git push -u origin main
```

**Verify:**
- Go to your GitHub repository
- You should see all your backend files

---

## Backend Setup

### Step 1: Complete Backend Configuration

1. **Create `.env` file** (if not already done):
   ```env
   PORT=3000
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173,http://localhost:3000,http://localhost:8080
   
   AIRTABLE_TOKEN=your_token_here
   AIRTABLE_BASE_ID=your_base_id_here
   AIRTABLE_TABLE_NAME=Courses
   
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-pro
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Test backend locally:**
   ```bash
   npm start
   # Or for development: npm run dev
   ```

5. **Verify backend is running:**
   Open browser: `http://localhost:3000/health`
   Should see: `{"ok": true, "version": "1.0.0", ...}`

### Step 2: Note Your Backend URL

- **Local development**: `http://localhost:3000`
- **Production (after Render deployment)**: `https://your-service-name.onrender.com`

---

## Frontend Configuration

### Step 1: Identify Your Frontend Framework

Your frontend uses:
- React Router
- Figma Make
- Mobile iOS-style UI

### Step 2: Create API Configuration File

Create a new file in your frontend project: `src/config/api.ts` (or `src/utils/api.ts`)

```typescript
// src/config/api.ts

// For local development
const LOCAL_API_URL = 'http://localhost:3000';

// For production (update after deploying to Render)
const PRODUCTION_API_URL = 'https://your-service-name.onrender.com';

// Determine which URL to use
const getApiUrl = () => {
  // Check if we're in development
  if (process.env.NODE_ENV === 'development') {
    return LOCAL_API_URL;
  }
  
  // Check for environment variable (if set)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Default to production
  return PRODUCTION_API_URL;
};

export const API_BASE_URL = getApiUrl();

// Helper function for making API calls
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ 
      error: { message: 'Unknown error' } 
    }));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return response.json();
}
```

### Step 3: Create API Service Functions

Create `src/services/timetableApi.ts`:

```typescript
// src/services/timetableApi.ts
import { apiRequest } from '../config/api';

// Types (adjust based on your backend types)
export interface Course {
  courseId: string;
  name: string;
  credits: number;
  major: string;
  category: string;
  tags: string[];
  meetingTimes: Array<{
    day: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
    startTime: string;
    endTime: string;
  }>;
  deliveryType: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  restrictions?: string[];
}

export interface RecommendationRequest {
  user: {
    name: string;
    major: string;
    studentIdYear: number;
    grade: number;
    semester: number;
  };
  targetCredits: number;
  fixedLectures: Array<{
    courseId: string;
    meetingTimes: Array<{
      day: string;
      startTime: string;
      endTime: string;
    }>;
  }>;
  blockedTimes: Array<{
    day: string;
    startTime: string;
    endTime: string;
  }>;
  strategy: 'MAJOR_FOCUS' | 'MIX' | 'INTEREST_FOCUS';
  tracks: string[];
  interests: string[];
  constraints: {
    avoidDays?: string[];
    preferOnlineOnlyDays?: string[];
    avoidMorning?: boolean | null;
    keepLunchTime?: boolean | null;
    maxClassesPerDay?: number | null;
    maxConsecutiveClasses?: number | null;
    avoidTeamProjects?: boolean | null;
    preferOnlineClasses?: boolean | null;
    notes?: string | null;
  };
  freeTextRequest?: string;
}

export interface Recommendation {
  rank: number;
  totalCredits: number;
  score: number;
  explanation: string;
  warnings: string[];
  courses: Course[];
  timetableGrid: Array<{
    day: string;
    startTime: string;
    endTime: string;
  }>;
}

// API Functions

/**
 * Fetch courses from backend
 */
export async function fetchCourses(
  major?: string,
  query?: string
): Promise<Course[]> {
  const params = new URLSearchParams();
  if (major) params.append('major', major);
  if (query) params.append('q', query);

  const response = await apiRequest<{ courses: Course[]; count: number }>(
    `/api/courses?${params}`
  );
  
  return response.courses;
}

/**
 * Generate timetable recommendations
 */
export async function generateRecommendations(
  request: RecommendationRequest
): Promise<Recommendation[]> {
  const response = await apiRequest<{ recommendations: Recommendation[] }>(
    '/api/recommend',
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
  
  return response.recommendations;
}

/**
 * Check backend health
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await apiRequest<{ ok: boolean }>('/health');
    return response.ok === true;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
}
```

### Step 4: Update Your Frontend Environment Variables

If your frontend uses environment variables (React, Vite, etc.), create `.env` or `.env.local`:

```env
# Frontend .env file
REACT_APP_API_URL=http://localhost:3000

# For production, update to:
# REACT_APP_API_URL=https://your-service-name.onrender.com
```

**Note:** Restart your frontend dev server after changing `.env` files.

### Step 5: Integrate API Calls in Your Components

**Example: Screen 1 - Onboarding (Major Dropdown)**

```typescript
// In your onboarding component
import { fetchCourses } from '../services/timetableApi';
import { useState, useEffect } from 'react';

function OnboardingScreen() {
  const [majors, setMajors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadMajors() {
      setLoading(true);
      try {
        // Fetch courses to get available majors
        const courses = await fetchCourses();
        const uniqueMajors = [...new Set(courses.map(c => c.major))];
        setMajors(uniqueMajors);
      } catch (error) {
        console.error('Failed to load majors:', error);
        // Handle error (show toast, etc.)
      } finally {
        setLoading(false);
      }
    }
    loadMajors();
  }, []);

  // ... rest of your component
}
```

**Example: Screen 4 - Generate Timetable Button**

```typescript
// In your final screen component
import { generateRecommendations } from '../services/timetableApi';
import { useState } from 'react';

function LifeConstraintsScreen() {
  const [generating, setGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  const handleGenerateTimetable = async () => {
    setGenerating(true);
    try {
      // Collect all data from your screens
      const requestData = {
        user: {
          name: userData.name,
          major: userData.major,
          studentIdYear: userData.studentIdYear,
          grade: userData.grade,
          semester: userData.semester,
        },
        targetCredits: targetCredits,
        fixedLectures: fixedLectures,
        blockedTimes: blockedTimes,
        strategy: selectedStrategy,
        tracks: selectedTracks,
        interests: selectedInterests,
        constraints: {
          keepLunchTime: keepLunchTime,
          avoidMorning: avoidMorning,
          maxClassesPerDay: maxClassesPerDay,
          // ... other constraints
        },
        freeTextRequest: freeTextRequest, // From Screen 1
      };

      const results = await generateRecommendations(requestData);
      setRecommendations(results);
      
      // Navigate to results screen or show recommendations
      // navigate('/results', { state: { recommendations: results } });
    } catch (error) {
      console.error('Failed to generate timetable:', error);
      // Show error message to user
      alert('시간표 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button 
      onClick={handleGenerateTimetable}
      disabled={generating}
    >
      {generating ? '생성 중...' : '시간표 생성'}
    </button>
  );
}
```

---

## Local Development (Both Services)

### Running Both Frontend and Backend Locally

**Terminal 1 - Backend:**
```bash
cd HY-Table
npm run dev
# Backend runs on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd your-frontend-folder
npm start
# or npm run dev
# Frontend runs on http://localhost:5173 (or 3000, 8080)
```

### Verify Both Are Running

1. **Backend**: Open `http://localhost:3000/health` in browser
2. **Frontend**: Open your frontend URL
3. **Test connection**: Use browser DevTools → Network tab to see API calls

---

## Testing the Connection

### Test 1: Health Check from Frontend

Add this to your frontend (temporary test component):

```typescript
import { checkBackendHealth } from './services/timetableApi';

async function testConnection() {
  const isHealthy = await checkBackendHealth();
  console.log('Backend connection:', isHealthy ? '✅ Connected' : '❌ Failed');
}
```

### Test 2: Fetch Courses

```typescript
import { fetchCourses } from './services/timetableApi';

async function testCourses() {
  try {
    const courses = await fetchCourses('컴퓨터공학');
    console.log('Courses loaded:', courses.length);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Test 3: Browser DevTools

1. Open your frontend in browser
2. Open DevTools (F12)
3. Go to **Network** tab
4. Trigger an API call (e.g., search for courses)
5. Look for requests to `localhost:3000` (or your backend URL)
6. Check:
   - Request status (should be 200)
   - Response data
   - CORS headers (if CORS error, see troubleshooting)

---

## Deployment Strategy

### Option 1: Deploy Backend First (Recommended)

1. **Deploy backend to Render.com** (see INSTRUCTIONS.md)
2. **Get production URL**: `https://your-service.onrender.com`
3. **Update frontend API URL** to production URL
4. **Deploy frontend** (Vercel, Netlify, etc.)

### Option 2: Keep Backend Local (Development Only)

- Use `http://localhost:3000` in frontend
- Only works for local development
- Not suitable for production

### Step-by-Step: Update Frontend for Production

1. **After deploying backend to Render**, update frontend:

```typescript
// src/config/api.ts
const PRODUCTION_API_URL = 'https://your-actual-service-name.onrender.com';
```

2. **Or use environment variable**:

```env
# Frontend .env.production
REACT_APP_API_URL=https://your-service-name.onrender.com
```

3. **Rebuild frontend**:
```bash
npm run build
```

---

## CORS Configuration

### Understanding CORS

CORS (Cross-Origin Resource Sharing) allows your frontend (different domain/port) to call your backend API.

### Backend CORS Setup

Your backend is already configured. Just ensure `.env` has:

```env
# For local development
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,http://localhost:8080

# For production (add your frontend domain)
CORS_ORIGIN=https://your-frontend-domain.com,https://www.your-frontend-domain.com
```

### Common CORS Issues

**Error:** `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solution:**
1. Add your frontend URL to backend `CORS_ORIGIN`
2. Restart backend server
3. Clear browser cache
4. Check that frontend is using correct backend URL

---

## Environment Variables Setup

### Backend Environment Variables

**Local Development (.env):**
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
AIRTABLE_TOKEN=...
AIRTABLE_BASE_ID=...
AIRTABLE_TABLE_NAME=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-pro
```

**Production (Render.com):**
- Set in Render dashboard → Environment Variables
- Same variables as above, but:
  - `NODE_ENV=production`
  - `CORS_ORIGIN=https://your-frontend-domain.com`

### Frontend Environment Variables

**Local Development (.env.local):**
```env
REACT_APP_API_URL=http://localhost:3000
```

**Production (.env.production):**
```env
REACT_APP_API_URL=https://your-service-name.onrender.com
```

**Note:** 
- React requires `REACT_APP_` prefix
- Vite uses `VITE_` prefix
- Restart dev server after changing `.env`

---

## Troubleshooting Connection Issues

### Issue: "Network Error" or "Failed to fetch"

**Possible causes:**
1. Backend is not running
2. Wrong API URL in frontend
3. CORS issue

**Solutions:**
1. **Check backend is running:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Verify API URL in frontend:**
   ```typescript
   console.log('API URL:', API_BASE_URL);
   ```

3. **Check CORS configuration** (see CORS section above)

### Issue: "404 Not Found" on API calls

**Solution:**
- Verify endpoint path: `/api/courses` not `/courses`
- Check backend routes are correct
- Ensure backend server is running

### Issue: "CORS policy blocked"

**Solution:**
1. Add frontend URL to backend `CORS_ORIGIN`
2. Restart backend
3. Clear browser cache
4. Check browser console for exact error

### Issue: API returns empty array

**Possible causes:**
1. No data in Airtable
2. Wrong major filter
3. Backend not connected to Airtable

**Solution:**
1. Test backend directly: `curl http://localhost:3000/api/courses`
2. Check Airtable connection in backend logs
3. Verify Airtable token and base ID

### Issue: "401 Unauthorized" or "403 Forbidden"

**Solution:**
- Check Airtable token is valid
- Verify Gemini API key is correct
- Check environment variables are set

### Issue: Frontend can't find API module

**Solution:**
```typescript
// Make sure import path is correct
import { fetchCourses } from './services/timetableApi';
// or
import { fetchCourses } from '../services/timetableApi';
```

### Issue: TypeScript errors in frontend

**Solution:**
1. Install backend types or copy type definitions
2. Create `src/types/api.ts` with backend types
3. Or use `any` temporarily for testing

---

## Quick Checklist

Before connecting frontend to backend:

- [ ] Backend is running locally (`npm run dev`)
- [ ] Backend health check works (`http://localhost:3000/health`)
- [ ] Frontend API configuration file created
- [ ] API service functions created
- [ ] Frontend environment variable set (if using)
- [ ] CORS configured in backend `.env`
- [ ] Test API call from frontend works
- [ ] Browser DevTools shows successful API requests

After deployment:

- [ ] Backend deployed to Render.com
- [ ] Backend production URL obtained
- [ ] Frontend API URL updated to production
- [ ] CORS updated with production frontend domain
- [ ] Test connection from production frontend

---

## Example: Complete Integration Flow

### 1. User fills Screen 1 (Onboarding)

```typescript
// User enters: name, major, studentIdYear, grade, semester
// User enters free text: "월요일에는 수업이 없었으면 좋겠어요"
const userData = {
  name: "홍길동",
  major: "컴퓨터공학",
  studentIdYear: 2023,
  grade: 2,
  semester: 1,
};
const freeTextRequest = "월요일에는 수업이 없었으면 좋겠어요";
```

### 2. User configures Screen 2 (Goal Credits & Fixed Schedule)

```typescript
const targetCredits = 18;
const fixedLectures = [
  {
    courseId: "CS101",
    meetingTimes: [{ day: "MON", startTime: "09:00", endTime: "10:30" }]
  }
];
const blockedTimes = [
  { day: "WED", startTime: "14:00", endTime: "16:00" }
];
```

### 3. User selects Screen 3 (Filling Strategy)

```typescript
const strategy = "MAJOR_FOCUS";
const tracks = ["소프트웨어", "인공지능"];
const interests = ["머신러닝"];
```

### 4. User sets Screen 4 (Life Constraints)

```typescript
const constraints = {
  keepLunchTime: true,
  avoidMorning: false,
  maxClassesPerDay: 4,
};
```

### 5. User clicks "Generate Timetable"

```typescript
const request = {
  user: userData,
  targetCredits,
  fixedLectures,
  blockedTimes,
  strategy,
  tracks,
  interests,
  constraints,
  freeTextRequest, // This will be parsed by Gemini
};

const recommendations = await generateRecommendations(request);
// Display recommendations to user
```

---

## Next Steps

1. ✅ Set up GitHub repositories
2. ✅ Configure backend API URL in frontend
3. ✅ Create API service functions
4. ✅ Test connection locally
5. ✅ Deploy backend to Render
6. ✅ Update frontend for production
7. ✅ Deploy frontend
8. ✅ Test end-to-end flow

Your frontend and backend are now connected! 🎉

For more details, see:
- [INSTRUCTIONS.md](INSTRUCTIONS.md) - Complete backend setup
- [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md) - Detailed frontend examples
- [README.md](README.md) - API documentation
