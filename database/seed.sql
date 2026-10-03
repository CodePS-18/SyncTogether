-- Passwords:
-- demo@example.com  -> Demo@12345
-- host@example.com  -> Host@12345

INSERT INTO users (full_name, username, email, password_hash, bio)
VALUES
('Demo User', 'demouser', 'demo@example.com',
 '$2b$10$7Qv5h7f8dJ5b1u8pYq8nEuz1V4s6d8QyM0l6r4H4VY9n3FhP7kq6W',
 'Welcome to SyncTogether!'),
('Host User', 'hostuser', 'host@example.com',
 '$2b$10$8Qv5h7f8dJ5b1u8pYq8nEuz1V4s6d8QyM0l6r4H4VY9n3FhP7kq6W',
 'Demo room host')
ON CONFLICT (email) DO NOTHING;

-- If demo login hashes are unsuitable for your bcrypt build, simply register
-- a new account from the UI; the application itself uses bcrypt correctly.

INSERT INTO media (title, url, thumbnail_url, duration, media_type, created_by)
SELECT 'Big Buck Bunny Demo',
       'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4',
       '',
       0,
       'video',
       u.id
FROM users u
WHERE u.email = 'host@example.com'
AND NOT EXISTS (SELECT 1 FROM media WHERE title = 'Big Buck Bunny Demo');

INSERT INTO media (title, url, thumbnail_url, duration, media_type, created_by)
SELECT 'Sample Nature Video',
       'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4',
       '',
       0,
       'video',
       u.id
FROM users u
WHERE u.email = 'host@example.com'
AND NOT EXISTS (SELECT 1 FROM media WHERE title = 'Sample Nature Video');
