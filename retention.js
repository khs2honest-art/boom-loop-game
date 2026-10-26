// Daily maintenance; no personal names/emails are stored.
// Old relay records are removed after 30 days past explosion.
// Orphan session identities are removed after 90 days.
export const DAY=86400000;
export async function pruneExpired(env, now=Date.now()){
  if(!env.DB)throw Error("D1 binding missing");
  const oldBomb=now-30*DAY,oldUser=now-90*DAY;
  const batch=[
    env.DB.prepare("DELETE FROM transfer_settlements WHERE token IN(SELECT t.token FROM transfers t JOIN bombs b ON b.id=t.bomb_id WHERE b.expires_at<?)").bind(oldBomb),
    env.DB.prepare("DELETE FROM invite_views WHERE token IN(SELECT l.token FROM links l JOIN bombs b ON l.bomb_id=b.id WHERE b.expires_at<?)").bind(oldBomb),
    env.DB.prepare("DELETE FROM transfers WHERE bomb_id IN(SELECT id FROM bombs WHERE expires_at<?)").bind(oldBomb),
    env.DB.prepare("DELETE FROM links WHERE bomb_id IN(SELECT id FROM bombs WHERE expires_at<?)").bind(oldBomb),
    env.DB.prepare("DELETE FROM bombs WHERE expires_at<?").bind(oldBomb),
    env.DB.prepare("DELETE FROM player_stats WHERE user_id IN (SELECT u.id FROM users u WHERE u.created_at<? AND player_stats.last_played<? AND NOT EXISTS(SELECT 1 FROM bombs WHERE creator_id=u.id OR holder_id=u.id) AND NOT EXISTS(SELECT 1 FROM links WHERE sender_id=u.id) AND NOT EXISTS(SELECT 1 FROM transfers WHERE sender_id=u.id OR receiver_id=u.id) AND NOT EXISTS(SELECT 1 FROM invite_views WHERE visitor_id=u.id))").bind(oldUser,oldUser),
    env.DB.prepare("DELETE FROM users WHERE created_at<? AND NOT EXISTS(SELECT 1 FROM player_stats WHERE user_id=users.id) AND NOT EXISTS(SELECT 1 FROM bombs WHERE creator_id=users.id OR holder_id=users.id) AND NOT EXISTS(SELECT 1 FROM links WHERE sender_id=users.id) AND NOT EXISTS(SELECT 1 FROM transfers WHERE sender_id=users.id OR receiver_id=users.id) AND NOT EXISTS(SELECT 1 FROM invite_views WHERE visitor_id=users.id)").bind(oldUser)
  ];
  return await env.DB.batch(batch);
}
