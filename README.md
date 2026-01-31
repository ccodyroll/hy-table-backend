# HY-Table Backend

Production-ready backend for HY-Table timetable scheduler service. Built with Node.js, TypeScript, Express, Airtable, and Google Gemini AI.

## Features

- 🎓 **Course Data Management**: Fetch and cache courses from Airtable
- 🤖 **AI-Powered Recommendations**: Use Google Gemini to rank and score timetable candidates
- 🇰🇷 **Korean Natural Language Parsing**: Convert Korean free-text requests into structured constraints
- ⚡ **Smart Scheduling**: Generate conflict-free timetables based on user preferences
- 🔒 **Production-Ready**: Rate limiting, input validation, structured logging, CORS support
- 📊 **Observability**: Health checks, request tracing, error handling

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Data Source**: Airtable
- **AI**: Google Gemini
- **Validation**: Zod
- **Hosting**: Render.com

## Project Structure

```
.
├── src/
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
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

## Local Development

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Create `.env` file** (for local development):
   ```env
   PORT=3000
   AIRTABLE_TOKEN=your_airtable_token
   AIRTABLE_BASE_ID=your_base_id
   AIRTABLE_TABLE_NAME=Courses
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-pro
   FRONTEND_ORIGIN=http://localhost:3001
   NODE_ENV=development
   ```

3. **Run in development mode**:
   ```bash
   npm run dev
   ```

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

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:

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
- `GEMINI_MODEL` - Gemini model name (default: "gemini-pro")
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
```

## Frontend Integration

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
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

## Troubleshooting

### Airtable Connection Issues

- Verify `AIRTABLE_TOKEN` and `AIRTABLE_BASE_ID` are correct
- Check table name matches `AIRTABLE_TABLE_NAME`
- Ensure API token has read access to the base

### Gemini API Issues

- If `GEMINI_API_KEY` is not set, the service will use fallback rule-based scoring
- Check API key validity and quota
- Review logs for parsing errors

### CORS Errors

- Set `FRONTEND_ORIGIN` to your exact frontend domain (no trailing slash)
- For development, use `http://localhost:PORT`

## License

MIT
