/**
 * Time parsing and overlap detection utilities
 */

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface TimeSlot {
  day: DayOfWeek;
  start: string; // HH:MM format
  end: string;   // HH:MM format
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours >= 24 || minutes < 0 || minutes >= 60) {
    throw new Error(`Invalid time format: ${time}`);
  }
  return hours * 60 + minutes;
}

/**
 * Check if two time slots overlap
 */
export function timeSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  if (slot1.day !== slot2.day) {
    return false;
  }

  const start1 = timeToMinutes(slot1.start);
  const end1 = timeToMinutes(slot1.end);
  const start2 = timeToMinutes(slot2.start);
  const end2 = timeToMinutes(slot2.end);

  // Check for overlap: start1 < end2 && start2 < end1
  return start1 < end2 && start2 < end1;
}

/**
 * Parse meeting time string from Airtable
 * Supports formats like:
 * - "Mon 09:00-10:15, Wed 09:00-10:15"
 * - "Monday 9:00 AM - 10:15 AM"
 * - "MON 09:00-10:15"
 */
export function parseMeetingTimes(timeString: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const dayMap: Record<string, DayOfWeek> = {
    'mon': 'MON', 'monday': 'MON',
    'tue': 'TUE', 'tuesday': 'TUE',
    'wed': 'WED', 'wednesday': 'WED',
    'thu': 'THU', 'thursday': 'THU',
    'fri': 'FRI', 'friday': 'FRI',
    'sat': 'SAT', 'saturday': 'SAT',
    'sun': 'SUN', 'sunday': 'SUN'
  };

  // Split by comma or semicolon
  const parts = timeString.split(/[,;]/).map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    // Match patterns like "Mon 09:00-10:15" or "Monday 9:00 AM - 10:15 AM"
    const dayMatch = part.match(/^([a-z]+)\s+/i);
    if (!dayMatch) continue;

    const dayKey = dayMatch[1].toLowerCase();
    const day = dayMap[dayKey];
    if (!day) continue;

    // Extract time range
    const timeRange = part.substring(dayMatch[0].length).trim();
    
    // Match HH:MM-HH:MM or H:MM AM/PM - H:MM AM/PM
    const timeMatch = timeRange.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    
    if (timeMatch) {
      let startHours = parseInt(timeMatch[1], 10);
      const startMinutes = parseInt(timeMatch[2], 10);
      const startAmPm = timeMatch[3]?.toUpperCase();
      let endHours = parseInt(timeMatch[4], 10);
      const endMinutes = parseInt(timeMatch[5], 10);
      const endAmPm = timeMatch[6]?.toUpperCase();

      // Convert 12-hour to 24-hour format
      if (startAmPm === 'PM' && startHours !== 12) startHours += 12;
      if (startAmPm === 'AM' && startHours === 12) startHours = 0;
      if (endAmPm === 'PM' && endHours !== 12) endHours += 12;
      if (endAmPm === 'AM' && endHours === 12) endHours = 0;

      const start = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
      const end = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

      slots.push({ day, start, end });
    } else {
      // Try simpler format: HH:MM-HH:MM
      const simpleMatch = timeRange.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
      if (simpleMatch) {
        const startHours = parseInt(simpleMatch[1], 10);
        const startMinutes = parseInt(simpleMatch[2], 10);
        const endHours = parseInt(simpleMatch[3], 10);
        const endMinutes = parseInt(simpleMatch[4], 10);

        const start = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
        const end = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

        slots.push({ day, start, end });
      }
    }
  }

  return slots;
}

/**
 * Check if a course's meeting times overlap with any blocked times
 */
export function hasTimeConflict(
  courseTimes: TimeSlot[],
  blockedTimes: TimeSlot[]
): boolean {
  for (const courseTime of courseTimes) {
    for (const blockedTime of blockedTimes) {
      if (timeSlotsOverlap(courseTime, blockedTime)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if two courses have overlapping meeting times
 */
export function coursesOverlap(course1Times: TimeSlot[], course2Times: TimeSlot[]): boolean {
  for (const time1 of course1Times) {
    for (const time2 of course2Times) {
      if (timeSlotsOverlap(time1, time2)) {
        return true;
      }
    }
  }
  return false;
}
