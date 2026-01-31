import Airtable from 'airtable';
import { Course, AirtableRecord } from '../types';
import { parseMeetingTimes } from '../utils/timeParser';

interface CacheEntry {
  data: Course[];
  timestamp: number;
}

class AirtableService {
  private base: Airtable.Base;
  private cache: CacheEntry | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const token = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!token || !baseId) {
      throw new Error('AIRTABLE_TOKEN and AIRTABLE_BASE_ID must be set');
    }

    Airtable.configure({ apiKey: token });
    this.base = Airtable.base(baseId);
  }

  /**
   * Fetch all courses from Airtable with caching
   */
  async getCourses(major?: string, query?: string): Promise<Course[]> {
    // Check cache
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      let courses = this.cache.data;
      
      // Apply filters
      if (major) {
        courses = courses.filter(c => c.major === major);
      }
      if (query) {
        const lowerQuery = query.toLowerCase();
        courses = courses.filter(c => 
          c.name.toLowerCase().includes(lowerQuery) ||
          c.courseId.toLowerCase().includes(lowerQuery) ||
          c.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
      }
      
      return courses;
    }

    // Fetch from Airtable
    const tableName = process.env.AIRTABLE_TABLE_NAME || 'Courses';
    const records: AirtableRecord[] = [];

    try {
      await this.base(tableName)
        .select({
          view: 'Grid view', // Adjust if needed
        })
        .eachPage((pageRecords, fetchNextPage) => {
          records.push(...pageRecords as any);
          fetchNextPage();
        });

      // Normalize records to Course objects
      const courses = records.map(record => this.normalizeRecord(record));

      // Update cache
      this.cache = {
        data: courses,
        timestamp: Date.now(),
      };

      // Apply filters
      let filtered = courses;
      if (major) {
        filtered = filtered.filter(c => c.major === major);
      }
      if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter(c => 
          c.name.toLowerCase().includes(lowerQuery) ||
          c.courseId.toLowerCase().includes(lowerQuery) ||
          c.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
      }

      return filtered;
    } catch (error) {
      console.error('Error fetching from Airtable:', error);
      throw new Error('Failed to fetch courses from Airtable');
    }
  }

  /**
   * Normalize Airtable record to Course object
   * Adjust field names based on your Airtable schema
   */
  private normalizeRecord(record: AirtableRecord): Course {
    const fields = record.fields;

    // Parse meeting times - adjust field name as needed
    const meetingTimeStr = fields.meetingTimes || fields['Meeting Times'] || fields['시간'] || '';
    const meetingTimes = parseMeetingTimes(meetingTimeStr);

    // Parse tags - handle both string and array formats
    let tags: string[] = [];
    if (Array.isArray(fields.tags || fields['Tags'] || fields['태그'])) {
      tags = fields.tags || fields['Tags'] || fields['태그'] || [];
    } else if (typeof (fields.tags || fields['Tags'] || fields['태그']) === 'string') {
      tags = (fields.tags || fields['Tags'] || fields['태그'] || '').split(',').map((t: string) => t.trim());
    }

    // Parse delivery type
    const deliveryTypeStr = (fields.deliveryType || fields['Delivery Type'] || fields['수업방식'] || 'OFFLINE').toString().toUpperCase();
    const deliveryType = ['ONLINE', 'OFFLINE', 'HYBRID'].includes(deliveryTypeStr) 
      ? deliveryTypeStr as 'ONLINE' | 'OFFLINE' | 'HYBRID'
      : 'OFFLINE';

    // Parse restrictions
    let restrictions: string[] = [];
    if (Array.isArray(fields.restrictions || fields['Restrictions'] || fields['제한사항'])) {
      restrictions = fields.restrictions || fields['Restrictions'] || fields['제한사항'] || [];
    } else if (typeof (fields.restrictions || fields['Restrictions'] || fields['제한사항']) === 'string') {
      restrictions = (fields.restrictions || fields['Restrictions'] || fields['제한사항'] || '').split(',').map((r: string) => r.trim());
    }

    return {
      courseId: (fields.courseId || fields['Course ID'] || fields['과목코드'] || fields.id || record.id).toString(),
      name: (fields.name || fields['Name'] || fields['과목명'] || '').toString(),
      credits: Number(fields.credits || fields['Credits'] || fields['학점'] || 0),
      major: (fields.major || fields['Major'] || fields['전공'] || '').toString(),
      category: (fields.category || fields['Category'] || fields['분류'] || '').toString(),
      tags,
      meetingTimes,
      deliveryType,
      restrictions,
      instructor: fields.instructor || fields['Instructor'] || fields['교수'] || undefined,
      capacity: fields.capacity || fields['Capacity'] || fields['정원'] ? Number(fields.capacity || fields['Capacity'] || fields['정원']) : undefined,
      enrolled: fields.enrolled || fields['Enrolled'] || fields['수강인원'] ? Number(fields.enrolled || fields['Enrolled'] || fields['수강인원']) : undefined,
    };
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache = null;
  }
}

export default new AirtableService();
