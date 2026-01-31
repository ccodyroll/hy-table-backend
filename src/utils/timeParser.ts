import { TimeSlot, DayOfWeek } from '../types';

/**
 * Parse Korean day names to DayOfWeek
 */
export function parseKoreanDay(dayStr: string): DayOfWeek | null {
  const dayMap: Record<string, DayOfWeek> = {
    '월': 'MON',
    '화': 'TUE',
    '수': 'WED',
    '목': 'THU',
    '금': 'FRI',
    '토': 'SAT',
    '일': 'SUN',
    '월요일': 'MON',
    '화요일': 'TUE',
    '수요일': 'WED',
    '목요일': 'THU',
    '금요일': 'FRI',
    '토요일': 'SAT',
    '일요일': 'SUN',
  };

  return dayMap[dayStr] || null;
}

/**
 * Parse time string (e.g., "09:00-10:30", "09:00~10:30", "9:00-10:30")
 */
export function parseTimeRange(timeStr: string): { start: string; end: string } | null {
  if (!timeStr) return null;

  // Normalize separators
  const normalized = timeStr.replace(/[~-]/g, '-').trim();
  const parts = normalized.split('-').map(p => p.trim());

  if (parts.length !== 2) return null;

  const start = normalizeTime(parts[0]);
  const end = normalizeTime(parts[1]);

  if (!start || !end) return null;

  return { start, end };
}

/**
 * Normalize time string to HH:mm format
 */
function normalizeTime(timeStr: string): string | null {
  if (!timeStr) return null;

  // Remove common suffixes
  timeStr = timeStr.replace(/시|분/g, '').trim();

  // Match patterns like "9:00", "09:00", "9", "09"
  const match = timeStr.match(/^(\d{1,2}):?(\d{2})?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Parse meeting time string from Airtable
 * Examples: "월 09:00-10:30", "월/수 09:00-10:30", "월 09:00-10:30, 수 11:00-12:30"
 * Also supports: "MON 09:00-10:30", "월요일 09:00-10:30", "월 9:00-10:30"
 */
export function parseMeetingTimes(meetingTimeStr: string): TimeSlot[] {
  if (!meetingTimeStr || typeof meetingTimeStr !== 'string') return [];

  const slots: TimeSlot[] = [];
  
  // Normalize the string: remove extra whitespace
  const normalized = meetingTimeStr.trim();
  if (!normalized) return [];

  // Split by comma first (for multiple time slots)
  const parts = normalized.split(',').map(p => p.trim()).filter(p => p);

  for (const part of parts) {
    // Try multiple patterns
    
    // Pattern 1: Korean day with time "월 09:00-10:30" or "월/수 09:00-10:30"
    let dayTimeMatch = part.match(/^([월화수목금토일]+(?:\/[월화수목금토일]+)*)\s+(.+)$/);
    
    // Pattern 2: English day "MON 09:00-10:30" or "MON/WED 09:00-10:30"
    if (!dayTimeMatch) {
      dayTimeMatch = part.match(/^(MON|TUE|WED|THU|FRI|SAT|SUN)(?:\/(MON|TUE|WED|THU|FRI|SAT|SUN))?\s+(.+)$/i);
      if (dayTimeMatch) {
        // Convert English days to Korean format for parsing
        const englishToKorean: Record<string, string> = {
          'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토', 'SUN': '일'
        };
        const day1 = englishToKorean[dayTimeMatch[1].toUpperCase()];
        const day2 = dayTimeMatch[2] ? englishToKorean[dayTimeMatch[2].toUpperCase()] : null;
        dayTimeMatch = [dayTimeMatch[0], day2 ? `${day1}/${day2}` : day1, dayTimeMatch[3]];
      }
    }
    
    // Pattern 3: Korean day with 요일 suffix "월요일 09:00-10:30"
    if (!dayTimeMatch) {
      dayTimeMatch = part.match(/^([월화수목금토일]요일)(?:\/([월화수목금토일]요일))?\s+(.+)$/);
      if (dayTimeMatch) {
        const day1 = dayTimeMatch[1].replace('요일', '');
        const day2 = dayTimeMatch[2] ? dayTimeMatch[2].replace('요일', '') : null;
        dayTimeMatch = [dayTimeMatch[0], day2 ? `${day1}/${day2}` : day1, dayTimeMatch[3]];
      }
    }
    
    if (!dayTimeMatch) {
      // Try to extract just time range if no day is specified (assume all days or skip)
      const timeRange = parseTimeRange(part);
      if (timeRange) {
        // If only time is found, we can't determine the day, so skip
        console.warn(`[WARNING] Found time range "${part}" but no day specified. Skipping.`);
      }
      continue;
    }

    const daysStr = dayTimeMatch[1];
    const timeStr = dayTimeMatch[2];

    const timeRange = parseTimeRange(timeStr);
    if (!timeRange) {
      console.warn(`[WARNING] Failed to parse time range from "${timeStr}" in "${part}"`);
      continue;
    }

    // Handle multiple days separated by /
    const dayParts = daysStr.split('/');
    for (const dayPart of dayParts) {
      const day = parseKoreanDay(dayPart.trim());
      if (day) {
        slots.push({
          day,
          startTime: timeRange.start,
          endTime: timeRange.end,
        });
      } else {
        console.warn(`[WARNING] Failed to parse day from "${dayPart}" in "${part}"`);
      }
    }
  }

  return slots;
}

/**
 * Check if two time slots overlap
 */
export function timeSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  if (slot1.day !== slot2.day) return false;

  const start1 = timeToMinutes(slot1.startTime);
  const end1 = timeToMinutes(slot1.endTime);
  const start2 = timeToMinutes(slot2.startTime);
  const end2 = timeToMinutes(slot2.endTime);

  return start1 < end2 && start2 < end1;
}

/**
 * Convert time string to minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Check if time is in morning (before 12:00)
 */
export function isMorningTime(timeStr: string): boolean {
  const minutes = timeToMinutes(timeStr);
  return minutes < 12 * 60; // Before 12:00
}

/**
 * Check if time slot overlaps with lunch time (12:00-13:00)
 */
export function overlapsLunchTime(slot: TimeSlot): boolean {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  const lunchStart = 12 * 60; // 12:00
  const lunchEnd = 13 * 60; // 13:00

  return start < lunchEnd && end > lunchStart;
}

/**
 * Validate time string format (HH:MM)
 */
export function isValidTimeFormat(timeStr: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
}

/**
 * Validate that start time is before end time
 */
export function isValidTimeRange(startTime: string, endTime: string): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return start < end;
}

/**
 * Check if a time slot overlaps with any blocked time
 */
export function overlapsWithBlockedTime(slot: TimeSlot, blockedTime: { day: DayOfWeek; startTime: string; endTime: string }): boolean {
  if (slot.day !== blockedTime.day) return false;
  return timeSlotsOverlap(slot, {
    day: blockedTime.day,
    startTime: blockedTime.startTime,
    endTime: blockedTime.endTime,
  });
}
