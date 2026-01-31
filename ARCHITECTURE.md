# HY-Table Backend Architecture

## Overview

HY-Table Backend is a Node.js/Express/TypeScript backend service for generating university timetable recommendations. It integrates with Airtable for course data and Google Gemini AI for natural language processing.

## System Architecture

```
┌─────────────┐
│   Client    │
│ (Frontend)  │
└──────┬──────┘
       │ HTTP/REST
       ▼
┌─────────────────────────────────────┐
│         Express Server              │
│  ┌───────────────────────────────┐  │
│  │   Middleware Layer            │  │
│  │  - CORS                       │  │
│  │  - JSON Parser                │  │
│  │  - Error Handler              │  │
│  └───────────────┬───────────────┘  │
│                  ▼                   │
│  ┌───────────────────────────────┐  │
│  │      Route Handlers           │  │
│  │  - /health                    │  │
│  │  - /api/courses               │  │
│  │  - /api/recommend             │  │
│  │  - /api/parse-condition       │  │
│  └───────────────┬───────────────┘  │
│                  ▼                   │
│  ┌───────────────────────────────┐  │
│  │      Service Layer            │  │
│  │  - AirtableService            │  │
│  │  - GeminiService              │  │
│  │  - SchedulerService           │  │
│  └───────────────┬───────────────┘  │
│                  ▼                   │
│  ┌───────────────────────────────┐  │
│  │      Utility Layer            │  │
│  │  - timeParser                 │  │
│  │  - responseBuilder            │  │
│  │  - validation                 │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
       │                    │
       ▼                    ▼
┌─────────────┐    ┌─────────────┐
│  Airtable   │    │   Gemini    │
│   (API)     │    │     AI      │
└─────────────┘    └─────────────┘
```

## Request Flow

### 1. Health Check (`GET /health`, `GET /api/health`)

```
Client → Express → healthRouter → { ok: true }
```

### 2. Fetch Courses (`GET /api/courses`)

```
Client → Express → coursesRouter
                → AirtableService.getCourses()
                → Airtable API
                → Cache (if available)
                → { courses: [...], count: N }
```

### 3. Parse Conditions (`POST /api/parse-condition`)

```
Client → Express → parseConditionRouter
                → GeminiService.parseConstraints()
                → Gemini API (optional, fallback if unavailable)
                → { conditions: [...] }
```

### 4. Generate Recommendations (`POST /api/recommend`)

```
Client → Express → recommendRouter
                → Validate Request (Zod)
                → AirtableService.getCourses()
                → SchedulerService.generateCandidates()
                  ├─ filterValidCourses() [HARD constraints]
                  ├─ sortCoursesByPriority() [Strategy/Constraints]
                  ├─ backtrack() [Generate candidates]
                  └─ scoreCandidate() [SOFT constraints]
                → GeminiService.parseConstraints() [Optional]
                → responseBuilder.buildRecommendationResponse()
                → { recommendations: [...], debug: {...} }
```

## Core Components

### 1. Entry Point (`src/index.ts`)

- Server initialization
- Middleware setup (CORS, JSON parser, error handler)
- Route registration
- Server startup

**Key Responsibilities:**
- Load environment variables
- Configure Express app
- Register routes
- Start HTTP server

### 2. Routes (`src/routes/`)

#### `health.ts`
- Health check endpoint
- Returns `{ ok: true }`

#### `courses.ts`
- Fetch courses from Airtable
- Query parameters: `major`, `q` (search)
- Returns `{ courses: [...], count: N }`

#### `parseCondition.ts`
- Parse Korean natural language to structured constraints
- Uses Gemini AI (with fallback)
- Returns `{ conditions: [...] }`

#### `recommend.ts`
- Main timetable recommendation endpoint
- Validates request with Zod
- Orchestrates services to generate recommendations
- Returns `{ recommendations: [...], debug: {...} }` or `{ error: {...} }`

### 3. Services (`src/services/`)

#### `airtableService.ts`
- Fetches course data from Airtable
- Implements caching (5-minute TTL)
- Normalizes Airtable records to `Course` type
- Parses `요일_시간` field to `meetingTimes`

**Key Methods:**
- `getCourses(major?, query?)`: Fetch and filter courses
- `normalizeRecord(record)`: Convert Airtable record to Course

**Caching:**
- In-memory cache with 5-minute expiration
- Cache key: `all_courses`

#### `geminiService.ts`
- Integrates with Google Gemini AI
- Parses Korean natural language to structured constraints
- Graceful degradation if API key not set

**Key Methods:**
- `parseConstraints(freeText)`: Parse Korean text to UserConstraints
- `refineRecommendations()`: (Currently not used)

**Error Handling:**
- Returns `null` on failure (graceful degradation)
- Logs errors for debugging

#### `schedulerService.ts`
- Core timetable generation logic
- Backtracking algorithm for candidate generation
- Course filtering and scoring

**Key Methods:**
- `generateCandidates()`: Main entry point
- `filterValidCourses()`: Filter by HARD constraints
- `sortCoursesByPriority()`: Sort by strategy/constraints
- `backtrack()`: Generate candidate timetables
- `scoreCandidate()`: Score candidates by SOFT constraints
- `hasConflict()`: Check time slot overlaps

**Algorithm:**
1. Filter courses by HARD constraints (fixedLectures, blockedTimes, empty meetingTimes)
2. Sort courses by priority (strategy, constraints)
3. Backtrack to generate candidates (max 50)
4. Score all candidates
5. Sort by score (descending)

### 4. Middleware (`src/middleware/`)

#### `cors.ts`
- CORS configuration
- Supports multiple origins (comma-separated)
- Allows Figma iframe previews (`*.figma.site`)
- Development mode: allows all localhost origins

#### `errorHandler.ts`
- Centralized error handling
- Ensures all errors return valid JSON
- Format: `{ ok: false, error: { code, message, details? } }`
- 404 handler: `{ ok: false, error: { code: 'NOT_FOUND', message: '...' } }`

### 5. Utils (`src/utils/`)

#### `timeParser.ts`
- Parses time strings to `TimeSlot[]`
- Supports multiple formats:
  - Airtable: `"수(15:00-17:00)"`
  - Korean: `"월 09:00-10:30"`
  - English: `"MON 09:00-10:30"`
  - Multiple: `"월/수 09:00-10:30, 수 11:00-12:30"`

**Key Functions:**
- `parseMeetingTimes(str)`: Parse time string to TimeSlot[]
- `timeSlotsOverlap(slot1, slot2)`: Check if two time slots overlap
- `isMorningTime(time)`: Check if time is morning
- `overlapsLunchTime(slot)`: Check if slot overlaps lunch time

#### `responseBuilder.ts`
- Builds standardized API responses
- Formats recommendations for frontend
- Generates explanations and warnings
- Handles success/error responses

**Key Functions:**
- `buildRecommendationResponse()`: Main response builder
- `generateExplanation()`: Generate recommendation explanation
- `generateWarnings()`: Generate warnings for recommendations
- `generateFailureExplanation()`: Generate error response

#### `validation.ts`
- Validation utilities (currently minimal)

### 6. Types (`src/types/index.ts`)

- `Course`: Course data structure
- `TimeSlot`: Time slot structure
- `DayOfWeek`: Day enumeration
- `UserConstraints`: User preference constraints
- `TimetableCandidate`: Generated timetable candidate
- `FixedLecture`: Fixed lecture constraint
- `BlockedTime`: Blocked time constraint

## Data Flow

### Course Data Flow

```
Airtable API
    ↓
AirtableService.normalizeRecord()
    ↓
Course {
  courseId, name, credits, major,
  meetingTimes: TimeSlot[],
  deliveryType, tags, ...
}
    ↓
Cache (5 min TTL)
    ↓
Filter by major/query
    ↓
Return to route
```

### Recommendation Generation Flow

```
Request {
  user, targetCredits, fixedLectures,
  blockedTimes, constraints, freeTextRequest,
  strategy, tracks, interests
}
    ↓
Validate (Zod)
    ↓
Parse constraints (Gemini or fallback)
    ↓
Fetch courses (AirtableService)
    ↓
Filter valid courses (HARD constraints)
    ↓
Sort by priority (strategy/constraints)
    ↓
Backtrack to generate candidates
    ↓
Score candidates (SOFT constraints)
    ↓
Sort by score
    ↓
Build response (responseBuilder)
    ↓
Response {
  recommendations: [...],
  debug: {...}
}
```

## Key Design Decisions

### 1. HARD vs SOFT Constraints

- **HARD Constraints**: Filter courses (fixedLectures, blockedTimes, empty meetingTimes)
  - Applied in `filterValidCourses()`
  - Courses violating HARD constraints are excluded

- **SOFT Constraints**: Affect scoring only (avoidDays, avoidMorning, keepLunchTime, etc.)
  - Applied in `scoreCandidate()`
  - Candidates violating SOFT constraints get lower scores but are still included

### 2. Course Priority Sorting

- Courses are sorted before backtracking to ensure different conditions produce different timetables
- Sorting considers:
  - Strategy (MAJOR_FOCUS, INTEREST_FOCUS, MIX)
  - Constraints (preferOnlineClasses, avoidTeamProjects, etc.)
  - Credits (prefer higher credits to reach target faster)

### 3. Caching Strategy

- Airtable data cached in memory (5-minute TTL)
- Cache key: `all_courses`
- Cache invalidated after 5 minutes or on service restart

### 4. Error Handling

- All errors return valid JSON
- Centralized error handler ensures consistent format
- Graceful degradation for optional services (Gemini)

### 5. Time Parsing

- Supports multiple time formats for flexibility
- Airtable format: `"수(15:00-17:00)"`
- Korean format: `"월 09:00-10:30"`
- English format: `"MON 09:00-10:30"`
- Courses with empty `meetingTimes` are excluded

## Known Risks & Limitations

### 1. Time Parsing Ambiguity

**Risk**: Time format variations may not be parsed correctly

**Mitigation**:
- Supports multiple formats
- Logs parsing failures
- Excludes courses with empty `meetingTimes`

**Recommendation**: Add unit tests for edge cases

### 2. Time Overlap Detection

**Risk**: Edge cases in overlap detection (e.g., exact boundaries)

**Current Implementation**:
```typescript
return start1 < end2 && start2 < end1;
```

**Recommendation**: Add tests for boundary cases

### 3. Backtracking Performance

**Risk**: Exponential growth with many courses

**Mitigation**:
- Limits candidates to 50
- Filters courses before backtracking
- Sorts courses to prioritize relevant ones

**Recommendation**: Monitor performance with large course sets

### 4. Gemini API Reliability

**Risk**: API failures, timeouts, rate limits

**Current Implementation**:
- Returns `null` on failure (graceful degradation)
- No timeout/retry logic

**Recommendation**: Add timeout (5s), retry (1x), and fallback

### 5. JSON Parsing Errors

**Risk**: Invalid JSON from Gemini or malformed responses

**Current Implementation**:
- Try-catch around JSON.parse
- Returns `null` on failure

**Recommendation**: Add JSON validation before parsing

## Environment Variables

### Required
- `AIRTABLE_TOKEN`: Airtable API token
- `AIRTABLE_BASE_ID`: Airtable base ID
- `AIRTABLE_TABLE_NAME`: Table name (default: "Courses")

### Optional
- `GEMINI_API_KEY`: Google Gemini API key (fallback if not set)
- `GEMINI_MODEL`: Gemini model name (default: "gemini-2.5-flash")
- `CORS_ORIGIN`: Frontend origin(s), comma-separated
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

## Deployment

### Render.com

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Port**: Uses `process.env.PORT` (set by Render)

### Local Development

- **Dev Command**: `npm run dev` (hot reload)
- **Build Command**: `npm run build`
- **Start Command**: `npm start` (requires build)

## Testing Recommendations

### Unit Tests Needed

1. **Time Parsing** (`timeParser.ts`)
   - Test various time formats
   - Test edge cases (empty, invalid, boundary times)

2. **Time Overlap Detection** (`timeParser.ts`)
   - Test exact boundaries
   - Test overlapping ranges
   - Test non-overlapping ranges

3. **Course Filtering** (`schedulerService.ts`)
   - Test HARD constraint filtering
   - Test empty meetingTimes exclusion

4. **Recommendation Generation** (`schedulerService.ts`)
   - Test basic recommendation flow
   - Test with various constraints

5. **Error Handling** (`errorHandler.ts`)
   - Test JSON serialization errors
   - Test various error types

## Future Improvements

1. **Gemini API Resilience**
   - Add timeout (5s)
   - Add retry logic (1x)
   - Improve fallback handling

2. **Performance Optimization**
   - Optimize backtracking algorithm
   - Add course pre-filtering
   - Consider memoization

3. **Testing**
   - Add unit tests for core logic
   - Add integration tests for API endpoints
   - Add E2E tests for recommendation flow

4. **Monitoring**
   - Add request/response logging
   - Add performance metrics
   - Add error tracking

5. **API Response Standardization**
   - Standardize success responses: `{ ok: true, data: {...}, meta?: {...} }`
   - Standardize error responses: `{ ok: false, error: { code, message, details? } }`
   - Maintain backward compatibility during transition
