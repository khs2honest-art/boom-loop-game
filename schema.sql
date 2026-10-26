-- BOOM LOOP D1 schema v1
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
CREATE TABLE IF NOT EXISTS bombs(id TEXT PRIMARY KEY,creator_id TEXT NOT NULL REFERENCES users(id),holder_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,hops INTEGER NOT NULL DEFAULT 0 CHECK(hops>=0));
CREATE INDEX IF NOT EXISTS idx_bombs_holder ON bombs(holder_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_bombs_creator ON bombs(creator_id,created_at);
CREATE INDEX IF NOT EXISTS idx_bombs_leader ON bombs(expires_at,hops);
CREATE TABLE IF NOT EXISTS links(token TEXT PRIMARY KEY,bomb_id TEXT NOT NULL REFERENCES bombs(id),sender_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_links_sender ON links(sender_id,created_at);
CREATE TABLE IF NOT EXISTS transfers(token TEXT PRIMARY KEY REFERENCES links(token),bomb_id TEXT NOT NULL REFERENCES bombs(id),hop INTEGER NOT NULL CHECK(hop>=1),sender_id TEXT NOT NULL REFERENCES users(id),receiver_id TEXT NOT NULL REFERENCES users(id),sender_reward INTEGER NOT NULL CHECK(sender_reward IN (10,30,100)),receiver_reward INTEGER NOT NULL DEFAULT 5 CHECK(receiver_reward=5),created_at INTEGER NOT NULL,UNIQUE(bomb_id,hop),UNIQUE(bomb_id,receiver_id),CHECK(sender_id<>receiver_id));
CREATE INDEX IF NOT EXISTS idx_transfers_sender ON transfers(sender_id,created_at);
CREATE INDEX IF NOT EXISTS idx_transfers_receiver ON transfers(receiver_id,created_at);
CREATE TABLE IF NOT EXISTS invite_views(token TEXT NOT NULL REFERENCES links(token),visitor_id TEXT NOT NULL REFERENCES users(id),first_seen INTEGER NOT NULL,PRIMARY KEY(token,visitor_id));
CREATE INDEX IF NOT EXISTS idx_invite_views_at ON invite_views(first_seen);

-- Persistent lifetime game stats are separate from disposable invitation records.
CREATE TABLE IF NOT EXISTS player_stats(
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  points INTEGER NOT NULL DEFAULT 0 CHECK(points>=0),
  passes INTEGER NOT NULL DEFAULT 0 CHECK(passes>=0),
  receives INTEGER NOT NULL DEFAULT 0 CHECK(receives>=0),
  last_played INTEGER NOT NULL DEFAULT 0,
  equipped_style TEXT NOT NULL DEFAULT 'ember' CHECK(equipped_style IN ('ember','spark','neon','cosmic'))
);
CREATE INDEX IF NOT EXISTS idx_player_stats_last_played ON player_stats(last_played);
CREATE TABLE IF NOT EXISTS transfer_settlements(
  token TEXT PRIMARY KEY REFERENCES transfers(token),
  settled_at INTEGER NOT NULL
);
