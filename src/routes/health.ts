import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /health
 * Lightweight health check endpoint (200 OK)
 */
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
  });
});

export default router;
