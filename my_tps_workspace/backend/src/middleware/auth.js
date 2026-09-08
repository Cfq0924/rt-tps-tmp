import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Auth switch: set AUTH_DISABLED=false to enforce JWT auth (production).
// Default is disabled to keep the development flow friction-free — the
// backend logs a warning at startup whenever it is off.
export const AUTH_DISABLED = (process.env.AUTH_DISABLED ?? 'true') !== 'false';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function authMiddleware(req, res, next) {
  if (AUTH_DISABLED) {
    req.user = { userId: 1, email: 'dev@localhost' };
    return next();
  }
  const token = parseJwtFromCookie(req) ?? bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'authentication required' });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}

function bearerToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7) || null;
}

// Routes that don't require auth
export const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/health'
];

export function parseJwtFromCookie(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(c => {
      const [key, ...val] = c.split('=');
      return [key, val.join('=')];
    })
  );

  return cookies['jwt'] || null;
}

export { JWT_SECRET };
