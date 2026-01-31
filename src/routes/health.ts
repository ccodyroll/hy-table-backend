import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    ok: true,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export default router;
