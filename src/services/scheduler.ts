/**
 * Scheduler service for generating candidate timetables
 * Handles collision detection, filtering, and candidate generation
 */

import { logger } from '../utils/logger';
import { Course, getAirtableService } from './airtable';
import { getGeminiService, TimetableCandidate, ScoredTimetable } from './gemini';
import { RecommendRequest } from '../schemas/request';
import { 
  TimeSlot, 
  hasTimeConflict, 
  coursesOverlap,
  timeToMinutes 
} from '../utils/time';

interface ScheduleGenerationResult {
  recommendations: ScoredTimetable[];
  debug: {
    candidatesGenerated: number;
    geminiUsed: boolean;
  };
}

class SchedulerService {
  /**
   * Filter courses that are invalid due to time conflicts or restrictions
   */
  private filterInvalidCourses(
    allCourses: Course[],
    fixedLectures: RecommendRequest['fixedLectures'],
    blockedTimes: TimeSlot[],
    request: RecommendRequest
  ): Course[] {
    const validCourses: Course[] = [];

    for (const course of allCourses) {
      // Skip if no meeting times
      if (course.meetingTimes.length === 0) {
        continue;
      }

      // Check conflict with blocked times
      if (hasTimeConflict(course.meetingTimes, blockedTimes)) {
        continue;
      }

      // Check conflict with fixed lectures
      let hasConflict = false;
      for (const fixed of fixedLectures) {
        // Find the fixed course to get its meeting times
        const fixedCourse = allCourses.find(c => c.courseId === fixed.courseId);
        if (fixedCourse) {
          if (coursesOverlap(course.meetingTimes, fixedCourse.meetingTimes)) {
            hasConflict = true;
            break;
          }
        } else {
          // Use meeting times from request if course not found
          if (hasTimeConflict(course.meetingTimes, fixed.meetingTimes)) {
            hasConflict = true;
            break;
          }
        }
      }

      if (hasConflict) {
        continue;
      }

      // Check morning constraint
      if (request.constraints.avoidMorning) {
        const hasMorning = course.meetingTimes.some(t => {
          const [hours] = t.start.split(':').map(Number);
          return hours < 10;
        });
        if (hasMorning) {
          continue;
        }
      }

      // Check avoidDays constraint (from parsed Korean)
      const parsedConstraints = (request as any).parsedConstraints;
      if (parsedConstraints?.avoidDays && parsedConstraints.avoidDays.length > 0) {
        const hasAvoidedDay = course.meetingTimes.some(t => 
          parsedConstraints.avoidDays.includes(t.day)
        );
        if (hasAvoidedDay) {
          continue;
        }
      }

      // Check preferOnlineOnlyDays constraint
      if (parsedConstraints?.preferOnlineOnlyDays && parsedConstraints.preferOnlineOnlyDays.length > 0) {
        const hasOnlineOnlyDay = course.meetingTimes.some(t => 
          parsedConstraints.preferOnlineOnlyDays.includes(t.day)
        );
        if (hasOnlineOnlyDay && !course.online) {
          continue; // Must be online on these days
        }
      }

      // Check avoidTeamProjects constraint
      if (parsedConstraints?.avoidTeamProjects && course.teamProject) {
        continue;
      }

      // Check online preference
      if (request.constraints.preferOnlineClasses && !course.online) {
        // Don't skip, but will be penalized in scoring
      }

      validCourses.push(course);
    }

    return validCourses;
  }

  /**
   * Check if a schedule satisfies constraints
   */
  private satisfiesConstraints(
    courses: Course[],
    request: RecommendRequest
  ): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let valid = true;

    // Check consecutive classes
    const daySchedule: Record<string, TimeSlot[]> = {};
    for (const course of courses) {
      for (const time of course.meetingTimes) {
        if (!daySchedule[time.day]) {
          daySchedule[time.day] = [];
        }
        daySchedule[time.day].push(time);
      }
    }

    const parsedConstraints = (request as any).parsedConstraints;

    for (const [day, times] of Object.entries(daySchedule)) {
      // Sort by start time
      times.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

      // Check maxClassesPerDay constraint
      if (parsedConstraints?.maxClassesPerDay && times.length > parsedConstraints.maxClassesPerDay) {
        warnings.push(`${day}: ${times.length} classes (max: ${parsedConstraints.maxClassesPerDay} per day)`);
      }

      let consecutive = 1;
      let maxConsecutive = 1;

      for (let i = 1; i < times.length; i++) {
        const prevEnd = timeToMinutes(times[i - 1].end);
        const currStart = timeToMinutes(times[i].start);
        
        // Consider consecutive if gap is <= 30 minutes
        if (currStart - prevEnd <= 30) {
          consecutive++;
          maxConsecutive = Math.max(maxConsecutive, consecutive);
        } else {
          consecutive = 1;
        }
      }

      if (maxConsecutive > request.constraints.maxConsecutiveClasses) {
        warnings.push(`${day}: ${maxConsecutive} consecutive classes (max: ${request.constraints.maxConsecutiveClasses})`);
      }
    }

    // Check lunch time
    if (request.constraints.keepLunchTime) {
      const hasLunchBlock = request.blockedTimes.some(bt => {
        const start = timeToMinutes(bt.start);
        const end = timeToMinutes(bt.end);
        // Lunch typically 11:30-13:30
        return start >= 690 && end <= 810; // 11:30-13:30 in minutes
      });

      if (!hasLunchBlock) {
        warnings.push('Lunch time preference not fully satisfied');
      }
    }

    return { valid, warnings };
  }

  /**
   * Generate candidate schedules using greedy + backtracking approach
   */
  private generateCandidates(
    validCourses: Course[],
    fixedLectures: RecommendRequest['fixedLectures'],
    request: RecommendRequest,
    maxCandidates: number = 20
  ): TimetableCandidate[] {
    const candidates: TimetableCandidate[] = [];
    const targetCredits = request.targetCredits;
    const fixedCourseIds = new Set(fixedLectures.map(f => f.courseId));
    
    // Get fixed courses
    const fixedCourses = validCourses.filter(c => fixedCourseIds.has(c.courseId));
    const fixedCredits = fixedCourses.reduce((sum, c) => sum + c.credits, 0);
    const remainingCredits = targetCredits - fixedCredits;

    // Filter out fixed courses from selection pool
    const selectableCourses = validCourses.filter(c => !fixedCourseIds.has(c.courseId));

    // Strategy-based course prioritization
    const prioritizedCourses = this.prioritizeCourses(selectableCourses, request);

    // Generate candidates using backtracking
    const generate = (
      currentCourses: Course[],
      currentCredits: number,
      startIndex: number,
      depth: number
    ): void => {
      if (candidates.length >= maxCandidates) {
        return;
      }

      // Check if we've reached target credits (with some tolerance)
      if (currentCredits >= remainingCredits - 2 && currentCredits <= remainingCredits + 5) {
        const allCourses = [...fixedCourses, ...currentCourses];
        const totalCredits = allCourses.reduce((sum, c) => sum + c.credits, 0);
        
        // Check for overlaps within selected courses
        let hasOverlap = false;
        for (let i = 0; i < allCourses.length; i++) {
          for (let j = i + 1; j < allCourses.length; j++) {
            if (coursesOverlap(allCourses[i].meetingTimes, allCourses[j].meetingTimes)) {
              hasOverlap = true;
              break;
            }
          }
          if (hasOverlap) break;
        }

        if (!hasOverlap) {
          candidates.push({
            courses: allCourses,
            totalCredits
          });
        }
      }

      // Don't go too deep
      if (depth > 10 || startIndex >= prioritizedCourses.length) {
        return;
      }

      // Try adding courses
      for (let i = startIndex; i < prioritizedCourses.length; i++) {
        const course = prioritizedCourses[i];
        
        // Check if adding this course would exceed credits
        if (currentCredits + course.credits > remainingCredits + 5) {
          continue;
        }

        // Check for overlaps with current courses
        let hasOverlap = false;
        for (const existing of currentCourses) {
          if (coursesOverlap(course.meetingTimes, existing.meetingTimes)) {
            hasOverlap = true;
            break;
          }
        }

        if (!hasOverlap) {
          generate(
            [...currentCourses, course],
            currentCredits + course.credits,
            i + 1,
            depth + 1
          );
        }
      }
    };

    generate([], 0, 0, 0);

    // If we didn't generate enough, try greedy approach
    if (candidates.length < maxCandidates) {
      this.greedyGenerate(prioritizedCourses, fixedCourses, remainingCredits, candidates, maxCandidates);
    }

    return candidates.slice(0, maxCandidates);
  }

  /**
   * Prioritize courses based on strategy
   */
  private prioritizeCourses(courses: Course[], request: RecommendRequest): Course[] {
    const scored = courses.map(course => {
      let score = 0;

      // Major alignment
      if (course.major === request.user.major || course.department === request.user.major) {
        score += 10;
      }

      // Track alignment
      if (request.tracks.includes(course.track || '')) {
        score += 8;
      }

      // Interest alignment
      for (const interest of request.interests) {
        if (course.name.toLowerCase().includes(interest.toLowerCase()) ||
            course.tags?.some(tag => tag.toLowerCase().includes(interest.toLowerCase()))) {
          score += 5;
        }
      }

      // Constraint preferences
      if (request.constraints.preferTeamProjects && course.teamProject) {
        score += 3;
      }

      if (request.constraints.preferOnlineClasses && course.online) {
        score += 3;
      }

      // Strategy-specific scoring
      if (request.strategy === 'MAJOR_FOCUS') {
        if (course.major === request.user.major) {
          score += 15;
        }
      } else if (request.strategy === 'INTEREST_FOCUS') {
        const interestMatches = request.interests.filter(interest =>
          course.name.toLowerCase().includes(interest.toLowerCase()) ||
          course.tags?.some(tag => tag.toLowerCase().includes(interest.toLowerCase()))
        );
        score += interestMatches.length * 10;
      }

      return { course, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .map(item => item.course);
  }

  /**
   * Greedy generation as fallback
   */
  private greedyGenerate(
    prioritizedCourses: Course[],
    fixedCourses: Course[],
    targetCredits: number,
    candidates: TimetableCandidate[],
    maxCandidates: number
  ): void {
    const used = new Set<string>();

    for (let attempt = 0; attempt < maxCandidates && candidates.length < maxCandidates; attempt++) {
      const selected: Course[] = [];
      let credits = 0;
      const selectedTimes: TimeSlot[] = [];

      for (const course of prioritizedCourses) {
        if (credits >= targetCredits - 2) {
          break;
        }

        // Check for overlaps
        let hasOverlap = false;
        for (const time of course.meetingTimes) {
          for (const existing of selectedTimes) {
            if (time.day === existing.day) {
              const start1 = timeToMinutes(time.start);
              const end1 = timeToMinutes(time.end);
              const start2 = timeToMinutes(existing.start);
              const end2 = timeToMinutes(existing.end);
              if (start1 < end2 && start2 < end1) {
                hasOverlap = true;
                break;
              }
            }
          }
          if (hasOverlap) break;
        }

        if (!hasOverlap && credits + course.credits <= targetCredits + 5) {
          selected.push(course);
          credits += course.credits;
          selectedTimes.push(...course.meetingTimes);
        }
      }

      if (selected.length > 0) {
        const allCourses = [...fixedCourses, ...selected];
        const totalCredits = allCourses.reduce((sum, c) => sum + c.credits, 0);
        const candidateKey = allCourses.map(c => c.courseId).sort().join(',');

        if (!used.has(candidateKey)) {
          used.add(candidateKey);
          candidates.push({
            courses: allCourses,
            totalCredits
          });
        }
      }
    }
  }

  /**
   * Generate and rank timetable recommendations
   */
  async generateRecommendations(
    request: RecommendRequest
  ): Promise<ScheduleGenerationResult> {
    logger.info('Generating timetable recommendations', { 
      requestId: (request as any).requestId 
    });

    // Fetch all courses
    const airtableService = getAirtableService();
    const allCourses = await airtableService.getAllCourses();

    // Filter invalid courses
    const validCourses = this.filterInvalidCourses(
      allCourses,
      request.fixedLectures,
      request.blockedTimes,
      request
    );

    logger.debug('Filtered courses', { 
      total: allCourses.length, 
      valid: validCourses.length 
    });

    // Generate candidates
    const candidates = this.generateCandidates(
      validCourses,
      request.fixedLectures,
      request,
      20 // max candidates
    );

    if (candidates.length === 0) {
      logger.warn('No valid candidates generated');
      return {
        recommendations: [],
        debug: {
          candidatesGenerated: 0,
          geminiUsed: false
        }
      };
    }

    // Score candidates with Gemini
    const geminiService = getGeminiService();
    const scored = await geminiService.scoreCandidates(candidates, request);

    // Add constraint warnings to scored items
    const recommendations: ScoredTimetable[] = scored.map((scoredItem) => {
      const constraints = this.satisfiesConstraints(scoredItem.courses, request);

      return {
        ...scoredItem,
        warnings: [...scoredItem.warnings, ...constraints.warnings]
      };
    });

    // Sort by score (descending)
    recommendations.sort((a, b) => b.score - a.score);

    // Add rank
    recommendations.forEach((rec, idx) => {
      (rec as any).rank = idx + 1;
    });

    const geminiUsed = !!process.env.GEMINI_API_KEY && recommendations.length > 0;

    return {
      recommendations: recommendations.slice(0, 10), // Top 10
      debug: {
        candidatesGenerated: candidates.length,
        geminiUsed
      }
    };
  }
}

// Singleton instance
let schedulerService: SchedulerService | null = null;

export function getSchedulerService(): SchedulerService {
  if (!schedulerService) {
    schedulerService = new SchedulerService();
  }
  return schedulerService;
}
