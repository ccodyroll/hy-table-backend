# Frontend Integration Guide

This guide provides code examples for integrating the HY-Table backend with your frontend application.

## Base URL Configuration

### Environment Variables

Create a `.env` file in your frontend project:

```env
REACT_APP_API_URL=https://your-service.onrender.com
```

Or for local development:

```env
REACT_APP_API_URL=http://localhost:3000
```

### JavaScript/TypeScript Config

```typescript
// config/api.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default API_BASE_URL;
```

## API Client Examples

### 1. Health Check

```typescript
async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    return data.ok === true;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}
```

### 2. Fetch Courses

```typescript
interface Course {
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

async function fetchCourses(
  major?: string,
  query?: string
): Promise<Course[]> {
  const params = new URLSearchParams();
  if (major) params.append('major', major);
  if (query) params.append('q', query);

  const response = await fetch(`${API_BASE_URL}/api/courses?${params}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch courses: ${response.statusText}`);
  }

  const data = await response.json();
  return data.courses;
}

// Usage
const courses = await fetchCourses('컴퓨터공학', '알고리즘');
```

### 3. Generate Recommendations

```typescript
interface RecommendationRequest {
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

interface Recommendation {
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

async function generateRecommendations(
  request: RecommendationRequest
): Promise<Recommendation[]> {
  const response = await fetch(`${API_BASE_URL}/api/recommend`, {
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

  const data = await response.json();
  return data.recommendations;
}

// Usage Example
const request: RecommendationRequest = {
  user: {
    name: '홍길동',
    major: '컴퓨터공학',
    studentIdYear: 2023,
    grade: 2,
    semester: 1,
  },
  targetCredits: 18,
  fixedLectures: [
    {
      courseId: 'CS101',
      meetingTimes: [
        {
          day: 'MON',
          startTime: '09:00',
          endTime: '10:30',
        },
      ],
    },
  ],
  blockedTimes: [
    {
      day: 'WED',
      startTime: '14:00',
      endTime: '16:00',
    },
  ],
  strategy: 'MAJOR_FOCUS',
  tracks: ['소프트웨어', '인공지능'],
  interests: ['머신러닝', '웹개발'],
  constraints: {
    avoidDays: ['FRI'],
    keepLunchTime: true,
    maxClassesPerDay: 4,
    preferOnlineClasses: false,
  },
  freeTextRequest: '월요일에는 수업이 없었으면 좋겠어요. 오전 9시 수업은 피하고 싶어요.',
};

const recommendations = await generateRecommendations(request);
console.log('Top recommendation:', recommendations[0]);
```

## React Hook Examples

### useCourses Hook

```typescript
import { useState, useEffect } from 'react';

function useCourses(major?: string, query?: string) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCourses() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCourses(major, query);
        setCourses(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load courses');
      } finally {
        setLoading(false);
      }
    }

    loadCourses();
  }, [major, query]);

  return { courses, loading, error };
}

// Usage in component
function CourseList() {
  const { courses, loading, error } = useCourses('컴퓨터공학');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {courses.map(course => (
        <li key={course.courseId}>{course.name}</li>
      ))}
    </ul>
  );
}
```

### useRecommendations Hook

```typescript
import { useState, useCallback } from 'react';

function useRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (request: RecommendationRequest) => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateRecommendations(request);
      setRecommendations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  return { recommendations, loading, error, generate };
}

// Usage in component
function TimetableGenerator() {
  const { recommendations, loading, error, generate } = useRecommendations();

  const handleGenerate = () => {
    generate({
      // ... request data
    });
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Timetable'}
      </button>
      {error && <div>Error: {error}</div>}
      {recommendations.map(rec => (
        <div key={rec.rank}>
          <h3>Option {rec.rank}</h3>
          <p>{rec.explanation}</p>
          <p>Credits: {rec.totalCredits}</p>
        </div>
      ))}
    </div>
  );
}
```

## Error Handling

```typescript
async function handleApiCall<T>(
  apiCall: () => Promise<T>
): Promise<{ data?: T; error?: string }> {
  try {
    const data = await apiCall();
    return { data };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: 'An unknown error occurred' };
  }
}

// Usage
const { data, error } = await handleApiCall(() => fetchCourses());
if (error) {
  // Show error to user
  console.error(error);
} else {
  // Use data
  console.log(data);
}
```

## CORS Configuration

The backend is configured to accept requests from specific origins. Make sure:

1. Your frontend domain is included in the `CORS_ORIGIN` environment variable
2. For local development, the backend allows:
   - `http://localhost:3000`
   - `http://localhost:5173`
   - `http://localhost:8080`

If you encounter CORS errors:

1. Check that your frontend URL matches the allowed origins
2. Verify the backend `CORS_ORIGIN` environment variable includes your domain
3. Ensure you're using the correct HTTP method (GET, POST)

## TypeScript Types

You can import or copy the TypeScript types from the backend:

```typescript
// types/api.ts
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface TimeSlot {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface Course {
  courseId: string;
  name: string;
  credits: number;
  major: string;
  category: string;
  tags: string[];
  meetingTimes: TimeSlot[];
  deliveryType: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  restrictions?: string[];
  instructor?: string;
  capacity?: number;
  enrolled?: number;
}

// ... (copy other types as needed)
```

## Testing the Integration

### 1. Test Health Endpoint

```bash
curl https://your-service.onrender.com/health
```

Expected response:
```json
{
  "ok": true,
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Test Courses Endpoint

```bash
curl "https://your-service.onrender.com/api/courses?major=컴퓨터공학"
```

### 3. Test Recommendations Endpoint

```bash
curl -X POST https://your-service.onrender.com/api/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "name": "Test User",
      "major": "컴퓨터공학",
      "studentIdYear": 2023,
      "grade": 2,
      "semester": 1
    },
    "targetCredits": 18,
    "fixedLectures": [],
    "blockedTimes": [],
    "strategy": "MIX",
    "tracks": [],
    "interests": [],
    "constraints": {},
    "freeTextRequest": ""
  }'
```

## Common Issues

### Issue: CORS Error

**Solution**: Verify your frontend domain is in the backend's `CORS_ORIGIN` environment variable.

### Issue: 400 Bad Request

**Solution**: Check that your request body matches the expected schema. Use the validation schema from the backend as reference.

### Issue: 500 Internal Server Error

**Solution**: 
- Check backend logs on Render
- Verify all environment variables are set correctly
- Ensure Airtable and Gemini API keys are valid

### Issue: Empty Recommendations

**Solution**:
- Check that courses exist in Airtable for the specified major
- Verify constraints aren't too restrictive
- Ensure target credits is achievable with available courses
