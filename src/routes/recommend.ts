import { Router, Request, Response } from 'express';
import airtableService from '../services/airtableService';
import geminiService from '../services/geminiService';
import schedulerService from '../services/schedulerService';
import { buildRecommendationResponse } from '../utils/responseBuilder';
import { z } from 'zod';
import { DayOfWeek, TimeSlot, BlockedTime } from '../types';
import { parseTimeRange, parseKoreanDay, isValidTimeFormat, isValidTimeRange, timeToMinutes } from '../utils/timeParser';

const router = Router();

// Frontend request schema
const recommendRequestSchema = z.object({
  user: z.object({
    name: z.string(),
    major: z.string(),
    studentIdYear: z.number(),
    grade: z.number(),
    semester: z.number(),
  }),
  targetCredits: z.union([z.number(), z.string()]), // 문자열도 허용 (예: "15~18")
  fixedLectures: z.array(z.object({
    name: z.string(),
    code: z.string(),
    credits: z.number(),
    day: z.number().min(0).max(5), // 0=월, 1=화, ..., 5=토
    startHour: z.number().min(0).max(13), // 0=09:00, 1=10:00, ..., 13=22:00
    duration: z.number(), // 30분 단위: 2=1시간, 3=1.5시간, 4=2시간
    professor: z.string().optional(),
  })).optional().default([]),
  blockedTimes: z.array(z.object({
    day: z.number().min(0).max(5), // 0=월, 1=화, ..., 5=토
    start: z.number().min(0).max(13), // 0=09:00, 1=10:00, ..., 13=22:00
    end: z.number().min(0).max(13), // 0=09:00, 1=10:00, ..., 13=22:00
    label: z.string().optional(),
  })).optional().default([]),
  constraints: z.record(z.union([z.string(), z.boolean()])).optional().default({}),
  freeTextRequest: z.string().optional(),
  // Backward compatibility
  basket: z.array(z.any()).optional().default([]),
  strategy: z.enum(['MAJOR_FOCUS', 'MIX', 'INTEREST_FOCUS']).optional().default('MIX'),
  tracks: z.array(z.string()).optional().default([]),
  interests: z.array(z.string()).optional().default([]),
});

/**
 * POST /api/recommend
 * Generate timetable recommendations
 * 
 * Request: { "basket": [...], "blockedTimes": [], "strategy": "MIX", ... }
 * Response: { "recommendations": [{ "courses": [...] }] }
 */
router.post('/', async (req: Request, res: Response) => {
  console.log('=== /api/recommend called ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Validate request
    const validationResult = recommendRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      console.error('=== VALIDATION FAILED ===');
      console.error('Validation errors:', JSON.stringify(validationResult.error.errors, null, 2));
      console.error('Request body received:', JSON.stringify(req.body, null, 2));
      
      res.status(400).json({
        error: {
          message: 'Invalid request data',
          details: validationResult.error.errors,
        },
      });
      return;
    }

    console.log('Validation passed');
    const requestData = validationResult.data;
    console.log('Parsed request data (first 500 chars):', JSON.stringify(requestData, null, 2).substring(0, 500));

    // Helper: Convert day number (0~5) to DayOfWeek
    const dayNumberToDayOfWeek = (dayNum: number): DayOfWeek => {
      const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      return days[dayNum] || 'MON';
    };

    // Helper: Convert startHour (0~13) to HH:mm format (0=09:00, 1=10:00, ..., 13=22:00)
    const startHourToTime = (startHour: number): string => {
      const hour = 9 + startHour; // 0=09:00, 1=10:00, ..., 13=22:00
      return `${hour.toString().padStart(2, '0')}:00`;
    };

    // Helper: Convert duration (30분 단위) to hours
    const durationToHours = (duration: number): number => {
      return duration / 2; // 2=1시간, 3=1.5시간, 4=2시간
    };

    // Convert fixedLectures format
    const fixedLectures = (requestData.fixedLectures || []).map(course => {
      const day = dayNumberToDayOfWeek(course.day);
      const startTime = startHourToTime(course.startHour);
      const durationHours = durationToHours(course.duration);
      const endHour = 9 + course.startHour + durationHours;
      const endTime = `${Math.floor(endHour).toString().padStart(2, '0')}:${((endHour % 1) * 60).toString().padStart(2, '0')}`;

      return {
        courseId: course.code,
        meetingTimes: [{
          day,
          startTime,
          endTime,
        }],
      };
    });

    // Backward compatibility: also check basket
    if (requestData.basket && requestData.basket.length > 0) {
      requestData.basket.forEach((course: any) => {
        let day: DayOfWeek;
        let startTime: string;
        let endTime: string;

        if (typeof course.day === 'number') {
          day = dayNumberToDayOfWeek(course.day);
          startTime = startHourToTime(course.startHour);
          const durationHours = durationToHours(course.duration);
          const endHour = 9 + course.startHour + durationHours;
          endTime = `${Math.floor(endHour).toString().padStart(2, '0')}:${((endHour % 1) * 60).toString().padStart(2, '0')}`;
        } else {
          day = parseKoreanDay(course.day) || 'MON';
          startTime = `${course.startHour.toString().padStart(2, '0')}:00`;
          const endHour = course.startHour + course.duration;
          endTime = `${endHour.toString().padStart(2, '0')}:00`;
        }

        fixedLectures.push({
          courseId: course.code,
          meetingTimes: [{
            day,
            startTime,
            endTime,
          }],
        });
      });
    }

    // Convert blockedTimes format
    const blockedTimes: BlockedTime[] = (requestData.blockedTimes || []).map((blocked: any) => {
      // New format: day, start, end are numbers (0~13)
      if (typeof blocked.day === 'number' && typeof blocked.start === 'number' && typeof blocked.end === 'number') {
        const day = dayNumberToDayOfWeek(blocked.day);
        const startTime = startHourToTime(blocked.start);
        const endTime = startHourToTime(blocked.end);

        return {
          day,
          startTime,
          endTime,
          label: blocked.label,
        };
      }

      // Backward compatibility: old format with strings
      let day: DayOfWeek;
      let startTime: string;
      let endTime: string;

      if (typeof blocked.day === 'string') {
        day = parseKoreanDay(blocked.day) || 'MON';
      } else {
        day = dayNumberToDayOfWeek(blocked.day);
      }

      if (blocked.startTime && blocked.endTime) {
        startTime = blocked.startTime;
        endTime = blocked.endTime;
      } else if (blocked.start !== undefined && blocked.end !== undefined) {
        if (typeof blocked.start === 'number' && typeof blocked.end === 'number') {
          startTime = startHourToTime(blocked.start);
          endTime = startHourToTime(blocked.end);
        } else {
          startTime = String(blocked.start);
          endTime = String(blocked.end);
        }
      } else if (blocked.startHour !== undefined && blocked.duration !== undefined) {
        startTime = startHourToTime(blocked.startHour);
        const durationHours = durationToHours(blocked.duration);
        const endHour = 9 + blocked.startHour + durationHours;
        endTime = `${Math.floor(endHour).toString().padStart(2, '0')}:${((endHour % 1) * 60).toString().padStart(2, '0')}`;
      } else {
        throw new Error(`Invalid blockedTimes format: missing start/end`);
      }

      return {
        day,
        startTime,
        endTime,
        label: blocked.label,
      };
    });

    // Convert constraints from frontend format to internal format
    const constraints: any = {};
    const hardConstraints: any = {}; // HARD 제약만 별도로 관리
    
    // Parse constraint values from frontend constraints object
    for (const [key, value] of Object.entries(requestData.constraints || {})) {
      // Skip false values
      if (value === false) {
        continue;
      }

      if (typeof value === 'string') {
        // Handle constraint types
        if (key === '시간 제약' || key === '공강 설정') {
          // Try to parse as JSON string first (frontend sends JSON stringified)
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object') {
              // Handle hard constraints - these should be treated as HARD (filtered)
              if (Array.isArray(parsed.hard)) {
                for (const item of parsed.hard) {
                  if (item.text) {
                    const text = item.text;
                    if (['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(text)) {
                      hardConstraints.avoidDays = [...(hardConstraints.avoidDays || []), text as DayOfWeek];
                    } else if (text === 'avoid_morning') {
                      hardConstraints.avoidMorning = true;
                    } else if (text === 'keep_lunch_time') {
                      hardConstraints.keepLunchTime = true;
                    }
                  }
                }
              }
              // Handle soft constraints - these should be treated as SOFT (scoring only)
              if (Array.isArray(parsed.soft)) {
                for (const item of parsed.soft) {
                  if (item.text) {
                    const text = item.text;
                    if (['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(text)) {
                      constraints.avoidDays = [...(constraints.avoidDays || []), text as DayOfWeek];
                    } else if (text === 'avoid_morning') {
                      constraints.avoidMorning = true;
                    } else if (text === 'keep_lunch_time') {
                      constraints.keepLunchTime = true;
                    } else if (text.startsWith('max_') && text.includes('_per_day')) {
                      const match = text.match(/max_(\d+)_per_day/);
                      if (match) {
                        constraints.maxClassesPerDay = parseInt(match[1], 10);
                      }
                    } else if (text.startsWith('max_') && text.includes('_consecutive')) {
                      const match = text.match(/max_(\d+)_consecutive/);
                      if (match) {
                        constraints.maxConsecutiveClasses = parseInt(match[1], 10);
                      }
                    }
                  }
                }
              }
              continue; // Already handled, skip to next constraint
            }
          } catch (e) {
            // Not JSON, continue with normal parsing
          }

          // Parse day-based constraints like "MON_WED_FRI" or "수요일 공강"
          if (value.includes('_') && ['MON', 'TUE', 'WED', 'THU', 'FRI'].some(d => value.includes(d))) {
            const days = value.split('_').filter(d => ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(d)) as DayOfWeek[];
            if (days.length > 0) {
              constraints.avoidDays = [...(constraints.avoidDays || []), ...days];
            }
          } else if (value === 'avoid_morning') {
            constraints.avoidMorning = true;
          } else if (value === 'keep_lunch_time') {
            constraints.keepLunchTime = true;
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
          } else if (value.startsWith('blocked_')) {
            // Blocked time constraints are already handled in blockedTimes
            // Skip here
          } else if (value.includes('공강') || value.includes('수업 없음')) {
            // Parse Korean day names from string like "수요일 공강"
            const dayMatch = value.match(/(월|화|수|목|금|토|일)요일/);
            if (dayMatch) {
              const day = parseKoreanDay(dayMatch[1] + '요일');
              if (day) {
                constraints.avoidDays = [...(constraints.avoidDays || []), day];
              }
            }
          }
        } else if (key === '수업 성향') {
          if (value === 'avoid_team_projects') {
            constraints.avoidTeamProjects = true;
          } else if (value === 'prefer_online') {
            constraints.preferOnlineClasses = true;
          }
        } else if (key === '목표학점 설정') {
          // Parse credit range like "15~18" or "15-18"
          const rangeMatch = String(value).match(/(\d+)\s*[~-]\s*(\d+)/);
          if (rangeMatch) {
            constraints.targetCreditsMin = parseInt(rangeMatch[1], 10);
            constraints.targetCreditsMax = parseInt(rangeMatch[2], 10);
          } else {
            const singleMatch = String(value).match(/(\d+)/);
            if (singleMatch) {
              const credits = parseInt(singleMatch[1], 10);
              constraints.targetCreditsMin = credits;
              constraints.targetCreditsMax = credits;
            }
          }
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

    // Fetch all available courses (no major filter)
    console.log('Fetching all courses (major filter disabled)');
    const allCourses = await airtableService.getCourses();
    console.log('Fetched courses:', allCourses.length);
    
    if (allCourses.length === 0) {
      console.warn('No courses found in Airtable');
      // Return error response
      res.status(400).json({
        error: 'HARD 제약 조건 충돌',
        details: {
          reason: 'Airtable에서 강의 데이터를 찾을 수 없습니다.',
          conflictingConstraints: ['강의 데이터 부재'],
          suggestions: [
            'Airtable에 강의 데이터가 있는지 확인해주세요',
            'Airtable 연결 설정을 확인해주세요',
            '관리자에게 문의해주세요'
          ]
        }
      });
      return;
    }

    // Parse targetCredits: support range like "15~18"
    let targetCredits: number;
    let targetCreditsMin: number;
    let targetCreditsMax: number;
    
    if (typeof requestData.targetCredits === 'string') {
      const rangeMatch = requestData.targetCredits.match(/(\d+)\s*[~-]\s*(\d+)/);
      if (rangeMatch) {
        targetCreditsMin = parseInt(rangeMatch[1], 10);
        targetCreditsMax = parseInt(rangeMatch[2], 10);
        targetCredits = targetCreditsMin; // Use minimum for backward compatibility
      } else {
        const singleValue = parseInt(requestData.targetCredits, 10) || 18;
        targetCredits = singleValue;
        targetCreditsMin = singleValue;
        targetCreditsMax = singleValue;
      }
    } else {
      targetCredits = requestData.targetCredits;
      targetCreditsMin = targetCredits;
      targetCreditsMax = targetCredits;
    }

    // Calculate fixed lectures credits
    const fixedCredits = fixedLectures.reduce((sum, fl) => {
      const course = allCourses.find(c => c.courseId === fl.courseId);
      return sum + (course?.credits || 0);
    }, 0);

    // If targetCredits is not provided, use default (18 - fixed credits)
    if (!targetCredits || targetCredits <= 0) {
      targetCredits = 18;
      targetCreditsMin = 18;
      targetCreditsMax = 18;
    }

    // targetCredits is the TOTAL target (including fixed lectures)
    // We need to calculate remaining credits needed
    const remainingTargetCredits = Math.max(0, targetCredits - fixedCredits);
    const remainingTargetCreditsMin = Math.max(0, targetCreditsMin - fixedCredits);
    const remainingTargetCreditsMax = Math.max(0, targetCreditsMax - fixedCredits);

    // Generate candidate timetables (with execution time tracking)
    console.log('=== Generating candidates ===');
    console.log('Available courses:', allCourses.length);
    console.log('Fixed lectures:', fixedLectures.length, `(${fixedCredits} credits)`);
    console.log('Blocked times:', blockedTimes.length);
    console.log('Target credits (total):', targetCredits, `(range: ${targetCreditsMin}-${targetCreditsMax})`);
    console.log('Target credits (remaining):', remainingTargetCredits, `(range: ${remainingTargetCreditsMin}-${remainingTargetCreditsMax})`);
    console.log('Parsed constraints:', JSON.stringify(parsedConstraints, null, 2));
    
    const startTime = Date.now();
    const result = schedulerService.generateCandidates(
      allCourses,
      fixedLectures,
      blockedTimes,
      targetCredits, // Pass total target for scoring
      remainingTargetCredits, // Pass remaining target for backtracking
      remainingTargetCreditsMin, // Pass min range
      remainingTargetCreditsMax, // Pass max range
      fixedCredits, // Pass fixed credits
      parsedConstraints,
      requestData.strategy,
      requestData.tracks,
      requestData.interests
    );
    const executionTime = Date.now() - startTime;
    
    console.log('=== Candidates generated ===');
    console.log('Total candidates:', result.candidates.length);
    console.log('Execution time:', executionTime, 'ms');

    // Build response using response builder
    const response = buildRecommendationResponse({
      requestBody: requestData,
      parsedConstraints,
      candidateTimetables: result.candidates,
      runMeta: {
        candidatesGenerated: result.debug?.candidatesGenerated || result.candidates.length,
        geminiUsed,
        executionTime,
      },
      targetCredits,
    });

    // 성공/실패에 따라 상태 코드 설정
    if ('error' in response) {
      res.status(400).json(response);
    } else {
      res.json(response);
    }
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
