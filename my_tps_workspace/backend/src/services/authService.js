import bcrypt from 'bcryptjs';
import { getDb } from '../db/init.js';
import { signToken } from '../middleware/auth.js';

export async function register({ email, password, name }) {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw Object.assign(new Error('User already exists'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = db.prepare(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
  ).run(email, passwordHash, name);

  const user = { userId: result.lastInsertRowid, email, name };
  const token = signToken(user);

  return { token, user };
}

export async function login({ email, password }) {
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const payload = { userId: user.id, email: user.email };
  const token = signToken(payload);

  return { token, user: { userId: user.id, email: user.email, name: user.name } };
}
