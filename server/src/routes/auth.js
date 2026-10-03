import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { OAuth2Client } from 'google-auth-library';

const router = express.Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const registerSchema = z.object({
  fullName: z.string().min(2).max(100),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(100)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function sign(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const exists = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [data.email.toLowerCase(), data.username]
    );
    if (exists.rows[0]) return res.status(409).json({ message: 'Email or username already exists.' });

    const passwordHash = await bcrypt.hash(data.password, 12);
    const result = await query(
      `INSERT INTO users (full_name, username, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, username, email, avatar_url, bio`,
      [data.fullName, data.username, data.email.toLowerCase(), passwordHash]
    );
    const user = result.rows[0];
    res.status(201).json({ user, token: sign(user.id) });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await query('SELECT * FROM users WHERE email = $1', [data.email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !user.password_hash || !(await bcrypt.compare(data.password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    await query('UPDATE users SET online_status = TRUE WHERE id = $1', [user.id]);
    const safeUser = {
      id: user.id, full_name: user.full_name, username: user.username,
      email: user.email, avatar_url: user.avatar_url, bio: user.bio
    };
    res.json({ user: safeUser, token: sign(user.id) });
  } catch (err) { next(err); }
});



router.post('/google', async (req, res, next) => {
  try {
    const credential = z.string().min(20).parse(req.body?.credential);
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: 'Google authentication is not configured on the server.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return res.status(401).json({ message: 'Google account could not be verified.' });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const fullName = String(payload.name || email.split('@')[0]).slice(0, 100);
    const avatarUrl = payload.picture || null;

    let result = await query(
      'SELECT id, full_name, username, email, avatar_url, bio FROM users WHERE google_id = $1',
      [googleId]
    );

    let user = result.rows[0];

    if (!user) {
      // If the email already belongs to a password account, do not silently take it over.
      result = await query(
        'SELECT id, full_name, username, email, avatar_url, bio FROM users WHERE email = $1',
        [email]
      );
      if (result.rows[0]) {
        return res.status(409).json({
          message: 'An account with this email already exists. Sign in with your password first, then link Google from your account settings.'
        });
      }

      const base = (payload.name || email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 40) || 'user';
      let username = base;
      for (let i = 0; i < 100; i += 1) {
        const check = await query('SELECT 1 FROM users WHERE username = $1', [username]);
        if (!check.rows[0]) break;
        username = `${base.slice(0, 35)}${Math.floor(10000 + Math.random() * 90000)}`;
      }

      result = await query(
        `INSERT INTO users (full_name, username, email, password_hash, google_id, avatar_url, online_status)
         VALUES ($1, $2, $3, NULL, $4, $5, TRUE)
         RETURNING id, full_name, username, email, avatar_url, bio`,
        [fullName, username, email, googleId, avatarUrl]
      );
      user = result.rows[0];
    } else {
      await query(
        'UPDATE users SET full_name=$1, avatar_url=COALESCE($2, avatar_url), online_status=TRUE WHERE id=$3',
        [fullName, avatarUrl, user.id]
      );
      user.full_name = fullName;
      if (avatarUrl) user.avatar_url = avatarUrl;
    }

    res.json({ user, token: sign(user.id) });
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(400).json({ message: 'Google credential is required.' });
    console.error('Google authentication error:', err);
    return res.status(401).json({ message: 'Google authentication failed.' });
  }
});

router.post('/logout', authRequired, async (req, res, next) => {
  try {
    await query('UPDATE users SET online_status = FALSE WHERE id = $1', [req.user.id]);
    res.json({ message: 'Logged out.' });
  } catch (err) { next(err); }
});

router.get('/me', authRequired, (req, res) => res.json({ user: req.user }));

export default router;
