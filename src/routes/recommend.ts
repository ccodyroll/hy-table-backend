<<<<<<< HEAD
import { Router, Request, Response } from 'express';
import { validateRecommendationRequest } from '../utils/validation';
import airtableService from '../services/airtableService';
import geminiService from '../services/geminiService';
import schedulerService from '../services/schedulerService';
import { RecommendationRequest, RecommendationResponse } from '../types';
=======
/**
 * Timetable recommendation endpoint
 */

import { Router, Request, Response } from 'express';
import { recommendRequestSchema, RecommendRequest } from '../schemas/request';
import { getSchedulerService } from '../services/scheduler';
import { getConstraintParserService } from '../services/constraintParser';
import { logger } from '../utils/logger';
import { generateRequestId } from '../utils/requestId';
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625

const router = Router();

/**
<<<<<<< HEAD
 * POST /api/recommend
 * Generate timetable recommendations
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request
    const requestData = validateRecommendationRequest(req.body) as RecommendationRequest;

    // Parse free text constraints using Gemini
    let parsedConstraints = { ...requestData.constraints };
    let geminiUsed = false;

    if (requestData.freeTextRequest && requestData.freeTextRequest.trim()) {
      const geminiConstraints = await geminiService.parseConstraints(requestData.freeTextRequest);
      if (geminiConstraints) {
        geminiUsed = true;
        // Merge Gemini constraints with UI constraints (UI overrides Gemini for non-array fields)
        parsedConstraints = {
          // Start with Gemini constraints
          ...geminiConstraints,
          // Override with UI constraints (UI takes precedence)
          ...requestData.constraints,
          // Array fields: merge and deduplicate (UI values take precedence in ordering)
          avoidDays: [
            ...(requestData.constraints.avoidDays || []),
            ...(geminiConstraints.avoidDays || []),
          ].filter((v, i, a) => a.indexOf(v) === i),
          preferOnlineOnlyDays: [
            ...(requestData.constraints.preferOnlineOnlyDays || []),
            ...(geminiConstraints.preferOnlineOnlyDays || []),
          ].filter((v, i, a) => a.indexOf(v) === i),
        };
      }
    }

    // Fetch available courses
    const allCourses = await airtableService.getCourses(requestData.user.major);

    // Generate candidate timetables
    const candidates = schedulerService.generateCandidates(
      allCourses,
      requestData.fixedLectures,
      requestData.blockedTimes,
      requestData.targetCredits,
      parsedConstraints,
      requestData.strategy,
      requestData.tracks,
      requestData.interests
    );

    // Take top candidates
    const topCandidates = candidates.slice(0, 10);

    // Try to refine with Gemini (optional, fails gracefully)
    let refinedRankings: Array<{ rank: number; explanation: string }> | null = null;
    if (topCandidates.length > 0) {
      refinedRankings = await geminiService.refineRecommendations(
        topCandidates,
        requestData.freeTextRequest || ''
      );
    }

    // Build response
    const recommendations = topCandidates.map((candidate, index) => {
      const rank = index + 1;
      let explanation = `총 ${candidate.totalCredits}학점, ${candidate.courses.length}개 과목으로 구성된 시간표입니다.`;
      
      // Use Gemini explanation if available
      if (refinedRankings) {
        const refined = refinedRankings.find(r => r.rank === rank);
        if (refined) {
          explanation = refined.explanation;
        }
      }

      return {
        rank,
        totalCredits: candidate.totalCredits,
        score: candidate.score,
        explanation,
        warnings: candidate.warnings,
        courses: candidate.courses,
        timetableGrid: candidate.timetableGrid,
      };
    });

    const response: RecommendationResponse = {
      recommendations,
      debug: {
        candidatesGenerated: candidates.length,
        geminiUsed,
      },
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error generating recommendations:', error);

    if (error.name === 'ZodError') {
      res.status(400).json({
        error: {
          message: 'Invalid request data',
          details: error.errors,
        },
      });
    } else {
      res.status(500).json({
        error: {
          message: 'Failed to generate recommendations',
        },
      });
    }
=======
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

      res.status(400).json({
        error: 'Invalid request body',
        details: validationResult.error.errors,
        requestId
      });
      return;
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
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
  }
});

export default router;
