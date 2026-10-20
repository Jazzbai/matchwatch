CREATE TABLE IF NOT EXISTS stream_broadcasts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL, sport text NOT NULL, description text NOT NULL DEFAULT '', key_hash text NOT NULL,
 ended boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stream_broadcasts_owner ON stream_broadcasts(owner_id);
CREATE TABLE IF NOT EXISTS stream_videos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL, sport text NOT NULL, object_key text NOT NULL, content_type text NOT NULL,
 file_size bigint NOT NULL, ready boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stream_videos_owner ON stream_videos(owner_id);
CREATE TABLE IF NOT EXISTS stream_favorites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 video_id text NOT NULL, title text NOT NULL, sport text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS stream_favorites_owner_video ON stream_favorites(owner_id, video_id);
