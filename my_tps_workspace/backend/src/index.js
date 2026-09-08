import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { requestIdMiddleware, logger } from './logging/index.js';
import { authMiddleware, AUTH_DISABLED } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import filesRoutes from './routes/files.js';
import filesPublicRoutes from './routes/filesPublic.js';
import patientsRoutes from './routes/patients.js';
import studiesRoutes from './routes/studies.js';
import contouringRoutes from './routes/contouring.js';
import rtStructRoutes from './routes/rtStruct.js';
import rtDoseRoutes from './routes/rtDose.js';
import rtPlanRoutes from './routes/rtPlan.js';
import segmentationsRoutes from './routes/segmentations.js';
import ebrtPlansRoutes from './routes/ebrtPlans.js';
import exportRoutes from './routes/export.js';
import peerReviewRoutes from './routes/peerReview.js';
import registrationRoutes from './routes/registration.js';
import doseSumsRoutes from './routes/doseSums.js';
import doseEngineRoutes from './routes/doseEngine.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Global middleware
// CORS origins: override with comma-separated CORS_ORIGINS for other environments
const CORS_ORIGINS = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
// Vite auto-increments the port when 5173 is taken — allow common alternates
for (let port = 5174; port <= 5179; port++) {
  CORS_ORIGINS.push(`http://localhost:${port}`);
}

app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('http_request', {
      reqId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.userId,
    });
  });
  next();
});

// Request ID
app.use(requestIdMiddleware);

// Health check (no auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (no auth required for login/register)
app.use('/api/auth', authRoutes);

// Rate limiting on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: { error: 'Too many attempts, please try again later' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Public HMAC-verified download (no auth — signature is the auth mechanism)
// Must be mounted BEFORE auth-protected /api/files to take precedence
app.use('/api/files/public', filesPublicRoutes);
// Auth-protected routes
app.use('/api/files', authMiddleware, filesRoutes);
app.use('/api/patients', authMiddleware, patientsRoutes);
app.use('/api/studies', authMiddleware, studiesRoutes);
app.use('/api/contouring', authMiddleware, contouringRoutes);
app.use('/api/rtstruct', authMiddleware, rtStructRoutes);
app.use('/api/rtdose', authMiddleware, rtDoseRoutes);
app.use('/api/rtplan', authMiddleware, rtPlanRoutes);
app.use('/api/segmentations', authMiddleware, segmentationsRoutes);
app.use('/api/ebrt', authMiddleware, ebrtPlansRoutes);
app.use('/api/export', authMiddleware, exportRoutes);
app.use('/api/peer-review', authMiddleware, peerReviewRoutes);
app.use('/api/registration', authMiddleware, registrationRoutes);
app.use('/api/dose-sums', authMiddleware, doseSumsRoutes);
app.use('/api/dose-engine', authMiddleware, doseEngineRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`backend_started`, { port: PORT, env: process.env.NODE_ENV || 'development' });
  if (AUTH_DISABLED) {
    logger.warn('AUTH IS DISABLED — every request runs as the dev user. Set AUTH_DISABLED=false to enforce JWT auth.');
  }
  console.log(`Backend running on http://localhost:${PORT}`);
});

export default app;
