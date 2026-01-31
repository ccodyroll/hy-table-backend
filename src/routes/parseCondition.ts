import { Router, Request, Response } from 'express';
import geminiService from '../services/geminiService';
import { z } from 'zod';

const router = Router();

const parseConditionSchema = z.object({
  freeText: z.string().min(1, 'Free text is required'),
});

/**
 * POST /api/parse-condition
 * Parse Korean natural language constraints to structured format
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request
    const validationResult = parseConditionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json({
        error: {
          message: 'Invalid request data',
          details: validationResult.error.errors,
        },
      });
      return;
    }

    const { freeText } = validationResult.data;

    // Parse constraints using Gemini
    const parsedConstraints = await geminiService.parseConstraints(freeText);

    if (!parsedConstraints) {
      // If Gemini fails or is not available, return empty constraints
      res.json({
        constraints: {
          avoidDays: [],
          preferOnlineOnlyDays: [],
          avoidMorning: null,
          keepLunchTime: null,
          maxClassesPerDay: null,
          maxConsecutiveClasses: null,
          avoidTeamProjects: null,
          preferOnlineClasses: null,
          notes: null,
        },
        geminiUsed: false,
      });
      return;
    }

    // Return parsed constraints
    res.json({
      constraints: parsedConstraints,
      geminiUsed: true,
    });
  } catch (error: any) {
    console.error('Error parsing conditions:', error);
    res.status(500).json({
      error: {
        message: 'Failed to parse conditions',
      },
    });
  }
});

export default router;
