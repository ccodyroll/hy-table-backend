/**
 * Courses API endpoint
 */

import { Router, Request, Response } from 'express';
import { getAirtableService } from '../services/airtable';
import { logger } from '../utils/logger';
import { generateRequestId } from '../utils/requestId';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const major = typeof req.query.major === 'string' ? req.query.major : undefined;
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;

    logger.info('Fetching courses', { requestId, major, query });

    const airtableService = getAirtableService();
    const courses = await airtableService.getCourses({ major, query });

    const duration = Date.now() - startTime;
    logger.info('Courses fetched successfully', { 
      requestId, 
      count: courses.length, 
      duration 
    });

    res.json(courses);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching courses', error, { requestId, duration });

    res.status(500).json({
      error: 'Failed to fetch courses',
      requestId
    });
  }
});

export default router;
