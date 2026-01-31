# HY-Table Backend

Production-ready backend for HY-Table timetable scheduler service. Built with Node.js, TypeScript, Express, Airtable, and Google Gemini AI.

## Features

- 🎓 **Course Data Management**: Fetch and cache courses from Airtable
- 🤖 **AI-Powered Recommendations**: Use Google Gemini to rank and score timetable candidates
- 🇰🇷 **Korean Natural Language Parsing**: Convert Korean free-text requests into structured constraints
- ⚡ **Smart Scheduling**: Generate conflict-free timetables based on user preferences
- 🔒 **Production-Ready**: Input validation, error handling, CORS support
- 📊 **Observability**: Health checks, request logging, error handling

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
│   ├── index.ts                 # Server entry point
│   ├── routes/                  # API route handlers
│   │   ├── health.ts            # Health check endpoint
│   │   ├── courses.ts           # Course data endpoint
│   │   ├── recommend.ts        # Timetable recommendation endpoint
│   │   └── parseCondition.ts   # Natural language parsing endpoint
│   ├── services/                # Business logic services
│   │   ├── airtableService.ts   # Airtable integration with caching
│   │   ├── geminiService.ts     # Gemini AI service
│   │   └── schedulerService.ts  # Timetable generation logic
│   ├── middleware/              # Express middleware
│   │   ├── cors.ts              # CORS configuration
│   │   └── errorHandler.ts      # Error handling middleware
│   ├── types/                   # TypeScript type definitions
│   │   └── index.ts
│   ├── schemas/                 # (Reserved for Zod schemas)
│   └── utils/                   # Utility functions
│       ├── timeParser.ts        # Time parsing and overlap detection
│       ├── responseBuilder.ts   # Response formatting
│       └── validation.ts        # Validation utilities
├── package.json
├── tsconfig.json
├── Procfile                     # Render deployment config
├── render.yaml                  # Render service configuration
├── .gitignore
└── README.md
```

## Local Development

### Prerequisites

- Node.js 18+ installed
- npm or yarn
- Airtable account with API token
- Google Gemini API key (optional, fallback scoring available)

### Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd HY-Table
   npm install
   ```

2. **Create `.env` file** (for local development):
   ```env
   PORT=3000
   NODE_ENV=development
   AIRTABLE_TOKEN=your_airtable_token
   AIRTABLE_BASE_ID=your_base_id
   AIRTABLE_TABLE_NAME=Courses
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   CORS_ORIGIN=http://localhost:3001,http://localhost:5173
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
4. Configure the service

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
- `CORS_ORIGIN` - Frontend origin for CORS (comma-separated for multiple origins)
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
  "ok": true
}
```

### GET /api/health

Alternative health check endpoint.

**Response**:
```json
{
  "ok": true
}
```

### GET /api/courses

Fetch courses from Airtable.

**Query Parameters**:
- `major` (optional): Filter by major
- `q` (optional): Search query

**Example**:
```bash
GET /api/courses?major=컴퓨터공학&q=알고리즘
```

**Response**:
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
      "instructor": "김교수"
    }
  ],
  "count": 1
}
```

### POST /api/parse-condition

Parse Korean natural language constraints to structured format.

**Request Body**:
```json
{
  "input": "월요일에는 수업이 없었으면 좋겠어요. 오전 9시 수업은 피하고 싶어요.",
  "currentConditions": []
}
```

**Response**:
```json
{
  "conditions": [
    {
      "type": "공강 설정",
      "label": "월요일 공강",
      "value": "avoidDays_MON"
    },
    {
      "type": "시간 제약",
      "label": "오전 수업 피하기",
      "value": "avoidMorning_true"
    }
  ]
}
```

### POST /api/recommend

Generate timetable recommendations.

**Request Body**:
```json
{
  "user": {
    "name": "홍길동",
    "major": "컴퓨터공학",
    "studentIdYear": 25,
    "grade": 2,
    "semester": 1
  },
  "targetCredits": 15,
  "fixedLectures": [
    {
      "name": "데이터베이스",
      "code": "CSE2003",
      "credits": 3,
      "day": 0,
      "startHour": 2,
      "duration": 2,
      "professor": "김교수"
    }
  ],
  "blockedTimes": [
    {
      "day": 2,
      "start": 0,
      "end": 13,
      "label": "수요일 공강"
    }
  ],
  "constraints": {
    "학업 목표": false,
    "시간 제약": false,
    "선호 과목": false,
    "수업 성향": false,
    "공강 설정": "수요일 공강",
    "목표학점 설정": "15~18",
    "강의담기": false,
    "장바구니": false
  },
  "freeTextRequest": "월요일에는 수업이 없었으면 좋겠어요. 오전 9시 수업은 피하고 싶어요.",
  "strategy": "MAJOR_FOCUS",
  "tracks": ["소프트웨어", "인공지능"],
  "interests": ["머신러닝", "웹개발"]
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

**Response**:
```json
{
  "recommendations": [
    {
      "rank": 1,
      "totalCredits": 15,
      "score": 145,
      "explanation": "목표 학점(15학점)을 달성했습니다. 균형잡힌 시간표입니다.",
      "warnings": [],
      "courses": [
        {
          "id": "CSE2001",
          "name": "데이터베이스",
          "code": "CSE2001",
          "credits": 3,
          "professor": "김교수",
          "type": "OFFLINE",
          "day": 0,
          "startHour": 9,
          "duration": 2,
          "color": "#FFB3BA"
        }
      ]
    }
  ],
  "debug": {
    "candidatesGenerated": 50,
    "geminiUsed": true,
    "executionTime": 2
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
- `요일_시간` / `meetingTimes` / `Meeting Times` / `시간`: Meeting time string (e.g., "수(15:00-17:00)" or "월 09:00-10:30, 수 11:00-12:30")
- `deliveryType` / `Delivery Type` / `수업방식`: ONLINE, OFFLINE, or HYBRID
- `restrictions` / `Restrictions` / `제한사항`: Array or comma-separated restrictions
- `instructor` / `Instructor` / `교수`: Instructor name

**Meeting Time Format**:
- Airtable format: `"수(15:00-17:00)"`
- Single day: `"월 09:00-10:30"`
- Multiple days: `"월/수 09:00-10:30"`
- Multiple time slots: `"월 09:00-10:30, 수 11:00-12:30"`

## Frontend Integration

### CORS Configuration

The backend supports CORS. Set `CORS_ORIGIN` environment variable to your frontend domain:

```env
CORS_ORIGIN=https://your-frontend.com
```

For multiple origins, use comma-separated values:
```env
CORS_ORIGIN=https://app.example.com,https://staging.example.com
```

For local development, the backend allows:
- `http://localhost:3000`
- `http://localhost:5173`
- `http://localhost:8080`
- Any `https://*.figma.site` domain (for Figma iframe previews)

### Example Frontend Code

#### Fetch Courses

```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-service.onrender.com';

async function fetchCourses(major?: string, query?: string) {
  const params = new URLSearchParams();
  if (major) params.append('major', major);
  if (query) params.append('q', query);
  
  const url = `${API_BASE_URL}/api/courses?${params.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch courses');
  }
  
  const data = await response.json();
  return data.courses;
}
```

#### Generate Recommendations

```typescript
async function generateRecommendations(request: RecommendRequest) {
  const url = `${API_BASE_URL}/api/recommend`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate recommendations');
  }
  
  return response.json();
}
```

## Error Handling

The API returns structured error responses:

```json
{
  "error": {
    "message": "Error description",
    "details": [] // Optional validation errors
  }
}
```

**HTTP Status Codes**:
- `200`: Success
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `500`: Internal Server Error

## Development

### Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Run production server (requires build first)
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

## Troubleshooting

### Airtable Connection Issues

- Verify `AIRTABLE_TOKEN` and `AIRTABLE_BASE_ID` are correct
- Check table name matches `AIRTABLE_TABLE_NAME`
- Ensure API token has read access to the base
- Verify `요일_시간` field exists and contains valid time data

### Gemini API Issues

- If `GEMINI_API_KEY` is not set, the service will use fallback rule-based scoring
- Check API key validity and quota
- Review logs for parsing errors
- The service will continue to work even if Gemini fails (graceful degradation)

### CORS Errors

- Set `CORS_ORIGIN` to your exact frontend domain (no trailing slash)
- For multiple origins, use comma-separated values
- For development, use `http://localhost:PORT`
- Check that the frontend is sending requests to the correct backend URL

### Time Parsing Issues

- Ensure `요일_시간` field format is correct: `"수(15:00-17:00)"` or `"월 09:00-10:30"`
- Courses with empty `요일_시간` are excluded from timetable generation
- Check logs for parsing warnings: `[WARNING] Failed to parse meetingTimes`

## License

MIT
