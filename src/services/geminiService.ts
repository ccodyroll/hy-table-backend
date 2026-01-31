import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserConstraints, DayOfWeek } from '../types';

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      console.warn('GEMINI_API_KEY not set - Gemini features will be disabled');
    }
  }

  /**
   * Parse Korean natural language constraints to structured format
   */
  async parseConstraints(freeText: string): Promise<UserConstraints | null> {
    console.log('=== geminiService.parseConstraints called ===');
    console.log('Input text:', freeText);
    console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
    console.log('genAI instance exists:', !!this.genAI);
    console.log('Model name:', this.modelName);
    
    if (!this.genAI || !freeText || !freeText.trim()) {
      console.warn('Gemini AI not initialized or empty input - returning null');
      if (!this.genAI) {
        console.warn('Reason: genAI is null (GEMINI_API_KEY not set)');
      }
      if (!freeText || !freeText.trim()) {
        console.warn('Reason: freeText is empty');
      }
      return null;
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      console.log('Using model:', this.modelName);

      const prompt = `You are a constraint parser for a university timetable scheduler. Parse the following Korean user request into structured JSON constraints.

User request: "${freeText}"

Rules:
1. Output ONLY valid JSON, no markdown, no explanation
2. Use null for unspecified fields
3. Day mapping: 월요일→MON, 화요일→TUE, 수요일→WED, 목요일→THU, 금요일→FRI
4. Interpretation rules:
   - "오전/아침 수업" → avoidMorning: true
   - "점심시간/12~1시" → keepLunchTime: true
   - "하루 N개 이하" → maxClassesPerDay: N
   - "연강/연속" → maxConsecutiveClasses: N
   - "팀플" → avoidTeamProjects: true
   - "온라인/비대면" → preferOnlineClasses: true
   - "월요일 수업 없음" → avoidDays: ["MON"]

5. Notes field normalization (CRITICAL):
   If the user mentions specific time constraints that cannot be mapped to structured fields, put them in "notes" field.
   The "notes" field MUST be normalized to one of these EXACT formats:
   
   For time blocks (blocked times):
   - Format: "[요일] [시작시간]-[종료시간] 불가"
   - 요일: 월요일, 화요일, 수요일, 목요일, 금요일, 토요일, 일요일 (full name only)
   - 시간: HH:MM 형식 (24-hour format)
   - Examples:
     * "오후 2-7시 안대" → "월요일 14:00-19:00 불가" (if no day specified, assume all weekdays or use context)
     * "월요일 오후 5-7시 안돼" → "월요일 17:00-19:00 불가"
     * "화요일 3시부터 5시까지 안됨" → "화요일 15:00-17:00 불가"
     * "수요일 오전 9-10시" → "수요일 09:00-10:00 불가"
     * "금요일 저녁 6-8시 불가" → "금요일 18:00-20:00 불가"
   
   IMPORTANT normalization rules:
   - "오후 N시" → N+12 (if N < 12), "오전 N시" → N (if N < 12)
   - "저녁" → 18:00-22:00, "밤" → 20:00-22:00, "새벽" → 00:00-06:00
   - "점심" → 12:00-13:00, "아침" → 09:00-12:00
   - If day is not specified but time is mentioned, try to infer from context or use "월요일" as default
   - Always use 24-hour format (HH:MM)
   - Always end with "불가" or "안됨" or "안돼" → normalize to "불가"
   - Remove all reason text (알바, 수업, 일 등) - only keep day and time

Output JSON schema:
{
  "avoidDays": ["MON","TUE","WED","THU","FRI"] | [],
  "preferOnlineOnlyDays": ["MON","TUE","WED","THU","FRI"] | [],
  "avoidMorning": boolean | null,
  "keepLunchTime": boolean | null,
  "maxClassesPerDay": number | null,
  "maxConsecutiveClasses": number | null,
  "avoidTeamProjects": boolean | null,
  "preferOnlineClasses": boolean | null,
  "notes": string | null
}

Output JSON only:`;

      console.log('Calling Gemini API with prompt length:', prompt.length);
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text().trim();
      console.log('Gemini response text (first 500 chars):', text.substring(0, 500));

      // Extract JSON from response (handle markdown code blocks if present)
      let jsonStr = text;
      const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        console.log('Found JSON in markdown code block');
        jsonStr = jsonMatch[1];
      } else {
        console.log('Using raw text as JSON');
      }

      console.log('Attempting to parse JSON:', jsonStr.substring(0, 200));
      const constraints = JSON.parse(jsonStr) as UserConstraints;
      console.log('Successfully parsed constraints:', JSON.stringify(constraints, null, 2));

      // Validate and sanitize
      const sanitized = this.sanitizeConstraints(constraints);
      console.log('Sanitized constraints:', JSON.stringify(sanitized, null, 2));
      return sanitized;
    } catch (error) {
      console.error('=== ERROR in geminiService.parseConstraints ===');
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Error stack:', error instanceof Error ? error.stack : undefined);
      console.error('Full error object:', error);
      return null; // Fail gracefully
    }
  }

  /**
   * Refine timetable recommendations using Gemini
   */
  async refineRecommendations(
    candidates: Array<{ courses: any[]; totalCredits: number; score: number }>,
    userRequest: string
  ): Promise<Array<{ rank: number; explanation: string }> | null> {
    if (!this.genAI || candidates.length === 0) {
      return null;
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });

      // Prepare candidate summaries
      const candidateSummaries = candidates.slice(0, 10).map((c, idx) => ({
        index: idx,
        courseCount: c.courses.length,
        totalCredits: c.totalCredits,
        score: c.score,
        courseNames: c.courses.map(course => course.name).join(', '),
      }));

      const prompt = `You are a timetable recommendation assistant. Rank and explain these timetable candidates based on the user's requirements.

User requirements: "${userRequest}"

Candidates:
${JSON.stringify(candidateSummaries, null, 2)}

Output a JSON array of objects with:
- rank: number (1-based, best first)
- explanation: string (brief Korean explanation why this timetable is good)

Output ONLY valid JSON array, no markdown, no explanation. Example:
[{"rank": 1, "explanation": "학점 목표를 달성하며 흥미로운 과목들을 포함합니다."}, ...]`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text().trim();

      // Extract JSON
      let jsonStr = text;
      const jsonMatch = text.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const refinements = JSON.parse(jsonStr) as Array<{ rank: number; explanation: string }>;
      return refinements;
    } catch (error) {
      console.error('Error refining recommendations with Gemini:', error);
      return null; // Fail gracefully
    }
  }

  /**
   * Sanitize and validate constraints
   */
  private sanitizeConstraints(constraints: any): UserConstraints {
    const validDays: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    return {
      avoidDays: Array.isArray(constraints.avoidDays)
        ? constraints.avoidDays.filter((d: string) => validDays.includes(d as DayOfWeek))
        : undefined,
      preferOnlineOnlyDays: Array.isArray(constraints.preferOnlineOnlyDays)
        ? constraints.preferOnlineOnlyDays.filter((d: string) => validDays.includes(d as DayOfWeek))
        : undefined,
      avoidMorning: typeof constraints.avoidMorning === 'boolean' ? constraints.avoidMorning : null,
      keepLunchTime: typeof constraints.keepLunchTime === 'boolean' ? constraints.keepLunchTime : null,
      maxClassesPerDay: typeof constraints.maxClassesPerDay === 'number' && constraints.maxClassesPerDay > 0
        ? constraints.maxClassesPerDay
        : null,
      maxConsecutiveClasses: typeof constraints.maxConsecutiveClasses === 'number' && constraints.maxConsecutiveClasses > 0
        ? constraints.maxConsecutiveClasses
        : null,
      avoidTeamProjects: typeof constraints.avoidTeamProjects === 'boolean' ? constraints.avoidTeamProjects : null,
      preferOnlineClasses: typeof constraints.preferOnlineClasses === 'boolean' ? constraints.preferOnlineClasses : null,
      notes: typeof constraints.notes === 'string' ? constraints.notes : null,
    };
  }
}

export default new GeminiService();
