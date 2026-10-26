-- Add persistent game point totals to an existing database.
-- Safe to run repeatedly; no existing game records are deleted.
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
-- Backfill all still-retained historical transfers, without replaying payouts.
INSERT OR IGNORE INTO player_stats(user_id,points,passes,receives,last_played)
SELECT person_id,SUM(points),SUM(passes),SUM(receives),MAX(created_at)
FROM (
 SELECT sender_id AS person_id,sender_reward AS points,1 AS passes,0 AS receives,created_at FROM transfers
 UNION ALL
 SELECT receiver_id AS person_id,receiver_reward AS points,0 AS passes,1 AS receives,created_at FROM transfers
)
GROUP BY person_id;
INSERT OR IGNORE INTO transfer_settlements(token,settled_at)
SELECT token,created_at FROM transfers;
