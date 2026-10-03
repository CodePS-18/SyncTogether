# SyncTogether: A Real-Time Collaborative Entertainment Platform

SyncTogether is a full-stack watch-party application for creating/joining rooms, synchronized video playback, real-time chat, reactions, participants, playlists, and room management.

## Stack
- Frontend: React + Vite + Tailwind CSS + React Router + Axios + Socket.IO Client + Lucide React
- Backend: Node.js + Express + Socket.IO + JWT + bcrypt + PostgreSQL
- Security: Helmet, CORS, rate limiting, validation, parameterized SQL
- Database: PostgreSQL

## Project Structure
```text
synctogether/
├── client/
├── server/
├── database/
├── .gitignore
└── README.md
```

## 1. Prerequisites
Install:
- Node.js 20+
- npm
- PostgreSQL 14+

## 2. Database
Create a PostgreSQL database named `synctogether`, then run:

```bash
psql -U postgres -d synctogether -f database/schema.sql
psql -U postgres -d synctogether -f database/seed.sql
```

If `psql` is not in PATH, run the SQL files from pgAdmin Query Tool.

## 3. Backend
```bash
cd server
copy .env.example .env
npm install
npm run dev
```

Edit `.env` with your PostgreSQL credentials and a strong JWT secret.

Backend: `http://localhost:5000`

## 4. Frontend
Open another terminal:

```bash
cd client
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Demo
Seed users:
- `demo@example.com` / `Demo@12345`
- `host@example.com` / `Host@12345`

You can also register a new account.

## Notes
The MVP uses browser-playable public MP4 media for synchronized playback. Protected/DRM streaming is intentionally not bypassed. YouTube-compatible content can be added later with a dedicated player integration.

## Main API
- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/logout`
- GET `/api/auth/me`
- GET `/api/users/:id`
- PUT `/api/users/:id`
- POST `/api/rooms`
- GET `/api/rooms`
- GET `/api/rooms/:roomCode`
- PUT `/api/rooms/:roomCode`
- DELETE `/api/rooms/:roomCode`
- POST `/api/rooms/:roomCode/join`
- POST `/api/rooms/:roomCode/leave`
- GET `/api/rooms/:roomCode/messages`
- GET `/api/rooms/:roomCode/playlist`
- POST `/api/rooms/:roomCode/playlist`
- PUT `/api/rooms/:roomCode/playlist`
- DELETE `/api/rooms/:roomCode/playlist/:itemId`

## Socket events
`join-room`, `leave-room`, `play`, `pause`, `seek`, `change-video`, `sync-state`, `user-joined`, `user-left`, `chat-message`, `reaction`, `playlist-update`, `room-update`, `host-transfer`.

## Development priority
1. Project setup
2. Database
3. Backend/API
4. Authentication
5. Rooms
6. Socket.IO
7. Playback synchronization
8. Chat
9. Playlist
10. Reactions
11. Dashboard
12. Responsive UI
13. Security
14. Testing
15. Documentation


## Google Login

SyncTogether now supports Google Sign-In using Google Identity Services. The browser sends the Google ID token to the Express API, where it is verified before a SyncTogether JWT session is issued.

### 1. Create a Google Web Client ID

In Google Cloud Console, create/configure an OAuth 2.0 Web application client and add this authorized JavaScript origin for local development:

`http://localhost:5173`

Copy the Web Client ID.

### 2. Configure environment variables

Server (`server/.env`):

```env
GOOGLE_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com
```

Client (`client/.env`):

```env
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com
```

Do not commit your `.env` files.

### 3. Update the database

For an existing SyncTogether database, run:

```sql
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
```

For a fresh database, `database/schema.sql` already contains the Google fields.

### 4. Install dependencies and run

```powershell
cd server
npm install
npm run dev
```

In another terminal:

```powershell
cd client
npm install
npm run dev
```

Then open `http://localhost:5173/login` and choose **Sign in with Google**.

### Google authentication behavior

- Google ID tokens are verified server-side with the configured Web Client ID.
- The Google `sub` value is stored as the unique `google_id`.
- Google accounts receive a generated unique SyncTogether username.
- Existing password accounts are not automatically taken over when their email matches a Google account; this avoids unsafe account linking.
- Google accounts have a nullable `password_hash` because they authenticate through Google.
