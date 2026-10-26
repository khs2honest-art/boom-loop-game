(() => {
  "use strict";
  const el=id=>document.getElementById(id);
  const DAY=86400000,MAX_HOPS=10000;
  const storeKey="boom-loop-static-v1",seenKey="boom-loop-seen-v1";
  const find=()=>new URL(window.location.href);
  let held=null, incoming=null;
  function safeRead(k,fall){
    try{const obj=JSON.parse(localStorage.getItem(k)||"null");return obj&&typeof obj==="object"&&!Array.isArray(obj)?obj:fall;}catch{return fall;}
  }
  function safeWrite(k,obj){try{localStorage.setItem(k,JSON.stringify(obj));return true;}catch{return false;}}
  function valid(x){
    return !!x&&x.v===1&&typeof x.id==="string"&&/^[a-f0-9]{16}$/.test(x.id)
      &&Number.isSafeInteger(x.h)&&x.h>=0&&x.h<=MAX_HOPS
      &&Number.isSafeInteger(x.until)&&x.until>Date.now()-DAY&&x.until<Date.now()+DAY+60000;
  }
  function encode(x){
    const bytes=new TextEncoder().encode(JSON.stringify(x));
    let chars="";for(const b of bytes)chars+=String.fromCharCode(b);
    return btoa(chars).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  }
  function decode(str){
    if(typeof str!=="string"||str.length>350||!/^[A-Za-z0-9_-]+$/.test(str))return null;
    try{
      const raw=atob(str.replace(/-/g,"+").replace(/_/g,"/"));
      const bytes=Uint8Array.from(raw,x=>x.charCodeAt(0));
      const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
      return valid(value)?value:null;
    }catch{return null;}
  }
  const empty=()=>{for(const name of ["receive","holding","start","expired"])el(name).classList.add("hide");};
  const strip=()=>{const url=new URL(location.href);url.searchParams.delete("b");history.replaceState(null,"",url.toString());};
  const clock=until=>{
    const delta=Math.max(0,Math.ceil((until-Date.now())/1000));
    const hr=Math.floor(delta/3600),min=Math.floor(delta%3600/60),sec=delta%60;
    return [hr,min,sec].map(x=>String(x).padStart(2,"0")).join(":");
  };
  function status(message,good=false){
    const n=el("status");n.textContent=message;n.className="callout"+(good?" success":"");
  }
  function makeLink(game){
    const url=new URL(location.pathname,location.origin);
    url.searchParams.set("b",encode(game));return url.toString();
  }
  function remember(game){
    held=game;safeWrite(storeKey,game);
    const seen=safeRead(seenKey,{});
    seen[game.id]=Math.max(Number(seen[game.id])||0,game.h);
    // Avoid unlimited local storage growth.
    for(const key of Object.keys(seen).slice(0,Math.max(0,Object.keys(seen).length-50)))delete seen[key];
    safeWrite(seenKey,seen);
  }
  function render(){
    empty();
    if(incoming){
      if(incoming.until<=Date.now()){el("expired").classList.remove("hide");return;}
      el("receive").classList.remove("hide");
      el("incomingHops").textContent=incoming.h+"번";
      el("receiveTimer").textContent=clock(incoming.until);
      return;
    }
    if(valid(held)&&held.until>Date.now()){
      el("holding").classList.remove("hide");
      el("ownHops").textContent=held.h+"번 전달";
      el("ownTimer").textContent=clock(held.until);
      el("shareOptions").classList.add("hide");
      return;
    }
    if(held&&valid(held)&&held.until<=Date.now()){
      el("expired").classList.remove("hide");return;
    }
    el("start").classList.remove("hide");
  }
  function create(){
    const bytes=crypto.getRandomValues(new Uint8Array(8));
    const id=Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
    const game={v:1,id,h:0,until:Date.now()+DAY};
    incoming=null;remember(game);strip();render();status("새 폭탄이 생겼어! 친구에게 전해봐.",true);
    el("holding").scrollIntoView({block:"center",behavior:"smooth"});
  }
  async function share(){
    if(!held||!valid(held)||held.until<=Date.now())return;
    const url=makeLink(held);
    el("link").value=url;el("shareOptions").classList.remove("hide");
    if(navigator.share){
      try{await navigator.share({title:"💣 BOOM LOOP",text:"네 차례야! 폭탄을 받고 다음 친구에게 넘겨봐 💣",url});return;}
      catch(e){if(e.name==="AbortError")return;}
    }
    try{await navigator.clipboard.writeText(url);status("초대 링크를 복사했어!",true);}
    catch{status("아래 표시된 초대 링크를 복사해줘.",true);}
  }
  function accept(){
    if(!incoming||!valid(incoming)||incoming.until<=Date.now())return render();
    const seen=safeRead(seenKey,{});
    if(Object.prototype.hasOwnProperty.call(seen,incoming.id)){
      status("이 기기에서 이미 참여했던 폭탄이야. 새 폭탄으로 시작해 줘.");
      incoming=null;strip();render();return;
    }
    const next={...incoming,h:incoming.h+1};
    incoming=null;remember(next);strip();render();status("폭탄 받기 완료! 이제 친구에게 전달해 봐.",true);
    el("holding").scrollIntoView({block:"center",behavior:"smooth"});
  }
  function init(){
    held=safeRead(storeKey,null);
    if(!valid(held))held=null;
    const b=find().searchParams.get("b");
    if(b){
      const obj=decode(b);
      if(!obj){status("초대 링크가 올바르지 않거나 오래됐어. 새 폭탄으로 시작할 수 있어.");strip();}
      else if(obj.until<=Date.now())incoming=obj;
      else{
        const seen=safeRead(seenKey,{});
        if(Object.prototype.hasOwnProperty.call(seen,obj.id)){
          if(held&&held.id===obj.id){
            status("이 기기에서 이미 참여한 폭탄이야. 보유 중인 폭탄을 다른 친구에게 전달할 수 있어.");
          }else status("이 기기에서 이미 참여했던 폭탄이야. 다시 수락할 수 없어.");
          strip();
        }else incoming=obj;
      }
    }
    render();
  }
  el("create").addEventListener("click",create);
  el("restart").addEventListener("click",create);
  el("new").addEventListener("click",create);
  el("accept").addEventListener("click",accept);
  el("share").addEventListener("click",share);
  el("copy").addEventListener("click",async()=>{
    el("link").select();
    try{await navigator.clipboard.writeText(el("link").value);status("링크 복사 완료!",true);}
    catch{status("선택된 초대 링크를 직접 복사해 줘.");}
  });
  el("clear").addEventListener("click",()=>{
    if(!window.confirm("이 브라우저의 폭탄 체험 기록을 초기화할까요?"))return;
    try{localStorage.removeItem(storeKey);localStorage.removeItem(seenKey);}catch{}
    incoming=null;held=null;strip();render();status("이 브라우저의 체험 기록을 초기화했어.",true);
  });
  setInterval(()=>{
    if(incoming){el("receiveTimer").textContent=clock(incoming.until);if(Date.now()>=incoming.until){render();}}
    else if(held&&valid(held)){el("ownTimer").textContent=clock(held.until);if(Date.now()>=held.until){render();}}
  },1000);
  init();
})();
