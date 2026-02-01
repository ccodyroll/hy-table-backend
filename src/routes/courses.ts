import { Router, Request, Response } from 'express';
import airtableService from '../services/airtableService';
import { DayOfWeek } from '../types';
import { timeToMinutes } from '../utils/timeParser';

const router = Router();

/**
 * GET /api/courses
 * Query params: major, q (search query)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const major = req.query.major as string | undefined;
    const query = req.query.q as string | undefined;

    const courses = await airtableService.getCourses(major, query);

    // Convert to frontend format
    const coursesForFrontend = courses.map(course => {
      // Convert meetingTimes to timeslots format for frontend
      // Frontend expects: { day: "MON" | "TUE" | ..., startMin: number, endMin: number }
      const timeslots = course.meetingTimes
        .filter(timeSlot => {
          // Filter out SUN (일요일) if frontend doesn't support it
          // Keep only MON-SAT
          const validDays: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          return validDays.includes(timeSlot.day);
        })
        .map(timeSlot => ({
          day: timeSlot.day as 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT',
          startMin: timeToMinutes(timeSlot.startTime),
          endMin: timeToMinutes(timeSlot.endTime),
        }));

      return {
        ...course,
        timeslots: timeslots, // Add timeslots field for frontend
        meetingTimes: course.meetingTimes.map(({ location, ...timeSlot }) => timeSlot), // Keep meetingTimes for backward compatibility
      };
    });

    res.json({
      courses: coursesForFrontend,
      count: coursesForFrontend.length,
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch courses',
      },
    });
  }
});

export default router;
