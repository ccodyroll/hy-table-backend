import { TimeSlot, DayOfWeek } from './types.ts';

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

  // "무"는 처리하지 않음 (null 반환)
  if (dayStr === '무') {
    return null;
  }

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
 */
export function parseMeetingTimes(meetingTimeStr: string): TimeSlot[] {
  if (!meetingTimeStr || typeof meetingTimeStr !== 'string') return [];

  const slots: TimeSlot[] = [];
  const normalized = meetingTimeStr.trim();
  if (!normalized) return [];

  // Check if this is pipe-separated format first
  const isPipeFormat = normalized.match(/^[월화수목금토일무]+\|/);
  if (isPipeFormat) {
    const pipeParts = normalized.split(/\s*\/\s*/).map(p => p.trim()).filter(p => p);
    
    for (const pipePart of pipeParts) {
      if (!pipePart.match(/^[월화수목금토일무]+\|/)) {
        continue;
      }
      
      const segments = pipePart.split('|').map(s => s.trim()).filter(s => s);
      if (segments.length >= 2) {
        const dayStr = segments[0];
        const timeStr = segments[1];
        const location = segments.length >= 4 ? segments[3] : undefined;
        
        const day = parseKoreanDay(dayStr);
        const timeRange = parseTimeRange(timeStr);
        
        if (day && timeRange) {
          slots.push({
            day,
            startTime: timeRange.start,
            endTime: timeRange.end,
            location: location,
          });
        }
      }
    }
    
    if (slots.length > 0) {
      return slots;
    }
  }

  // Split by semicolon or comma
  const parts = normalized.split(/[;,]/).map(p => p.trim()).filter(p => p);

  for (let part of parts) {
    let location: string | undefined;
    const isPattern0 = part.match(/^[월화수목금토일]+\([^)]+\)$/);
    
    if (!isPattern0) {
      const locationMatch = part.match(/\s+\(([^)]+)\)\s*$/);
      if (locationMatch) {
        location = locationMatch[1].trim();
      }
    }
    
    const partWithoutLocation = part.replace(/\s+\([^)]+\)\s*$/g, '').trim();
    part = partWithoutLocation;
    
    // Pattern 0: Airtable format "수(15:00-17:00)"
    let dayTimeMatch = part.match(/^([월화수목금토일]+)\((.+)\)$/);
    if (dayTimeMatch) {
      const daysStr = dayTimeMatch[1];
      const timeStr = dayTimeMatch[2];
      const timeRange = parseTimeRange(timeStr);
      if (timeRange) {
        const dayParts = daysStr.split(/[/,]/).map(d => d.trim());
        for (const dayPart of dayParts) {
          const day = parseKoreanDay(dayPart);
          if (day) {
            slots.push({
              day,
              startTime: timeRange.start,
              endTime: timeRange.end,
              location: location,
            });
          }
        }
        continue;
      }
    }
    
    // Pattern 1: Korean day with time "월 09:00-10:30"
    dayTimeMatch = part.match(/^([월화수목금토일]+(?:\/[월화수목금토일]+)*)\s+(.+)$/);
    
    // Pattern 2: English day "MON 09:00-10:30"
    if (!dayTimeMatch) {
      dayTimeMatch = part.match(/^(MON|TUE|WED|THU|FRI|SAT|SUN)(?:\/(MON|TUE|WED|THU|FRI|SAT|SUN))?\s+(.+)$/i);
      if (dayTimeMatch) {
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
      continue;
    }

    const daysStr = dayTimeMatch[1];
    const timeStr = dayTimeMatch[2].trim();

    const timeRange = parseTimeRange(timeStr);
    if (!timeRange) {
      continue;
    }

    const dayParts = daysStr.split('/');
    for (const dayPart of dayParts) {
      const day = parseKoreanDay(dayPart.trim());
      if (day) {
        slots.push({
          day,
          startTime: timeRange.start,
          endTime: timeRange.end,
          location: location,
        });
      }
    }
  }

  return slots;
}

/**
 * Convert time string to minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}
