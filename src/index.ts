/**
 * Main server entry point
 * Express server with CORS, rate limiting, and structured logging
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import healthRouter from './routes/health';
import coursesRouter from './routes/courses';
import recommendRouter from './routes/recommend';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: process.env.FRONTEND_ORIGIN || '*', // In production, set specific origin
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  (req as any).requestId = requestId;
  
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`${req.method} ${req.path}`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration
    });
  });

  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/recommend', recommendRouter);

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', { 
    requestId: (req as any).requestId,
    path: req.path 
  });
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err, { 
    requestId: (req as any).requestId 
  });

  res.status(500).json({
    error: 'Internal server error',
    requestId: (req as any).requestId
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`, {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.FRONTEND_ORIGIN || '*'
  });

  // Validate required environment variables
  const requiredVars = ['AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    logger.warn('Missing required environment variables', { missing });
  } else {
    logger.info('All required environment variables are set');
  }

  if (!process.env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set, will use fallback scoring');
  }
});

export default app;
