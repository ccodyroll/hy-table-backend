# HY-Table Backend

Production-ready backend for an AI-powered university timetable scheduler. Built with Node.js, Express, TypeScript, Airtable, and Google Gemini AI.

## Features

- 🎓 **Course Data Management**: Fetches and caches course data from Airtable
- 🤖 **AI-Powered Recommendations**: Uses Google Gemini for natural language processing and timetable refinement
- ⚡ **Smart Scheduling**: Backtracking algorithm with collision detection and constraint satisfaction
- 🌐 **RESTful API**: Clean, well-documented endpoints
- 🔒 **Production Ready**: Environment-based configuration, error handling, CORS support

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Data Source**: Airtable
- **AI Engine**: Google Gemini
- **Validation**: Zod

## Project Structure

```
.
├── src/
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
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

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
   ```bash
   npm install
   ```

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
   GEMINI_MODEL=gemini-pro
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
   ```bash
   npm run dev
   ```

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

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
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
GEMINI_MODEL=gemini-pro
```

### Step 4: Deploy

1. Click "Create Web Service"
2. Render will automatically build and deploy
3. Your service will be available at `https://your-service.onrender.com`

### Step 5: Verify

```bash
curl https://your-service.onrender.com/health
```

## Frontend Integration

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
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

## Troubleshooting

### Airtable Connection Issues

- Verify `AIRTABLE_TOKEN` and `AIRTABLE_BASE_ID` are correct
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

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
