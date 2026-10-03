import jwt from 'jsonwebtoken';
import { query } from '../db.js';

export function registerSocketHandlers(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid socket token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-room', async ({ roomCode }) => {
      try {
        const roomResult = await query('SELECT * FROM rooms WHERE room_code=$1', [roomCode]);
        const room = roomResult.rows[0];
        if (!room) return socket.emit('room-error', { message: 'Room not found.' });

        const member = await query(
          `SELECT rm.role,u.full_name,u.username,u.avatar_url
           FROM room_members rm JOIN users u ON u.id=rm.user_id
           WHERE rm.room_id=$1 AND rm.user_id=$2`,
          [room.id, socket.userId]
        );
        if (!member.rows[0]) return socket.emit('room-error', { message: 'Join the room first.' });

        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.role = member.rows[0].role;

        const state = {
          currentMediaId: room.current_media_id,
          position: room.current_position,
          isPlaying: room.is_playing,
          stateUpdatedAt: room.state_updated_at,
          hostId: room.host_id
        };

        socket.emit('sync-state', state);
        socket.to(roomCode).emit('user-joined', {
          user: {
            id: socket.userId,
            full_name: member.rows[0].full_name,
            username: member.rows[0].username,
            avatar_url: member.rows[0].avatar_url,
            role: member.rows[0].role
          }
        });
      } catch (err) {
        socket.emit('room-error', { message: 'Could not join real-time room.' });
      }
    });

    socket.on('play', async ({ position = 0 }) => {
      await updatePlayback(socket, position, true);
    });

    socket.on('pause', async ({ position = 0 }) => {
      await updatePlayback(socket, position, false);
    });

    socket.on('seek', async ({ position = 0 }) => {
      await updatePlayback(socket, position, socket.data.lastPlaying ?? false);
    });

    socket.on('change-video', async ({ mediaId }) => {
      if (!socket.data.roomCode) return;
      if (!await canControl(socket)) return;
      await query(
        `UPDATE rooms SET current_media_id=$1,current_position=0,is_playing=false,state_updated_at=NOW()
         WHERE room_code=$2`,
        [mediaId, socket.data.roomCode]
      );
      io.to(socket.data.roomCode).emit('sync-state', {
        currentMediaId: mediaId, position: 0, isPlaying: false,
        stateUpdatedAt: new Date().toISOString()
      });
    });

    socket.on('chat-message', async ({ message }) => {
      if (!socket.data.roomCode || typeof message !== 'string') return;
      const clean = message.trim().slice(0, 1000);
      if (!clean) return;
      const room = (await query('SELECT id,allow_chat FROM rooms WHERE room_code=$1',[socket.data.roomCode])).rows[0];
      if (!room?.allow_chat) return;
      const result = await query(
        `INSERT INTO messages(room_id,user_id,message)
         VALUES($1,$2,$3)
         RETURNING id,message,created_at`,
        [room.id,socket.userId,clean]
      );
      const user = (await query(
        'SELECT id,username,full_name,avatar_url FROM users WHERE id=$1',
        [socket.userId]
      )).rows[0];
      io.to(socket.data.roomCode).emit('chat-message', {
        ...result.rows[0], user
      });
    });

    socket.on('reaction', async ({ reactionType }) => {
      const allowed = ['❤️','😂','😍','😮','👏','🔥','👍','🎉'];
      if (!allowed.includes(reactionType) || !socket.data.roomCode) return;
      const room = (await query('SELECT id,allow_reactions FROM rooms WHERE room_code=$1',[socket.data.roomCode])).rows[0];
      if (!room?.allow_reactions) return;
      const user = (await query('SELECT username FROM users WHERE id=$1',[socket.userId])).rows[0];
      io.to(socket.data.roomCode).emit('reaction', {
        reactionType, username: user?.username || 'User'
      });
      await query(
        'INSERT INTO reactions(room_id,user_id,reaction_type) VALUES($1,$2,$3)',
        [room.id,socket.userId,reactionType]
      );
    });

    socket.on('playlist-update', ({ playlist }) => {
      if (!socket.data.roomCode) return;
      socket.to(socket.data.roomCode).emit('playlist-update', { playlist });
    });

    socket.on('room-update', (payload) => {
      if (!socket.data.roomCode) return;
      socket.to(socket.data.roomCode).emit('room-update', payload);
    });

    socket.on('host-transfer', async ({ userId }) => {
      if (!socket.data.roomCode || socket.data.role !== 'host') return;
      const room = (await query('SELECT id FROM rooms WHERE room_code=$1',[socket.data.roomCode])).rows[0];
      const target = (await query(
        'SELECT id FROM room_members WHERE room_id=$1 AND user_id=$2',
        [room?.id,userId]
      )).rows[0];
      if (!target) return;
      await query('UPDATE room_members SET role=$1 WHERE room_id=$2 AND user_id=$3',['participant',room.id,socket.userId]);
      await query('UPDATE room_members SET role=$1 WHERE room_id=$2 AND user_id=$3',['host',room.id,userId]);
      await query('UPDATE rooms SET host_id=$1 WHERE id=$2',[userId,room.id]);
      io.to(socket.data.roomCode).emit('host-transfer', { hostId:userId });
    });

    socket.on('leave-room', () => leave(socket));
    socket.on('disconnect', () => leave(socket));
  });
}

async function canControl(socket) {
  if (!socket.data.roomCode) return false;
  const room = (await query(
    `SELECT r.host_id,rm.role FROM rooms r JOIN room_members rm ON rm.room_id=r.id
     WHERE r.room_code=$1 AND rm.user_id=$2`,
    [socket.data.roomCode,socket.userId]
  )).rows[0];
  const allowed = room && ['host','moderator'].includes(room.role);
  if (allowed) socket.data.lastPlaying = true;
  return Boolean(allowed);
}

async function updatePlayback(socket, position, playing) {
  if (!await canControl(socket)) return;
  const safePosition = Number.isFinite(Number(position)) ? Math.max(0, Number(position)) : 0;
  socket.data.lastPlaying = playing;
  await query(
    `UPDATE rooms SET current_position=$1,is_playing=$2,state_updated_at=NOW()
     WHERE room_code=$3`,
    [safePosition,playing,socket.data.roomCode]
  );
  io.to(socket.data.roomCode).emit('sync-state', {
    position: safePosition,
    isPlaying: playing,
    stateUpdatedAt: new Date().toISOString()
  });
}

async function leave(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  socket.to(code).emit('user-left', { userId: socket.userId });
}
