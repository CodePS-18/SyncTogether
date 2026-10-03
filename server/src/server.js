import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import roomRoutes from './routes/rooms.js';
import { notFound, errorHandler } from './middleware/error.js';
import { registerSocketHandlers } from './sockets/index.js';

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get('/api/health', (req,res) => res.json({ ok: true, service: 'synctogether-server' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);

app.use(notFound);
app.use(errorHandler);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173'
  }
});
registerSocketHandlers(io);

const port = Number(process.env.PORT || 5000);
server.listen(port, () => console.log(`SyncTogether server running on http://localhost:${port}`));
