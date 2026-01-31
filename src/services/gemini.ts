/**
 * Gemini service for ranking and scoring timetable candidates
 * Includes fallback to rule-based scoring if Gemini fails
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { Course } from './airtable';
import { RecommendRequest } from '../schemas/request';

export interface TimetableCandidate {
  courses: Course[];
  totalCredits: number;
}

export interface ScoredTimetable extends TimetableCandidate {
  score: number;
  explanation: string;
  warnings: string[];
}

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private readonly modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-pro';

    if (apiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(apiKey);
        logger.info('Gemini service initialized', { model: this.modelName });
      } catch (error) {
        logger.error('Failed to initialize Gemini', error);
      }
    } else {
      logger.warn('GEMINI_API_KEY not set, will use fallback scoring');
    }
  }

  /**
   * Rule-based fallback scoring when Gemini is unavailable
   */
  private fallbackScoring(
    candidates: TimetableCandidate[],
    request: RecommendRequest
  ): ScoredTimetable[] {
    return candidates.map((candidate) => {
      let score = 50; // Base score
      const warnings: string[] = [];

      // Credit target alignment
      const creditDiff = Math.abs(candidate.totalCredits - request.targetCredits);
      score -= creditDiff * 2; // Penalize deviation from target

      // Strategy-based scoring
      if (request.strategy === 'MAJOR_FOCUS') {
        const majorCourses = candidate.courses.filter(c => 
          c.major === request.user.major || 
          c.department === request.user.major
        );
        score += (majorCourses.length / candidate.courses.length) * 30;
      } else if (request.strategy === 'INTEREST_FOCUS') {
        const interestMatches = candidate.courses.filter(c =>
          request.interests.some(interest =>
            c.name.toLowerCase().includes(interest.toLowerCase()) ||
            c.tags?.some(tag => tag.toLowerCase().includes(interest.toLowerCase()))
          )
        );
        score += (interestMatches.length / candidate.courses.length) * 30;
      } else if (request.strategy === 'MIX') {
        // Balance between major and interests
        const majorCourses = candidate.courses.filter(c => 
          c.major === request.user.major || 
          c.department === request.user.major
        );
        const interestMatches = candidate.courses.filter(c =>
          request.interests.some(interest =>
            c.name.toLowerCase().includes(interest.toLowerCase()) ||
            c.tags?.some(tag => tag.toLowerCase().includes(interest.toLowerCase()))
          )
        );
        // Balance between major and interest courses
        const majorRatio = candidate.courses.length > 0 ? majorCourses.length / candidate.courses.length : 0;
        const interestRatio = candidate.courses.length > 0 ? interestMatches.length / candidate.courses.length : 0;
        const balance = 1 - Math.abs(majorRatio - interestRatio);
        score += balance * 20;
      }

      // Track alignment
      if (request.tracks.length > 0) {
        const trackMatches = candidate.courses.filter(c =>
          request.tracks.some(track => c.track === track)
        );
        score += (trackMatches.length / candidate.courses.length) * 15;
      }

      // Constraint-based adjustments
      if (request.constraints.preferTeamProjects) {
        const teamProjects = candidate.courses.filter(c => c.teamProject);
        score += (teamProjects.length / candidate.courses.length) * 10;
      }

      if (request.constraints.preferOnlineClasses) {
        const onlineClasses = candidate.courses.filter(c => c.online);
        score += (onlineClasses.length / candidate.courses.length) * 10;
      }

      if (request.constraints.avoidMorning) {
        const morningClasses = candidate.courses.filter(c =>
          c.meetingTimes.some(t => {
            const [hours] = t.start.split(':').map(Number);
            return hours < 10;
          })
        );
        score -= (morningClasses.length / candidate.courses.length) * 15;
      }

      // Warnings
      if (creditDiff > 3) {
        warnings.push(`Total credits (${candidate.totalCredits}) differs significantly from target (${request.targetCredits})`);
      }

      if (candidate.courses.length === 0) {
        warnings.push('No courses selected');
        score = 0;
      }

      return {
        ...candidate,
        score: Math.max(0, Math.min(100, score)),
        explanation: `Rule-based scoring: ${request.strategy} strategy, ${candidate.totalCredits} credits, ${candidate.courses.length} courses`,
        warnings
      };
    });
  }

  /**
   * Score and rank timetable candidates using Gemini
   */
  async scoreCandidates(
    candidates: TimetableCandidate[],
    request: RecommendRequest
  ): Promise<ScoredTimetable[]> {
    if (!this.genAI || candidates.length === 0) {
      return this.fallbackScoring(candidates, request);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });

      // Build prompt with deterministic JSON schema
      const prompt = this.buildPrompt(candidates, request);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const parsed = this.parseGeminiResponse(text, candidates.length);

      if (parsed && parsed.length === candidates.length) {
        // Merge scores with candidate data
        const scored: ScoredTimetable[] = candidates.map((candidate, idx) => {
          const scoreData = parsed[idx] || { score: 50, explanation: 'No score provided', warnings: [] };
          return {
            ...candidate,
            score: scoreData.score,
            explanation: scoreData.explanation,
            warnings: scoreData.warnings
          };
        });

        logger.info('Successfully scored candidates with Gemini', { 
          count: scored.length 
        });
        return scored;
      } else {
        logger.warn('Failed to parse Gemini response, using fallback');
        return this.fallbackScoring(candidates, request);
      }
    } catch (error) {
      logger.error('Gemini scoring failed, using fallback', error);
      return this.fallbackScoring(candidates, request);
    }
  }

  /**
   * Build deterministic prompt for Gemini
   */
  private buildPrompt(
    candidates: TimetableCandidate[],
    request: RecommendRequest
  ): string {
    const candidatesStr = candidates.map((c, idx) => {
      const coursesStr = c.courses.map(course => 
        `- ${course.name} (${course.courseId}, ${course.credits} credits, ${course.meetingTimes.length} time slots)`
      ).join('\n');
      return `Candidate ${idx + 1}:\nTotal Credits: ${c.totalCredits}\nCourses:\n${coursesStr}`;
    }).join('\n\n');

    return `You are a university timetable advisor. Score and rank ${candidates.length} timetable candidates based on user preferences.

User Profile:
- Name: ${request.user.name}
- Major: ${request.user.major}
- Year: ${request.user.studentYear}
- Grade: ${request.user.grade}
- Semester: ${request.user.semester}

Preferences:
- Target Credits: ${request.targetCredits}
- Strategy: ${request.strategy}
- Tracks: ${request.tracks.join(', ') || 'None'}
- Interests: ${request.interests.join(', ') || 'None'}
- Constraints: ${JSON.stringify(request.constraints)}
- Additional Request: ${request.freeTextRequest || 'None'}

Candidates:
${candidatesStr}

Return a JSON array with exactly ${candidates.length} objects, each with:
{
  "rank": number (1-based index),
  "score": number (0-100),
  "explanation": "string (brief explanation of why this score)",
  "warnings": ["string"] (any issues or concerns)
}

Rank candidates from best (rank 1) to worst. Consider:
1. Alignment with target credits
2. Strategy adherence (${request.strategy})
3. Track and interest matches
4. Constraint satisfaction
5. Overall schedule quality

Return ONLY valid JSON, no markdown, no code blocks.`;
  }

  /**
   * Parse Gemini response with error handling
   */
  private parseGeminiResponse(
    text: string,
    expectedCount: number
  ): Array<{ score: number; explanation: string; warnings: string[] }> | null {
    try {
      // Remove markdown code blocks if present
      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleaned);
      
      if (!Array.isArray(parsed)) {
        logger.warn('Gemini response is not an array');
        return null;
      }

      // Extract score data (will be merged with candidates by caller)
      return parsed.slice(0, expectedCount).map((item: any) => ({
        score: typeof item.score === 'number' ? Math.max(0, Math.min(100, item.score)) : 50,
        explanation: typeof item.explanation === 'string' ? item.explanation : 'No explanation provided',
        warnings: Array.isArray(item.warnings) ? item.warnings : []
      }));
    } catch (error) {
      logger.error('Failed to parse Gemini JSON response', error, { text: text.substring(0, 200) });
      return null;
    }
  }
}

// Singleton instance
let geminiService: GeminiService | null = null;

export function getGeminiService(): GeminiService {
  if (!geminiService) {
    geminiService = new GeminiService();
  }
  return geminiService;
}
