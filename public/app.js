const $=id=>document.getElementById(id);
let current=null,invitation=null,offset=0,lastExpiredRefresh="",displayedShareBomb=null,sessionReady=false;
const fetchedPanels={history:false,metrics:false};
const availableStyles=[
  {id:"ember",name:"기본 폭탄",icon:"💣",need:0},
  {id:"spark",name:"스파크",icon:"✨",need:10},
  {id:"neon",name:"네온",icon:"⚡",need:100},
  {id:"cosmic",name:"코스믹",icon:"🌌",need:300}
];
function renderStyles(me){
  const list=$("styleOptions");list.replaceChildren();
  const style=availableStyles.find(x=>x.id===me.equipped_style)||availableStyles[0];
  document.querySelector(".bombarea").dataset.theme=style.id;
  $("equippedLabel").textContent=style.name+" · 누적 "+me.points.toLocaleString("ko-KR")+"점";
  for(const item of availableStyles){
    const btn=document.createElement("button");btn.type="button";btn.className="style-tile";
    const locked=me.points<item.need,chosen=item.id===style.id;
    if(locked)btn.classList.add("locked");if(chosen)btn.classList.add("active");
    btn.disabled=locked||chosen;
    btn.setAttribute("aria-label",item.name+(locked?" "+item.need+"점 필요":chosen?" 선택됨":" 선택"));
    const ico=document.createElement("span");ico.className="style-icon";ico.textContent=item.icon;
    const name=document.createElement("b");name.textContent=item.name;
    const need=document.createElement("small");need.textContent=chosen?"사용 중":locked?item.need+"점 필요":"선택하기 · 무료";
    btn.append(ico,name,need);
    if(!locked&&!chosen)btn.addEventListener("click",async()=>{
      btn.disabled=true;
      try{await api("/api/equip",{style:item.id});await update();msg(item.name+" 적용 완료!",true);}
      catch(e){msg(e.message);btn.disabled=false;}
    });
    list.append(btn);
  }
}
const params=new URLSearchParams(location.search),token=params.get("invite"),resultId=params.get("result");
function msg(txt,good=false){const el=$("feedback");el.classList.remove("hidden");el.classList.toggle("success",good);el.textContent=txt;el.scrollIntoView({behavior:"smooth",block:"nearest"});}
async function api(path,data){const opt=data===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)};const resp=await fetch(path,{credentials:"same-origin",cache:"no-store",...opt});const json=await resp.json().catch(()=>({error:"응답을 읽을 수 없어요."}));if(!resp.ok||!json.ok)throw Error(json.error||"요청에 실패했어요.");return json;}
function remain(end){const s=Math.max(0,Math.ceil((end-(Date.now()+offset))/1000));const hh=Math.floor(s/3600),mm=Math.floor((s%3600)/60),ss=s%60;return [hh,mm,ss].map(x=>String(x).padStart(2,"0")).join(":");}
function tick(){if(current){$("holdClock").textContent=remain(current.expires_at);const elapsed=(Date.now()+offset-current.created_at)/86400000;$("progress").style.width=(100*Math.min(1,Math.max(0,elapsed))).toFixed(2)+"%";if(current.expires_at<=Date.now()+offset&&lastExpiredRefresh!==current.id){lastExpiredRefresh=current.id;Promise.allSettled([update(),loadHistory()]).then(()=>msg("폭탄 시간이 끝났어! 종료 기록을 확인해 봐.",true));}}if(invitation){$("inviteClock").textContent=remain(invitation.expires_at);}}
function setLocked(b,lock){b.disabled=lock;}
async function update(bootstrap=null){
  const [me,board]=await Promise.all([bootstrap||api("/api/me"),api("/api/board")]);
  offset=me.now-Date.now();current=me.holder;
  $("points").textContent=me.points.toLocaleString("ko-KR");
  $("passes").textContent=me.passes;$("events").textContent=me.events;
  renderStyles(me);
  $("emptyState").classList.toggle("hidden",!!current);
  $("holding").classList.toggle("hidden",!current);
  // Do not erase a still-valid invitation merely because the user tapped refresh.
  if(!current||displayedShareBomb!==current.id){$("shareArea").classList.add("hidden");displayedShareBomb=null;}
  if(current)$("myHops").textContent=current.hops+"회";
  const b=$("board");b.replaceChildren();
  if(!board.board.length){const p=document.createElement("p");p.className="note";p.textContent="첫 번째 폭탄의 주인공이 되어봐!";b.append(p);}
  board.board.forEach((row,i)=>{const div=document.createElement("div");div.className="event";const label=document.createElement("span");label.textContent=(i+1)+"위 · 폭탄 #"+row.id.slice(0,6);const count=document.createElement("span");count.className="rank";count.textContent=row.hops+"회 전달";div.append(label,count);b.append(div);});
  tick();
}
async function loadInvite(){
 if(!token)return;
 try{
  invitation=await api("/api/ticket?token="+encodeURIComponent(token));
  const el=$("invite");el.hidden=false;
  if(!invitation.valid){$("acceptBtn").disabled=true;$("inviteInfo").textContent="이미 수락되었거나 만료된 링크예요.";return;}
  if(invitation.own){$("acceptBtn").disabled=true;$("inviteInfo").textContent="본인이 보낸 링크는 수락할 수 없어요.";return;}
  $("inviteInfo").textContent="현재 "+invitation.hops+"번 전달된 폭탄이에요.";tick();
 }catch(e){msg(e.message);}
}
async function shareGame(url,message){
 if(navigator.share){try{await navigator.share({title:"💣 BOOM LOOP",text:message,url});return;}catch(e){if(e.name==="AbortError")return;}}
 try{await navigator.clipboard.writeText(url);msg("공유 링크를 복사했어!",true);}catch(e){msg("공유할 주소: "+url);}
}
async function loadResult(){
 if(!resultId)return;
 try{const data=await api("/api/result?id="+encodeURIComponent(resultId));const el=$("publicResult");el.hidden=false;
 $("resultTitle").textContent=data.ended?"💥 릴레이 종료!":"🔥 지금도 릴레이 진행 중!";
 $("resultHops").textContent=data.hops+"번 전달";
 $("resultDescription").textContent=data.ended?"폭탄이 여기까지 퍼졌어. 다음 기록에 도전해 봐!":"폭탄이 아직 움직이고 있어. 누가 마지막까지 살아남을까?";}
 catch(e){msg("결과 조회 실패: "+e.message);}
}
async function loadHistory(){
 const d=await api("/api/history");fetchedPanels.history=true;const list=$("historyList");list.replaceChildren();
 if(!d.history.length){const p=document.createElement("p");p.className="note";p.textContent="아직 종료된 기록은 없어. 폭탄이 터지면 최종 전달 횟수가 여기에 남아.";list.append(p);return;}
 for(const b of d.history){const el=document.createElement("div");el.className="event";const a=document.createElement("span");a.textContent=(b.exploded_on_me?"💥 내 손에서 폭발":"🎉 참여 완료")+" · #"+b.id.slice(0,6);const btn=document.createElement("button");btn.className="btn outline";btn.style.cssText="width:auto;font-size:12px;padding:8px 10px;margin:0;";btn.textContent=b.hops+"번 · 공유";btn.addEventListener("click",()=>shareGame(location.origin+"/?result="+b.id,"폭탄이 "+b.hops+"번이나 돌았어! 너도 도전해 봐."));el.append(a,btn);list.append(el);}
}
async function loadMetrics(){
 try{const m=await api("/api/metrics");fetchedPanels.metrics=true;$("globalVisits").textContent=m.invite_visits.toLocaleString("ko-KR");$("globalPasses").textContent=m.passes.toLocaleString("ko-KR");$("globalRate").textContent=m.accept_rate+"%";$("relayContinue").textContent=m.continuation_rate+"%";$("repeatSenders").textContent=m.repeat_senders.toLocaleString("ko-KR");}
 catch(e){console.warn("메트릭 로드 실패",e);}
}
$("createBtn").addEventListener("click",async()=>{const b=$("createBtn");setLocked(b,true);try{const d=await api("/api/create",{});msg(d.reused?"현재 폭탄을 불러왔어요.":"새 폭탄이 만들어졌어! 이제 친구에게 보내봐.",true);await update();$("holding").scrollIntoView({behavior:"auto",block:"start"});}catch(e){msg(e.message);}finally{setLocked(b,false);}});
$("shareBtn").addEventListener("click",async()=>{const b=$("shareBtn");if(!current)return;setLocked(b,true);try{const data=await api("/api/link",{bomb:current.id});$("shareLink").value=data.url;displayedShareBomb=current.id;$("shareArea").classList.remove("hidden");setLocked(b,false);if(navigator.share){try{await navigator.share({title:"💣 BOOM LOOP 릴레이",text:"폭탄 받으면 +5점! 네 차례야 😈",url:data.url});}catch(e){if(e.name!=="AbortError")msg("공유를 취소했거나 사용할 수 없어요. 링크를 복사해도 돼.");}}else{try{await navigator.clipboard.writeText(data.url);msg("초대 링크가 복사됐어. 친구에게 보내봐!",true);}catch(e){msg("링크가 생성됐어. 아래 입력창에서 복사해줘!",true);}}}catch(e){msg(e.message);}finally{setLocked(b,false);}});
$("eraseBtn").addEventListener("click",async()=>{
 if(!window.confirm("이 브라우저의 게임 포인트·테마·참여 기록 연결을 삭제할까요? 취소할 수 없어요."))return;
 const btn=$("eraseBtn");btn.disabled=true;
 try{
   await api("/api/erase",{confirm:"ERASE_MY_ACCOUNT"});
   location.replace(location.pathname);
 }catch(e){msg(e.message);btn.disabled=false;}
});
$("resultStartBtn").addEventListener("click",()=>$("createBtn").click());
$("resultShareBtn").addEventListener("click",()=>shareGame(location.href,"이 폭탄 릴레이 결과를 확인해 봐!"));
$("refreshBtn").addEventListener("click",async()=>{try{await update();await loadMetrics();await loadHistory();msg("최신 상태를 반영했어요.",true);}catch(e){msg(e.message);}});
$("copyBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("shareLink").value);msg("링크 복사 완료!",true);}catch(e){$("shareLink").select();msg("입력창의 링크를 직접 복사해줘.");}});
$("acceptBtn").addEventListener("click",async()=>{const b=$("acceptBtn");setLocked(b,true);try{const d=await api("/api/accept",{token});msg("폭탄 받기 성공! +"+d.receiver_reward+"점. 보낸 친구는 +"+d.sender_reward+"점 획득! 이제 다른 친구에게 넘겨봐.",true);invitation=null;$("invite").hidden=true;history.replaceState(null,"",location.pathname);await update();$("holding").scrollIntoView({behavior:"auto",block:"start"});}catch(e){msg(e.message);setLocked(b,false);}});
function lazyPanels(){
 if(!("IntersectionObserver" in window)){loadMetrics();loadHistory();return;}
 const panels=[{id:"growth",load:loadMetrics},{id:"historyList",load:loadHistory}];
 const observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){
     observer.unobserve(entry.target);
     const panel=panels.find(p=>entry.target.id===p.id);
     if(panel)panel.load().catch(e=>console.warn("지연 화면 갱신 실패",e));
   }
 },{rootMargin:"180px"});
 for(const panel of panels){const el=$(panel.id);if(el)observer.observe(el);}
}
async function boot(){
 try{
   const me=await api("/api/me");sessionReady=true;
   await Promise.all([update(me),loadInvite(),loadResult()]);
   lazyPanels();
 }catch(e){msg(e.message);}
}
boot();
// Refresh only when the user returns to the tab; avoid background polling and DB traffic.
let lastForegroundSync=0;
async function syncOnForeground(){
 if(!sessionReady||document.hidden||Date.now()-lastForegroundSync<12000)return;
 lastForegroundSync=Date.now();
 try{const work=[update()];if(fetchedPanels.metrics)work.push(loadMetrics());if(fetchedPanels.history)work.push(loadHistory());await Promise.all(work);}catch(e){console.warn("복귀 시 상태 갱신 실패",e);}
}
document.addEventListener("visibilitychange",syncOnForeground);
window.addEventListener("focus",syncOnForeground);
setInterval(tick,1000);
