// Core domain types

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface TimeSlot {
  day: DayOfWeek;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  location?: string; // 강의실 정보 (예: "경영관 203강의실")
}

export interface Course {
  courseId: string;
  name: string;
  credits: number;
  major: string;
  category: string;
  tags: string[];
  meetingTimes: TimeSlot[];
  schedule_text?: string; // Original schedule text from Airtable
  deliveryType: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  restrictions?: string[];
  instructor?: string;
  capacity?: number;
  enrolled?: number;
}

export interface FixedLecture {
  courseId: string;
  meetingTimes: TimeSlot[];
}

export interface BlockedTime {
  day: DayOfWeek;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  label?: string; // Optional label (e.g., "알바", "동아리")
}

export interface UserConstraints {
  avoidDays?: DayOfWeek[];
  preferOnlineOnlyDays?: DayOfWeek[];
  avoidMorning?: boolean | null;
  keepLunchTime?: boolean | null;
  maxClassesPerDay?: number | null;
  maxConsecutiveClasses?: number | null;
  avoidTeamProjects?: boolean | null;
  preferOnlineClasses?: boolean | null;
  targetCredits?: string | null; // Format: "15" or "12~18"
  notes?: string | null;
}

export interface RecommendationRequest {
  user: {
    name: string;
    major: string;
    studentIdYear: number;
    grade: number;
    semester: number;
  };
  targetCredits: number;
  fixedLectures: FixedLecture[];
  blockedTimes: BlockedTime[];
  strategy: 'MAJOR_FOCUS' | 'MIX' | 'INTEREST_FOCUS';
  tracks: string[];
  interests: string[];
  constraints: UserConstraints;
  freeTextRequest?: string;
}

export interface TimetableCandidate {
  courses: Course[];
  totalCredits: number;
  score: number;
  timetableGrid: TimeSlot[];
  conflicts: string[];
  warnings: string[];
}

export interface RecommendationResponse {
  recommendations: Array<{
    rank: number;
    totalCredits: number;
    score: number;
    explanation: string;
    warnings: string[];
    courses: Course[];
    timetableGrid: TimeSlot[];
  }>;
  debug: {
    candidatesGenerated: number;
    geminiUsed: boolean;
    blockedTimesApplied?: boolean;
    blockedTimesCount?: number;
    combinationsFilteredByBlockedTimes?: number;
  };
}

export interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
}
