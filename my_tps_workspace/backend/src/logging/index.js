import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const { combine, timestamp, json, printf } = winston.format;

// Structured log format
const logFormat = printf(({ level, message, timestamp, reqId, userId, action, durationMs, ...rest }) => {
  return JSON.stringify({
    timestamp,
    level,
    reqId: reqId || null,
    userId: userId || null,
    action: action || null,
    durationMs: durationMs || null,
    message,
    ...rest
  });
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
    // In production: add file transport
  ]
});

// Request ID middleware adds reqId to each request
export function requestIdMiddleware(req, res, next) {
  req.id = req.id || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
}

// Audit log helper — writes to logger and optionally to audit_log table
export function auditLog(db, { reqId, userId, action, resourceType, resourceId, metadata, ipAddress }) {
  logger.info('audit', { reqId, userId, action, resourceType, resourceId, metadata, ipAddress });

  if (!db) return; // Skip DB write if no db instance

  try {
    const stmt = db.prepare(`
      INSERT INTO audit_log (req_id, user_id, action, resource_type, resource_id, metadata, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      reqId,
      userId || null,
      action,
      resourceType || null,
      resourceId || null,
      metadata ? JSON.stringify(metadata) : null,
      ipAddress || null
    );
  } catch (err) {
    logger.error('audit_log_write_failed', { err: err.message, reqId, action });
  }
}

export default logger;
