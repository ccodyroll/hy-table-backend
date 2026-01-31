import { Course, FixedLecture, BlockedTime, UserConstraints, TimeSlot, TimetableCandidate } from '../types';
import { timeSlotsOverlap, isMorningTime, overlapsLunchTime, timeToMinutes } from '../utils/timeParser';

class SchedulerService {
  /**
   * Generate candidate timetables
   * Returns candidates and debug information
   */
  generateCandidates(
    availableCourses: Course[],
    fixedLectures: FixedLecture[],
    blockedTimes: BlockedTime[],
    targetCredits: number,
    constraints: UserConstraints & { hardConstraints?: UserConstraints },
    strategy: 'MAJOR_FOCUS' | 'MIX' | 'INTEREST_FOCUS',
    tracks: string[],
    interests: string[]
  ): { candidates: TimetableCandidate[]; debug?: { candidatesGenerated: number; combinationsFilteredByBlockedTimes: number } } {
    // Track statistics
    const initialCourseCount = availableCourses.length;

    // Separate HARD and SOFT constraints
    // HARD constraints should filter courses, SOFT constraints only affect scoring
    const hardConstraints = constraints.hardConstraints || {};
    const softConstraints: UserConstraints = { ...constraints };
    delete (softConstraints as any).hardConstraints;

    // Filter out courses that conflict with fixed lectures, blocked times, or HARD constraints
    let validCourses = this.filterValidCourses(
      availableCourses,
      fixedLectures,
      blockedTimes,
      hardConstraints
    );

    // Count how many courses were filtered out due to blockedTimes
    // (This is approximate - some courses might be filtered for multiple reasons)
    const filteredByBlockedTimesCount = initialCourseCount - validCourses.length;

    // Sort courses based on strategy and constraints to prioritize relevant courses
    // This ensures different conditions produce different timetables
    validCourses = this.sortCoursesByPriority(validCourses, strategy, tracks, interests, softConstraints);

    // Generate candidates using backtracking
    const candidates: TimetableCandidate[] = [];
    const maxCandidates = 50; // Limit to prevent excessive computation

    this.backtrack(
      validCourses,
      fixedLectures,
      blockedTimes,
      targetCredits,
      softConstraints, // Use SOFT constraints for backtracking (validation only checks maxClassesPerDay, etc.)
      strategy,
      tracks,
      interests,
      [],
      0,
      candidates,
      maxCandidates
    );

    // Score all candidates using SOFT constraints
    const scoredCandidates = candidates.map(candidate =>
      this.scoreCandidate(candidate, targetCredits, softConstraints, strategy, tracks, interests)
    );

    // Sort by score (descending)
    const sortedCandidates = scoredCandidates.sort((a, b) => b.score - a.score);

    return {
      candidates: sortedCandidates,
      debug: {
        candidatesGenerated: sortedCandidates.length,
        combinationsFilteredByBlockedTimes: filteredByBlockedTimesCount,
      },
    };
  }

  /**
   * Filter courses that don't conflict with fixed lectures or blocked times
   * Also exclude courses with empty or missing meetingTimes
   */
  private filterValidCourses(
    courses: Course[],
    fixedLectures: FixedLecture[],
    blockedTimes: BlockedTime[],
    constraints: UserConstraints
  ): Course[] {
    return courses.filter(course => {
      // Exclude courses with no meetingTimes (요일_시간이 비어있는 경우)
      if (!course.meetingTimes || course.meetingTimes.length === 0) {
        return false;
      }

      // Check conflicts with fixed lectures
      for (const fixed of fixedLectures) {
        for (const courseSlot of course.meetingTimes) {
          for (const fixedSlot of fixed.meetingTimes) {
            if (timeSlotsOverlap(courseSlot, fixedSlot)) {
              return false;
            }
          }
        }
      }

      // Check conflicts with blocked times (HARD constraint)
      for (const blocked of blockedTimes) {
        for (const courseSlot of course.meetingTimes) {
          if (timeSlotsOverlap(courseSlot, blocked)) {
            return false;
          }
        }
      }

      // NOTE: SOFT constraints (avoidDays, avoidMorning, keepLunchTime, avoidTeamProjects)
      // are NOT filtered here. They are only used for scoring later.
      // This allows the algorithm to generate candidates even if they violate SOFT constraints,
      // and then rank them lower based on how well they satisfy SOFT constraints.

      return true;
    });
  }

  /**
   * Backtracking algorithm to generate candidate timetables
   */
  private backtrack(
    courses: Course[],
    fixedLectures: FixedLecture[],
    blockedTimes: BlockedTime[],
    targetCredits: number,
    constraints: UserConstraints,
    strategy: 'MAJOR_FOCUS' | 'MIX' | 'INTEREST_FOCUS',
    tracks: string[],
    interests: string[],
    currentSelection: Course[],
    currentCredits: number,
    candidates: TimetableCandidate[],
    maxCandidates: number
  ): void {
    // Base case: reached target credits or no more valid courses
    if (candidates.length >= maxCandidates) {
      return;
    }

    if (currentCredits >= targetCredits) {
      // Check if selection is valid
      if (this.isValidSelection(currentSelection, constraints)) {
        const allSlots = this.buildTimetableGrid(currentSelection, fixedLectures);
        candidates.push({
          courses: [...currentSelection],
          totalCredits: currentCredits,
          score: 0, // Will be scored later
          timetableGrid: allSlots,
          conflicts: [],
          warnings: [],
        });
      }
      return;
    }

    // Try adding each remaining course
    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];

      // Skip if adding this course would exceed reasonable limits
      if (currentCredits + course.credits > targetCredits + 3) {
        continue;
      }

      // Check if course conflicts with current selection
      if (this.hasConflict(course, currentSelection)) {
        continue;
      }

      // Add course and recurse
      currentSelection.push(course);
      this.backtrack(
        courses.slice(i + 1),
        fixedLectures,
        blockedTimes,
        targetCredits,
        constraints,
        strategy,
        tracks,
        interests,
        currentSelection,
        currentCredits + course.credits,
        candidates,
        maxCandidates
      );
      currentSelection.pop();
    }
  }

  /**
   * Check if a course conflicts with existing selection
   */
  private hasConflict(course: Course, selection: Course[]): boolean {
    for (const selected of selection) {
      for (const slot1 of course.meetingTimes) {
        for (const slot2 of selected.meetingTimes) {
          if (timeSlotsOverlap(slot1, slot2)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Sort courses by priority based on strategy, tracks, interests, and constraints
   * This ensures that different conditions produce different timetables
   */
  private sortCoursesByPriority(
    courses: Course[],
    strategy: 'MAJOR_FOCUS' | 'MIX' | 'INTEREST_FOCUS',
    tracks: string[],
    interests: string[],
    constraints: UserConstraints
  ): Course[] {
    // Create a copy to avoid mutating the original array
    const sorted = [...courses];

    sorted.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Strategy-based scoring
      if (strategy === 'MAJOR_FOCUS' && tracks.length > 0) {
        const aMatches = tracks.some(track => 
          (a.major || '').toLowerCase().includes(track.toLowerCase()) || 
          a.tags.some(tag => tag.toLowerCase().includes(track.toLowerCase()))
        );
        const bMatches = tracks.some(track => 
          (b.major || '').toLowerCase().includes(track.toLowerCase()) || 
          b.tags.some(tag => tag.toLowerCase().includes(track.toLowerCase()))
        );
        if (aMatches) scoreA += 100;
        if (bMatches) scoreB += 100;
      } else if (strategy === 'INTEREST_FOCUS' && interests.length > 0) {
        const aMatches = interests.some(interest => 
          a.name.toLowerCase().includes(interest.toLowerCase()) || 
          a.tags.some(tag => tag.toLowerCase().includes(interest.toLowerCase()))
        );
        const bMatches = interests.some(interest => 
          b.name.toLowerCase().includes(interest.toLowerCase()) || 
          b.tags.some(tag => tag.toLowerCase().includes(interest.toLowerCase()))
        );
        if (aMatches) scoreA += 100;
        if (bMatches) scoreB += 100;
      }

      // Constraint-based scoring
      if (constraints.preferOnlineClasses) {
        if (a.deliveryType === 'ONLINE') scoreA += 20;
        if (b.deliveryType === 'ONLINE') scoreB += 20;
      }

      if (constraints.avoidTeamProjects) {
        // Assuming teamProject is a boolean field or tag
        const aHasTeamProject = a.tags.some(tag => 
          tag.toLowerCase().includes('team') || 
          tag.toLowerCase().includes('팀플') ||
          tag.toLowerCase().includes('group')
        );
        const bHasTeamProject = b.tags.some(tag => 
          tag.toLowerCase().includes('team') || 
          tag.toLowerCase().includes('팀플') ||
          tag.toLowerCase().includes('group')
        );
        if (!aHasTeamProject) scoreA += 15;
        if (!bHasTeamProject) scoreB += 15;
      }

      if (constraints.avoidMorning) {
        const aIsMorning = a.meetingTimes.some(slot => isMorningTime(slot.startTime));
        const bIsMorning = b.meetingTimes.some(slot => isMorningTime(slot.startTime));
        if (!aIsMorning) scoreA += 10;
        if (!bIsMorning) scoreB += 10;
      }

      // Prefer courses that don't violate avoidDays
      if (constraints.avoidDays && constraints.avoidDays.length > 0) {
        const aHasAvoidedDay = a.meetingTimes.some(slot => 
          constraints.avoidDays!.includes(slot.day)
        );
        const bHasAvoidedDay = b.meetingTimes.some(slot => 
          constraints.avoidDays!.includes(slot.day)
        );
        if (!aHasAvoidedDay) scoreA += 10;
        if (!bHasAvoidedDay) scoreB += 10;
      }

      // Prefer courses that keep lunch time free
      if (constraints.keepLunchTime) {
        const aOverlapsLunch = a.meetingTimes.some(slot => overlapsLunchTime(slot));
        const bOverlapsLunch = b.meetingTimes.some(slot => overlapsLunchTime(slot));
        if (!aOverlapsLunch) scoreA += 10;
        if (!bOverlapsLunch) scoreB += 10;
      }

      // Secondary sort: prefer courses with more credits (to reach target faster)
      scoreA += a.credits;
      scoreB += b.credits;

      // Tertiary sort: by course ID for consistency
      if (scoreA === scoreB) {
        return a.courseId.localeCompare(b.courseId);
      }

      return scoreB - scoreA; // Higher score first
    });

    return sorted;
  }

  /**
   * Check if selection satisfies constraints
   */
  private isValidSelection(courses: Course[], constraints: UserConstraints): boolean {
    // Check max classes per day
    if (constraints.maxClassesPerDay) {
      const dayCounts: Record<string, number> = {};
      for (const course of courses) {
        for (const slot of course.meetingTimes) {
          dayCounts[slot.day] = (dayCounts[slot.day] || 0) + 1;
        }
      }
      for (const count of Object.values(dayCounts)) {
        if (count > constraints.maxClassesPerDay!) {
          return false;
        }
      }
    }

    // Check max consecutive classes
    if (constraints.maxConsecutiveClasses) {
      // This is a simplified check - could be more sophisticated
      // For now, we'll check in scoring
    }

    return true;
  }

  /**
   * Build timetable grid from courses and fixed lectures
   */
  private buildTimetableGrid(courses: Course[], fixedLectures: FixedLecture[]): TimeSlot[] {
    const slots: TimeSlot[] = [];

    for (const course of courses) {
      slots.push(...course.meetingTimes);
    }

    for (const fixed of fixedLectures) {
      slots.push(...fixed.meetingTimes);
    }

    return slots;
  }

  /**
   * Score a candidate timetable
   */
  private scoreCandidate(
    candidate: TimetableCandidate,
    targetCredits: number,
    constraints: UserConstraints,
    strategy: 'MAJOR_FOCUS' | 'MIX' | 'INTEREST_FOCUS',
    tracks: string[],
    interests: string[]
  ): TimetableCandidate {
    let score = 100;

    // Credit score (closer to target is better)
    const creditDiff = Math.abs(candidate.totalCredits - targetCredits);
    score -= creditDiff * 5;

    // Strategy-based scoring
    if (strategy === 'MAJOR_FOCUS') {
      const majorCourses = candidate.courses.filter(c => tracks.some(track => c.major.includes(track) || c.tags.includes(track)));
      score += majorCourses.length * 10;
    } else if (strategy === 'INTEREST_FOCUS') {
      const interestCourses = candidate.courses.filter(c => 
        interests.some(interest => c.name.includes(interest) || c.tags.includes(interest))
      );
      score += interestCourses.length * 10;
    } else if (strategy === 'MIX') {
      // Balanced scoring
      score += candidate.courses.length * 5;
    }

    // Constraint satisfaction
    const warnings: string[] = [];

    // Check max consecutive classes
    if (constraints.maxConsecutiveClasses) {
      const consecutiveViolations = this.countConsecutiveViolations(candidate.timetableGrid, constraints.maxConsecutiveClasses);
      if (consecutiveViolations > 0) {
        score -= consecutiveViolations * 5;
        warnings.push(`연속 수업 제한을 ${consecutiveViolations}회 초과했습니다.`);
      }
    }

    // Check empty days preference
    const dayCounts: Record<string, number> = {};
    for (const slot of candidate.timetableGrid) {
      dayCounts[slot.day] = (dayCounts[slot.day] || 0) + 1;
    }
    const emptyDays = ['MON', 'TUE', 'WED', 'THU', 'FRI'].filter(day => !dayCounts[day]).length;
    score += emptyDays * 3; // Bonus for empty days

    // Online class preference
    if (constraints.preferOnlineClasses) {
      const onlineCount = candidate.courses.filter(c => c.deliveryType === 'ONLINE').length;
      score += onlineCount * 5;
    }

    // Prefer online-only days
    if (constraints.preferOnlineOnlyDays && constraints.preferOnlineOnlyDays.length > 0) {
      const onlineOnlyDays = constraints.preferOnlineOnlyDays.filter(day => {
        const dayCourses = candidate.courses.filter(c => 
          c.meetingTimes.some(slot => slot.day === day)
        );
        return dayCourses.every(c => c.deliveryType === 'ONLINE');
      });
      score += onlineOnlyDays.length * 8;
    }

    candidate.score = Math.max(0, score);
    candidate.warnings = warnings;
    return candidate;
  }

  /**
   * Count violations of max consecutive classes constraint
   */
  private countConsecutiveViolations(slots: TimeSlot[], maxConsecutive: number): number {
    const daySlots: Record<string, TimeSlot[]> = {};

    for (const slot of slots) {
      if (!daySlots[slot.day]) {
        daySlots[slot.day] = [];
      }
      daySlots[slot.day].push(slot);
    }

    let violations = 0;

    for (const daySlotsList of Object.values(daySlots)) {
      // Sort by start time
      daySlotsList.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

      let consecutive = 1;
      for (let i = 1; i < daySlotsList.length; i++) {
        const prevEnd = timeToMinutes(daySlotsList[i - 1].endTime);
        const currStart = timeToMinutes(daySlotsList[i].startTime);

        // Check if consecutive (within 30 minutes)
        if (currStart - prevEnd <= 30) {
          consecutive++;
        } else {
          if (consecutive > maxConsecutive) {
            violations += consecutive - maxConsecutive;
          }
          consecutive = 1;
        }
      }

      if (consecutive > maxConsecutive) {
        violations += consecutive - maxConsecutive;
      }
    }

    return violations;
  }
}

export default new SchedulerService();
