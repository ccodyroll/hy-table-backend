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
    });
  }
});

export default router;
