# Supabase Edge Functions Quick Start

## What's Been Created

✅ **Directory Structure:**
```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── cors.ts          # CORS headers
│   │   ├── types.ts         # TypeScript types
│   │   └── timeParser.ts    # Time parsing utilities
│   ├── health/
│   │   └── index.ts         # Health check endpoint
│   └── courses/
│       └── index.ts         # Courses endpoint (placeholder)
├── config.toml              # Edge Functions configuration
└── (recommend and parse-condition to be added)
```

✅ **Documentation:**
- `SUPABASE_MIGRATION.md` - Complete migration guide

## Next Steps

### 1. ✅ AirtableService Implementation - COMPLETE

The `courses/index.ts` and `_shared/airtableService.ts` are now complete and ready to use!

### 2. Convert Remaining Services

Convert these services to Deno format:
- `geminiService.ts` → Use `@google/generative-ai` Deno-compatible version
- `schedulerService.ts` → Convert to Deno (mostly TypeScript, should work)

### 3. Create Remaining Edge Functions

- `supabase/functions/recommend/index.ts`
- `supabase/functions/parse-condition/index.ts`

### 4. Deploy

**First, install Supabase CLI:**

**Windows (Scoop):**
```powershell
# Install Scoop if you don't have it
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# Add Supabase bucket
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git

# Install Supabase CLI
scoop install supabase
```

**macOS (Homebrew):**
```bash
brew install supabase/tap/supabase
```

**Or use npx (no installation needed):**
```bash
# Use npx to run commands without installing
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy health
```

**Then deploy:**
```bash
# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets (in Supabase Dashboard)
# Dashboard → Edge Functions → Secrets

# Deploy
supabase functions deploy health
supabase functions deploy courses
supabase functions deploy recommend
supabase functions deploy parse-condition
```

## Current Status

- ✅ Basic structure created
- ✅ Health endpoint ready
- ✅ Courses endpoint **COMPLETE** (AirtableService implemented)
- ✅ AirtableService for Deno (using REST API)
- ⏳ Recommend endpoint (to be created)
- ⏳ Parse-condition endpoint (to be created)
- ⏳ GeminiService (to be converted)
- ⏳ SchedulerService (to be converted)

## Important Notes

1. **Airtable Package**: The npm `airtable` package doesn't work in Deno. You must use Airtable REST API directly.

2. **Environment Variables**: Set as Supabase Secrets, not `.env` file.

3. **API URLs**: Frontend will need to update URLs to:
   ```
   https://your-project.supabase.co/functions/v1/{endpoint}
   ```

4. **Authorization**: All requests need `Authorization: Bearer {SUPABASE_ANON_KEY}` header.

## Getting Help

See `SUPABASE_MIGRATION.md` for detailed instructions on:
- AirtableService implementation
- Converting services to Deno
- Testing and deployment
- Troubleshooting
