# Project Structure

Complete file tree for HY-Table Backend:

```
HY-Table_MVP_ver2/
├── .gitignore                    # Git ignore rules
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── README.md                     # Main documentation
├── DEPLOYMENT.md                 # Deployment guide
├── PROJECT_STRUCTURE.md          # This file
│
└── src/                          # Source code
    ├── index.ts                  # Main server entry point
    │
    ├── routes/                   # Express route handlers
    │   ├── health.ts             # GET /health endpoint
    │   ├── courses.ts            # GET /api/courses endpoint
    │   └── recommend.ts          # POST /api/recommend endpoint
    │
    ├── services/                 # Business logic services
    │   ├── airtable.ts           # Airtable integration with caching
    │   ├── gemini.ts             # Gemini AI scoring service
    │   ├── constraintParser.ts   # Korean natural language constraint parser
    │   └── scheduler.ts          # Timetable generation logic
    │
    ├── schemas/                  # Validation schemas
    │   └── request.ts            # Zod schemas for request validation
    │
    └── utils/                    # Utility functions
        ├── logger.ts             # Structured logging utility
        ├── requestId.ts          # Request ID generation
        └── time.ts               # Time parsing and overlap detection
```

## File Descriptions

### Root Files

- **`.gitignore`**: Excludes `node_modules/`, `dist/`, `.env`, and other build/IDE files
- **`package.json`**: Defines dependencies, scripts, and project metadata
- **`tsconfig.json`**: TypeScript compiler configuration
- **`README.md`**: Complete API documentation and usage guide
- **`DEPLOYMENT.md`**: Step-by-step deployment instructions for Render.com

### Source Files

#### `src/index.ts`
- Express server setup
- CORS configuration
- Rate limiting middleware
- Request logging
- Route registration
- Error handling

#### Routes

**`src/routes/health.ts`**
- Health check endpoint
- Returns service status and version

**`src/routes/courses.ts`**
- Fetches courses from Airtable
- Supports filtering by major and search query
- Returns normalized course data

**`src/routes/recommend.ts`**
- Validates recommendation request
- Calls scheduler service
- Returns ranked timetable recommendations

#### Services

**`src/services/airtable.ts`**
- Airtable API integration
- In-memory caching (5 min TTL)
- Course data normalization
- Field mapping from Airtable to internal schema

**`src/services/gemini.ts`**
- Google Gemini AI integration
- Candidate scoring and ranking
- Fallback rule-based scoring
- JSON response parsing with error handling

**`src/services/constraintParser.ts`**
- Korean natural language constraint parsing
- Converts Korean free-text to structured constraints
- Uses Gemini with low temperature for deterministic output
- Robust JSON parsing with validation
- Fallback handling if parsing fails

**`src/services/scheduler.ts`**
- Timetable candidate generation
- Time conflict detection
- Course filtering based on constraints
- Greedy + backtracking algorithms
- Constraint validation

#### Schemas

**`src/schemas/request.ts`**
- Zod validation schemas
- Type definitions for requests
- Input validation for `/api/recommend` endpoint

#### Utils

**`src/utils/logger.ts`**
- Structured logging with request IDs
- Secret sanitization
- Log levels (info, error, warn, debug)

**`src/utils/requestId.ts`**
- Unique request ID generation
- Used for request tracing

**`src/utils/time.ts`**
- Time string parsing (multiple formats)
- Time slot overlap detection
- Conflict checking utilities

## Build Output

When built, TypeScript compiles to:

```
dist/
├── index.js
├── routes/
│   ├── health.js
│   ├── courses.js
│   └── recommend.js
├── services/
│   ├── airtable.js
│   ├── gemini.js
│   ├── constraintParser.js
│   └── scheduler.js
├── schemas/
│   └── request.js
└── utils/
    ├── logger.js
    ├── requestId.js
    └── time.js
```

## Environment Variables

Required (set in Render):
- `AIRTABLE_TOKEN`
- `AIRTABLE_BASE_ID`

Optional:
- `AIRTABLE_TABLE_NAME` (default: "Courses")
- `GEMINI_API_KEY` (fallback scoring if not set)
- `GEMINI_MODEL` (default: "gemini-pro")
- `FRONTEND_ORIGIN` (CORS origin, default: "*")
- `PORT` (auto-set by Render)
- `NODE_ENV` (default: "production" on Render)

## Dependencies

### Production
- `express` - Web framework
- `cors` - CORS middleware
- `express-rate-limit` - Rate limiting
- `zod` - Schema validation
- `airtable` - Airtable SDK
- `@google/generative-ai` - Gemini AI SDK
- `dotenv` - Environment variable loading

### Development
- `typescript` - TypeScript compiler
- `tsx` - TypeScript execution
- `@types/*` - Type definitions
