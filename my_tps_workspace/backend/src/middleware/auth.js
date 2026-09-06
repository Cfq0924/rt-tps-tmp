import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// AUTH DISABLED - Always allow requests without auth check
export function authMiddleware(req, res, next) {
  // Mock user for development
  req.user = { userId: 1, email: 'dev@localhost' };
  next();
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
