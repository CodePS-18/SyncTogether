import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

router.get('/:id', authRequired, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, full_name, username, email, avatar_url, bio, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
});

router.put('/:id', authRequired, async (req, res, next) => {
  try {
    if (req.params.id !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });
    const data = z.object({
      fullName: z.string().min(2).max(100),
      bio: z.string().max(500).optional(),
      avatarUrl: z.string().url().optional().or(z.literal(''))
    }).parse(req.body);
    const result = await query(
      `UPDATE users SET full_name=$1, bio=$2, avatar_url=$3
       WHERE id=$4
       RETURNING id, full_name, username, email, avatar_url, bio`,
      [data.fullName, data.bio || '', data.avatarUrl || null, req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
});

export default router;
