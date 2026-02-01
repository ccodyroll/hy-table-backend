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
   * Uses table ID (tbl8Mza7Z65g7Pton) for stability
   */
  private async fetchFromAirtable(): Promise<Course[]> {
    // Use table ID for stability (table name changes won't break the API)
    const tableId = process.env.AIRTABLE_TABLE_ID || 'tbl8Mza7Z65g7Pton';
    const tableName = process.env.AIRTABLE_TABLE_NAME || 'Courses';
    // Try table ID first, fallback to table name
    const table = this.base(tableId) || this.base(tableName);
    const records: AirtableRecord[] = [];

    await table
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
   * Uses new schema with field IDs (primary) and field names (fallback)
   */
  private normalizeRecord(record: AirtableRecord): Course {
    const fields = record.fields;

    // Field ID mappings (primary) - fallback to field names
    // course_name (fldxBRALu8pnBwGvn)
    const courseName = fields['fldxBRALu8pnBwGvn'] || fields.course_name || record.id;
    
    // id (fldnrkAKox1BAjAp1) - e.g., "2026_1_BUS1059_11347"
    const courseId = fields['fldnrkAKox1BAjAp1'] || fields.id || record.id;
    
    // course_code (fldqgpYh3n8lpCDj4) - e.g., "11347"
    const courseCode = fields['fldqgpYh3n8lpCDj4'] || fields.course_code || '';
    
    // professor (fldyYL2fEvg61cTZY)
    const instructor = fields['fldyYL2fEvg61cTZY'] || fields.professor || undefined;
    
    // classification (fldkXofStJWCLRFpL) - Single select
    const category = fields['fldkXofStJWCLRFpL'] || fields.classification || '';
    
    // credit (fldtXa5UzuOayoKS1)
    const credits = Number(fields['fldtXa5UzuOayoKS1'] || fields.credit || 0);
    
    // capacity (fldGifKoI5xDcvCP1)
    const capacity = fields['fldGifKoI5xDcvCP1'] || fields.capacity;
    const capacityNum = capacity ? Number(capacity) : undefined;
    
    // lecture_type (fldv3ZYOBW2kKqh10) - Single select
    const lectureType = fields['fldv3ZYOBW2kKqh10'] || fields.lecture_type || '오프라인';
    
    // Map lecture_type to deliveryType
    let deliveryType: 'ONLINE' | 'OFFLINE' | 'HYBRID' = 'OFFLINE';
    const lectureTypeStr = lectureType.toString().toLowerCase();
    if (lectureTypeStr.includes('온라인') || lectureTypeStr === 'online') {
      deliveryType = 'ONLINE';
    } else if (lectureTypeStr.includes('혼합') || lectureTypeStr.includes('blended') || lectureTypeStr === 'hybrid') {
      deliveryType = 'HYBRID';
    } else {
      deliveryType = 'OFFLINE';
    }
    
    // schedule_text (fld7XicgiX9cukCAu) - Long text, contains time schedule
    // Format: "월 16:00-17:30 (경영관 101강의실); 월 17:30-19:00 (경영관 101강의실)"
    let meetingTimeValue: any = fields['fld7XicgiX9cukCAu'] || fields.schedule_text || '';
    
    // Handle array format from Airtable
    let meetingTimeStr = '';
    if (Array.isArray(meetingTimeValue)) {
      meetingTimeStr = meetingTimeValue.join('; ');
    } else if (typeof meetingTimeValue === 'string') {
      meetingTimeStr = meetingTimeValue;
    } else if (meetingTimeValue && typeof meetingTimeValue === 'object') {
      // Handle object format (e.g., {day: "월", time: "09:00-10:30"})
      meetingTimeStr = JSON.stringify(meetingTimeValue);
    }
    
    // Check if schedule_text contains time information
    // Skip warning for formats like "||온라인|..." or "||실습|..." which don't have time info
    const hasTimeInfo = meetingTimeStr && 
      !meetingTimeStr.startsWith('||') && 
      !meetingTimeStr.match(/^[|]*[온라인|실습|시간\s*미정]/) &&
      (meetingTimeStr.match(/[월화수목금토일]/) || meetingTimeStr.match(/[0-9]{1,2}:[0-9]{2}/));
    
    // Debug: log if meetingTimes is empty (only if it should have time info)
    if (!meetingTimeStr) {
      console.warn(`[WARNING] Course "${courseName}" (${record.id}) has no meetingTimes field.`);
    }
    
    const meetingTimes = parseMeetingTimes(meetingTimeStr);
    
    // Debug: log if parsing failed (only if it should have time info)
    if (hasTimeInfo && meetingTimeStr && meetingTimes.length === 0) {
      console.warn(`[WARNING] Failed to parse meetingTimes for "${courseName}": "${meetingTimeStr}"`);
    }

    // interest_categories (fldVAPyjkCSXv6D65) - Multiple select
    // ai_tags (fldkv2NYfExqtJ5hW) - Multiple select
    // Combine both into tags array
    const interestCategories = fields['fldVAPyjkCSXv6D65'] || fields.interest_categories || [];
    const aiTags = fields['fldkv2NYfExqtJ5hW'] || fields.ai_tags || [];
    
    let tags: string[] = [];
    // Handle interest_categories (array of strings)
    if (Array.isArray(interestCategories)) {
      tags = [...interestCategories];
    } else if (typeof interestCategories === 'string') {
      tags = interestCategories.split(',').map((t: string) => t.trim()).filter(Boolean);
    }
    
    // Handle ai_tags (array of strings)
    if (Array.isArray(aiTags)) {
      tags = [...tags, ...aiTags];
    } else if (typeof aiTags === 'string') {
      const aiTagsArray = aiTags.split(',').map((t: string) => t.trim()).filter(Boolean);
      tags = [...tags, ...aiTagsArray];
    }

    // restrictions (fldYU6iYuGyEu6dWY)
    let restrictions: string[] = [];
    const restrictionsValue = fields['fldYU6iYuGyEu6dWY'] || fields.restrictions;
    if (Array.isArray(restrictionsValue)) {
      restrictions = restrictionsValue;
    } else if (typeof restrictionsValue === 'string') {
      restrictions = restrictionsValue.split(',').map((r: string) => r.trim()).filter(Boolean);
    }
    
    // For major, use classification or Area field
    // Area (fldKu4Pa3e5zDUo3f) - might contain major info
    const area = fields['fldKu4Pa3e5zDUo3f'] || fields.Area || '';
    const major = area || category || '';

    return {
      courseId: courseId.toString(),
      name: courseName.toString(),
      credits,
      major,
      category: category.toString(),
      tags,
      meetingTimes,
      deliveryType,
      restrictions,
      instructor,
      capacity: capacityNum,
      enrolled: undefined, // Not in new schema
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
