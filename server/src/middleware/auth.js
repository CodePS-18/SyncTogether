import jwt from 'jsonwebtoken';
import { query } from '../db.js';

export async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      'SELECT id, full_name, username, email, avatar_url, bio FROM users WHERE id = $1',
      [payload.userId]
    );
    if (!result.rows[0]) return res.status(401).json({ message: 'User no longer exists.' });

    req.user = result.rows[0];
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}
