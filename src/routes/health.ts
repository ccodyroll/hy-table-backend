<<<<<<< HEAD
=======
/**
 * Health check endpoint
 */

>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
import { Router, Request, Response } from 'express';

const router = Router();

<<<<<<< HEAD
/**
 * GET /health
 * Health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    ok: true,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
=======
router.get('/', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    version: '1.0.0'
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
  });
});

export default router;
