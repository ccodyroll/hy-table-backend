/**
 * Zod schemas for request validation
 */

import { z } from 'zod';

const dayOfWeekSchema = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);

const timeSlotSchema = z.object({
  day: dayOfWeekSchema,
  start: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
  end: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format')
});

const fixedLectureSchema = z.object({
  courseId: z.string().min(1),
  meetingTimes: z.array(timeSlotSchema).min(1)
});

const userSchema = z.object({
  name: z.string().min(1),
  major: z.string().min(1),
  studentYear: z.number().int().min(1).max(10),
  grade: z.number().int().min(1).max(10),
  semester: z.string().min(1)
});

const constraintsSchema = z.object({
  keepLunchTime: z.boolean(),
  avoidMorning: z.boolean(),
  preferEmptyDay: z.boolean(),
  maxConsecutiveClasses: z.number().int().min(1).max(10),
  preferTeamProjects: z.boolean(),
  preferOnlineClasses: z.boolean()
});

export const recommendRequestSchema = z.object({
  user: userSchema,
  targetCredits: z.number().int().min(1).max(30),
  fixedLectures: z.array(fixedLectureSchema).default([]),
  blockedTimes: z.array(timeSlotSchema).default([]),
  strategy: z.enum(['MAJOR_FOCUS', 'MIX', 'INTEREST_FOCUS']),
  tracks: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  constraints: constraintsSchema,
  freeTextRequest: z.string().default('')
});

export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
export type User = z.infer<typeof userSchema>;
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type FixedLecture = z.infer<typeof fixedLectureSchema>;
export type Constraints = z.infer<typeof constraintsSchema>;
