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
  private cachePromise: Promise<Course[]> | null = null; // Promise caching for concurrent requests
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
   * Uses Promise caching to prevent concurrent duplicate API calls
   */
  async getCourses(major?: string, query?: string): Promise<Course[]> {
    // Check cache first
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      const courses = this.cache.data;
      const filtered = this.filterCourses(courses, major, query);
      console.log(`Airtable (cached): Filtered to ${filtered.length} courses (major: ${major || 'none'})`);
      return filtered;
    }

    // If a fetch is already in progress, wait for it
    if (this.cachePromise) {
      console.log('Airtable: Waiting for ongoing fetch...');
      const courses = await this.cachePromise;
      const filtered = this.filterCourses(courses, major, query);
      return filtered;
    }

    // Start new fetch and cache the Promise
    this.cachePromise = this.fetchFromAirtable();

    try {
      const courses = await this.cachePromise;
      
      // Update cache
      this.cache = {
        data: courses,
        timestamp: Date.now(),
      };

      const filtered = this.filterCourses(courses, major, query);
      console.log(`Airtable: Fetched ${courses.length} total courses, filtered to ${filtered.length} courses (major: ${major || 'none'})`);
      return filtered;
    } catch (error) {
      console.error('=== ERROR fetching from Airtable ===');
      console.error('Error:', error);
      console.error('Major filter:', major);
      console.error('Query filter:', query);
      
      // Return empty array instead of throwing to allow graceful degradation
      console.warn('Returning empty courses array due to Airtable error');
      return [];
    } finally {
      // Clear the Promise cache after fetch completes (success or failure)
      this.cachePromise = null;
    }
  }

  /**
   * Fetch courses from Airtable API
   * Private method that performs the actual API call
   */
  private async fetchFromAirtable(): Promise<Course[]> {
    const tableName = process.env.AIRTABLE_TABLE_NAME || 'Courses';
    const records: AirtableRecord[] = [];

    await this.base(tableName)
      .select({
        view: 'Grid view', // Adjust if needed
      })
      .eachPage((pageRecords, fetchNextPage) => {
        // Convert Airtable Records to our AirtableRecord type
        for (const record of pageRecords) {
          records.push({
            id: record.id,
            fields: record.fields,
          });
        }
        fetchNextPage();
      });

    // Normalize records to Course objects
    const courses = records.map(record => this.normalizeRecord(record));
    console.log(`Airtable: Fetched ${records.length} records, normalized to ${courses.length} courses`);
    
    return courses;
  }

  /**
   * Filter courses by major and/or query
   * Extracted to avoid code duplication
   */
  private filterCourses(courses: Course[], major?: string, query?: string): Course[] {
    let filtered = courses;

    if (major) {
      // More flexible major matching (partial match or exact match)
      const majorLower = major.toLowerCase();
      filtered = filtered.filter(c => {
        const courseMajor = (c.major || '').toLowerCase();
        return courseMajor === majorLower || 
               courseMajor.includes(majorLower) || 
               majorLower.includes(courseMajor);
      });
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
  }

  /**
   * Normalize Airtable record to Course object
   * Adjust field names based on your Airtable schema
   */
  private normalizeRecord(record: AirtableRecord): Course {
    const fields = record.fields;

    // Parse meeting times - adjust field name as needed
    // Try multiple possible field names (case-insensitive search)
    const courseName = fields.name || fields['Name'] || fields['과목명'] || record.id;
    const allFieldKeys = Object.keys(fields);
    
    // Try exact matches first
    let meetingTimeValue: any = fields['요일_시간'] ||
                                fields['요일 시간'] ||
                                fields.meetingTimes || 
                                fields['Meeting Times'] || 
                                fields['meeting_times'] ||
                                fields['meetingTimes'] ||
                                fields['시간'] || 
                                fields['시간표'] ||
                                fields['schedule'] ||
                                fields['Schedule'] ||
                                fields['time'] ||
                                fields['Time'] ||
                                '';
    
    // If not found, try case-insensitive search
    if (!meetingTimeValue) {
      const timeFieldKeys = allFieldKeys.filter(key => {
        const lowerKey = key.toLowerCase();
        return lowerKey.includes('요일') ||
               lowerKey.includes('time') || 
               lowerKey.includes('시간') || 
               lowerKey.includes('schedule') ||
               lowerKey.includes('시간표') ||
               lowerKey.includes('meeting');
      });
      
      if (timeFieldKeys.length > 0) {
        // Try the first matching field
        meetingTimeValue = fields[timeFieldKeys[0]];
        console.log(`[INFO] Found potential time field "${timeFieldKeys[0]}" for course "${courseName}":`, meetingTimeValue);
      }
    }
    
    // Handle array format from Airtable
    let meetingTimeStr = '';
    if (Array.isArray(meetingTimeValue)) {
      meetingTimeStr = meetingTimeValue.join(', ');
    } else if (typeof meetingTimeValue === 'string') {
      meetingTimeStr = meetingTimeValue;
    } else if (meetingTimeValue && typeof meetingTimeValue === 'object') {
      // Handle object format (e.g., {day: "월", time: "09:00-10:30"})
      meetingTimeStr = JSON.stringify(meetingTimeValue);
    }
    
    // Debug: log if meetingTimes is empty
    if (!meetingTimeStr) {
      console.warn(`[WARNING] Course "${courseName}" (${record.id}) has no meetingTimes field.`);
      console.warn(`  Available fields:`, allFieldKeys);
      console.warn(`  Sample field values (first 5):`, 
        allFieldKeys.slice(0, 5).reduce((acc, key) => {
          acc[key] = typeof fields[key] === 'string' ? fields[key].substring(0, 50) : fields[key];
          return acc;
        }, {} as Record<string, any>)
      );
    }
    
    const meetingTimes = parseMeetingTimes(meetingTimeStr);
    
    // Debug: log if parsing failed
    if (meetingTimeStr && meetingTimes.length === 0) {
      const courseName = fields.name || fields['Name'] || fields['과목명'] || record.id;
      console.warn(`[WARNING] Failed to parse meetingTimes for "${courseName}": "${meetingTimeStr}"`);
    }

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
    this.cachePromise = null; // Also clear Promise cache
  }
}

export default new AirtableService();
