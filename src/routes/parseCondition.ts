import { Router, Request, Response } from 'express';
import geminiService from '../services/geminiService';
import { z } from 'zod';

const router = Router();

const parseConditionSchema = z.object({
  input: z.string().min(1, 'Input is required'),
  currentConditions: z.array(z.object({
    id: z.string().optional(),
    type: z.string(),
    label: z.string(),
    value: z.union([z.string(), z.boolean(), z.number()]),
  })).optional().default([]),
});

/**
 * POST /api/parse-condition
 * Parse Korean natural language constraints to structured format
 * 
 * Route: POST /api/parse-condition (exact match with frontend)
 * 
 * Request: { "input": "...", "currentConditions": [...] }
 * Response: { "conditions": [{ "type": "...", "label": "...", "value": "..." }] }
 */
router.post('/', async (req: Request, res: Response) => {
  console.log('=== /api/parse-condition called ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Validate request
    const validationResult = parseConditionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.errors);
      res.status(400).json({
        error: {
          message: 'Invalid request data',
          details: validationResult.error.errors,
        },
      });
      return;
    }

    const { input, currentConditions } = validationResult.data;
    console.log('Validated input:', input);
    console.log('Current conditions:', JSON.stringify(currentConditions, null, 2));

    if (!input || input.trim().length === 0) {
      console.warn('Input is empty');
      res.status(400).json({
        error: {
          message: 'Input cannot be empty',
        },
      });
      return;
    }

    // Parse constraints using Gemini
    console.log('Calling geminiService.parseConstraints with input:', input.trim());
    const parsedConstraints = await geminiService.parseConstraints(input.trim());
    console.log('Parsed constraints result:', parsedConstraints ? JSON.stringify(parsedConstraints, null, 2) : 'null');

    if (!parsedConstraints) {
      // If Gemini fails or is not available, return empty conditions
      console.warn('Gemini returned null - returning empty conditions');
      res.json({
        conditions: [],
      });
      return;
    }

    // Convert parsed constraints to frontend format
    const conditions: Array<{ type: string; label: string; value: string | boolean }> = [];

    // Avoid days
    if (parsedConstraints.avoidDays && parsedConstraints.avoidDays.length > 0) {
      const dayLabels: Record<string, string> = {
        'MON': '월요일',
        'TUE': '화요일',
        'WED': '수요일',
        'THU': '목요일',
        'FRI': '금요일',
        'SAT': '토요일',
        'SUN': '일요일',
      };
      const dayNames = parsedConstraints.avoidDays.map(d => dayLabels[d] || d).join(', ');
      conditions.push({
        type: '시간 제약',
        label: `${dayNames} 수업 없음`,
        value: parsedConstraints.avoidDays.join('_'),
      });
    }

    // Avoid morning
    if (parsedConstraints.avoidMorning === true) {
      conditions.push({
        type: '시간 제약',
        label: '오전 수업 피하기',
        value: 'avoid_morning',
      });
    }

    // Keep lunch time
    if (parsedConstraints.keepLunchTime === true) {
      conditions.push({
        type: '시간 제약',
        label: '점심시간 비우기',
        value: 'keep_lunch_time',
      });
    }

    // Max classes per day
    if (parsedConstraints.maxClassesPerDay !== null && parsedConstraints.maxClassesPerDay !== undefined) {
      conditions.push({
        type: '시간 제약',
        label: `하루 ${parsedConstraints.maxClassesPerDay}개 이하`,
        value: `max_${parsedConstraints.maxClassesPerDay}_per_day`,
      });
    }

    // Max consecutive classes
    if (parsedConstraints.maxConsecutiveClasses !== null && parsedConstraints.maxConsecutiveClasses !== undefined) {
      conditions.push({
        type: '시간 제약',
        label: `연속 수업 ${parsedConstraints.maxConsecutiveClasses}개 이하`,
        value: `max_${parsedConstraints.maxConsecutiveClasses}_consecutive`,
      });
    }

    // Avoid team projects
    if (parsedConstraints.avoidTeamProjects === true) {
      conditions.push({
        type: '수업 성향',
        label: '팀플 적은 과목',
        value: 'avoid_team_projects',
      });
    }

    // Prefer online classes
    if (parsedConstraints.preferOnlineClasses === true) {
      conditions.push({
        type: '수업 성향',
        label: '온라인 수업 선호',
        value: 'prefer_online',
      });
    }

    // Prefer online only days
    if (parsedConstraints.preferOnlineOnlyDays && parsedConstraints.preferOnlineOnlyDays.length > 0) {
      const dayLabels: Record<string, string> = {
        'MON': '월요일',
        'TUE': '화요일',
        'WED': '수요일',
        'THU': '목요일',
        'FRI': '금요일',
      };
      const dayNames = parsedConstraints.preferOnlineOnlyDays.map(d => dayLabels[d] || d).join(', ');
      conditions.push({
        type: '시간 제약',
        label: `${dayNames} 온라인만`,
        value: `online_only_${parsedConstraints.preferOnlineOnlyDays.join('_')}`,
      });
    }

    // Return conditions in frontend format
    console.log('Returning conditions:', JSON.stringify(conditions, null, 2));
    res.json({
      conditions,
    });
  } catch (error: any) {
    console.error('=== ERROR in /api/parse-condition ===');
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Error details:', error);
    res.status(500).json({
      error: {
        message: 'Failed to parse conditions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    });
  }
});

export default router;
