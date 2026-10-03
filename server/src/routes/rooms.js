import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { makeRoomCode } from '../utils/roomCode.js';

const router = express.Router();

async function uniqueCode() {
  for (let i = 0; i < 20; i++) {
    const code = makeRoomCode();
    const r = await query('SELECT id FROM rooms WHERE room_code=$1', [code]);
    if (!r.rows[0]) return code;
  }
  throw new Error('Could not generate a unique room code.');
}

async function getRoom(roomCode) {
  const r = await query(
    `SELECT r.*, u.username AS host_username, u.full_name AS host_name,
      m.title AS current_title, m.url AS current_url, m.thumbnail_url AS current_thumbnail
     FROM rooms r
     JOIN users u ON u.id=r.host_id
     LEFT JOIN media m ON m.id=r.current_media_id
     WHERE r.room_code=$1`,
    [roomCode]
  );
  return r.rows[0];
}

router.get('/', authRequired, async (req, res, next) => {
  try {
    const r = await query(
      `SELECT r.room_code, r.name, r.description, r.is_private, r.max_participants,
              r.host_id, u.username AS host_username,
              COUNT(rm.id)::int AS participants,
              m.title AS current_title
       FROM rooms r
       JOIN users u ON u.id=r.host_id
       LEFT JOIN room_members rm ON rm.room_id=r.id
       LEFT JOIN media m ON m.id=r.current_media_id
       WHERE r.is_private=false
       GROUP BY r.id, u.username, m.title
       ORDER BY r.created_at DESC`
    );
    res.json({ rooms: r.rows });
  } catch (err) { next(err); }
});

router.post('/', authRequired, async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(2).max(120),
      description: z.string().max(500).optional(),
      isPrivate: z.boolean().default(true),
      password: z.string().max(100).optional(),
      maxParticipants: z.number().int().min(2).max(100).default(10),
      allowChat: z.boolean().default(true),
      allowReactions: z.boolean().default(true)
    }).parse(req.body);

    const code = await uniqueCode();
    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : null;

    const client = await (await import('../db.js')).pool.connect();
    try {
      await client.query('BEGIN');
      const room = await client.query(
        `INSERT INTO rooms
          (room_code,name,description,host_id,password_hash,is_private,max_participants,allow_chat,allow_reactions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [code, data.name, data.description || '', req.user.id, passwordHash,
         data.isPrivate, data.maxParticipants, data.allowChat, data.allowReactions]
      );
      await client.query(
        `INSERT INTO room_members(room_id,user_id,role) VALUES($1,$2,'host')`,
        [room.rows[0].id, req.user.id]
      );
      await client.query(
        `INSERT INTO playlists(room_id,name) VALUES($1,'Watch Queue')`,
        [room.rows[0].id]
      );
      await client.query('COMMIT');
      res.status(201).json({ room: await getRoom(code) });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  } catch (err) { next(err); }
});

router.get('/:roomCode', authRequired, async (req, res, next) => {
  try {
    const room = await getRoom(req.params.roomCode);
    if (!room) return res.status(404).json({ message: 'Room does not exist.' });

    const members = await query(
      `SELECT u.id,u.full_name,u.username,u.avatar_url,u.online_status,rm.role
       FROM room_members rm JOIN users u ON u.id=rm.user_id
       WHERE rm.room_id=$1 ORDER BY rm.role='host' DESC, rm.joined_at ASC`,
      [room.id]
    );
    res.json({ room, participants: members.rows });
  } catch (err) { next(err); }
});

router.post('/:roomCode/join', authRequired, async (req, res, next) => {
  try {
    const room = await getRoom(req.params.roomCode);
    if (!room) return res.status(404).json({ message: 'Room does not exist.' });

    if (room.password_hash) {
      const password = String(req.body.password || '');
      if (!(await bcrypt.compare(password, room.password_hash))) {
        return res.status(401).json({ message: 'Incorrect room password.' });
      }
    }

    const count = await query('SELECT COUNT(*)::int AS count FROM room_members WHERE room_id=$1', [room.id]);
    const already = await query(
      'SELECT id FROM room_members WHERE room_id=$1 AND user_id=$2',
      [room.id, req.user.id]
    );
    if (!already.rows[0] && count.rows[0].count >= room.max_participants) {
      return res.status(409).json({ message: 'Room is full.' });
    }

    if (!already.rows[0]) {
      await query(
        `INSERT INTO room_members(room_id,user_id,role)
         VALUES($1,$2,'participant')
         ON CONFLICT(room_id,user_id) DO NOTHING`,
        [room.id, req.user.id]
      );
    }
    await query('UPDATE users SET online_status=true WHERE id=$1', [req.user.id]);
    res.json({ room: await getRoom(req.params.roomCode) });
  } catch (err) { next(err); }
});

router.post('/:roomCode/leave', authRequired, async (req, res, next) => {
  try {
    const room = await getRoom(req.params.roomCode);
    if (!room) return res.status(404).json({ message: 'Room does not exist.' });
    if (room.host_id === req.user.id) {
      return res.status(400).json({ message: 'Host cannot leave without transferring or closing the room.' });
    }
    await query('DELETE FROM room_members WHERE room_id=$1 AND user_id=$2', [room.id, req.user.id]);
    res.json({ message: 'Left room.' });
  } catch (err) { next(err); }
});

router.put('/:roomCode', authRequired, async (req, res, next) => {
  try {
    const room = await getRoom(req.params.roomCode);
    if (!room) return res.status(404).json({ message: 'Room does not exist.' });
    if (room.host_id !== req.user.id) return res.status(403).json({ message: 'Host only.' });

    const data = z.object({
      name: z.string().min(2).max(120).optional(),
      description: z.string().max(500).optional(),
      isPrivate: z.boolean().optional(),
      maxParticipants: z.number().int().min(2).max(100).optional(),
      allowChat: z.boolean().optional(),
      allowReactions: z.boolean().optional()
    }).parse(req.body);

    const result = await query(
      `UPDATE rooms SET
       name=COALESCE($1,name), description=COALESCE($2,description),
       is_private=COALESCE($3,is_private), max_participants=COALESCE($4,max_participants),
       allow_chat=COALESCE($5,allow_chat), allow_reactions=COALESCE($6,allow_reactions)
       WHERE room_code=$7 RETURNING *`,
      [data.name ?? null, data.description ?? null, data.isPrivate ?? null,
       data.maxParticipants ?? null, data.allowChat ?? null, data.allowReactions ?? null,
       req.params.roomCode]
    );
    res.json({ room: result.rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:roomCode', authRequired, async (req, res, next) => {
  try {
    const room = await getRoom(req.params.roomCode);
    if (!room) return res.status(404).json({ message: 'Room does not exist.' });
    if (room.host_id !== req.user.id) return res.status(403).json({ message: 'Host only.' });
    await query('DELETE FROM rooms WHERE id=$1', [room.id]);
    res.json({ message: 'Room closed.' });
  } catch (err) { next(err); }
});

router.get('/:roomCode/messages', authRequired, async (req, res, next) => {
  try {
    const r = await query(
      `SELECT msg.id,msg.message,msg.created_at,u.id AS user_id,u.username,u.full_name,u.avatar_url
       FROM messages msg JOIN users u ON u.id=msg.user_id
       JOIN rooms r ON r.id=msg.room_id
       WHERE r.room_code=$1 ORDER BY msg.created_at ASC LIMIT 200`,
      [req.params.roomCode]
    );
    res.json({ messages: r.rows });
  } catch (err) { next(err); }
});

router.get('/:roomCode/playlist', authRequired, async (req, res, next) => {
  try {
    const r = await query(
      `SELECT pi.id,pi.position,m.id AS media_id,m.title,m.url,m.thumbnail_url,m.duration,m.media_type
       FROM playlist_items pi
       JOIN playlists p ON p.id=pi.playlist_id
       JOIN rooms r ON r.id=p.room_id
       JOIN media m ON m.id=pi.media_id
       WHERE r.room_code=$1 ORDER BY pi.position ASC`,
      [req.params.roomCode]
    );
    res.json({ playlist: r.rows });
  } catch (err) { next(err); }
});

router.post('/:roomCode/playlist', authRequired, async (req, res, next) => {
  try {
    const room = await getRoom(req.params.roomCode);
    if (!room) return res.status(404).json({ message: 'Room does not exist.' });
    const member = await query(
      `SELECT role FROM room_members WHERE room_id=$1 AND user_id=$2`,
      [room.id, req.user.id]
    );
    if (!member.rows[0] || !['host','moderator'].includes(member.rows[0].role)) {
      return res.status(403).json({ message: 'Insufficient permissions.' });
    }

    const data = z.object({
      title: z.string().min(1).max(200),
      url: z.string().url(),
      thumbnailUrl: z.string().url().optional().or(z.literal('')),
      duration: z.number().int().min(0).default(0)
    }).parse(req.body);

    const media = await query(
      `INSERT INTO media(title,url,thumbnail_url,duration,created_by)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [data.title,data.url,data.thumbnailUrl || null,data.duration,req.user.id]
    );
    const playlist = await query('SELECT id FROM playlists WHERE room_id=$1', [room.id]);
    const position = await query(
      `SELECT COALESCE(MAX(position),-1)+1 AS next FROM playlist_items WHERE playlist_id=$1`,
      [playlist.rows[0].id]
    );
    const item = await query(
      `INSERT INTO playlist_items(playlist_id,media_id,position)
       VALUES($1,$2,$3) RETURNING id`,
      [playlist.rows[0].id, media.rows[0].id, position.rows[0].next]
    );
    res.status(201).json({ item: { ...media.rows[0], id: item.rows[0].id, media_id: media.rows[0].id } });
  } catch (err) { next(err); }
});

router.put('/:roomCode/playlist', authRequired, async (req, res, next) => {
  try {
    const room = await getRoom(req.params.roomCode);
    if (!room) return res.status(404).json({ message: 'Room does not exist.' });
    const member = await query(
      `SELECT role FROM room_members WHERE room_id=$1 AND user_id=$2`,
      [room.id, req.user.id]
    );
    if (!member.rows[0] || member.rows[0].role !== 'host') return res.status(403).json({ message: 'Host only.' });

    const items = z.array(z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0)
    })).parse(req.body.items);

    for (const item of items) {
      await query('UPDATE playlist_items SET position=$1 WHERE id=$2', [item.position,item.id]);
    }
    res.json({ message: 'Playlist reordered.' });
  } catch (err) { next(err); }
});

router.delete('/:roomCode/playlist/:itemId', authRequired, async (req, res, next) => {
  try {
    const room = await getRoom(req.params.roomCode);
    if (!room) return res.status(404).json({ message: 'Room does not exist.' });
    const member = await query(
      `SELECT role FROM room_members WHERE room_id=$1 AND user_id=$2`,
      [room.id, req.user.id]
    );
    if (!member.rows[0] || !['host','moderator'].includes(member.rows[0].role)) {
      return res.status(403).json({ message: 'Insufficient permissions.' });
    }
    await query(
      `DELETE FROM playlist_items pi USING playlists p
       WHERE pi.id=$1 AND pi.playlist_id=p.id AND p.room_id=$2`,
      [req.params.itemId,room.id]
    );
    res.json({ message: 'Playlist item removed.' });
  } catch (err) { next(err); }
});

export default router;
