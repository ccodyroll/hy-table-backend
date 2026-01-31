# HY-Table Backend

<<<<<<< HEAD
Production-ready backend for an AI-powered university timetable scheduler. Built with Node.js, Express, TypeScript, Airtable, and Google Gemini AI.

## Features

- 🎓 **Course Data Management**: Fetches and caches course data from Airtable
- 🤖 **AI-Powered Recommendations**: Uses Google Gemini for natural language processing and timetable refinement
- ⚡ **Smart Scheduling**: Backtracking algorithm with collision detection and constraint satisfaction
- 🌐 **RESTful API**: Clean, well-documented endpoints
- 🔒 **Production Ready**: Environment-based configuration, error handling, CORS support
=======
Production-ready backend for HY-Table timetable scheduler service. Built with Node.js, TypeScript, Express, Airtable, and Google Gemini AI.

## Features

- 🎓 **Course Data Management**: Fetch and cache courses from Airtable
- 🤖 **AI-Powered Recommendations**: Use Google Gemini to rank and score timetable candidates
- 🇰🇷 **Korean Natural Language Parsing**: Convert Korean free-text requests into structured constraints
- ⚡ **Smart Scheduling**: Generate conflict-free timetables based on user preferences
- 🔒 **Production-Ready**: Rate limiting, input validation, structured logging, CORS support
- 📊 **Observability**: Health checks, request tracing, error handling
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Data Source**: Airtable
<<<<<<< HEAD
- **AI Engine**: Google Gemini
- **Validation**: Zod
=======
- **AI**: Google Gemini
- **Validation**: Zod
- **Hosting**: Render.com
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625

## Project Structure

```
.
├── src/
<<<<<<< HEAD
│   ├── index.ts                 # Main server entry point
│   ├── routes/                  # API route handlers
│   │   ├── health.ts
│   │   ├── courses.ts
│   │   └── recommend.ts
│   ├── services/                # Business logic services
│   │   ├── airtableService.ts   # Airtable integration
│   │   ├── geminiService.ts     # Gemini AI integration
│   │   └── schedulerService.ts  # Timetable generation
│   ├── middleware/              # Express middleware
│   │   ├── cors.ts
│   │   └── errorHandler.ts
│   ├── types/                   # TypeScript type definitions
│   │   └── index.ts
│   └── utils/                   # Utility functions
│       ├── timeParser.ts
│       └── validation.ts
=======
│   ├── index.ts                 # Server bootstrap
│   ├── routes/
│   │   ├── health.ts            # Health check endpoint
│   │   ├── courses.ts           # Course data endpoint
│   │   └── recommend.ts         # Timetable recommendation endpoint
│   ├── services/
│   │   ├── airtable.ts          # Airtable integration with caching
│   │   ├── gemini.ts            # Gemini AI scoring service
│   │   └── scheduler.ts         # Timetable generation logic
│   ├── schemas/
│   │   └── request.ts           # Zod validation schemas
│   └── utils/
│       ├── logger.ts            # Structured logging
│       ├── time.ts              # Time parsing and overlap detection
│       └── requestId.ts         # Request ID generation
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

<<<<<<< HEAD
## Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Airtable account with API token
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd HY-Table
   ```

2. **Install dependencies**
=======
## Local Development

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Setup

1. **Clone and install dependencies**:
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
   ```bash
   npm install
   ```

<<<<<<< HEAD
3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   NODE_ENV=production
   CORS_ORIGIN=https://your-frontend-domain.com
   
   AIRTABLE_TOKEN=your_airtable_token_here
   AIRTABLE_BASE_ID=your_base_id_here
   AIRTABLE_TABLE_NAME=your_table_name_here
   
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```

   See `.env.example` for reference.

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Run the server**
   ```bash
   npm start
   ```

   For development with hot reload:
=======
2. **Create `.env` file** (for local development):
   ```env
   PORT=3000
   AIRTABLE_TOKEN=your_airtable_token
   AIRTABLE_BASE_ID=your_base_id
   AIRTABLE_TABLE_NAME=Courses
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   FRONTEND_ORIGIN=http://localhost:3001
   NODE_ENV=development
   ```

3. **Run in development mode**:
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
   ```bash
   npm run dev
   ```

<<<<<<< HEAD
## API Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "ok": true,
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Get Courses

```http
GET /api/courses?major=컴퓨터공학&q=알고리즘
```

**Query Parameters:**
- `major` (optional): Filter by major
- `q` (optional): Search query

**Response:**
```json
{
  "courses": [
    {
      "courseId": "CS101",
      "name": "알고리즘",
      "credits": 3,
      "major": "컴퓨터공학",
      "category": "전공필수",
      "tags": ["프로그래밍", "자료구조"],
      "meetingTimes": [
        {
          "day": "MON",
          "startTime": "09:00",
          "endTime": "10:30"
        }
      ],
      "deliveryType": "OFFLINE",
      "restrictions": []
    }
  ],
  "count": 1
}
```

### Generate Recommendations

```http
POST /api/recommend
Content-Type: application/json
```

**Request Body:**
```json
{
  "user": {
    "name": "홍길동",
    "major": "컴퓨터공학",
    "studentIdYear": 2023,
    "grade": 2,
    "semester": 1
  },
  "targetCredits": 18,
  "fixedLectures": [
    {
      "courseId": "CS101",
      "meetingTimes": [
        {
          "day": "MON",
          "startTime": "09:00",
          "endTime": "10:30"
        }
      ]
    }
  ],
  "blockedTimes": [
    {
      "day": "WED",
      "startTime": "14:00",
      "endTime": "16:00"
    }
  ],
  "strategy": "MAJOR_FOCUS",
  "tracks": ["소프트웨어", "인공지능"],
  "interests": ["머신러닝", "웹개발"],
  "constraints": {
    "avoidDays": ["FRI"],
    "keepLunchTime": true,
    "maxClassesPerDay": 4,
    "preferOnlineClasses": false
  },
  "freeTextRequest": "월요일에는 수업이 없었으면 좋겠어요. 오전 9시 수업은 피하고 싶어요."
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "rank": 1,
      "totalCredits": 18,
      "score": 125,
      "explanation": "학점 목표를 달성하며 흥미로운 과목들을 포함합니다.",
      "warnings": [],
      "courses": [...],
      "timetableGrid": [...]
    }
  ],
  "debug": {
    "candidatesGenerated": 45,
    "geminiUsed": true
  }
}
```

## Airtable Schema

Your Airtable table should have the following fields (field names are flexible and will be auto-detected):

- `courseId` / `Course ID` / `과목코드`: Course identifier
- `name` / `Name` / `과목명`: Course name
- `credits` / `Credits` / `학점`: Number of credits
- `major` / `Major` / `전공`: Major field
- `category` / `Category` / `분류`: Course category
- `tags` / `Tags` / `태그`: Array or comma-separated tags
- `meetingTimes` / `Meeting Times` / `시간`: Meeting time string (e.g., "월 09:00-10:30, 수 11:00-12:30")
- `deliveryType` / `Delivery Type` / `수업방식`: ONLINE, OFFLINE, or HYBRID
- `restrictions` / `Restrictions` / `제한사항`: Array or comma-separated restrictions

**Meeting Time Format:**
- Single day: `"월 09:00-10:30"`
- Multiple days: `"월/수 09:00-10:30"`
- Multiple time slots: `"월 09:00-10:30, 수 11:00-12:30"`

## Natural Language Processing

The backend uses Google Gemini to parse Korean natural language constraints from user input. Examples:

- `"월요일에는 수업이 없었으면 좋겠어요."` → `avoidDays: ["MON"]`
- `"오전 9시 수업은 피하고 싶어요."` → `avoidMorning: true`
- `"점심시간 12~1시는 비워주세요."` → `keepLunchTime: true`
- `"하루에 수업은 3개 이하였으면 좋겠어요."` → `maxClassesPerDay: 3`
- `"팀플 많은 과목은 싫어요."` → `avoidTeamProjects: true`

## Deployment on Render.com

### Step 1: Prepare Repository

1. Push your code to GitHub
2. Ensure all environment variables are documented in `.env.example`

### Step 2: Create Web Service on Render
=======
   The server will start on `http://localhost:3000` with hot-reload.

4. **Build for production**:
   ```bash
   npm run build
   ```

5. **Run production build**:
   ```bash
   npm start
   ```

## Render.com Deployment

### 1. Create a New Web Service
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
<<<<<<< HEAD
   - **Name**: `hy-table-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free or Starter (as needed)

### Step 3: Set Environment Variables

In Render dashboard, go to your service → Environment → Add Environment Variable:

```
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
AIRTABLE_TOKEN=your_token
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_TABLE_NAME=your_table_name
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash
```

### Step 4: Deploy

1. Click "Create Web Service"
2. Render will automatically build and deploy
3. Your service will be available at `https://your-service.onrender.com`

### Step 5: Verify

```bash
curl https://your-service.onrender.com/health
=======

### 2. Build & Start Commands

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### 3. Environment Variables

Add these environment variables in Render dashboard:

**Required**:
- `AIRTABLE_TOKEN` - Your Airtable API token
- `AIRTABLE_BASE_ID` - Your Airtable base ID
- `AIRTABLE_TABLE_NAME` - Table name (default: "Courses")

**Optional**:
- `GEMINI_API_KEY` - Google Gemini API key (if not set, uses fallback scoring)
- `GEMINI_MODEL` - Gemini model name (default: "gemini-2.5-flash")
- `FRONTEND_ORIGIN` - Frontend origin for CORS (e.g., `https://your-frontend.com`)
- `PORT` - Server port (Render sets this automatically)
- `NODE_ENV` - Set to `production`

### 4. Deploy

Render will automatically deploy on every push to your main branch.

## API Endpoints

### GET /health

Health check endpoint.

**Response**:
```json
{
  "ok": true,
  "version": "1.0.0"
}
```

### GET /api/courses

Fetch courses from Airtable.

**Query Parameters**:
- `major` (optional): Filter by major
- `q` (optional): Search query

**Example**:
```bash
GET /api/courses?major=Computer Science&q=algorithm
```

**Response**:
```json
[
  {
    "courseId": "CS101",
    "name": "Introduction to Computer Science",
    "credits": 3,
    "department": "Computer Science",
    "major": "Computer Science",
    "track": "Core",
    "tags": ["programming", "algorithms"],
    "meetingTimes": [
      { "day": "MON", "start": "09:00", "end": "10:15" },
      { "day": "WED", "start": "09:00", "end": "10:15" }
    ],
    "restrictions": "Prerequisites: None",
    "description": "...",
    "instructor": "Dr. Smith",
    "online": false,
    "teamProject": false
  }
]
```

### POST /api/recommend

Generate timetable recommendations.

**Request Body**:
```json
{
  "user": {
    "name": "John Doe",
    "major": "Computer Science",
    "studentYear": 2,
    "grade": 3,
    "semester": "Fall 2024"
  },
  "targetCredits": 15,
  "fixedLectures": [
    {
      "courseId": "CS101",
      "meetingTimes": [
        { "day": "MON", "start": "09:00", "end": "10:15" }
      ]
    }
  ],
  "blockedTimes": [
    { "day": "TUE", "start": "12:00", "end": "13:00" }
  ],
  "strategy": "MAJOR_FOCUS",
  "tracks": ["Core", "AI"],
  "interests": ["machine learning", "web development"],
  "constraints": {
    "keepLunchTime": true,
    "avoidMorning": false,
    "preferEmptyDay": true,
    "maxConsecutiveClasses": 3,
    "preferTeamProjects": false,
    "preferOnlineClasses": false
  },
  "freeTextRequest": "월요일에는 수업이 없었으면 좋겠어요. 오전 9시 수업은 최대한 피하고 싶어요."
}
```

**Korean Natural Language Parsing**:

The `freeTextRequest` field supports Korean natural language input. The backend uses Gemini AI to parse Korean text into structured constraints. Examples:

- `"월요일에는 수업이 없었으면 좋겠어요."` → Avoids Monday classes
- `"오전 9시 수업은 최대한 피하고 싶어요."` → Avoids morning classes
- `"점심시간 12~1시는 항상 비워주세요."` → Keeps lunch time free
- `"팀플 많은 과목은 싫어요."` → Avoids team project courses
- `"하루에 수업은 3개 이하였으면 좋겠어요."` → Max 3 classes per day
- `"금요일엔 온라인 수업만 있었으면 해요."` → Online classes only on Friday

**Note**: UI-based constraints always override parsed constraints. If a constraint is set in the UI, it takes precedence over the Korean text interpretation.
```

**Response**:
```json
{
  "recommendations": [
    {
      "rank": 1,
      "totalCredits": 15,
      "courses": [
        {
          "courseId": "CS101",
          "name": "Introduction to Computer Science",
          "credits": 3,
          "meetingTimes": [
            { "day": "MON", "start": "09:00", "end": "10:15" }
          ]
        }
      ],
      "score": 85,
      "explanation": "Well-balanced schedule aligned with major focus strategy...",
      "warnings": []
    }
  ],
  "debug": {
    "candidatesGenerated": 15,
    "geminiUsed": true
  }
}
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
```

## Frontend Integration

<<<<<<< HEAD
### Base URL Configuration

In your frontend, set the API base URL:

```javascript
// config.js or environment variable
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-service.onrender.com';
```

### Example: Fetch Courses

```javascript
async function fetchCourses(major, query) {
  const params = new URLSearchParams();
  if (major) params.append('major', major);
  if (query) params.append('q', query);

  const response = await fetch(`${API_BASE_URL}/api/courses?${params}`);
  const data = await response.json();
  return data.courses;
}
```

### Example: Generate Recommendations

```javascript
async function generateRecommendations(requestData) {
  const response = await fetch(`${API_BASE_URL}/api/recommend`, {
=======
### CORS Configuration

The backend supports CORS. Set `FRONTEND_ORIGIN` environment variable to your frontend domain:

```env
FRONTEND_ORIGIN=https://your-frontend.com
```

Or allow all origins (development only):
```env
FRONTEND_ORIGIN=*
```

### Example Frontend Code

#### Fetch Courses

```typescript
const RENDER_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-service.onrender.com';

async function fetchCourses(major?: string, query?: string) {
  const params = new URLSearchParams();
  if (major) params.append('major', major);
  if (query) params.append('q', query);
  
  const url = `${RENDER_BASE_URL}/api/courses?${params.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch courses');
  }
  
  return response.json();
}
```

#### Generate Recommendations

```typescript
async function generateRecommendations(request: RecommendRequest) {
  const url = `${RENDER_BASE_URL}/api/recommend`;
  
  const response = await fetch(url, {
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
<<<<<<< HEAD
    body: JSON.stringify(requestData),
  });

  if (!response.ok) {
    throw new Error('Failed to generate recommendations');
  }

  const data = await response.json();
  return data.recommendations;
}
```

### CORS Configuration

The backend is configured to accept requests from domains specified in `CORS_ORIGIN`. For multiple domains, use comma-separated values:

```env
CORS_ORIGIN=https://app.example.com,https://staging.example.com
```

For local development, the backend allows:
- `http://localhost:3000`
- `http://localhost:5173`
- `http://localhost:8080`

## Error Handling

The API returns standard HTTP status codes:

- `200`: Success
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `500`: Internal Server Error

Error response format:
```json
{
  "error": {
    "message": "Error description",
    "details": {} // Optional, for validation errors
  }
}
```

## Development

### Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Run production server
- `npm run dev`: Run development server with hot reload
- `npm run type-check`: Type check without building

### Local Testing

1. Start the server: `npm run dev`
2. Test health endpoint: `curl http://localhost:3000/health`
3. Test courses endpoint: `curl http://localhost:3000/api/courses?major=컴퓨터공학`

## Security Notes

- ✅ All API keys are stored in environment variables
- ✅ CORS is configured to restrict origins
- ✅ Input validation using Zod schemas
- ✅ Error messages don't expose sensitive information
- ⚠️ Ensure `.env` is in `.gitignore` (already included)
- ⚠️ Never commit API keys to version control
=======
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate recommendations');
  }
  
  return response.json();
}

// Usage
const result = await generateRecommendations({
  user: {
    name: "John Doe",
    major: "Computer Science",
    studentYear: 2,
    grade: 3,
    semester: "Fall 2024"
  },
  targetCredits: 15,
  fixedLectures: [],
  blockedTimes: [],
  strategy: "MAJOR_FOCUS",
  tracks: [],
  interests: [],
  constraints: {
    keepLunchTime: true,
    avoidMorning: false,
    preferEmptyDay: true,
    maxConsecutiveClasses: 3,
    preferTeamProjects: false,
    preferOnlineClasses: false
  },
  freeTextRequest: ""
});
```

### Environment Variable in Frontend

Create `.env` file in your frontend project:

```env
REACT_APP_API_URL=https://your-service.onrender.com
```

Or for other frameworks:
```env
VITE_API_URL=https://your-service.onrender.com
NEXT_PUBLIC_API_URL=https://your-service.onrender.com
```

## Airtable Schema

Your Airtable table should have the following fields (field names are flexible and will be normalized):

- `course_id` or `Course ID` - Unique course identifier
- `name` or `Name` - Course name
- `credits` or `Credits` - Number of credits
- `department` or `Department` - Department name
- `major` or `Major` - Major field
- `track` or `Track` - Major track
- `tags` or `Tags` - Array of tags/keywords
- `meeting_times` or `Meeting Times` - Time string (e.g., "Mon 09:00-10:15, Wed 09:00-10:15")
- `restrictions` or `Restrictions` - Prerequisites/restrictions
- `description` or `Description` - Course description
- `instructor` or `Instructor` - Instructor name
- `online` or `Online` - Boolean for online classes
- `team_project` or `Team Project` - Boolean for team projects

### Meeting Times Format

The parser supports multiple formats:
- `"Mon 09:00-10:15, Wed 09:00-10:15"`
- `"Monday 9:00 AM - 10:15 AM"`
- `"MON 09:00-10:15"`

## Error Handling

The API returns structured error responses:

```json
{
  "error": "Error message",
  "requestId": "1234567890-abc123",
  "details": [] // Optional validation errors
}
```

## Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP
- **Headers**: `X-RateLimit-*` headers included in responses

## Logging

Structured logging with:
- Request IDs for tracing
- Timestamps
- Duration tracking
- Secret sanitization (API keys, tokens are redacted)

## Security

- ✅ No hardcoded secrets (all from environment variables)
- ✅ Input validation with Zod
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Secret sanitization in logs
- ✅ Error handling without leaking sensitive info
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625

## Troubleshooting

### Airtable Connection Issues

- Verify `AIRTABLE_TOKEN` and `AIRTABLE_BASE_ID` are correct
<<<<<<< HEAD
- Check that the table name matches `AIRTABLE_TABLE_NAME`
- Ensure your Airtable base has the required fields

### Gemini API Issues

- Verify `GEMINI_API_KEY` is valid
- Check API quota limits
- The service will continue to work even if Gemini fails (graceful degradation)

### CORS Errors

- Verify `CORS_ORIGIN` includes your frontend domain
- Check that the frontend is sending requests to the correct backend URL
- For local development, ensure you're using an allowed origin
=======
- Check table name matches `AIRTABLE_TABLE_NAME`
- Ensure API token has read access to the base

### Gemini API Issues

- If `GEMINI_API_KEY` is not set, the service will use fallback rule-based scoring
- Check API key validity and quota
- Review logs for parsing errors

### CORS Errors

- Set `FRONTEND_ORIGIN` to your exact frontend domain (no trailing slash)
- For development, use `http://localhost:PORT`
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625

## License

MIT
<<<<<<< HEAD

## Support

For issues or questions, please open an issue on GitHub.
=======
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
