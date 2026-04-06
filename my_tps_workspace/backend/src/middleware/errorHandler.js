import { logger } from '../logging/index.js';

// Not found handler
export function notFoundHandler(req, res, next) {
  res.status(404).json({ error: 'Not found' });
}

// Global error handler — must have 4 args
export function errorHandler(err, req, res, next) {
  // Log with full context
  logger.error('unhandled_error', {
    reqId: req.id,
    userId: req.user?.userId,
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
  });

  // Don't leak internal details in production
  const isDev = process.env.NODE_ENV !== 'production';

  if (err.name === 'MulterError') {
    return res.status(400).json({ error: 'Upload error', detail: err.message });
  }

  if (err.message === 'Invalid DICOM file') {
    return res.status(422).json({ error: 'Invalid DICOM file', detail: err.detail });
  }

  res.status(err.status || 500).json({
    error: err.status === 401 ? 'Authentication required' : 'Internal server error',
    detail: isDev ? err.message : undefined,
  });
}
