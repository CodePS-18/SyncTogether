CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT,
    google_id VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    bio VARCHAR(500) DEFAULT '',
    online_status BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) DEFAULT '',
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT,
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    max_participants INTEGER NOT NULL DEFAULT 10 CHECK (max_participants BETWEEN 2 AND 100),
    allow_chat BOOLEAN NOT NULL DEFAULT TRUE,
    allow_reactions BOOLEAN NOT NULL DEFAULT TRUE,
    content_type VARCHAR(30) NOT NULL DEFAULT 'video',
    current_media_id UUID,
    current_position DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_playing BOOLEAN NOT NULL DEFAULT FALSE,
    state_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'participant'
        CHECK (role IN ('host','moderator','participant')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration INTEGER DEFAULT 0,
    media_type VARCHAR(30) NOT NULL DEFAULT 'video',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rooms
    DROP CONSTRAINT IF EXISTS rooms_current_media_fk;
ALTER TABLE rooms
    ADD CONSTRAINT rooms_current_media_fk
    FOREIGN KEY (current_media_id) REFERENCES media(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL DEFAULT 'Watch Queue',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id)
);

CREATE TABLE IF NOT EXISTS playlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE(playlist_id, media_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message VARCHAR(500) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_host ON rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS rooms_updated_at ON rooms;
CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON rooms
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
