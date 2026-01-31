/**
 * Airtable service for fetching course data
 * Includes in-memory caching with TTL to reduce API calls
 */

import Airtable from 'airtable';
import { logger } from '../utils/logger';
import { parseMeetingTimes, TimeSlot } from '../utils/time';

export interface Course {
  courseId: string;
  name: string;
  credits: number;
  department?: string;
  major?: string;
  track?: string;
  tags?: string[];
  meetingTimes: TimeSlot[];
  restrictions?: string;
  description?: string;
  instructor?: string;
  online?: boolean;
  teamProject?: boolean;
}

interface CacheEntry {
  courses: Course[];
  timestamp: number;
}

class AirtableService {
  private base: Airtable.Base;
  private cache: CacheEntry | null = null;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly tableName: string;

  constructor() {
    const apiKey = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    this.tableName = process.env.AIRTABLE_TABLE_NAME || 'Courses';

    if (!apiKey || !baseId) {
      throw new Error('Missing required Airtable environment variables: AIRTABLE_TOKEN, AIRTABLE_BASE_ID');
    }

    Airtable.configure({ apiKey });
    this.base = Airtable.base(baseId);
  }

  /**
   * Normalize Airtable record to Course schema
   * Adapt field names based on your Airtable schema
   */
  private normalizeRecord(record: Airtable.Record<Airtable.FieldSet>): Course | null {
    try {
      const fields = record.fields;

      // Map common Airtable field names (adjust based on your schema)
      const courseId = (fields.course_id || fields['Course ID'] || fields.id || record.id) as string;
      const name = (fields.name || fields.Name || fields.title || fields.Title) as string;
      const credits = Number(fields.credits || fields.Credits || fields.credit || 0);
      const department = (fields.department || fields.Department || fields.dept) as string | undefined;
      const major = (fields.major || fields.Major || fields.major_field) as string | undefined;
      const track = (fields.track || fields.Track || fields.major_track) as string | undefined;
      const tags = Array.isArray(fields.tags || fields.Tags || fields.keywords) 
        ? (fields.tags || fields.Tags || fields.keywords) as string[]
        : undefined;
      const meetingTimeStr = (fields.meeting_times || fields['Meeting Times'] || fields.schedule || fields.time) as string | undefined;
      const restrictions = (fields.restrictions || fields.Restrictions || fields.prerequisites) as string | undefined;
      const description = (fields.description || fields.Description || fields.desc) as string | undefined;
      const instructor = (fields.instructor || fields.Instructor || fields.professor) as string | undefined;
      const online = Boolean(fields.online || fields.Online || fields.is_online);
      const teamProject = Boolean(fields.team_project || fields['Team Project'] || fields.has_team_project);

      if (!courseId || !name) {
        logger.warn('Skipping record with missing courseId or name', { recordId: record.id });
        return null;
      }

      // Parse meeting times
      let meetingTimes: TimeSlot[] = [];
      if (meetingTimeStr && typeof meetingTimeStr === 'string') {
        try {
          meetingTimes = parseMeetingTimes(meetingTimeStr);
        } catch (error) {
          logger.warn('Failed to parse meeting times', { 
            courseId, 
            meetingTimeStr,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return {
        courseId: String(courseId),
        name: String(name),
        credits: credits || 0,
        department: department ? String(department) : undefined,
        major: major ? String(major) : undefined,
        track: track ? String(track) : undefined,
        tags: tags,
        meetingTimes,
        restrictions: restrictions ? String(restrictions) : undefined,
        description: description ? String(description) : undefined,
        instructor: instructor ? String(instructor) : undefined,
        online,
        teamProject
      };
    } catch (error) {
      logger.error('Error normalizing Airtable record', error, { recordId: record.id });
      return null;
    }
  }

  /**
   * Fetch all courses from Airtable
   */
  private async fetchAllCourses(): Promise<Course[]> {
    const courses: Course[] = [];

    try {
      await this.base(this.tableName).select({
        // Fetch all fields
        view: 'Grid view' // or your preferred view
      }).eachPage((records, fetchNextPage) => {
        for (const record of records) {
          const course = this.normalizeRecord(record);
          if (course) {
            courses.push(course);
          }
        }
        fetchNextPage();
      });

      logger.info('Fetched courses from Airtable', { count: courses.length });
      return courses;
    } catch (error) {
      logger.error('Error fetching courses from Airtable', error);
      throw error;
    }
  }

  /**
   * Get all courses (with caching)
   */
  async getAllCourses(): Promise<Course[]> {
    const now = Date.now();

    // Check cache validity
    if (this.cache && (now - this.cache.timestamp) < this.cacheTTL) {
      logger.debug('Returning cached courses', { count: this.cache.courses.length });
      return this.cache.courses;
    }

    // Fetch fresh data
    const courses = await this.fetchAllCourses();
    this.cache = {
      courses,
      timestamp: now
    };

    return courses;
  }

  /**
   * Get courses filtered by major and/or search query
   */
  async getCourses(filters?: { major?: string; query?: string }): Promise<Course[]> {
    const allCourses = await this.getAllCourses();

    let filtered = allCourses;

    // Filter by major
    if (filters?.major) {
      const majorLower = filters.major.toLowerCase();
      filtered = filtered.filter(course => 
        course.major?.toLowerCase().includes(majorLower) ||
        course.department?.toLowerCase().includes(majorLower)
      );
    }

    // Filter by search query
    if (filters?.query) {
      const queryLower = filters.query.toLowerCase();
      filtered = filtered.filter(course =>
        course.name.toLowerCase().includes(queryLower) ||
        course.courseId.toLowerCase().includes(queryLower) ||
        course.description?.toLowerCase().includes(queryLower) ||
        course.tags?.some(tag => tag.toLowerCase().includes(queryLower))
      );
    }

    return filtered;
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache = null;
    logger.info('Airtable cache cleared');
  }
}

// Singleton instance
let airtableService: AirtableService | null = null;

export function getAirtableService(): AirtableService {
  if (!airtableService) {
    airtableService = new AirtableService();
  }
  return airtableService;
}
