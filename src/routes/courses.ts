<<<<<<< HEAD
import { Router, Request, Response } from 'express';
import airtableService from '../services/airtableService';

const router = Router();

/**
 * GET /api/courses
 * Query params: major, q (search query)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const major = req.query.major as string | undefined;
    const query = req.query.q as string | undefined;

    const courses = await airtableService.getCourses(major, query);

    res.json({
      courses,
      count: courses.length,
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch courses',
      },
=======
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
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
    });
  }
});

export default router;
