/**
 * Timetable recommendation endpoint
 */

import { Router, Request, Response } from 'express';
import { recommendRequestSchema, RecommendRequest } from '../schemas/request';
import { getSchedulerService } from '../services/scheduler';
import { getConstraintParserService } from '../services/constraintParser';
import { logger } from '../utils/logger';
import { generateRequestId } from '../utils/requestId';

const router = Router();

/**
 * Merge parsed Korean constraints with UI constraints
 * UI constraints always override parsed constraints
 */
function mergeConstraints(
  request: RecommendRequest,
  parsedConstraints: any
): RecommendRequest {
  if (!parsedConstraints) {
    return request;
  }

  // Create merged constraints object
  const merged = {
    ...request,
    constraints: {
      ...request.constraints,
      // UI values override parsed values
      avoidMorning: request.constraints.avoidMorning || parsedConstraints.avoidMorning || false,
      keepLunchTime: request.constraints.keepLunchTime || parsedConstraints.keepLunchTime || false,
      maxConsecutiveClasses: request.constraints.maxConsecutiveClasses || parsedConstraints.maxConsecutiveClasses || 10,
      preferTeamProjects: request.constraints.preferTeamProjects,
      preferOnlineClasses: request.constraints.preferOnlineClasses || parsedConstraints.preferOnlineClasses || false,
    },
    // Add parsed constraint fields to request
    parsedConstraints: {
      avoidDays: parsedConstraints.avoidDays || [],
      preferOnlineOnlyDays: parsedConstraints.preferOnlineOnlyDays || [],
      maxClassesPerDay: parsedConstraints.maxClassesPerDay,
      avoidTeamProjects: parsedConstraints.avoidTeamProjects,
      notes: parsedConstraints.notes
    }
  };

  return merged;
}

router.post('/', async (req: Request, res: Response) => {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // Validate request
    const validationResult = recommendRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      logger.warn('Invalid request body', { 
        requestId, 
        errors: validationResult.error.errors 
      });

      return res.status(400).json({
        error: 'Invalid request body',
        details: validationResult.error.errors,
        requestId
      });
    }

    const request: RecommendRequest = validationResult.data;
    
    // Attach requestId for logging
    (request as any).requestId = requestId;

    logger.info('Generating recommendations', { 
      requestId,
      user: request.user.name,
      targetCredits: request.targetCredits,
      strategy: request.strategy,
      hasFreeText: !!request.freeTextRequest
    });

    // Parse Korean constraints if provided
    let parsedConstraints = null;
    if (request.freeTextRequest && request.freeTextRequest.trim().length > 0) {
      try {
        const parserService = getConstraintParserService();
        parsedConstraints = await parserService.parseKoreanConstraints(
          request.freeTextRequest,
          request.constraints
        );
        
        if (parsedConstraints) {
          logger.info('Parsed Korean constraints', { 
            requestId,
            avoidDays: parsedConstraints.avoidDays,
            notes: parsedConstraints.notes 
          });
        }
      } catch (error) {
        logger.error('Error parsing Korean constraints, continuing with UI constraints only', error, { requestId });
      }
    }

    // Merge constraints (UI constraints override parsed constraints)
    const mergedRequest = mergeConstraints(request, parsedConstraints);

    // Generate recommendations
    const schedulerService = getSchedulerService();
    const result = await schedulerService.generateRecommendations(mergedRequest);

    const duration = Date.now() - startTime;
    logger.info('Recommendations generated', { 
      requestId, 
      count: result.recommendations.length,
      duration 
    });

    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error generating recommendations', error, { requestId, duration });

    res.status(500).json({
      error: 'Failed to generate recommendations',
      requestId
    });
  }
});

export default router;
