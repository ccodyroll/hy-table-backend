import { z } from 'zod';
import { RecommendationRequest } from '../types';

export const recommendationRequestSchema = z.object({
  user: z.object({
    name: z.string().min(1),
    major: z.string().min(1),
    studentIdYear: z.number().int().min(2000).max(2100),
    grade: z.number().int().min(1).max(10),
    semester: z.number().int().min(1).max(2),
  }),
  targetCredits: z.number().int().min(10).max(20),
  fixedLectures: z.array(
    z.object({
      courseId: z.string(),
      meetingTimes: z.array(
        z.object({
          day: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']),
          startTime: z.string().regex(/^\d{2}:\d{2}$/),
          endTime: z.string().regex(/^\d{2}:\d{2}$/),
        })
      ),
    })
  ),
  blockedTimes: z.array(
    z.object({
      day: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })
  ),
  strategy: z.enum(['MAJOR_FOCUS', 'MIX', 'INTEREST_FOCUS']),
  tracks: z.array(z.string()),
  interests: z.array(z.string()),
  constraints: z.object({
    avoidDays: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])).optional(),
    preferOnlineOnlyDays: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])).optional(),
    avoidMorning: z.boolean().nullable().optional(),
    keepLunchTime: z.boolean().nullable().optional(),
    maxClassesPerDay: z.number().int().positive().nullable().optional(),
    maxConsecutiveClasses: z.number().int().positive().nullable().optional(),
    avoidTeamProjects: z.boolean().nullable().optional(),
    preferOnlineClasses: z.boolean().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
  freeTextRequest: z.string().optional(),
});

export function validateRecommendationRequest(data: unknown): RecommendationRequest {
  return recommendationRequestSchema.parse(data);
}
