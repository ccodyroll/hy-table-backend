/**
 * Health check endpoint
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    version: '1.0.0'
  });
});

export default router;
