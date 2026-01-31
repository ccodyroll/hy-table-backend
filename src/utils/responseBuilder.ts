import { TimetableCandidate, Course, DayOfWeek, TimeSlot, BlockedTime } from '../types';
import { timeToMinutes, timeSlotsOverlap } from './timeParser';

interface ResponseBuilderInput {
  requestBody: any;
  parsedConstraints: any;
  candidateTimetables: TimetableCandidate[];
  runMeta: {
    candidatesGenerated: number;
    geminiUsed: boolean;
    executionTime: number;
  };
  targetCredits: number;
}

interface FrontendCourse {
  id: string;
  name: string;
  code: string;
  credits: number;
  professor: string;
  type: string;
  day: number;
  startHour: number;
  duration: number;
  color: string;
}

interface SuccessResponse {
  recommendations: Array<{
    rank: number;
    totalCredits: number;
    score: number;
    explanation: string;
    warnings: string[];
    courses: FrontendCourse[];
  }>;
  debug: {
    candidatesGenerated: number;
    geminiUsed: boolean;
    executionTime: number;
  };
}

interface ErrorResponse {
  error: string;
  details?: {
    reason: string;
    conflictingConstraints?: string[];
    suggestions?: string[];
  };
}

// 파스텔 톤 색상 팔레트
const PASTEL_COLORS = [
  '#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA', '#FFDFBA',
  '#E0BBE4', '#FEC8C1', '#FFCCCB', '#B4E4FF', '#C7CEEA',
  '#F8BBD0', '#B5EAD7', '#FFD3A5', '#FD9853', '#A8E6CF',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
];

/**
 * HARD 제약 만족 여부 확인
 */
function satisfiesHardConstraints(
  candidate: TimetableCandidate,
  parsedConstraints: any,
  blockedTimes: BlockedTime[]
): boolean {
  // 시간 충돌이 있으면 HARD 위반
  if (candidate.conflicts && candidate.conflicts.length > 0) {
    return false;
  }

  // blockedTimes와 충돌 확인
  for (const blocked of blockedTimes) {
    for (const course of candidate.courses) {
      for (const meetingTime of course.meetingTimes) {
        if (timeSlotsOverlap(meetingTime, {
          day: blocked.day,
          startTime: blocked.startTime,
          endTime: blocked.endTime,
        })) {
          return false; // 충돌
        }
      }
    }
  }

  return true;
}

/**
 * 경고 메시지 생성
 */
function generateWarnings(
  candidate: TimetableCandidate,
  targetCredits: number,
  parsedConstraints: any
): string[] {
  const warnings: string[] = [];

  // 목표 학점 체크
  if (candidate.totalCredits < targetCredits - 1) {
    warnings.push(`목표 학점(${targetCredits})보다 ${targetCredits - candidate.totalCredits}학점 부족합니다.`);
  } else if (candidate.totalCredits > targetCredits + 1) {
    warnings.push(`목표 학점(${targetCredits})보다 ${candidate.totalCredits - targetCredits}학점 초과합니다.`);
  }

  // SOFT 제약 미충족 체크
  if (parsedConstraints.avoidDays && parsedConstraints.avoidDays.length > 0) {
    const usedDays = new Set<DayOfWeek>();
    candidate.courses.forEach(course => {
      course.meetingTimes.forEach(mt => usedDays.add(mt.day));
    });
    const violatedDays = parsedConstraints.avoidDays.filter((day: DayOfWeek) => usedDays.has(day));
    if (violatedDays.length > 0) {
      const dayLabels: Record<DayOfWeek, string> = {
        'MON': '월요일', 'TUE': '화요일', 'WED': '수요일',
        'THU': '목요일', 'FRI': '금요일', 'SAT': '토요일', 'SUN': '일요일'
      };
      warnings.push(`회피 요청한 ${violatedDays.map((d: DayOfWeek) => dayLabels[d]).join(', ')}에 수업이 있습니다.`);
    }
  }

  if (parsedConstraints.avoidMorning === true) {
    const hasMorning = candidate.courses.some(course =>
      course.meetingTimes.some(mt => {
        const hour = parseInt(mt.startTime.split(':')[0], 10);
        return hour < 12;
      })
    );
    if (hasMorning) {
      warnings.push('오전 수업이 포함되어 있습니다.');
    }
  }

  if (parsedConstraints.keepLunchTime === true) {
    const overlapsLunch = candidate.courses.some(course =>
      course.meetingTimes.some(mt => {
        const start = timeToMinutes(mt.startTime);
        const end = timeToMinutes(mt.endTime);
        const lunchStart = timeToMinutes('12:00');
        const lunchEnd = timeToMinutes('13:00');
        return !(end <= lunchStart || start >= lunchEnd);
      })
    );
    if (overlapsLunch) {
      warnings.push('점심시간(12:00-13:00)에 수업이 있습니다.');
    }
  }

  // 하루 과밀 체크
  const dayCounts: Record<DayOfWeek, number> = {
    'MON': 0, 'TUE': 0, 'WED': 0, 'THU': 0, 'FRI': 0, 'SAT': 0, 'SUN': 0
  };
  candidate.courses.forEach(course => {
    course.meetingTimes.forEach(mt => dayCounts[mt.day]++);
  });
  const maxClassesPerDay = parsedConstraints.maxClassesPerDay;
  if (maxClassesPerDay) {
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > maxClassesPerDay) {
        const dayLabels: Record<string, string> = {
          'MON': '월요일', 'TUE': '화요일', 'WED': '수요일',
          'THU': '목요일', 'FRI': '금요일', 'SAT': '토요일', 'SUN': '일요일'
        };
        warnings.push(`${dayLabels[day]}에 ${count}개 수업이 있어 제한(${maxClassesPerDay}개)을 초과합니다.`);
      }
    });
  }

  // 연강 과다 체크
  const maxConsecutive = parsedConstraints.maxConsecutiveClasses;
  if (maxConsecutive) {
    // 각 요일별로 연속 수업 개수 계산
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > maxConsecutive) {
        const dayLabels: Record<string, string> = {
          'MON': '월요일', 'TUE': '화요일', 'WED': '수요일',
          'THU': '목요일', 'FRI': '금요일', 'SAT': '토요일', 'SUN': '일요일'
        };
        warnings.push(`${dayLabels[day]}에 연속 수업이 ${count}개로 제한(${maxConsecutive}개)을 초과합니다.`);
      }
    });
  }

  return warnings;
}

/**
 * 설명 생성 (한국어 1-2문장)
 */
function generateExplanation(
  candidate: TimetableCandidate,
  targetCredits: number,
  parsedConstraints: any
): string {
  const parts: string[] = [];

  // 학점 달성 여부
  if (Math.abs(candidate.totalCredits - targetCredits) <= 1) {
    parts.push(`목표 학점(${targetCredits}학점)을 달성했습니다.`);
  } else if (candidate.totalCredits < targetCredits) {
    parts.push(`목표 학점보다 ${targetCredits - candidate.totalCredits}학점 부족하지만`);
  } else {
    parts.push(`목표 학점보다 ${candidate.totalCredits - targetCredits}학점 많지만`);
  }

  // 제약 만족도
  const satisfied: string[] = [];
  const unsatisfied: string[] = [];

  if (parsedConstraints.avoidDays && parsedConstraints.avoidDays.length > 0) {
    const usedDays = new Set<DayOfWeek>();
    candidate.courses.forEach(course => {
      course.meetingTimes.forEach(mt => usedDays.add(mt.day));
    });
    const avoided = parsedConstraints.avoidDays.filter((d: DayOfWeek) => !usedDays.has(d));
    if (avoided.length > 0) {
      satisfied.push('회피 요청한 요일을 피했습니다');
    } else {
      unsatisfied.push('일부 회피 요청 요일에 수업이 있습니다');
    }
  }

  if (parsedConstraints.keepLunchTime) {
    const overlapsLunch = candidate.courses.some(course =>
      course.meetingTimes.some(mt => {
        const start = timeToMinutes(mt.startTime);
        const end = timeToMinutes(mt.endTime);
        return !(end <= timeToMinutes('12:00') || start >= timeToMinutes('13:00'));
      })
    );
    if (!overlapsLunch) {
      satisfied.push('점심시간을 비웠습니다');
    } else {
      unsatisfied.push('점심시간이 일부 차단되었습니다');
    }
  }

  if (satisfied.length > 0) {
    parts.push(satisfied.join(', ') + '습니다.');
  } else if (unsatisfied.length > 0) {
    parts.push(unsatisfied.join(', ') + '습니다.');
  } else {
    parts.push('균형잡힌 시간표입니다.');
  }

  return parts.join(' ');
}

/**
 * 결과 설명만 생성 (성공 케이스)
 */
export function generateResultExplanation(
  candidate: TimetableCandidate,
  targetCredits: number,
  parsedConstraints: any
): { explanation: string; warnings: string[] } {
  return {
    explanation: generateExplanation(candidate, targetCredits, parsedConstraints),
    warnings: generateWarnings(candidate, targetCredits, parsedConstraints),
  };
}

/**
 * 실패 설명 생성
 */
export function generateFailureExplanation(
  requestBody: any,
  parsedConstraints: any,
  targetCredits: number,
  blockedTimes: BlockedTime[]
): ErrorResponse {
  const conflictingConstraints: string[] = [];
  const suggestions: string[] = [];

  // 충돌 원인 분석 (추측하지 않고 실제 데이터만 사용)
  if (blockedTimes.length > 0) {
    conflictingConstraints.push('차단 시간');
    suggestions.push('차단 시간을 줄이거나 조정해주세요');
  }

  // Check hard constraints (these are filtered, so if no candidates, they likely caused the issue)
  const hardConstraints = parsedConstraints.hardConstraints || {};
  
  if (hardConstraints.avoidDays && hardConstraints.avoidDays.length > 0) {
    conflictingConstraints.push('회피 요일 (HARD)');
    const dayLabels: Record<DayOfWeek, string> = {
      'MON': '월요일', 'TUE': '화요일', 'WED': '수요일',
      'THU': '목요일', 'FRI': '금요일', 'SAT': '토요일', 'SUN': '일요일'
    };
    suggestions.push(`회피 요일(${hardConstraints.avoidDays.map((d: DayOfWeek) => dayLabels[d]).join(', ')})을 SOFT 제약으로 변경하거나 해제`);
  }
  
  if (hardConstraints.avoidMorning) {
    conflictingConstraints.push('아침 수업 회피 (HARD)');
    suggestions.push('아침 수업 회피를 SOFT 제약으로 변경하거나 해제');
  }
  
  if (hardConstraints.keepLunchTime) {
    conflictingConstraints.push('점심시간 보호 (HARD)');
    suggestions.push('점심시간 보호를 SOFT 제약으로 변경하거나 해제');
  }
  
  // Also check soft constraints (for backward compatibility)
  if (parsedConstraints.avoidDays && parsedConstraints.avoidDays.length > 0 && !hardConstraints.avoidDays) {
    conflictingConstraints.push('회피 요일');
    const dayLabels: Record<DayOfWeek, string> = {
      'MON': '월요일', 'TUE': '화요일', 'WED': '수요일',
      'THU': '목요일', 'FRI': '금요일', 'SAT': '토요일', 'SUN': '일요일'
    };
    suggestions.push(`회피 요일(${parsedConstraints.avoidDays.map((d: DayOfWeek) => dayLabels[d]).join(', ')})을 해제`);
  }

  if (requestBody.basket && requestBody.basket.length > 0) {
    conflictingConstraints.push('고정 과목');
    suggestions.push('고정 과목 1개를 해제해주세요');
  }

  if (targetCredits > 15) {
    suggestions.push(`목표 학점을 ${targetCredits - 3}로 낮추기`);
  }

  return {
    error: 'HARD 제약 조건 충돌',
    details: {
      reason: '제약 조건을 모두 만족하는 시간표를 생성할 수 없습니다.',
      conflictingConstraints: conflictingConstraints.length > 0 ? conflictingConstraints : [],
      suggestions: suggestions.length > 0 ? suggestions : [
        '제약 조건을 완화해주세요',
        '목표 학점을 낮춰주세요',
        '고정 과목을 줄여주세요'
      ]
    }
  };
}

/**
 * 시간표 추천 결과 JSON 응답 생성
 */
export function buildRecommendationResponse(
  input: ResponseBuilderInput
): SuccessResponse | ErrorResponse {
  const { candidateTimetables, parsedConstraints, runMeta, targetCredits, requestBody } = input;

  console.log('=== buildRecommendationResponse ===');
  console.log('Total candidates:', candidateTimetables.length);
  console.log('Target credits:', targetCredits);
  console.log('Parsed constraints:', JSON.stringify(parsedConstraints, null, 2));

  // Helper: Convert day number (0~5) to DayOfWeek
  const dayNumberToDayOfWeek = (dayNum: number): DayOfWeek => {
    const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return days[dayNum] || 'MON';
  };

  // Helper: Convert startHour (0~13) to HH:mm format (0=09:00, 1=10:00, ..., 13=22:00)
  const startHourToTime = (startHour: number): string => {
    const hour = 9 + startHour; // 0=09:00, 1=10:00, ..., 13=22:00
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  // HARD 제약 만족 후보 필터링
  const blockedTimes = (requestBody.blockedTimes || []).map((bt: any) => {
    // New format: day, start, end are numbers (0~13)
    if (typeof bt.day === 'number' && typeof bt.start === 'number' && typeof bt.end === 'number') {
      return {
        day: dayNumberToDayOfWeek(bt.day),
        startTime: startHourToTime(bt.start),
        endTime: startHourToTime(bt.end),
      };
    }
    
    // Old format: already converted strings
    return {
      day: bt.day as DayOfWeek,
      startTime: bt.startTime || bt.start,
      endTime: bt.endTime || bt.end,
    };
  }).filter((bt: any) => bt.day && bt.startTime && bt.endTime) as BlockedTime[];

  console.log('Blocked times:', JSON.stringify(blockedTimes, null, 2));

  const validCandidates = candidateTimetables.filter(candidate =>
    satisfiesHardConstraints(candidate, parsedConstraints, blockedTimes)
  );

  console.log('Valid candidates (HARD satisfied):', validCandidates.length);
  console.log('Invalid candidates:', candidateTimetables.length - validCandidates.length);

  // HARD 제약 만족 후보가 없으면 실패 응답
  if (validCandidates.length === 0) {
    return generateFailureExplanation(requestBody, parsedConstraints, targetCredits, blockedTimes);
  }

  // score 내림차순 정렬
  const sortedCandidates = [...validCandidates].sort((a, b) => b.score - a.score);

  // 상위 3개 선택
  const topCandidates = sortedCandidates.slice(0, 3);

  // 요일을 숫자로 변환 (0=월요일, 1=화요일, ...)
  const dayToNumber: Record<DayOfWeek, number> = {
    'MON': 0,
    'TUE': 1,
    'WED': 2,
    'THU': 3,
    'FRI': 4,
    'SAT': 5,
    'SUN': 6,
  };

  // 색상 할당 (각 후보 내에서 중복 없이)
  const recommendations = topCandidates.map((candidate, rankIndex) => {
    const usedColors = new Set<string>();
    const coursesWithColor: FrontendCourse[] = candidate.courses.map((course, courseIndex) => {
      let color: string;
      let attempts = 0;
      do {
        color = PASTEL_COLORS[(rankIndex * 10 + courseIndex + attempts) % PASTEL_COLORS.length];
        attempts++;
      } while (usedColors.has(color) && attempts < PASTEL_COLORS.length);
      usedColors.add(color);

      // 🔍 DEBUG: Log raw course data
      if (rankIndex === 0 && courseIndex < 3) {
        console.log(`🔍 RAW BACKEND DATA CHECK:`);
        console.log(`📋 Recommendation ${rankIndex}, Course ${courseIndex}:`);
        console.log(`  Course ID: ${course.courseId}`);
        console.log(`  Course Name: ${course.name}`);
        console.log(`  meetingTimes (raw):`, JSON.stringify(course.meetingTimes, null, 2));
        console.log(`  meetingTimes length: ${course.meetingTimes?.length || 0}`);
      }

      // 첫 번째 meeting time 사용 (일반적으로 하나의 시간대)
      // meetingTimes가 비어있을 수 있으므로 체크
      if (!course.meetingTimes || course.meetingTimes.length === 0) {
        // meetingTimes가 없으면 경고 로그 출력
        console.warn(`[WARNING] Course "${course.name}" (${course.courseId}) has no meetingTimes. Using default values.`);
        // meetingTimes가 없으면 기본값 사용
        const defaultCourse = {
          id: course.courseId,
          name: course.name,
          code: course.courseId,
          credits: course.credits,
          professor: course.instructor || '',
          type: course.deliveryType || course.category || 'OFFLINE',
          day: 0, // 기본값: 월요일
          startHour: 9, // 기본값: 09:00
          duration: 2, // 기본값: 1시간
          color,
        };
        if (rankIndex === 0 && courseIndex < 3) {
          console.log(`  → Using DEFAULT values: day=${defaultCourse.day}, startHour=${defaultCourse.startHour}, duration=${defaultCourse.duration}`);
        }
        return defaultCourse;
      }

      const firstMeeting = course.meetingTimes[0];
      if (!firstMeeting || !firstMeeting.startTime || !firstMeeting.endTime) {
        // firstMeeting이 유효하지 않으면 기본값 사용
        console.warn(`[WARNING] Course "${course.name}" (${course.courseId}) has invalid firstMeeting:`, firstMeeting);
        const defaultCourse = {
          id: course.courseId,
          name: course.name,
          code: course.courseId,
          credits: course.credits,
          professor: course.instructor || '',
          type: course.deliveryType || course.category || 'OFFLINE',
          day: 0, // 기본값: 월요일
          startHour: 9, // 기본값: 09:00
          duration: 2, // 기본값: 1시간
          color,
        };
        if (rankIndex === 0 && courseIndex < 3) {
          console.log(`  → Using DEFAULT values (invalid firstMeeting): day=${defaultCourse.day}, startHour=${defaultCourse.startHour}, duration=${defaultCourse.duration}`);
        }
        return defaultCourse;
      }

      const startHour = parseInt(firstMeeting.startTime.split(':')[0], 10);
      const endHour = parseInt(firstMeeting.endTime.split(':')[0], 10);
      const duration = endHour - startHour;
      const day = dayToNumber[firstMeeting.day] ?? 0;

      const frontendCourse = {
        id: course.courseId,
        name: course.name,
        code: course.courseId,
        credits: course.credits,
        professor: course.instructor || '',
        type: course.deliveryType || course.category || 'OFFLINE',
        day,
        startHour,
        duration,
        color,
      };

      // 🔍 DEBUG: Log parsed result
      if (rankIndex === 0 && courseIndex < 3) {
        console.log(`  → Parsed result: day=${day} (${firstMeeting.day}), startHour=${startHour} (${firstMeeting.startTime}), duration=${duration} (${firstMeeting.startTime}-${firstMeeting.endTime})`);
        console.log(`  → Final frontend course:`, JSON.stringify(frontendCourse, null, 2));
      }

      return frontendCourse;
    });

    const warnings = generateWarnings(candidate, targetCredits, parsedConstraints);
    const explanation = generateExplanation(candidate, targetCredits, parsedConstraints);

    const recommendation = {
      rank: rankIndex + 1,
      totalCredits: candidate.totalCredits,
      score: candidate.score,
      explanation,
      warnings,
      courses: coursesWithColor,
    };

    // 🔍 DEBUG: Log first recommendation's courses
    if (rankIndex === 0) {
      console.log(`📊 Full response structure for Recommendation ${rankIndex}:`);
      console.log(`  Total courses: ${coursesWithColor.length}`);
      if (coursesWithColor.length > 0) {
        console.log(`  First course RAW:`, JSON.stringify(coursesWithColor[0], null, 2));
      }
      if (coursesWithColor.length > 1) {
        console.log(`  Second course RAW:`, JSON.stringify(coursesWithColor[1], null, 2));
      }
      if (coursesWithColor.length > 2) {
        console.log(`  Third course RAW:`, JSON.stringify(coursesWithColor[2], null, 2));
      }
    }

    return recommendation;
  });

  const response = {
    recommendations,
    debug: {
      candidatesGenerated: runMeta.candidatesGenerated,
      geminiUsed: runMeta.geminiUsed,
      executionTime: runMeta.executionTime,
    },
  };

  // 🔍 DEBUG: Log full response structure
  console.log(`📊 Full response structure:`, JSON.stringify(response, null, 2));

  return response;
}
