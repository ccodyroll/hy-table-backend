import { Router, Request, Response } from 'express';
import { validateRecommendationRequest } from '../utils/validation';
import airtableService from '../services/airtableService';
import geminiService from '../services/geminiService';
import schedulerService from '../services/schedulerService';
import { RecommendationRequest, RecommendationResponse } from '../types';

const router = Router();

/**
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
  }
});

export default router;
