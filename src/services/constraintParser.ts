/**
 * Korean natural language constraint parser using Gemini
 * Converts Korean free-text requests into structured constraint objects
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { Constraints } from '../schemas/request';

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface ParsedConstraints {
  avoidDays: DayOfWeek[];
  preferOnlineOnlyDays: DayOfWeek[];
  avoidMorning: boolean | null;
  keepLunchTime: boolean | null;
  maxClassesPerDay: number | null;
  maxConsecutiveClasses: number | null;
  avoidTeamProjects: boolean | null;
  preferOnlineClasses: boolean | null;
  notes: string | null;
}

class ConstraintParserService {
  private genAI: GoogleGenerativeAI | null = null;
  private readonly modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-pro';

    if (apiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(apiKey);
        logger.info('Constraint parser service initialized', { model: this.modelName });
      } catch (error) {
        logger.error('Failed to initialize Gemini for constraint parser', error);
      }
    } else {
      logger.warn('GEMINI_API_KEY not set, constraint parsing will be skipped');
    }
  }

  /**
   * Parse Korean natural language into structured constraints
   */
  async parseKoreanConstraints(
    koreanText: string,
    existingConstraints: Constraints
  ): Promise<ParsedConstraints | null> {
    if (!this.genAI || !koreanText || koreanText.trim().length === 0) {
      return null;
    }

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.modelName,
        generationConfig: {
          temperature: 0.1, // Low temperature for deterministic output
          topP: 0.8,
        }
      });

      const prompt = this.buildPrompt(koreanText, existingConstraints);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const parsed = this.parseResponse(text);
      
      if (parsed) {
        logger.info('Successfully parsed Korean constraints', { 
          avoidDays: parsed.avoidDays.length,
          notes: parsed.notes 
        });
        return parsed;
      } else {
        logger.warn('Failed to parse Gemini response for constraints');
        return null;
      }
    } catch (error) {
      logger.error('Error parsing Korean constraints', error);
      return null;
    }
  }

  /**
   * Build deterministic prompt for constraint parsing
   */
  private buildPrompt(koreanText: string, existingConstraints: Constraints): string {
    return `You are a Korean language constraint parser for a university timetable scheduler.

Your task is to convert Korean natural language requests into a STRICT JSON object.

Input Korean Text:
"${koreanText}"

Existing UI Constraints (for reference only):
${JSON.stringify(existingConstraints, null, 2)}

Day Mapping Rules:
- 월요일 → MON
- 화요일 → TUE
- 수요일 → WED
- 목요일 → THU
- 금요일 → FRI
- 토요일 → SAT
- 일요일 → SUN

Time Interpretation Rules:
- "오전 수업", "아침 수업", "오전 9시", "오전 10시" → avoidMorning = true
- "점심시간", "12시~1시", "12시-1시", "점심" → keepLunchTime = true
- "하루에 수업 N개 이하", "하루 N개 이하" → maxClassesPerDay = N
- "연강", "연속 수업 N개" → maxConsecutiveClasses = N
- "팀플", "팀 프로젝트", "팀플 많은" → avoidTeamProjects = true
- "온라인", "비대면", "온라인 수업만" → preferOnlineClasses = true
- "금요일엔 온라인 수업만" → preferOnlineOnlyDays = ["FRI"]

Output Requirements:
1. Return ONLY valid JSON, no markdown, no code blocks, no explanations
2. If a condition is NOT mentioned in the Korean text, set the field to null
3. Do NOT hallucinate constraints that are not mentioned
4. For vague or unclear requests, put a short Korean summary in "notes"
5. Use null for boolean fields if not mentioned (not false)
6. Use empty array [] for day arrays if not mentioned

Output JSON Schema (MANDATORY):
{
  "avoidDays": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] | [],
  "preferOnlineOnlyDays": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] | [],
  "avoidMorning": boolean | null,
  "keepLunchTime": boolean | null,
  "maxClassesPerDay": number | null,
  "maxConsecutiveClasses": number | null,
  "avoidTeamProjects": boolean | null,
  "preferOnlineClasses": boolean | null,
  "notes": string | null
}

Examples:

Input: "월요일에는 수업이 없었으면 좋겠어요."
Output: {"avoidDays":["MON"],"preferOnlineOnlyDays":[],"avoidMorning":null,"keepLunchTime":null,"maxClassesPerDay":null,"maxConsecutiveClasses":null,"avoidTeamProjects":null,"preferOnlineClasses":null,"notes":null}

Input: "오전 9시 수업은 최대한 피하고 싶어요."
Output: {"avoidDays":[],"preferOnlineOnlyDays":[],"avoidMorning":true,"keepLunchTime":null,"maxClassesPerDay":null,"maxConsecutiveClasses":null,"avoidTeamProjects":null,"preferOnlineClasses":null,"notes":null}

Input: "점심시간 12~1시는 항상 비워주세요."
Output: {"avoidDays":[],"preferOnlineOnlyDays":[],"avoidMorning":null,"keepLunchTime":true,"maxClassesPerDay":null,"maxConsecutiveClasses":null,"avoidTeamProjects":null,"preferOnlineClasses":null,"notes":null}

Input: "팀플 많은 과목은 싫어요."
Output: {"avoidDays":[],"preferOnlineOnlyDays":[],"avoidMorning":null,"keepLunchTime":null,"maxClassesPerDay":null,"maxConsecutiveClasses":null,"avoidTeamProjects":true,"preferOnlineClasses":null,"notes":null}

Input: "하루에 수업은 3개 이하였으면 좋겠어요."
Output: {"avoidDays":[],"preferOnlineOnlyDays":[],"avoidMorning":null,"keepLunchTime":null,"maxClassesPerDay":3,"maxConsecutiveClasses":null,"avoidTeamProjects":null,"preferOnlineClasses":null,"notes":null}

Input: "금요일엔 온라인 수업만 있었으면 해요."
Output: {"avoidDays":[],"preferOnlineOnlyDays":["FRI"],"avoidMorning":null,"keepLunchTime":null,"maxClassesPerDay":null,"maxConsecutiveClasses":null,"avoidTeamProjects":null,"preferOnlineClasses":true,"notes":null}

Now parse the Korean text above and return ONLY the JSON object:`;
  }

  /**
   * Parse Gemini response with robust error handling
   */
  private parseResponse(text: string): ParsedConstraints | null {
    try {
      // Remove markdown code blocks if present
      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      // Try to extract JSON if there's extra text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      const parsed = JSON.parse(cleaned);

      // Validate structure
      const result: ParsedConstraints = {
        avoidDays: Array.isArray(parsed.avoidDays) 
          ? parsed.avoidDays.filter((d: string) => ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(d))
          : [],
        preferOnlineOnlyDays: Array.isArray(parsed.preferOnlineOnlyDays)
          ? parsed.preferOnlineOnlyDays.filter((d: string) => ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(d))
          : [],
        avoidMorning: typeof parsed.avoidMorning === 'boolean' ? parsed.avoidMorning : null,
        keepLunchTime: typeof parsed.keepLunchTime === 'boolean' ? parsed.keepLunchTime : null,
        maxClassesPerDay: typeof parsed.maxClassesPerDay === 'number' && parsed.maxClassesPerDay > 0 
          ? parsed.maxClassesPerDay 
          : null,
        maxConsecutiveClasses: typeof parsed.maxConsecutiveClasses === 'number' && parsed.maxConsecutiveClasses > 0
          ? parsed.maxConsecutiveClasses
          : null,
        avoidTeamProjects: typeof parsed.avoidTeamProjects === 'boolean' ? parsed.avoidTeamProjects : null,
        preferOnlineClasses: typeof parsed.preferOnlineClasses === 'boolean' ? parsed.preferOnlineClasses : null,
        notes: typeof parsed.notes === 'string' ? parsed.notes : null
      };

      return result;
    } catch (error) {
      logger.error('Failed to parse constraint JSON response', error, { 
        text: text.substring(0, 200) 
      });
      return null;
    }
  }
}

// Singleton instance
let constraintParserService: ConstraintParserService | null = null;

export function getConstraintParserService(): ConstraintParserService {
  if (!constraintParserService) {
    constraintParserService = new ConstraintParserService();
  }
  return constraintParserService;
}
