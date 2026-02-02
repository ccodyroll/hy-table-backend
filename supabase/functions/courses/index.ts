import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { DayOfWeek } from '../_shared/types.ts'
import { timeToMinutes } from '../_shared/timeParser.ts'

// Note: AirtableService needs to be implemented using Deno-compatible Airtable API
// For now, this is a placeholder structure

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const major = url.searchParams.get('major') || undefined
    const query = url.searchParams.get('q') || undefined

    // TODO: Implement AirtableService for Deno
    // For now, return empty array
    // const airtableService = new AirtableService()
    // const courses = await airtableService.getCourses(major, query)

    const courses: any[] = [] // Placeholder

    // Convert to frontend format
    const coursesForFrontend = courses.map(course => {
      const timeslots = course.meetingTimes
        .filter((timeSlot: any) => {
          const validDays: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
          return validDays.includes(timeSlot.day)
        })
        .map((timeSlot: any) => ({
          day: timeSlot.day as 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT',
          startMin: timeToMinutes(timeSlot.startTime),
          endMin: timeToMinutes(timeSlot.endTime),
        }))

      return {
        ...course,
        timeslots: timeslots,
        meetingTimes: course.meetingTimes.map(({ location, ...timeSlot }: any) => timeSlot),
      }
    })

    return new Response(
      JSON.stringify({
        courses: coursesForFrontend,
        count: coursesForFrontend.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error fetching courses:', error)
    return new Response(
      JSON.stringify({
        error: {
          message: 'Failed to fetch courses',
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
