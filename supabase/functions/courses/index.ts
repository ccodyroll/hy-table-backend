import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { DayOfWeek } from '../_shared/types.ts'
import { timeToMinutes } from '../_shared/timeParser.ts'
import airtableService from '../_shared/airtableService.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const major = url.searchParams.get('major') || undefined
    const query = url.searchParams.get('q') || undefined

    const courses = await airtableService.getCourses(major, query)

    // Convert to frontend format
    const coursesForFrontend = courses.map(course => {
      // Convert meetingTimes to timeslots format for frontend
      // Frontend expects: { day: "MON" | "TUE" | ..., startMin: number, endMin: number }
      const timeslots = course.meetingTimes
        .filter(timeSlot => {
          // Filter out SUN (일요일) if frontend doesn't support it
          // Keep only MON-SAT
          const validDays: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
          return validDays.includes(timeSlot.day)
        })
        .map(timeSlot => ({
          day: timeSlot.day as 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT',
          startMin: timeToMinutes(timeSlot.startTime),
          endMin: timeToMinutes(timeSlot.endTime),
        }))

      return {
        ...course,
        timeslots: timeslots, // Add timeslots field for frontend
        meetingTimes: course.meetingTimes.map(({ location, ...timeSlot }) => timeSlot), // Keep meetingTimes for backward compatibility
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
