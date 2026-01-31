import express, { Express } from 'express';
import dotenv from 'dotenv';
import corsMiddleware from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import coursesRouter from './routes/courses';
import recommendRouter from './routes/recommend';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (simple)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/recommend', recommendRouter);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;
