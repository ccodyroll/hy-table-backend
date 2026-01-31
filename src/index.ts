<<<<<<< HEAD
import express, { Express } from 'express';
import dotenv from 'dotenv';
import corsMiddleware from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
=======
/**
 * Main server entry point
 * Express server with CORS, rate limiting, and structured logging
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
import healthRouter from './routes/health';
import coursesRouter from './routes/courses';
import recommendRouter from './routes/recommend';

// Load environment variables
dotenv.config();

<<<<<<< HEAD
const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (simple)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
=======
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

>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/recommend', recommendRouter);

// 404 handler
<<<<<<< HEAD
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
=======
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
>>>>>>> f324546b156c39f4cc6964d956d7ecbfaaf9d625
});

export default app;
