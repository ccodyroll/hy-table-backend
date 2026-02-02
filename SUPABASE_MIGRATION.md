# Supabase Edge Functions Migration Guide

This guide will help you migrate from Render.com Express server to Supabase Edge Functions.

## Overview

**Current Setup:**
- Express.js server on Render.com
- Node.js runtime
- Sleep issues on free plan

**New Setup:**
- Supabase Edge Functions
- Deno runtime
- No sleep issues

## Prerequisites

1. Supabase account (free tier is sufficient)
2. Supabase CLI installed
3. Frontend project with Supabase already set up

## Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

Or using other package managers:
```bash
# Homebrew (macOS)
brew install supabase/tap/supabase

# Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

## Step 2: Link to Supabase Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

Get your project ref from: Supabase Dashboard → Project Settings → General → Reference ID

## Step 3: Set Environment Variables (Secrets)

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

Add the following secrets:

```
AIRTABLE_TOKEN=your_airtable_token
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_TABLE_NAME=Courses
AIRTABLE_TABLE_ID=tbl8Mza7Z65g7Pton
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
```

## Step 4: Implement AirtableService for Deno

The current `airtableService.ts` uses the npm `airtable` package which doesn't work in Deno. You need to implement it using Airtable REST API directly.

### Option A: Use Airtable REST API (Recommended)

Create `supabase/functions/_shared/airtableService.ts`:

```typescript
import { Course, AirtableRecord } from './types.ts'
import { parseMeetingTimes } from './timeParser.ts'

interface CacheEntry {
  data: Course[]
  timestamp: number
}

class AirtableService {
  private cache: CacheEntry | null = null
  private cachePromise: Promise<Course[]> | null = null
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly baseId: string
  private readonly token: string

  constructor() {
    this.token = Deno.env.get('AIRTABLE_TOKEN') || ''
    this.baseId = Deno.env.get('AIRTABLE_BASE_ID') || ''

    if (!this.token || !this.baseId) {
      throw new Error('AIRTABLE_TOKEN and AIRTABLE_BASE_ID must be set')
    }
  }

  async getCourses(major?: string, query?: string): Promise<Course[]> {
    // Check cache
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.filterCourses(this.cache.data, major, query)
    }

    // Wait for ongoing fetch
    if (this.cachePromise) {
      const courses = await this.cachePromise
      return this.filterCourses(courses, major, query)
    }

    // Start new fetch
    this.cachePromise = this.fetchFromAirtable()

    try {
      const courses = await this.cachePromise
      this.cache = { data: courses, timestamp: Date.now() }
      return this.filterCourses(courses, major, query)
    } catch (error) {
      console.error('Error fetching from Airtable:', error)
      return []
    } finally {
      this.cachePromise = null
    }
  }

  private async fetchFromAirtable(): Promise<Course[]> {
    const tableId = Deno.env.get('AIRTABLE_TABLE_ID') || 'tbl8Mza7Z65g7Pton'
    const url = `https://api.airtable.com/v0/${this.baseId}/${tableId}`
    
    const records: AirtableRecord[] = []
    let offset: string | undefined

    do {
      const params = new URLSearchParams()
      if (offset) params.set('offset', offset)

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.statusText}`)
      }

      const data = await response.json()
      records.push(...data.records)
      offset = data.offset
    } while (offset)

    return records.map(record => this.normalizeRecord(record))
  }

  private filterCourses(courses: Course[], major?: string, query?: string): Course[] {
    let filtered = courses

    if (major) {
      const majorLower = major.toLowerCase()
      filtered = filtered.filter(c => {
        const courseMajor = (c.major || '').toLowerCase()
        return courseMajor === majorLower || 
               courseMajor.includes(majorLower) || 
               majorLower.includes(courseMajor)
      })
    }

    if (query) {
      const lowerQuery = query.toLowerCase()
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(lowerQuery) ||
        c.courseId.toLowerCase().includes(lowerQuery) ||
        c.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      )
    }

    return filtered
  }

  private normalizeRecord(record: AirtableRecord): Course {
    // Same normalization logic as Express version
    // Copy from src/services/airtableService.ts normalizeRecord method
    const fields = record.fields

    const courseName = fields['fldxBRALu8pnBwGvn'] || fields.course_name || record.id
    const courseId = fields['fldnrkAKox1BAjAp1'] || fields.id || record.id
    const instructor = fields['fldyYL2fEvg61cTZY'] || fields.professor || undefined
    const category = fields['fldkXofStJWCLRFpL'] || fields.classification || ''
    const credits = Number(fields['fldtXa5UzuOayoKS1'] || fields.credit || 0)
    const capacity = fields['fldGifKoI5xDcvCP1'] || fields.capacity
    const capacityNum = capacity ? Number(capacity) : undefined
    const lectureType = fields['fldv3ZYOBW2kKqh10'] || fields.lecture_type || '오프라인'

    let deliveryType: 'ONLINE' | 'OFFLINE' | 'HYBRID' = 'OFFLINE'
    const lectureTypeStr = lectureType.toString().toLowerCase()
    if (lectureTypeStr.includes('온라인') || lectureTypeStr === 'online') {
      deliveryType = 'ONLINE'
    } else if (lectureTypeStr.includes('혼합') || lectureTypeStr.includes('blended') || lectureTypeStr === 'hybrid') {
      deliveryType = 'HYBRID'
    }

    let meetingTimeValue: any = fields['fld7XicgiX9cukCAu'] || fields.schedule_text || ''
    let meetingTimeStr = ''
    if (Array.isArray(meetingTimeValue)) {
      meetingTimeStr = meetingTimeValue.join('; ')
    } else if (typeof meetingTimeValue === 'string') {
      meetingTimeStr = meetingTimeValue
    }

    const meetingTimes = parseMeetingTimes(meetingTimeStr)

    const interestCategories = fields['fldVAPyjkCSXv6D65'] || fields.interest_categories || []
    const aiTags = fields['fldkv2NYfExqtJ5hW'] || fields.ai_tags || []
    
    let tags: string[] = []
    if (Array.isArray(interestCategories)) {
      tags = [...interestCategories]
    } else if (typeof interestCategories === 'string') {
      tags = interestCategories.split(',').map((t: string) => t.trim()).filter(Boolean)
    }

    if (Array.isArray(aiTags)) {
      tags = [...tags, ...aiTags]
    } else if (typeof aiTags === 'string') {
      const aiTagsArray = aiTags.split(',').map((t: string) => t.trim()).filter(Boolean)
      tags = [...tags, ...aiTagsArray]
    }

    let restrictions: string[] = []
    const restrictionsValue = fields['fldYU6iYuGyEu6dWY'] || fields.restrictions
    if (Array.isArray(restrictionsValue)) {
      restrictions = restrictionsValue
    } else if (typeof restrictionsValue === 'string') {
      restrictions = restrictionsValue.split(',').map((r: string) => r.trim()).filter(Boolean)
    }

    const area = fields['fldKu4Pa3e5zDUo3f'] || fields.Area || ''
    const major = area || category || ''

    return {
      courseId: courseId.toString(),
      name: courseName.toString(),
      credits,
      major,
      category: category.toString(),
      tags,
      meetingTimes,
      schedule_text: meetingTimeStr || undefined,
      deliveryType,
      restrictions,
      instructor,
      capacity: capacityNum,
      enrolled: undefined,
    }
  }
}

export default new AirtableService()
```

## Step 5: Deploy Edge Functions

```bash
# Deploy each function
supabase functions deploy health
supabase functions deploy courses
supabase functions deploy recommend
supabase functions deploy parse-condition
```

## Step 6: Update Frontend API URLs

Update your frontend code to use Supabase Edge Functions:

```typescript
// Before (Render)
const API_URL = 'https://hy-table-backend-hmjm.onrender.com'

// After (Supabase)
const SUPABASE_URL = 'https://your-project.supabase.co'
const API_URL = `${SUPABASE_URL}/functions/v1`

// Example usage
const response = await fetch(`${API_URL}/courses?major=컴퓨터공학`, {
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  },
})
```

## Step 7: Test

```bash
# Test health endpoint
curl https://your-project.supabase.co/functions/v1/health \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test courses endpoint
curl "https://your-project.supabase.co/functions/v1/courses?q=경영" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## API Endpoints

After migration, your endpoints will be:

- Health: `https://your-project.supabase.co/functions/v1/health`
- Courses: `https://your-project.supabase.co/functions/v1/courses`
- Recommend: `https://your-project.supabase.co/functions/v1/recommend`
- Parse Condition: `https://your-project.supabase.co/functions/v1/parse-condition`

## Troubleshooting

### Error: Function not found
- Make sure you deployed the function: `supabase functions deploy <function-name>`

### Error: Unauthorized
- Check that you're including the Authorization header with your Supabase anon key

### Error: AIRTABLE_TOKEN not set
- Verify secrets are set in Supabase Dashboard → Edge Functions → Secrets

### Local Development

```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve courses --env-file .env.local
```

## Next Steps

1. Complete AirtableService implementation (see Step 4)
2. Convert other services (GeminiService, SchedulerService) to Deno format
3. Convert recommend and parse-condition routes to Edge Functions
4. Test all endpoints
5. Update frontend to use new URLs
6. Decommission Render.com service

## Notes

- Edge Functions have a 60-second timeout limit
- Make sure `/api/recommend` completes within 60 seconds
- Consider optimizing if it takes longer
