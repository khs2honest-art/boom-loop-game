import {pruneExpired} from "./retention.js";
// Bomb Relay: server-authoritative, non-redeemable virtual rewards.
// Cloudflare Workers + D1; no real money, gift cards or incentivized ad views.
const DAY=86400000, HOUR=3600000;
const STYLES={ember:0,spark:10,neon:100,cosmic:300};
const corsHeaders={"X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","Cache-Control":"no-store","Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
function hex(n){return Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,"0")).join("");}
function output(data,status=200,cookie=""){const h=new Headers(corsHeaders);h.set("Content-Type","application/json; charset=utf-8");if(cookie)h.set("Set-Cookie",cookie);return new Response(JSON.stringify(data),{status,headers:h});}
function fail(message,status=400,cookie=""){return output({ok:false,error:message},status,cookie);}
function randomReward(){const x=crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;return x<0.70?10:x<0.95?30:100;}
function asId(x,n){return typeof x==="string"&&new RegExp("^[a-f0-9]{"+n+"}$").test(x);}
function publicOrigin(url){
  // Quick Tunnels terminate TLS at Cloudflare, then proxy HTTP to local Wrangler.
  // Only Cloudflare-owned preview hostnames need protocol normalization.
  return url.protocol==="http:"&&url.hostname.endsWith(".trycloudflare.com")?"https://"+url.host:url.origin;
}
function cookieValue(request){const m=(request.headers.get("cookie")||"").match(/(?:^|;\s*)relay_sid=([a-f0-9]{48})(?:;|$)/);return m?m[1]:null;}
async function userSession(request,env){
  let id=cookieValue(request);
  let cookie="";
  if(!id){id=hex(24);cookie="relay_sid="+id+"; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax"+(publicOrigin(new URL(request.url)).startsWith("https://")?"; Secure":"");}
  return {id,cookie};
}
async function body(request){
  if(!(request.headers.get("content-type")||"").toLowerCase().includes("application/json"))throw Error("JSON 요청만 가능해요.");
  const limit=512,size=Number(request.headers.get("content-length")||0);
  if(size>limit)throw new RangeError("요청 데이터 크기가 너무 큽니다.");
  const reader=request.body?.getReader();
  if(!reader)throw new SyntaxError("본문이 없습니다.");
  let total=0;
  const chunks=[];
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    total+=value.byteLength;
    if(total>limit){await reader.cancel();throw new RangeError("요청 데이터 크기가 너무 큽니다.");}
    chunks.push(value);
  }
  const bytes=new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const parsed=JSON.parse(new TextDecoder().decode(bytes));
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new SyntaxError("JSON 객체만 허용됩니다.");
  return parsed;
}
async function statusForUser(env,id,now){
  const [hold,score]=await Promise.all([
    env.DB.prepare("SELECT id, created_at, expires_at, hops FROM bombs WHERE holder_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(id,now).first(),
    env.DB.prepare("SELECT points, passes, receives, passes+receives AS events, equipped_style FROM player_stats WHERE user_id=?").bind(id).first()
  ]);
  return {ok:true,holder:hold||null,points:score?.points||0,passes:score?.passes||0,receives:score?.receives||0,events:score?.events||0,equipped_style:score?.equipped_style||"ember",now};
}
async function api(request,env,url){
  if(!env.DB)return fail("데이터베이스 연결이 필요합니다.",503);
  if(request.method==="POST"){
    const origin=request.headers.get("origin");
    if(origin&&origin!==url.origin)return fail("허용되지 않은 요청입니다.",403);
    const type=(request.headers.get("content-type")||"").toLowerCase();
    if(!type.includes("application/json"))return fail("JSON 형식이 필요합니다.",415);
  }
  const stateless=request.method==="GET"&&(url.pathname==="/api/board"||url.pathname==="/api/metrics"||url.pathname==="/api/result");
  const s=stateless?{id:cookieValue(request),cookie:""}:await userSession(request,env);
  const me=s.id, ck=s.cookie, now=Date.now();
  try{
    if(url.pathname==="/api/me"&&request.method==="GET"){
      return output(await statusForUser(env,me,now),200,ck);
    }
    if(url.pathname==="/api/erase"&&request.method==="POST"){
      const data=await body(request);
      if(data.confirm!=="ERASE_MY_ACCOUNT")return fail("삭제 확인 문구가 올바르지 않아요.",400,ck);
      const erasedCookie="relay_sid=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"+(publicOrigin(url).startsWith("https://")?"; Secure":"");
      const account=await env.DB.prepare("SELECT id FROM users WHERE id=?").bind(me).first();
      if(account){
        const shadow=hex(24);
        // Game outcomes remain as unlinkable anonymous relay activity; the original
        // browser ID, points, and cosmetics are deleted transactionally.
        await env.DB.batch([
          env.DB.prepare("INSERT INTO users(id,created_at) VALUES(?,?)").bind(shadow,now),
          env.DB.prepare("UPDATE bombs SET expires_at=CASE WHEN holder_id=? AND expires_at>? THEN ? ELSE expires_at END,creator_id=CASE WHEN creator_id=? THEN ? ELSE creator_id END,holder_id=CASE WHEN holder_id=? THEN ? ELSE holder_id END WHERE creator_id=? OR holder_id=?").bind(me,now,now,me,shadow,me,shadow,me,me),
          env.DB.prepare("UPDATE links SET sender_id=? WHERE sender_id=?").bind(shadow,me),
          env.DB.prepare("UPDATE transfers SET sender_id=CASE WHEN sender_id=? THEN ? ELSE sender_id END,receiver_id=CASE WHEN receiver_id=? THEN ? ELSE receiver_id END WHERE sender_id=? OR receiver_id=?").bind(me,shadow,me,shadow,me,me),
          env.DB.prepare("UPDATE invite_views SET visitor_id=? WHERE visitor_id=?").bind(shadow,me),
          env.DB.prepare("DELETE FROM player_stats WHERE user_id=?").bind(me),
          env.DB.prepare("DELETE FROM users WHERE id=?").bind(me)
        ]);
      }
      return output({ok:true,erased:true},200,erasedCookie);
    }
    if(url.pathname==="/api/equip"&&request.method==="POST"){
      const data=await body(request);
      if(!Object.prototype.hasOwnProperty.call(STYLES,data.style))return fail("존재하지 않는 폭탄 스타일이에요.",400,ck);
      await env.DB.prepare("INSERT OR IGNORE INTO users(id,created_at) VALUES(?,?)").bind(me,now).run();
      await env.DB.prepare("INSERT OR IGNORE INTO player_stats(user_id,last_played) VALUES(?,?)").bind(me,now).run();
      const r=await env.DB.prepare("UPDATE player_stats SET equipped_style=?,last_played=? WHERE user_id=? AND points>=?").bind(data.style,now,me,STYLES[data.style]).run();
      if(r.meta?.changes!==1)return fail("포인트가 부족해 잠금 해제되지 않은 스타일이에요.",403,ck);
      return output({ok:true,equipped_style:data.style},200,ck);
    }
    if(url.pathname==="/api/create"&&request.method==="POST"){
      await body(request);
      const hold=await env.DB.prepare("SELECT id, created_at, expires_at, hops FROM bombs WHERE holder_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(me,now).first();
      if(hold)return output({ok:true,bomb:hold,reused:true},200,ck);
      const cnt=await env.DB.prepare("SELECT COUNT(*) AS n FROM bombs WHERE creator_id=? AND created_at>?").bind(me,now-DAY).first();
      if(cnt.n>=3)return fail("폭탄 생성은 하루 최대 3개예요.",429,ck);
      const b={id:hex(8),created_at:now,expires_at:now+DAY,hops:0};
      // Create a durable user only after the request has passed validation and limits.
      await env.DB.prepare("INSERT OR IGNORE INTO users(id,created_at) VALUES(?,?)").bind(me,now).run();
      const inserted=await env.DB.prepare("INSERT INTO bombs(id,creator_id,holder_id,created_at,expires_at,hops) SELECT ?,?,?,?,?,0 WHERE NOT EXISTS(SELECT 1 FROM bombs WHERE holder_id=? AND expires_at>?) AND (SELECT COUNT(*) FROM bombs WHERE creator_id=? AND created_at>?)<3").bind(b.id,me,me,b.created_at,b.expires_at,me,now,me,now-DAY).run();
      if(inserted.meta?.changes!==1)return fail("다른 폭탄을 이미 보유 중이거나 생성 한도에 도달했어요.",409,ck);
      await env.DB.prepare("INSERT INTO player_stats(user_id,last_played) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_played=excluded.last_played").bind(me,now).run();
      return output({ok:true,bomb:b,reused:false},201,ck);
    }
    if(url.pathname==="/api/link"&&request.method==="POST"){
      const data=await body(request);
      if(!asId(data.bomb,16))return fail("폭탄 ID가 잘못됐어요.",400,ck);
      const b=await env.DB.prepare("SELECT id,holder_id,expires_at,hops FROM bombs WHERE id=?").bind(data.bomb).first();
      if(!b||b.holder_id!==me||b.expires_at<=now)return fail("현재 내가 들고 있는 폭탄이 아니에요.",409,ck);
      // Reuse the same unaccepted link, making repeated sharing cheap and consistent.
      const activeLink=await env.DB.prepare("SELECT token,expires_at FROM links WHERE bomb_id=? AND sender_id=? AND used_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(b.id,me,now).first();
      if(activeLink)return output({ok:true,url:publicOrigin(url)+"/?invite="+activeLink.token,expires_at:activeLink.expires_at,reused:true},200,ck);
      const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM links WHERE sender_id=? AND created_at>?").bind(me,now-HOUR).first();
      if(count.n>=20)return fail("초대 링크는 시간당 최대 20개예요.",429,ck);
      // Invitation remains usable for the bomb's remaining lifetime (up to 24 hours).
      const token=hex(16),expires=b.expires_at;
      const created=await env.DB.prepare("INSERT INTO links(token,bomb_id,sender_id,created_at,expires_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM links WHERE sender_id=? AND created_at>?)<20 AND EXISTS(SELECT 1 FROM bombs WHERE id=? AND holder_id=? AND expires_at>?)").bind(token,b.id,me,now,expires,me,now-HOUR,b.id,me,now).run();
      if(created.meta?.changes!==1)return fail("폭탄이 이미 전달됐거나 초대 링크 한도에 도달했어요.",429,ck);
      return output({ok:true,url:publicOrigin(url)+"/?invite="+token,expires_at:expires},201,ck);
    }
    if(url.pathname==="/api/ticket"&&request.method==="GET"){
      const t=url.searchParams.get("token");
      if(!asId(t,32))return fail("초대 링크가 잘못됐어요.",400,ck);
      const row=await env.DB.prepare("SELECT l.token,l.sender_id,l.expires_at AS link_expires,l.used_at,b.id AS bomb_id,b.hops,b.expires_at AS bomb_expires,b.holder_id,b.creator_id FROM links l JOIN bombs b ON b.id=l.bomb_id WHERE l.token=?").bind(t).first();
      if(!row)return fail("존재하지 않는 초대 링크예요.",404,ck);
      const valid=row.used_at===null&&row.link_expires>now&&row.bomb_expires>now&&row.holder_id===row.sender_id;
      if(valid&&row.sender_id!==me){
        await env.DB.batch([
          env.DB.prepare("INSERT OR IGNORE INTO users(id,created_at) VALUES(?,?)").bind(me,now),
          env.DB.prepare("INSERT OR IGNORE INTO invite_views(token,visitor_id,first_seen) VALUES(?,?,?)").bind(t,me,now)
        ]);
      }
      return output({ok:true,bomb:row.bomb_id,hops:row.hops,expires_at:row.bomb_expires,valid,own:row.sender_id===me,now},200,ck);
    }
    if(url.pathname==="/api/accept"&&request.method==="POST"){
      const data=await body(request),token=data.token;
      if(!asId(token,32))return fail("초대 링크가 잘못됐어요.",400,ck);
      const row=await env.DB.prepare("SELECT l.token,l.sender_id,l.expires_at AS link_expires,l.used_at,b.id AS bomb_id,b.hops,b.expires_at AS bomb_expires,b.holder_id,b.creator_id FROM links l JOIN bombs b ON b.id=l.bomb_id WHERE l.token=?").bind(token).first();
      if(!row)return fail("초대 링크를 찾을 수 없어요.",404,ck);
      if(row.used_at!==null||row.sender_id!==row.holder_id||row.link_expires<=now||row.bomb_expires<=now)return fail("이미 사용했거나 만료된 초대장이에요.",409,ck);
      if(me===row.sender_id||me===row.creator_id)return fail("본인이 시작하거나 보낸 폭탄은 받을 수 없어요.",403,ck);
      const prior=await env.DB.prepare("SELECT 1 AS yes FROM transfers WHERE bomb_id=? AND receiver_id=? LIMIT 1").bind(row.bomb_id,me).first();
      if(prior)return fail("이미 참여했던 폭탄은 다시 받을 수 없어요.",409,ck);
      const alreadyHolding=await env.DB.prepare("SELECT id FROM bombs WHERE holder_id=? AND expires_at>? AND id<>? LIMIT 1").bind(me,now,row.bomb_id).first();
      if(alreadyHolding)return fail("다른 폭탄을 먼저 전달해야 새 폭탄을 받을 수 있어요.",409,ck);
      const reward=randomReward(),receiver=5;
      // D1 batch is transactional. Transfer insertion is guarded by the new
      // holder + hop counter, ensuring only the winning atomic change scores.
      await env.DB.batch([
        env.DB.prepare("INSERT OR IGNORE INTO users(id,created_at) VALUES(?,?)").bind(me,now),
        env.DB.prepare("INSERT OR IGNORE INTO invite_views(token,visitor_id,first_seen) VALUES(?,?,?)").bind(token,me,now),
        env.DB.prepare("UPDATE bombs SET holder_id=?, hops=hops+1 WHERE id=? AND holder_id=? AND hops=? AND expires_at>? AND creator_id<>? AND NOT EXISTS(SELECT 1 FROM transfers WHERE bomb_id=? AND receiver_id=?) AND NOT EXISTS(SELECT 1 FROM bombs held WHERE held.holder_id=? AND held.expires_at>? AND held.id<>?)").bind(me,row.bomb_id,row.sender_id,row.hops,now,me,row.bomb_id,me,me,now,row.bomb_id),
        env.DB.prepare("INSERT OR IGNORE INTO transfers(token,bomb_id,hop,sender_id,receiver_id,sender_reward,receiver_reward,created_at) SELECT ?,?,?,?,?,?,?,? FROM bombs WHERE id=? AND holder_id=? AND hops=? AND NOT EXISTS(SELECT 1 FROM transfers WHERE token=?)").bind(token,row.bomb_id,row.hops+1,row.sender_id,me,reward,receiver,now,row.bomb_id,me,row.hops+1,token),
        env.DB.prepare("INSERT OR IGNORE INTO player_stats(user_id,last_played) VALUES(?,?)").bind(row.sender_id,now),
        env.DB.prepare("INSERT OR IGNORE INTO player_stats(user_id,last_played) VALUES(?,?)").bind(me,now),
        env.DB.prepare("UPDATE player_stats SET points=points+(SELECT sender_reward FROM transfers WHERE token=?),passes=passes+1,last_played=? WHERE user_id=? AND EXISTS(SELECT 1 FROM transfers WHERE token=? AND sender_id=?) AND NOT EXISTS(SELECT 1 FROM transfer_settlements WHERE token=?)").bind(token,now,row.sender_id,token,row.sender_id,token),
        env.DB.prepare("UPDATE player_stats SET points=points+(SELECT receiver_reward FROM transfers WHERE token=?),receives=receives+1,last_played=? WHERE user_id=? AND EXISTS(SELECT 1 FROM transfers WHERE token=? AND receiver_id=?) AND NOT EXISTS(SELECT 1 FROM transfer_settlements WHERE token=?)").bind(token,now,me,token,me,token),
        env.DB.prepare("INSERT OR IGNORE INTO transfer_settlements(token,settled_at) SELECT token,? FROM transfers WHERE token=?").bind(now,token),
        env.DB.prepare("UPDATE links SET used_at=? WHERE token=? AND EXISTS(SELECT 1 FROM transfers WHERE token=?)").bind(now,token,token)
      ]);
      const actual=await env.DB.prepare("SELECT receiver_id,sender_reward,receiver_reward FROM transfers WHERE token=?").bind(token).first();
      if(!actual||actual.receiver_id!==me)return fail("다른 사용자가 먼저 폭탄을 받았어요.",409,ck);
      return output({ok:true,bomb:row.bomb_id,sender_reward:actual.sender_reward,receiver_reward:actual.receiver_reward,expires_at:row.bomb_expires},200,ck);
    }
    if(url.pathname==="/api/result"&&request.method==="GET"){
      const id=url.searchParams.get("id");
      if(!asId(id,16))return fail("결과 링크가 올바르지 않아요.",400,ck);
      const b=await env.DB.prepare("SELECT id,hops,expires_at FROM bombs WHERE id=?").bind(id).first();
      if(!b)return fail("해당 릴레이를 찾을 수 없어요.",404,ck);
      return output({ok:true,bomb:b.id,hops:b.hops,expires_at:b.expires_at,ended:b.expires_at<=now,now},200,ck);
    }
    if(url.pathname==="/api/history"&&request.method==="GET"){
      const rows=await env.DB.prepare("SELECT b.id,b.hops,b.expires_at,b.created_at,CASE WHEN b.holder_id=? THEN 1 ELSE 0 END AS exploded_on_me FROM bombs b WHERE b.expires_at<=? AND (b.creator_id=? OR EXISTS(SELECT 1 FROM transfers t WHERE t.bomb_id=b.id AND (t.sender_id=? OR t.receiver_id=?))) ORDER BY b.expires_at DESC LIMIT 8").bind(me,now,me,me,me).all();
      return output({ok:true,history:rows.results||[],now},200,ck);
    }
    if(url.pathname==="/api/metrics"&&request.method==="GET"){
      const [bombs,links,views,passes,rere,receivers] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS n FROM bombs").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM links").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM invite_views").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM transfers").first(),
        env.DB.prepare("SELECT COUNT(DISTINCT t.receiver_id) AS n FROM transfers t WHERE EXISTS(SELECT 1 FROM transfers s WHERE s.sender_id=t.receiver_id AND s.created_at>=t.created_at)").first(),
        env.DB.prepare("SELECT COUNT(DISTINCT receiver_id) AS n FROM transfers").first()
      ]);
      return output({ok:true,bombs:bombs.n,links:links.n,invite_visits:views.n,passes:passes.n,repeat_senders:rere.n,unique_receivers:receivers.n,continuation_rate:receivers.n?Math.round(100*rere.n/receivers.n):0,accept_rate:views.n?Math.round(100*passes.n/views.n):0},200,ck);
    }
    if(url.pathname==="/api/board"&&request.method==="GET"){
      const recent=await env.DB.prepare("SELECT id,hops,expires_at FROM bombs WHERE expires_at>? ORDER BY hops DESC,created_at DESC LIMIT 8").bind(now).all();
      return output({ok:true,board:recent.results||[],now},200,ck);
    }
    return fail("해당 기능을 찾을 수 없어요.",404,ck);
  }catch(e){
    if(e instanceof SyntaxError)return fail("JSON 요청 형식이 잘못됐어요.",400,ck);
    if(e instanceof RangeError)return fail("요청 데이터 크기가 너무 큽니다.",413,ck);
    console.error("API_ERROR",url.pathname,String(e));
    return fail("처리 중 문제가 발생했어요. 잠시 뒤 다시 시도해 주세요.",500,ck);
  }
}
export default {
  async scheduled(controller,env){
    const result=await pruneExpired(env,controller.scheduledTime||Date.now());
    console.log("DAILY_RETENTION_CLEANUP",result.map(r=>r.meta?.changes||0).join(","));
  },
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith("/api/")){
      if(!["GET","POST"].includes(request.method))return fail("지원하지 않는 방식입니다.",405);
      return api(request,env,url);
    }
    if(env.ASSETS){
      const r=await env.ASSETS.fetch(request);
      const h=new Headers(r.headers);
      h.set("X-Content-Type-Options","nosniff");
      h.set("Referrer-Policy","strict-origin-when-cross-origin");
      h.set("X-Frame-Options","DENY");
      h.set("Content-Security-Policy",corsHeaders["Content-Security-Policy"]);
      h.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
      if(url.hostname.endsWith(".trycloudflare.com"))h.set("X-Robots-Tag","noindex, nofollow");
      if((h.get("Content-Type")||"").includes("text/html"))h.set("Cache-Control","no-store");
      return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});
    }
    return new Response("Missing static assets binding",{status:503});
  }
};
