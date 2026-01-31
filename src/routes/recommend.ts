import { Router, Request, Response } from 'express';
import airtableService from '../services/airtableService';
import geminiService from '../services/geminiService';
import schedulerService from '../services/schedulerService';
import { z } from 'zod';
import { DayOfWeek, TimeSlot, BlockedTime } from '../types';
import { parseTimeRange, parseKoreanDay, isValidTimeFormat, isValidTimeRange, timeToMinutes } from '../utils/timeParser';

const router = Router();

// Frontend request schema
const recommendRequestSchema = z.object({
  basket: z.array(z.object({
    title: z.string(),
    professor: z.string().optional(),
    code: z.string(),
    credits: z.number(),
    day: z.string(),
    startHour: z.number(),
    duration: z.number(),
  })).optional().default([]),
  blockedTimes: z.array(z.object({
    day: z.string(),
    start: z.string().optional(), // HH:MM format
    end: z.string().optional(), // HH:MM format
    startTime: z.string().optional(), // Alternative: HH:MM format
    endTime: z.string().optional(), // Alternative: HH:MM format
    startHour: z.number().optional(), // Alternative: hour number
    duration: z.number().optional(), // Alternative: duration in hours
    label: z.string().optional(), // Optional label (ignored by server)
  })).optional().default([]),
  strategy: z.enum(['MAJOR_FOCUS', 'MIX', 'INTEREST_FOCUS']).default('MIX'),
  tracks: z.array(z.string()).optional().default([]),
  interests: z.array(z.string()).optional().default([]),
  constraints: z.record(z.union([z.string(), z.boolean()])).optional().default({}),
  freeTextRequest: z.string().optional(),
  // Optional: for backward compatibility
  user: z.object({
    name: z.string(),
    major: z.string(),
    studentIdYear: z.number(),
    grade: z.number(),
    semester: z.number(),
  }).optional(),
  targetCredits: z.number().optional(),
});

/**
 * POST /api/recommend
 * Generate timetable recommendations
 * 
 * Request: { "basket": [...], "blockedTimes": [], "strategy": "MIX", ... }
 * Response: { "recommendations": [{ "courses": [...] }] }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request
    const validationResult = recommendRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json({
        error: {
          message: 'Invalid request data',
          details: validationResult.error.errors,
        },
      });
      return;
    }

    const requestData = validationResult.data;

    // Convert frontend basket to fixedLectures format
    const fixedLectures = requestData.basket.map(course => {
      const day = parseKoreanDay(course.day) || 'MON';
      const startTime = `${course.startHour.toString().padStart(2, '0')}:00`;
      const endHour = course.startHour + course.duration;
      const endTime = `${endHour.toString().padStart(2, '0')}:00`;

      return {
        courseId: course.code,
        meetingTimes: [{
          day: day as DayOfWeek,
          startTime,
          endTime,
        }],
      };
    });

    // Validate and convert blockedTimes format
    const blockedTimes: BlockedTime[] = [];
    const blockedTimesValidationErrors: Array<{ index: number; message: string }> = [];

    for (let i = 0; i < requestData.blockedTimes.length; i++) {
      const blocked = requestData.blockedTimes[i];
      let startTime: string;
      let endTime: string;
      
      // Try to get start/end from various formats
      if (blocked.start && blocked.end) {
        startTime = blocked.start;
        endTime = blocked.end;
      } else if (blocked.startTime && blocked.endTime) {
        startTime = blocked.startTime;
        endTime = blocked.endTime;
      } else if (blocked.startHour !== undefined && blocked.duration !== undefined) {
        startTime = `${blocked.startHour.toString().padStart(2, '0')}:00`;
        const endHour = blocked.startHour + blocked.duration;
        endTime = `${endHour.toString().padStart(2, '0')}:00`;
      } else {
        blockedTimesValidationErrors.push({
          index: i,
          message: 'Missing required fields: must provide (start, end) or (startTime, endTime) or (startHour, duration)',
        });
        continue;
      }

      // Validate time format (HH:MM)
      if (!isValidTimeFormat(startTime)) {
        blockedTimesValidationErrors.push({
          index: i,
          message: `Invalid start time format: "${startTime}". Expected HH:MM format (e.g., "18:00")`,
        });
        continue;
      }

      if (!isValidTimeFormat(endTime)) {
        blockedTimesValidationErrors.push({
          index: i,
          message: `Invalid end time format: "${endTime}". Expected HH:MM format (e.g., "21:00")`,
        });
        continue;
      }

      // Validate start < end
      if (!isValidTimeRange(startTime, endTime)) {
        blockedTimesValidationErrors.push({
          index: i,
          message: `Invalid time range: start time "${startTime}" must be before end time "${endTime}"`,
        });
        continue;
      }

      // Parse day
      const day = parseKoreanDay(blocked.day);
      if (!day) {
        blockedTimesValidationErrors.push({
          index: i,
          message: `Invalid day: "${blocked.day}". Expected one of: 월, 화, 수, 목, 금, 토, 일, MON, TUE, WED, THU, FRI, SAT, SUN`,
        });
        continue;
      }

      blockedTimes.push({
        day: day as DayOfWeek,
        startTime,
        endTime,
        label: blocked.label, // Optional, preserved but not used
      });
    }

    // If there are validation errors, return 400
    if (blockedTimesValidationErrors.length > 0) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid blockedTimes data',
        details: blockedTimesValidationErrors,
      });
      return;
    }

    // Convert constraints from frontend format to internal format
    const constraints: any = {};
    
    // Parse constraint values
    for (const [key, value] of Object.entries(requestData.constraints || {})) {
      if (typeof value === 'string') {
        // Handle string values like "MON_WED_FRI", "avoid_morning", etc.
        if (value.includes('_') && ['MON', 'TUE', 'WED', 'THU', 'FRI'].some(d => value.includes(d))) {
          // Day-based constraint
          const days = value.split('_').filter(d => ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(d)) as DayOfWeek[];
          if (days.length > 0) {
            if (key.includes('avoid') || value.startsWith('MON') || value.startsWith('TUE') || value.startsWith('WED') || value.startsWith('THU') || value.startsWith('FRI')) {
              constraints.avoidDays = [...(constraints.avoidDays || []), ...days];
            }
          }
        } else if (value === 'avoid_morning') {
          constraints.avoidMorning = true;
        } else if (value === 'keep_lunch_time') {
          constraints.keepLunchTime = true;
        } else if (value === 'avoid_team_projects') {
          constraints.avoidTeamProjects = true;
        } else if (value === 'prefer_online') {
          constraints.preferOnlineClasses = true;
        } else if (value.startsWith('max_') && value.includes('_per_day')) {
          const match = value.match(/max_(\d+)_per_day/);
          if (match) {
            constraints.maxClassesPerDay = parseInt(match[1], 10);
          }
        } else if (value.startsWith('max_') && value.includes('_consecutive')) {
          const match = value.match(/max_(\d+)_consecutive/);
          if (match) {
            constraints.maxConsecutiveClasses = parseInt(match[1], 10);
          }
        }
      } else if (typeof value === 'boolean') {
        // Handle boolean constraints
        if (key.includes('avoidMorning') || key.includes('morning')) {
          constraints.avoidMorning = value;
        } else if (key.includes('lunch') || key.includes('Lunch')) {
          constraints.keepLunchTime = value;
        } else if (key.includes('team') || key.includes('Team')) {
          constraints.avoidTeamProjects = value;
        } else if (key.includes('online') || key.includes('Online')) {
          constraints.preferOnlineClasses = value;
        }
      }
    }

    // Parse free text constraints using Gemini
    let parsedConstraints = { ...constraints };
    let geminiUsed = false;

    if (requestData.freeTextRequest && requestData.freeTextRequest.trim()) {
      const geminiConstraints = await geminiService.parseConstraints(requestData.freeTextRequest);
      if (geminiConstraints) {
        geminiUsed = true;
        // Merge Gemini constraints with UI constraints
        parsedConstraints = {
          ...geminiConstraints,
          ...constraints,
          avoidDays: [
            ...(constraints.avoidDays || []),
            ...(geminiConstraints.avoidDays || []),
          ].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i),
        };
      }
    }

    // Get user major from request or use default
    const userMajor = requestData.user?.major || '컴퓨터공학';
    
    // Fetch available courses
    const allCourses = await airtableService.getCourses(userMajor);

    // Calculate target credits from basket or use default
    const basketCredits = requestData.basket.reduce((sum, course) => sum + course.credits, 0);
    const targetCredits = requestData.targetCredits || (18 - basketCredits);

    // Generate candidate timetables
    const result = schedulerService.generateCandidates(
      allCourses,
      fixedLectures,
      blockedTimes,
      targetCredits,
      parsedConstraints,
      requestData.strategy,
      requestData.tracks,
      requestData.interests
    );

    // Extract candidates and debug info
    const candidates = result.candidates;
    const debugInfo = result.debug || {};

    // Take top candidates (limit to 3 for frontend)
    const topCandidates = candidates.slice(0, 3);

    // Convert to frontend format
    const recommendations = topCandidates.map((candidate) => {
      // Convert courses to frontend format
      const courses = candidate.courses.map(course => {
        // Get first meeting time for display
        const firstMeeting = course.meetingTimes[0];
        const startHour = parseInt(firstMeeting.startTime.split(':')[0], 10);
        const endHour = parseInt(firstMeeting.endTime.split(':')[0], 10);
        const duration = endHour - startHour;

        const dayLabels: Record<DayOfWeek, string> = {
          'MON': '월',
          'TUE': '화',
          'WED': '수',
          'THU': '목',
          'FRI': '금',
          'SAT': '토',
          'SUN': '일',
        };

        return {
          title: course.name,
          professor: course.instructor || '',
          code: course.courseId,
          credits: course.credits,
          day: dayLabels[firstMeeting.day] || firstMeeting.day,
          startHour,
          duration,
        };
      });

      return {
        courses,
      };
    });

    // Build response with debug info
    const response: any = {
      recommendations,
    };

    // Add debug information
    if (debugInfo.candidatesGenerated !== undefined || debugInfo.geminiUsed !== undefined || blockedTimes.length > 0) {
      response.debug = {
        candidatesGenerated: debugInfo.candidatesGenerated || candidates.length,
        geminiUsed: geminiUsed,
        blockedTimesApplied: blockedTimes.length > 0,
        blockedTimesCount: blockedTimes.length,
        combinationsFilteredByBlockedTimes: debugInfo.combinationsFilteredByBlockedTimes || 0,
      };
    }

    res.json(response);
  } catch (error: any) {
    console.error('Error generating recommendations:', error);

    res.status(500).json({
      error: {
        message: 'Failed to generate recommendations',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    });
  }
});

export default router;
