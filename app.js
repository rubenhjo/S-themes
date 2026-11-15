/* sigma-themes public release: no login, read-only catalog, verified server-side contribution pipeline.
   Personal playlists/favorites/queue stay in this browser. Published music and exports are SSEQ-only; no ROM patch is created. */
(() => {
'use strict';
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=()=>globalThis.crypto?.randomUUID?.() || ('local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
const fmt=s=>Number.isFinite(Number(s))?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'0:00';
const audio=new window.SigmaSeqAudio();
const state={tracks:[],playlists:[],items:[],likes:[],view:'all',queue:[],baseQueue:[],index:-1,playingId:null,shuffle:false,repeat:'off',volume:.8,muted:false,normalize:true,target:-14,sort:'added',search:'',busy:false,ready:false,connected:false,catalogChecked:false,activeProgress:null,dsMappings:{},folderTree:[],trackFolders:{},exportMetadata:{}};
let pageActive=true,lifecycleEpoch=0,configFlight=null,connectGeneration=0,catalogAbort=null,configAbort=null;
let config={},playToken=0,blobURL=null,ctx=null,gain=null,uiToastTimer=null,refreshFlight=null,realtimeSocket=null,heartbeat=null,reconnectTimer=null,refreshTimer=null,refreshDelay=null,drag=null,queueDrag=null,activeUpload=null,uploadOp=null,exportOp=null,pendingResume=null,historyTick=0,archiveUrls=[];
function toast(message,bad=false){let root=$('#toastRoot');root.innerHTML=`<div class="toast" role="status" style="background:${bad?'#a43f5c':'#534779'}">${escapeHTML(message)}</div>`;clearTimeout(uiToastTimer);uiToastTimer=setTimeout(()=>root.replaceChildren(),5500)}
function persist(){
 try{
  const session=SigmaCore.sessionSnapshot(state, Number(audio.currentTime)||0);
  localStorage.setItem('sigma-themes-personal-v3',JSON.stringify({
   playlists:state.playlists,items:state.items,likes:state.likes,view:state.view,
   queue:state.queue,baseQueue:state.baseQueue,index:state.index,playingId:state.playingId,
   shuffle:state.shuffle,repeat:state.repeat,volume:state.volume,muted:state.muted,
   normalize:state.normalize,target:state.target,sort:state.sort,
   session,dsMappings:state.dsMappings,folderTree:state.folderTree,trackFolders:state.trackFolders,exportMetadata:state.exportMetadata
  }));
 }catch(e){toast('Browser storage is unavailable. Export your playlists for safety.',true)}
}
function loadPersonal(){
 try{
  const raw=localStorage.getItem('sigma-themes-personal-v3')||'{}';let parsed;
  try{parsed=JSON.parse(raw)}catch(e){
   try{localStorage.setItem('sigma-themes-personal-invalid-'+Date.now(),raw)}catch{}
   toast('Personal settings were malformed. An unmodified recovery copy was retained where storage allows.',true);
   parsed={};
  }
  const s=SigmaCore.normalizePersonalState(parsed);
  for(const k of ['playlists','items','likes','queue','baseQueue','view','playingId','repeat','sort','target','volume','muted','normalize','shuffle','index','dsMappings'])state[k]=s[k];
  try{state.folderTree=Array.isArray(parsed.folderTree)?parsed.folderTree:[];SigmaDexExport.folderIndex(state.folderTree)}
  catch(e){state.folderTree=[];toast('Folder data was invalid. Restored main library without removing saved playlists.',true)}
  state.trackFolders=parsed.trackFolders&&typeof parsed.trackFolders==='object'&&!Array.isArray(parsed.trackFolders)?parsed.trackFolders:{};
  state.exportMetadata=parsed.exportMetadata&&typeof parsed.exportMetadata==='object'&&!Array.isArray(parsed.exportMetadata)?parsed.exportMetadata:{};
  const session=s.session&&typeof s.session==='object'?s.session:{trackId:s.playingId,seconds:Number(s.lastTime)||0,savedAt:0,context:s.view,queue:s.queue};
  pendingResume=session.trackId&&session.trackId===state.playingId&&state.queue.includes(session.trackId)?session:null;
 }catch(e){console.warn('Browser personal storage is unavailable',e);toast('Personal storage is unavailable. Export backups regularly.',true)}
}
function resumeValidationWatchers(){
 try{
  for(let i=0;i<sessionStorage.length;i++){
   const key=sessionStorage.key(i);if(!key?.startsWith('sigma-validation-'))continue;
   const job=JSON.parse(sessionStorage.getItem(key));
   if(job?.uploadId===key.slice('sigma-validation-'.length))void watchValidation(job);
  }
 }catch{}
}
function cleanQueue(){
 // IMPORTANT: Missing tracks may be caused by a partial catalog response or a network outage.
 // Only a future explicit, authenticated deletion event may remove personal references.
 state.index=state.playingId?state.queue.indexOf(state.playingId):-1;
 if(state.index<0 && state.playingId)state.queue.unshift(state.playingId),state.index=0;
}
function missingTrack(id){return {id,title:'Unavailable song',artist:'Not currently in shared library',album:'',duration_s:0,unavailable:true};}

function viewTracks(){let all=state.tracks.slice();if(state.view==='liked')all=state.likes.slice().sort((a,b)=>a.position-b.position).map(l=>state.tracks.find(t=>t.id===l.track_id)||missingTrack(l.track_id));else if(state.view.startsWith('playlist:'))all=state.items.filter(i=>i.playlist_id===state.view.slice(9)).sort((a,b)=>a.position-b.position).map(i=>state.tracks.find(t=>t.id===i.track_id)||missingTrack(i.track_id));else if(state.view.startsWith('folder:')){const tree=SigmaDexExport.folderIndex(state.folderTree),id=state.view.slice(7);all=all.filter(t=>{let f=state.trackFolders[t.id]||'root';while(f){if(f===id)return true;f=tree.get(f)?.parent_id;}return false;});}if(state.sort==='title')all.sort((a,b)=>a.title.localeCompare(b.title));else if(state.sort==='artist')all.sort((a,b)=>a.artist.localeCompare(b.artist));else if(state.sort==='added'&&state.view==='all')all.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));if(state.search)all=all.filter(t=>(t.title+' '+t.artist+' '+(t.album||'')).toLowerCase().includes(state.search.toLowerCase()));return all;}
function current(){return state.tracks.find(t=>t.id===state.playingId)}
function liked(id){return state.likes.some(l=>l.track_id===id)}
function hashColor(s){let x=2166136261;for(let c of String(s))x=Math.imul(x^c.charCodeAt(0),16777619);return x>>>0}
function art(t){const k=hashColor(t.title+'|'+t.artist),a=k%360,b=(a+69)%360;const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="hsl(${a} 48% 72%)"/><stop offset="1" stop-color="hsl(${b} 49% 43%)"/></linearGradient></defs><rect width="160" height="160" fill="url(#a)"/><circle cx="112" cy="39" r="55" fill="#ffffff" opacity=".15"/><path d="M-10 130 Q 30 32 70 100 T 185 80 M-10 171 Q 40 67 93 134 T 180 116" fill="none" stroke="#fff" stroke-width="12" opacity=".44"/><circle cx="82" cy="77" r="37" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/></svg>`;return 'data:image/svg+xml,'+encodeURIComponent(svg)}
async function getJSON(url,options={}){
 const r=await fetch(url,{cache:'no-store',...options});let d;
 try{d=await r.json()}catch{throw Error('Invalid response from '+url)}
 if(!r.ok){const e=new Error(d.error||`${r.status} ${r.statusText}`);e.status=r.status;throw e}
 return d;
}
async function loadCatalog({silent=false}={}){
 if(!pageActive)return false;
 if(refreshFlight)return refreshFlight;
 const generation=lifecycleEpoch;
 const flight=(async()=>{try{
   const controller=new AbortController();catalogAbort=controller;
   const timeout=setTimeout(()=>controller.abort(),30000);
   let data;
   try{data=await getJSON('/api/catalog',{signal:controller.signal})}
   finally{clearTimeout(timeout);if(catalogAbort===controller)catalogAbort=null}
   if(!pageActive||generation!==lifecycleEpoch)return false;
   if(!Array.isArray(data.tracks))throw Error('Incomplete catalog response');
   state.tracks=data.tracks;cleanQueue();state.connected=true;state.catalogChecked=true;render();
   if(!silent)toast('Shared library updated');return true;
  }catch(e){if(pageActive&&generation===lifecycleEpoch){state.connected=false;state.catalogChecked=true;renderStatus();if(!silent)toast('Could not refresh music: '+e.message,true)}return false}
  finally{if(refreshFlight===flight)refreshFlight=null}
 })();refreshFlight=flight;return flight;
}
async function loadConfig({silent=false}={}){
 if(!pageActive)return false;
 if(configFlight)return configFlight;
 const generation=lifecycleEpoch;
 const flight=(async()=>{try{
  const result=await SigmaCore.retryTransient(async()=>{
   const ac=new AbortController();configAbort=ac;let timedOut=false;
   const timer=setTimeout(()=>{timedOut=true;ac.abort()},6500);
   try{return await getJSON('/api/config',{signal:ac.signal})}
   catch(e){if(timedOut)throw new SigmaCore.TimeoutError('Configuration timed out');throw e}
   finally{clearTimeout(timer);if(configAbort===ac)configAbort=null}
  },{attempts:3,baseDelay:250});
  if(!pageActive||generation!==lifecycleEpoch)return false;
  config=result;state.ready=!!result.ready;renderStatus();return state.ready;
 }catch(e){if(pageActive&&generation===lifecycleEpoch){state.ready=false;renderStatus();if(!silent)toast('Upload configuration unavailable; listening still works. Retry with Refresh.',true)}return false}
 finally{if(configFlight===flight)configFlight=null}
 })();configFlight=flight;return flight;
}
function ensurePolling(){
 if(!pageActive||refreshTimer!==null)return;
 refreshTimer=setInterval(()=>{if(pageActive&&!document.hidden)void loadCatalog({silent:true})},45000);
}
function stopRealtime(){
 connectGeneration++;clearTimeout(reconnectTimer);reconnectTimer=null;
 clearTimeout(refreshDelay);refreshDelay=null;
 clearInterval(heartbeat);heartbeat=null;
 clearInterval(refreshTimer);refreshTimer=null;
 const ws=realtimeSocket;realtimeSocket=null;
 if(ws){ws.onopen=null;ws.onmessage=null;ws.onclose=null;ws.onerror=null;try{ws.close()}catch{}}
}
function startRealtime(){
 ensurePolling();
 const r=config.realtime;if(!pageActive||!state.ready||!r?.url||!r?.anonKey||!window.WebSocket)return;
 if(realtimeSocket&&(realtimeSocket.readyState===0||realtimeSocket.readyState===1))return;
 const generation=++connectGeneration;let backoff=1800;
 function connect(){
  if(!pageActive||!state.ready||generation!==connectGeneration)return;
  clearTimeout(reconnectTimer);reconnectTimer=null;
  const host=r.url.replace(/^https:/,'wss:');let ws;
  try{ws=new WebSocket(`${host}/realtime/v1/websocket?apikey=${encodeURIComponent(r.anonKey)}&vsn=1.0.0`)}
  catch(e){reconnectTimer=setTimeout(connect,backoff);backoff=Math.min(30000,backoff*1.8);return}
  realtimeSocket=ws;let seq=0;
  const stillActive=()=>pageActive&&generation===connectGeneration&&realtimeSocket===ws;
  const send=(topic,event,payload={},ref)=>{if(stillActive()&&ws.readyState===1)ws.send(JSON.stringify({topic,event,payload,ref:ref||String(++seq),join_ref:topic==='phoenix'?null:'1'}))};
  ws.onopen=()=>{if(!stillActive()){ws.close();return}backoff=1800;send('realtime:sigma-themes','phx_join',{config:{private:false,postgres_changes:[{event:'*',schema:'public',table:'theme_tracks'}]}});clearInterval(heartbeat);heartbeat=setInterval(()=>send('phoenix','heartbeat',{}),20000);void loadCatalog({silent:true})};
  ws.onmessage=e=>{if(!stillActive())return;try{const m=JSON.parse(e.data);if(m.event==='postgres_changes'||m.event==='phx_reply'&&m.payload?.status==='ok')scheduleRefresh()}catch{}};
  ws.onclose=()=>{if(!stillActive())return;realtimeSocket=null;clearInterval(heartbeat);heartbeat=null;reconnectTimer=setTimeout(connect,backoff);backoff=Math.min(30000,backoff*1.8)};
  ws.onerror=()=>{try{ws.close()}catch{}};
 }
 connect();
}
async function refreshService({silent=false}={}){
 if(!pageActive)return false;
 // Listening must not depend on the upload configuration endpoint.
 const [configured,loaded]=await Promise.all([loadConfig({silent:true}),loadCatalog({silent:true})]);
 if(!pageActive)return false;
 ensurePolling();if(configured)startRealtime();
 render();
 if(!silent)toast(loaded?(configured?'Library and uploads refreshed':'Music available; upload configuration still offline'):'Could not connect to the music library',!loaded);
 return configured&&loaded;
}
function scheduleRefresh(){clearTimeout(refreshDelay);refreshDelay=setTimeout(()=>void loadCatalog({silent:true}),200)}
function releaseURL(){if(blobURL){URL.revokeObjectURL(blobURL);blobURL=null}}
function setQueue(ids,shuffle=false,first=null){pendingResume=null;const order=ids.filter(id=>state.tracks.some(t=>t.id===id)),head=first?[first]:[],remaining=order.filter(id=>id!==first);state.baseQueue=order;state.queue=[...head,...(shuffle?randomize(remaining):remaining)];state.index=0;state.playingId=state.queue[0]||null;state.shuffle=shuffle;persist();renderPlayer()}
function randomize(array){let arr=array.slice();for(let i=arr.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
async function playAt(index,{restore=false}={}){
 if(index<0||index>=state.queue.length)return;
 const id=state.queue[index],t=state.tracks.find(t=>t.id===id);
 if(!t){toast('Song is unavailable in the shared library; your queue entry was preserved.',true);return}
 const token=++playToken;
 audio.pause();audio.removeAttribute('src');releaseURL();
 if(!restore)pendingResume=null;
 state.index=index;state.playingId=id;persist();renderPlayer();
 try{
  audio.slot=Number(t.sseq_id);audio.crossOrigin='anonymous';audio.src='/api/audio?id='+encodeURIComponent(id);await audio.load();
  await enableAudio();if(token!==playToken)return;
  await audio.play();
 }catch(e){if(token===playToken)toast('Audio could not be played: '+e.message,true)}
 if(token===playToken)renderPlayer();
}
function stop(){++playToken;audio.pause();audio.removeAttribute('src');releaseURL();state.index=-1;state.playingId=null;persist();renderPlayer()}
async function enableAudio(){if(audio.isSigmaSseq){audio.setSoundMode(state.normalize,state.target);return;}try{if(!ctx){const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;ctx=new AudioCtx();const source=ctx.createMediaElementSource(audio);gain=ctx.createGain();source.connect(gain).connect(ctx.destination)}if(ctx.state==='suspended')await ctx.resume();applyGain();}catch(e){console.warn('Audio context:',e)}}
function gainDB(){const t=current();if(!state.normalize||!Number.isFinite(t?.lufs)||!Number.isFinite(t?.true_peak))return 0;return Math.max(-45,Math.min(0,Number(state.target)-t.lufs,-1-t.true_peak))}
function applyGain(){if(audio.isSigmaSseq){audio.setSoundMode(state.normalize,state.target);return;}if(gain&&ctx)gain.gain.setTargetAtTime(Math.pow(10,gainDB()/20),ctx.currentTime,.035)}
function advance(step=1){if(!state.queue.length)return;if(step<0&&audio.currentTime>3){audio.currentTime=0;return}const live=new Set(state.tracks.map(t=>t.id));const i=SigmaCore.nextPlayableIndex(state.queue,state.index,step,live,state.repeat);if(i<0){audio.pause();audio.currentTime=0;renderPlayer();persist();return}void playAt(i)}
function toggleShuffle(){const next=!state.shuffle;if(!state.queue.length){setQueue(viewTracks().map(x=>x.id),next);return}const prefix=state.queue.slice(0,Math.max(0,state.index)+1),rest=state.queue.slice(Math.max(0,state.index)+1);state.queue=[...prefix,...(next?randomize(rest):state.baseQueue.filter(id=>rest.includes(id)))];state.shuffle=next;persist();renderPlayer()}
function renderPlayer(){const t=current()||(state.playingId?missingTrack(state.playingId):null);$('#playingTitle').textContent=t?.title||'Nothing playing';$('#playingArtist').textContent=t?.artist||'sigma-themes';const img=art(t||{title:'sigma',artist:'themes'});if($('#playingCover').getAttribute('src')!==img)$('#playingCover').src=img;$('#playPause').textContent=audio.paused?'▶':'❚❚';$('#shuffleToggle').classList.toggle('active',state.shuffle);$('#repeatToggle').classList.toggle('active',state.repeat!=='off');$('#repeatToggle').textContent=state.repeat==='one'?'↻₁':'↻';$('#repeatToggle').title='Repeat '+state.repeat;$('#mute').textContent=state.muted||state.volume===0?'◖':'◖))';$('#volume').value=state.volume;$('#elapsed').textContent=fmt(audio.currentTime);$('#duration').textContent=fmt(Number.isFinite(audio.duration)?audio.duration:t?.duration_s||0);$('#seek').value=audio.duration?Math.round(audio.currentTime/audio.duration*1000):0;$('#normalizeToggle').checked=!!state.normalize;$('#normalizeLevel').value=String(state.target)}
function openView(view){state.view=view;state.search='';$('#search').value='';closeMenu();persist();render()}
function renderStatus(){const element=$('#connectionStatus');element.textContent=state.connected?'● Shared library':state.ready?(state.catalogChecked?'⚠ Catalog unavailable':'◐ Connecting'):'○ Setup required';element.classList.toggle('bad',!state.connected);const status=$('#accountStatus');if(status)status.textContent=state.connected?'Public library online':state.ready?(state.catalogChecked?'Catalog API failed — check Supabase migrations and Vercel logs':'Checking public library…'):'Upload configuration incomplete — check Vercel environment variables';const label=$('#accountLabel');if(label)label.textContent='No account required';}
function render(){const list=viewTracks();$('#allCount').textContent=state.tracks.length;$('#sortBy').value=state.sort;let title=state.view==='liked'?'Liked songs':state.view.startsWith('playlist:')?state.playlists.find(p=>p.id===state.view.slice(9))?.name||'Playlist':state.view.startsWith('folder:')?(SigmaDexExport.folderIndex(state.folderTree).get(state.view.slice(7))?.name||'Folder'):'All music';$('#sectionTitle').textContent=title;$('#sectionDetail').textContent=`${list.length} ${list.length===1?'song':'songs'} · ${state.connected?'Shared catalog':'Awaiting server setup'}`;$('#heroTitle').textContent=state.tracks.length?'Music for the worlds we build.':'Your soundtrack, together.';$('#heroDesc').textContent=state.ready?'Everyone can listen and contribute. Personal playlists and favorites are saved only in your browser.':'Connect Supabase and Turnstile from Vercel environment settings to publish this library. Listening and personal playlists need no account.';
 $('#playlistNav').innerHTML=state.playlists.map(p=>`<button data-view="playlist:${escapeHTML(p.id)}" class="${state.view==='playlist:'+p.id?'active':''}">♫ <span class="ellipsis">${escapeHTML(p.name)}</span><small>${state.items.filter(i=>i.playlist_id===p.id).length}</small></button>`).join('');
 const folderIndex=SigmaDexExport.folderIndex(state.folderTree);
 const folders=[...folderIndex.values()].sort((a,b)=>a.path.localeCompare(b.path));
 $('#folderNav').innerHTML=folders.map(f=>`<button data-view="folder:${escapeHTML(f.id)}" class="${state.view==='folder:'+f.id?'active':''}" title="${escapeHTML(f.path||'Music')}" style="padding-left:${8+Math.min(8,(f.path||'').split('/').length-1)*10}px">▸ <span class="ellipsis">${escapeHTML(f.name)}</span><small>${state.tracks.filter(t=>state.trackFolders[t.id]===f.id).length}</small></button>`).join('');$$('[data-view]',$('#nav')).forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
 const movable=state.view==='liked'||state.view.startsWith('playlist:');$('#trackList').innerHTML=list.length?'<div class="thead"><span>≡</span><span>Title</span><span>Artist</span><span>Length</span><span>Actions</span></div>'+list.map((t,i)=>`<article class="track ${t.unavailable?'unavailable':''} ${t.id===state.playingId?'current':''}" data-id="${escapeHTML(t.id)}"><button class="small-icon drag-handle" aria-label="Drag to reorder ${escapeHTML(t.title)}" title="Drag to reorder">⋮⋮</button><div class="songinfo" role="button" tabindex="0" ${t.unavailable?'':'data-play-id="'+escapeHTML(t.id)+'"'} title="${t.unavailable?'Unavailable':'Play '+escapeHTML(t.title)}"><img class="cover" alt="" loading="lazy" src="${art(t)}"><div style="min-width:0"><strong>${escapeHTML(t.title)}</strong><small>${escapeHTML(t.album||t.artist)}</small></div></div><div class="ellipsis artist-cell">${escapeHTML(t.artist)}</div><span>${fmt(t.duration_s)}</span><div class="track-controls"><button class="small-icon ${liked(t.id)?'on':''}" data-action="like" data-id="${escapeHTML(t.id)}" title="Favorite">${liked(t.id)?'♥':'♡'}</button><button class="small-icon" data-action="add" data-id="${escapeHTML(t.id)}" title="Add to playlist">＋</button>${movable?`<button class="small-icon" data-action="up" data-id="${escapeHTML(t.id)}" ${i===0?'disabled':''} title="Move up">↑</button><button class="small-icon" data-action="down" data-id="${escapeHTML(t.id)}" ${i===list.length-1?'disabled':''} title="Move down">↓</button>`:''}<button class="small-icon" data-action="more" data-id="${escapeHTML(t.id)}" title="More">•••</button></div></article>`).join(''):`<div class="empty"><div class="big">♫</div><h3>${state.search?'No matches':state.view!=='all'?'Nothing here yet':'No songs yet'}</h3><p>${state.search?'Try a different search.':state.view!=='all'?'Add a song to this collection.':'Anyone can upload the first song.'}</p></div>`;
 $('#playlistCards').innerHTML=state.view.startsWith('playlist:')?`<div class="section-tools" style="margin-top:14px"><button class="btn small" data-playlist-action="rename">Rename playlist</button><button class="btn small" data-playlist-action="delete">Delete playlist</button></div>`:state.view.startsWith('folder:')?`<div class="section-tools" style="margin-top:14px"><button class="btn small" data-folder-action="create">＋ Subfolder</button>${state.view!=='folder:root'?'<button class="btn small" data-folder-action="manage">Manage folder</button>':''}</div>`:'';renderPlayer();renderStatus()}
function closeMenu(){$('#sidebar').classList.remove('open');$('#scrim').classList.add('hide')}
function createPlaylist(){const name=prompt('Playlist name','New playlist');if(!name?.trim())return;const id=uuid();state.playlists.push({id,name:name.trim().slice(0,90),created_at:new Date().toISOString()});persist();openView('playlist:'+id)}
function renamePlaylist(id){const p=state.playlists.find(p=>p.id===id);if(!p)return;const name=prompt('Rename playlist',p.name);if(name?.trim()){p.name=name.trim().slice(0,90);persist();render()}}
function deletePlaylist(id){if(!confirm('Delete this personal playlist?'))return;state.playlists=state.playlists.filter(p=>p.id!==id);state.items=state.items.filter(i=>i.playlist_id!==id);persist();openView('all')}
function addPlaylistTrack(id,pid){if(state.items.some(i=>i.track_id===id&&i.playlist_id===pid))return toast('Already in this playlist');state.items.push({track_id:id,playlist_id:pid,position:1+Math.max(-1,...state.items.filter(i=>i.playlist_id===pid).map(x=>x.position))});persist();render();toast('Added to your playlist')}
function toggleLike(id){if(liked(id))state.likes=state.likes.filter(l=>l.track_id!==id);else state.likes.push({track_id:id,position:state.likes.length});persist();render()}
function reorder(id,diff){
 if(!(state.view==='liked'||state.view.startsWith('playlist:')))return toast('Reorder songs within favorites or a playlist');
 const entries=state.view==='liked'?state.likes:state.items.filter(i=>i.playlist_id===state.view.slice(9));
 const sorted=entries.slice().sort((a,b)=>a.position-b.position);
 const full=sorted.map(e=>e.track_id),visible=viewTracks().map(t=>t.id);
 let ordered;
 try{ordered=SigmaCore.reorderVisibleSlots(full,visible,id,diff)}catch(e){return toast(e.message,true)}
 if(ordered.every((key,i)=>key===full[i]))return;
 const byId=new Map(sorted.map(e=>[e.track_id,e]));
 ordered.forEach((key,i)=>{byId.get(key).position=i});
 // A user-requested move takes precedence over an unrelated title/artist sort.
 state.sort='manual';persist();render();
}
function newFolder(parent=state.view.startsWith('folder:')?state.view.slice(7):'root'){
 const name=prompt('Folder name','New folder');if(!name?.trim())return;
 try{const id=uuid();state.folderTree=SigmaDexExport.createFolder(state.folderTree,name,parent,id);persist();openView('folder:'+id)}
 catch(e){toast('Could not create folder: '+e.message,true)}
}
function manageFolder(id){
 const tree=SigmaDexExport.folderIndex(state.folderTree),folder=tree.get(id);if(!folder||id==='root')return;
 const ancestors=(a,b)=>{let f=b;while(f){if(f===a)return true;f=tree.get(f)?.parent_id}return false};
 const parents=[...tree.values()].filter(f=>!ancestors(id,f.id));
 modal(`<h2>Manage folder</h2><p class="hint">Folder organization stays in this browser and travels in your Sigma Dex ZIP exports.</p><div class="folder-editor"><label>Folder name</label><input id="folderEditName" maxlength="75" value="${escapeHTML(folder.name)}"><label>Parent folder</label><select id="folderEditParent">${parents.map(f=>`<option value="${escapeHTML(f.id)}" ${f.id===folder.parent_id?'selected':''}>${escapeHTML(f.path||'Music')}</option>`).join('')}</select><button id="saveFolderEdit" class="btn primary">Save folder</button> <button id="removeFolderEdit" class="btn">Delete folder</button></div>`);
 $('#saveFolderEdit').onclick=()=>{try{const name=SigmaDexExport.safeName($('#folderEditName').value),parent=$('#folderEditParent').value;const changed=state.folderTree.map(f=>f.id===id?{...f,name,parent_id:parent}:f);SigmaDexExport.folderIndex(changed);state.folderTree=changed;persist();closeModal();render();}catch(e){toast(e.message,true)}};
 $('#removeFolderEdit').onclick=()=>{if(!confirm('Delete this folder? Contents and subfolders will move to its parent.'))return;const parent=folder.parent_id;state.folderTree=state.folderTree.filter(f=>f.id!==id).map(f=>f.parent_id===id?{...f,parent_id:parent}:f);for(const t of Object.keys(state.trackFolders))if(state.trackFolders[t]===id)state.trackFolders[t]=parent;persist();closeModal();openView('folder:'+parent)};
}
function modal(content){closeModal();$('#modalRoot').innerHTML=`<div class="overlay" id="modal"><div class="dialog" role="dialog" aria-modal="true">${content}<div class="actions"><button class="btn" id="closeDialog">Close</button></div></div></div>`;$('#closeDialog').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()})}
function closeModal(){for(const url of archiveUrls)URL.revokeObjectURL(url);archiveUrls=[];$('#modalRoot').replaceChildren()}
function choosePlaylist(id){modal(`<h2>Add to playlist</h2><p class="hint">Playlists are private to your browser.</p>${state.playlists.map(p=>`<button class="btn" data-addto="${escapeHTML(p.id)}" data-track="${escapeHTML(id)}" style="display:flex;width:100%;margin-top:8px">♫ ${escapeHTML(p.name)}</button>`).join('')||'<p>No playlists yet.</p>'}<button class="btn" data-create-from="${escapeHTML(id)}" style="margin-top:12px">＋ New playlist</button>`)}
function songOptions(id){const t=state.tracks.find(t=>t.id===id);if(!t)return;
 const map=state.exportMetadata[id]||state.dsMappings[id]||{},folders=[...SigmaDexExport.folderIndex(state.folderTree).values()].sort((a,b)=>a.path.localeCompare(b.path));
 const dur=Number(t.duration_s)||0,loopStart=Number.isFinite(Number(map.loop_start_sec))?Number(map.loop_start_sec):0;
 const loopEnd=Number.isFinite(Number(map.loop_end_sec))?Number(map.loop_end_sec):dur;
 modal(`<h2>${escapeHTML(t.title)}</h2><p class="hint">${escapeHTML(t.artist)} · ${escapeHTML(t.original_filename||'')}</p>
 <button class="btn" data-action="add" data-id="${escapeHTML(id)}">＋ Add to playlist</button> <button class="btn" data-action="download" data-id="${escapeHTML(id)}">↓ Download SSEQ</button>
 <div class="folder-editor"><label>Export title</label><input id="editExportTitle" value="${escapeHTML(map.title||t.title)}" maxlength="220">
 <label>Composer / artist</label><input id="editExportArtist" value="${escapeHTML(map.artist||t.artist)}" maxlength="220">
 <label>Music folder</label><select id="editTrackFolder">${folders.map(f=>`<option value="${escapeHTML(f.id)}" ${(state.trackFolders[id]||'root')===f.id?'selected':''}>${escapeHTML(f.path||'Music')}</option>`).join('')}</select>
 <label>Optional music / event ID (0–65535)</label><input id="sseqInput" type="number" min="0" max="65535" value="${Number.isInteger(map.event_id??map.sseq_id)?(map.event_id??map.sseq_id):''}" placeholder="Optional">
 <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="loopInput" style="width:auto;min-height:auto" ${map.loop_enabled!==false?'checked':''}>Loop song</label>
 <label>Loop start (seconds)</label><input id="loopStartInput" type="number" min="0" step="0.01" value="${loopStart}">
 <label>Loop end (seconds)</label><input id="loopEndInput" type="number" min="0" step="0.01" value="${loopEnd}">
 <button class="btn" id="previewStoredSseq">▶ Preview stored SSEQ in player</button>
 <p class="hint">The SSEQ loop is encoded in the published sequence. Local loop-editor metadata does not rewrite stored SSEQ bytes; changing a SSEQ loop requires a new converted revision.</p>
 <button class="btn primary" id="saveMapping">Save song settings</button></div>`);
 const preview={pause(){}};$('#previewStoredSseq').onclick=()=>{closeModal();setQueue([id],false);void playAt(0)};
 $('#saveMapping').onclick=()=>{const title=$('#editExportTitle').value.trim(),artist=$('#editExportArtist').value.trim();
 const raw=$('#sseqInput').value,idValue=raw===''?null:Number(raw),enabled=$('#loopInput').checked;
 const start=Number($('#loopStartInput').value),end=Number($('#loopEndInput').value);
 if(!title||!artist)return toast('Title and composer are required',true);
 if(idValue!==null&&(!Number.isInteger(idValue)||idValue<0||idValue>65535))return toast('Invalid music ID',true);
 if(enabled&&(!Number.isFinite(start)||!Number.isFinite(end)||start<0||start>=end||end>dur+.05))return toast('Loop points must be between 0 and the song duration',true);
 const folder=$('#editTrackFolder').value;if(!SigmaDexExport.folderIndex(state.folderTree).has(folder))return toast('Unknown folder',true);
 state.trackFolders[id]=folder;
 state.exportMetadata[id]={title,artist,event_id:idValue,loop_enabled:enabled,loop_start_sec:start,loop_end_sec:end};
 state.dsMappings[id]={sseq_id:idValue,loop_enabled:enabled};persist();preview.pause();closeModal();render();toast('Export metadata saved locally');
 };
}
function showQueue(){modal(`<h2>Up next</h2><p class="hint">Drag or use arrow buttons to reorder your personal queue.</p><div id="queueList">${state.queue.map((id,i)=>{const t=state.tracks.find(x=>x.id===id);return `<div class="queue-item" data-queue-row="${i}" style="display:flex;gap:7px;align-items:center;margin:6px 0"><button class="small-icon queue-handle" title="Drag">⋮⋮</button><span style="flex:1">${i===state.index?'▶ ':''}${escapeHTML(t?.title||'Unavailable song')}</span><button class="btn small" data-queue-move="-1" data-queue-index="${i}">↑</button><button class="btn small" data-queue-move="1" data-queue-index="${i}">↓</button><button class="btn small" data-queue-play="${i}">▶</button></div>`}).join('')||'<p>No songs queued</p>'}</div>`)}
function moveQueue(i,j){if(j<0||j>=state.queue.length||i===j)return;let [id]=state.queue.splice(i,1);state.queue.splice(j,0,id);state.index=state.queue.indexOf(state.playingId);persist();showQueue()}
function download(blob,name){const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),90000)}
async function fetchTrack(t,signal){SigmaCore.aborted(signal);const res=await fetch('/api/audio?id='+encodeURIComponent(t.id),{cache:'no-store',signal});if(!res.ok)throw Error(`Audio unavailable (${res.status})`);const len=Number(res.headers.get('content-length'));if(len&&len!==t.size_bytes)throw Error('Unexpected file size');const blob=await res.blob();SigmaCore.aborted(signal);if(blob.size!==t.size_bytes)throw Error('Audio file size differs from catalog');const hash=await sha256(blob);if(hash!==t.sha256)throw Error('SHA-256 failed for '+t.title);SigmaCore.aborted(signal);return blob}
async function sha256(file){const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')}
async function audioMetadata(file){const name=file.name.replace(/\.[^.]+$/,''),p=name.split(/\s+[-–—]\s+/);let title=p.length>1?p.slice(1).join(' - '):name,artist=p.length>1?p[0]:'Unknown artist';const mediaFile=!/\.(sseq|mid|midi)$/i.test(file.name);const url=mediaFile?URL.createObjectURL(file):null;let duration=0;try{if(mediaFile)duration=await new Promise(resolve=>{const a=new Audio(),timer=setTimeout(()=>resolve(0),6000);a.onloadedmetadata=()=>{clearTimeout(timer);resolve(Number.isFinite(a.duration)?a.duration:0)};a.onerror=()=>{clearTimeout(timer);resolve(0)};a.src=url})}finally{if(url)URL.revokeObjectURL(url)}let tags={};try{tags=await window.SigmaMetadata?.read(file)||{}}catch(e){console.warn('Embedded tags unavailable',e)}
 return {title:String(tags.title||title).slice(0,220),artist:String(tags.artist||artist).slice(0,220),album:String(tags.album||'').slice(0,220),duration}}
/** Optional asynchronous LUFS measurement. Bounded to avoid decoding huge tracks on mobile.
 * Measurements originate with the contributor (untrusted); player never amplifies based on them. */
async function loudnessMetrics(file,seconds=0,op=null){
 if(!window.Worker || !(window.AudioContext||window.webkitAudioContext) || file.size>24*1024*1024 || seconds>360)return null;
 let decoder=null,worker=null;
 try{
  setProgress('Analyzing loudness in background',1);
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  decoder=new AudioCtx();
  const raw=await decoder.decodeAudioData(await file.arrayBuffer());op?.check();
  if(raw.numberOfChannels<1||raw.numberOfChannels>2||raw.duration>360)return null;
  const channels=Array.from({length:raw.numberOfChannels},(_,i)=>new Float32Array(raw.getChannelData(i)));
  op?.check();worker=new Worker('loudness_worker.js');
  const metrics=await new Promise((resolve,reject)=>{
   const onAbort=()=>{clearTimeout(timer);reject(new SigmaCore.CancelledError())};
   op?.signal.addEventListener('abort',onAbort,{once:true});
   const timer=setTimeout(()=>reject(Error('Loudness analysis timed out')),45000);
   worker.onmessage=e=>{op?.signal.removeEventListener('abort',onAbort);clearTimeout(timer);e.data?.error?reject(Error(e.data.error)):resolve(e.data?.metrics)};
   worker.onerror=e=>{op?.signal.removeEventListener('abort',onAbort);clearTimeout(timer);reject(Error(e.message||'Loudness worker failed'))};
   worker.postMessage({id:'track',channels,fs:raw.sampleRate},channels.map(c=>c.buffer));
  });
  return metrics&&Number.isFinite(metrics.lufs)&&Number.isFinite(metrics.truePeak)?metrics:null;
 }catch(e){if(op?.canceled)throw new SigmaCore.CancelledError();console.warn('Loudness analysis unavailable:',e);return null}
 finally{worker?.terminate();if(decoder)void decoder.close().catch(()=>{})}
}
function matchesMagic(bytes,ext){if(bytes.length<12)return false;const ascii=(a,b)=>String.fromCharCode(...bytes.slice(a,b));if(ext==='sseq')return ascii(0,4)==='SSEQ'&&ascii(16,20)==='DATA';if(ext==='wav')return ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE';if(ext==='flac')return ascii(0,4)==='fLaC';if(ext==='ogg'||ext==='opus')return ascii(0,4)==='OggS';if(ext==='m4a')return ascii(4,8)==='ftyp';if(ext==='aac')return bytes[0]===255&&(bytes[1]&246)===240;if(ext==='mp3')return ascii(0,3)==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224);return false}
const extMime={sseq:'application/octet-stream'};
function setProgress(text,percent,metrics={}){
 state.activeProgress={text,percent};const root=$('#uploadProgress');if(!root)return;
 root.classList.remove('hide');$('#uploadProgressText').textContent=text;
 $('#uploadProgressFill').style.width=Math.min(100,Math.max(0,Number(percent)||0))+'%';
 window.dispatchEvent(new CustomEvent('sigma:upload-progress',{detail:{text,percent,metrics}}));
}
function clearProgress(){state.activeProgress=null;$('#uploadProgress')?.classList.add('hide');window.dispatchEvent(new Event('sigma:upload-finished'))}
function xhr(method,url,headers,body,onProgress,op){
 return new Promise((resolve,reject)=>{
  op.check();let settled=false;
  const request=new XMLHttpRequest();activeUpload=request;op.setXHR(request);
  const complete=(error,value)=>{if(settled)return;settled=true;op.signal.removeEventListener('abort',onAbort);op.clearXHR(request);
    if(activeUpload===request)activeUpload=null;error?reject(error):resolve(value)};
  const onAbort=()=>{try{request.abort()}catch{}complete(new SigmaCore.CancelledError())};
  op.signal.addEventListener('abort',onAbort,{once:true});
  try{
   request.open(method,url);Object.entries(headers||{}).forEach(([k,v])=>request.setRequestHeader(k,v));
   request.timeout=90000;
   request.upload.onprogress=e=>{if(!op.canceled&&e.lengthComputable)onProgress?.(e.loaded,e.total)};
   request.onload=()=>{if(op.canceled)return complete(new SigmaCore.CancelledError());if(request.status>=200&&request.status<300)return complete(null,request);
     // Storage PUT is cross-origin and is NOT logged as an API error by Vercel.
     // Show the public Storage error code/message, not signed URLs or tokens.
     let details='';
     try{const info=JSON.parse(request.responseText||'{}');
       details=String(info.message||info.error||info.code||'').slice(0,180)}catch{}
     const e=new Error(`${method} request failed (${request.status})${details?': '+details:''}`);
     e.status=request.status;e.storageError=details;complete(e)};
   request.onerror=()=>{const e=new Error('Network interrupted');e.code='NETWORK_ERROR';complete(op.canceled?new SigmaCore.CancelledError():e)};
   request.ontimeout=()=>complete(new SigmaCore.TimeoutError('Transfer timed out'));
   request.onabort=()=>complete(new SigmaCore.CancelledError());
   request.send(body);
  }catch(e){complete(e)}
 });
}
const temporarySessions=new Map();
function sessionGet(key){try{return sessionStorage.getItem(key)||temporarySessions.get(key)||null}catch{return temporarySessions.get(key)||null}}
function sessionSet(key,value){temporarySessions.set(key,value);try{sessionStorage.setItem(key,value)}catch{}}
function sessionRemove(key){temporarySessions.delete(key);try{sessionStorage.removeItem(key)}catch{}}
function sessionKey(hash,uploadId){return SigmaCore.tusSessionKey(hash,uploadId)}
async function tusTransfer(file,receipt,hash,op){
 const key=sessionKey(hash,receipt.uploadId);
 let location=sessionGet(key)||null;
 const endpoint=receipt.tusEndpoint;
 if(location){try{location=SigmaCore.validateTusURL(location,endpoint)}catch(e){sessionRemove(key);location=null}}
 const headers={'Tus-Resumable':'1.0.0','x-signature':receipt.token};
 const meta={bucketName:receipt.bucket,objectName:receipt.storagePath,contentType:extMime[receipt.extension],cacheControl:'3600'};
 const metadata=Object.entries(meta).map(([k,v])=>k+' '+btoa(String(v))).join(',');
 if(!location){
  setProgress('Starting resumable transfer',1);
  const r=await SigmaCore.retryTransient(()=>xhr('POST',endpoint,{...headers,'Upload-Length':String(file.size),'Upload-Metadata':metadata,'x-upsert':'false'},null,null,op),{signal:op.signal,attempts:3});
  op.check();const path=r.getResponseHeader('Location');if(!path)throw Error('TUS server did not return a resume URL');
  location=SigmaCore.validateTusURL(path,endpoint);sessionSet(key,location);
 }
 const chunkSize=6*1024*1024;let consecutiveErrors=0;
 while(true){
  op.check();
  const head=await SigmaCore.retryTransient(()=>xhr('HEAD',location,headers,null,null,op),{signal:op.signal,attempts:4});
  const rawOffset=head.getResponseHeader('Upload-Offset');
  if(rawOffset===null)throw Error('TUS server returned no upload offset');
  const offset=Number(rawOffset);
  if(!Number.isSafeInteger(offset)||offset<0||offset>file.size)throw Error('Invalid resumable offset');
  if(offset===file.size)break;
  const part=file.slice(offset,Math.min(offset+chunkSize,file.size));
  // If a PATCH fails transiently, obtain the server offset again before resending.
  try{await xhr('PATCH',location,{...headers,'Upload-Offset':String(offset),'Content-Type':'application/offset+octet-stream'},part,
    n=>setProgress('Uploading in chunks',90*(offset+n)/file.size,{fraction:(offset+n)/file.size}),op);consecutiveErrors=0}
  catch(e){if(!['network','timeout','server'].includes(SigmaCore.classify(e))||++consecutiveErrors>6)throw e;
    await SigmaCore.delay(Math.min(8000,900*consecutiveErrors),op.signal);continue}
 }
 op.check();sessionRemove(key);
}
async function regularTransfer(file,receipt,op){
 // Never blindly retry a PUT. If the first request reached Storage but its
 // acknowledgement was lost, retrying the SAME no-upsert path gets HTTP 400.
 // The caller checks the authoritative server-side object first.
 return xhr('PUT',receipt.signedUrl,{'Content-Type':extMime[receipt.extension],'x-upsert':'false'},file,
  (n,total)=>setProgress('Uploading SSEQ',90*n/total,{fraction:total?n/total:null}),op);
}
function isStorageDuplicate(e){
 return (e?.status===400||e?.status===409)&&/already exists|resourcealreadyexists|keyalreadyexists/i.test(String(e?.storageError||e?.message));
}
let turnstileInFlight=false;
async function getTurnstileToken(op){
 if(turnstileInFlight)throw Error('Bot verification already in progress');turnstileInFlight=true;
 $('#turnstilePanel').classList.remove('hide');
 try{return await SigmaCore.turnstileToken({turnstile:window.turnstile,element:$('#turnstileSlot'),siteKey:config.turnstileSiteKey,
   signal:op.signal,timeoutMs:45000,retries:1});}
 finally{turnstileInFlight=false;$('#turnstileSlot').replaceChildren();$('#turnstilePanel').classList.add('hide')}
}
const validationWatchers=new Map();
async function watchValidation(job){
 if(!job?.uploadId||!job?.receipt||validationWatchers.has(job.uploadId))return;
 const task=(async()=>{
  for(let i=0;i<42;i++){
   if(i)await new Promise(resolve=>setTimeout(resolve,15000));
   if(!pageActive)return;
   let response;
   try{response=await getJSON('/api/upload-status',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({uploadId:job.uploadId,receipt:job.receipt})});}
   catch(e){if(i===41)toast('Validation status is unavailable. Refresh the library later.',true);continue}
   if(!pageActive)return;
   if(response.status==='published'){
     sessionRemove('sigma-validation-'+job.uploadId);
     toast('Verified and published: '+job.title);
     void loadCatalog({silent:true});return;
   }
   if(response.status==='failed'||response.status==='expired'){
     sessionRemove('sigma-validation-'+job.uploadId);
     toast('Server rejected the SSEQ: '+job.title+'. Check the file format and try again.',true);return;
   }
  }
  if(pageActive)toast('Audio verification is still queued. It will appear when the server validates it.');
 })();
 validationWatchers.set(job.uploadId,task);
 try{await task}finally{validationWatchers.delete(job.uploadId)}
}
async function cancelRemote(reservation){
 if(!reservation?.uploadId||!reservation?.receipt)return;
 try{await getJSON('/api/upload-cancel',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({uploadId:reservation.uploadId,receipt:reservation.receipt})});}
 catch(e){console.warn('Server cleanup will retry when reservation expires:',e)}
}
function cancelUpload(){
 const op=uploadOp||exportOp;if(!op || op.canceled)return;
 op.cancel();
 const hash=op.hash;if(hash){sessionRemove('sigma-upload-'+hash);if(op.reservation?.uploadId)sessionRemove(sessionKey(hash,op.reservation.uploadId))}
 setProgress('Upload canceled by user',0);
 if(op.reservation){const reservation=op.reservation;op.reservation=null;void cancelRemote(reservation)}
}
async function uploadFiles(files){
 if(state.busy)return;if(!state.ready)return toast('Upload server is not configured',true);
 const arr=[...files];if(!arr.length)return;
 state.busy=true;$('#uploadBtn').disabled=true;
 const op=SigmaCore.operation();uploadOp=op;let done=0,errors=[];
 try{for(const sourceFile of arr){
  let file=sourceFile;
  if(op.canceled)break;
  window.dispatchEvent(new CustomEvent('sigma:upload-source',{detail:{bytes:sourceFile.size,extension:String(sourceFile.name.split('.').pop()||'').toLowerCase()}}));
  let hash=null;
  try{
   const slot=Number($('#hgSlot').value),program=Number($('#hgProgram').value);
   setProgress('Converting '+sourceFile.name+' into HeartGold SSEQ',1);
   const converted=await window.SigmaTranscribe.convertFile(sourceFile,{
     slot,program,loop:$('#hgLoop').checked,profiles:window.SigmaBankProfiles,signal:op.signal,
     onProgress:(label,part)=>setProgress(label,3+Math.round(45*part),{fraction:label==='Transcribing melody and timing'?Math.min(1,Math.max(0,(part-.15)/.74)):null})
   });
   op.check();
   file=new File([converted.bytes],sourceFile.name.replace(/\.[^.]+$/,'')+'.sseq',{type:'application/octet-stream'});
   if(file.size<30||file.size>config.maxUploadBytes)throw Error('SSEQ exceeds the 64 KiB sequence budget');
   const ext='sseq';
   const bytes=new Uint8Array(await file.slice(0,32).arrayBuffer());op.check();
   if(!matchesMagic(bytes,ext))throw Error('SSEQ header does not match extension');
   setProgress('Calculating SHA-256',1);hash=await sha256(file);op.hash=hash;op.check();
   if(state.tracks.some(t=>t.sha256===hash)){toast(file.name+': already uploaded');continue}
   const metadata=await audioMetadata(sourceFile);op.check();
   metadata.slot=slot;metadata.duration=converted.parsed.durationTicks*60/(converted.parsed.tempo*48);
   metadata.title=metadata.title||sourceFile.name.replace(/\.[^.]+$/,'');
   let reservation, resumedReservation=false;
   const persisted=sessionGet('sigma-upload-'+hash);
   if(persisted){
    try{
     const candidate=JSON.parse(persisted);
     if(Date.now()-Number(candidate.created)<100*60*1000 &&
       /^[0-9a-f-]{36}$/i.test(candidate.uploadId||'') && /^[0-9a-f]{64}$/i.test(candidate.receipt||'')){
      const status=await getJSON('/api/upload-status',{method:'POST',signal:op.signal,headers:{'Content-Type':'application/json'},
       body:JSON.stringify({uploadId:candidate.uploadId,receipt:candidate.receipt})});
      op.check();
      if(status.status==='pending'){reservation=candidate;resumedReservation=true;}
      else if(status.status==='validating'||status.status==='processing'){
       sessionRemove('sigma-upload-'+hash);toast(file.name+': awaiting server validation');continue;
      }
     }
    }catch(e){
     op.check();
     // Network faults are not proof that a reservation is invalid.
     if(['network','timeout','server'].includes(SigmaCore.classify(e)))throw e;
    }
    if(!reservation)sessionRemove('sigma-upload-'+hash);
   }
   if(!reservation){
    setProgress('Waiting for bot verification',1);const token=await getTurnstileToken(op);op.check();
    setProgress('Requesting upload permission',2);
    reservation=await getJSON('/api/upload-start',{method:'POST',signal:op.signal,headers:{'Content-Type':'application/json'},
      body:JSON.stringify({size:file.size,name:file.name,sha256:hash,turnstileToken:token})});
    op.check();reservation.created=Date.now();sessionSet('sigma-upload-'+hash,JSON.stringify(reservation));
   }
   op.reservation=reservation;op.check();
   const finishUpload=()=>getJSON('/api/upload-finish',{method:'POST',signal:op.signal,headers:{'Content-Type':'application/json'},
     body:JSON.stringify({uploadId:reservation.uploadId,receipt:reservation.receipt,metadata})});
   const finishIfStored=async()=>{
     setProgress('Checking saved SSEQ before retry',93);
     try{return await finishUpload()}
     catch(e){
       // Only a real 404 from Storage means there is no object. A 403, a
       // database failure, a checksum mismatch or invalid SSEQ is NOT missing.
       if(e.status===404&&e.message==='Uploaded file is missing')return null;
       throw e;
     }
   };
   let completion=null;
   if(resumedReservation)completion=await finishIfStored();
   if(!completion){
     try{await regularTransfer(file,reservation,op)}
     catch(e){
       // HTTP 400 conflict or lost PUT acknowledgement can mean Storage
       // already has the exact bytes. Finish performs full size/hash/SSEQ
       // checks before accepting them. Never use x-upsert:true to "fix" it.
       const uncertain=['network','timeout','server'].includes(SigmaCore.classify(e));
       if(!isStorageDuplicate(e)&&!uncertain)throw e;
       completion=await finishIfStored();
       if(!completion){
         if(!uncertain)throw e;
         // Server definitively reported 404. One bounded retry is safe.
         await regularTransfer(file,reservation,op).catch(async retryError=>{
           if(!isStorageDuplicate(retryError))throw retryError;
           completion=await finishIfStored();
           if(!completion)throw retryError;
         });
       }
     }
     if(!completion){op.check();setProgress('Validating SSEQ and HeartGold slot on server',94);completion=await finishUpload();}
   }
   op.check();sessionRemove('sigma-upload-'+hash);if(op.reservation?.uploadId)sessionRemove(sessionKey(hash,op.reservation.uploadId));
   op.reservation=null;op.hash=null;done++;setProgress('Awaiting trusted SSEQ validation',100);
   const pendingJob={uploadId:reservation.uploadId,receipt:reservation.receipt,title:metadata.title};
   sessionSet('sigma-validation-'+reservation.uploadId,JSON.stringify(pendingJob));
   void watchValidation(pendingJob);
   toast('Converted '+metadata.title+' to '+file.size+' SSEQ bytes; awaiting server event/bank validation.'+(converted.programSubstitutions?.length?' Lead program automatically changed to bank-compatible program '+converted.programSubstitutions[0].selected+'.':''));
  }catch(e){
   if(op.canceled || SigmaCore.classify(e)==='cancelled'){
    if(hash){sessionRemove('sigma-upload-'+hash);if(op.reservation?.uploadId)sessionRemove(sessionKey(hash,op.reservation.uploadId))}
    if(op.reservation){void cancelRemote(op.reservation);op.reservation=null}
    break;
   }
   console.error(e);errors.push(file.name+': '+e.message);toast('Upload failed: '+e.message,true);
  }
 }}finally{
  if(uploadOp===op)uploadOp=null;
  state.busy=false;$('#uploadBtn').disabled=false;$('#fileInput').value='';
  $('#turnstileSlot').replaceChildren();$('#turnstilePanel').classList.add('hide');clearProgress();
  if(op.canceled)toast('Upload canceled. No further files will be sent.');
  else if(errors.length)modal(`<h2>Upload errors</h2><p class="hint">${done} songs published. Re-select failed files to retry.</p><p>${errors.map(escapeHTML).join('<p>')}</p>`);
 }
}
function openSigmaExportPicker(){
 if(state.busy)return toast('Another operation is in progress',true);
 if(!state.tracks.length)return toast('Shared library is empty',true);
 const folders=[...SigmaDexExport.folderIndex(state.folderTree).values()].sort((a,b)=>a.path.localeCompare(b.path));
 modal(`<div class="sigma-export-dialog"><h2>Export to Sigma Dex</h2><p class="hint">One ZIP with converted audio, folders, loop settings and verified metadata. Ready for a future compatible Sigma Dex importer.</p>
 <label class="sigma-export-row"><input type="radio" name="sigmaScope" value="all" checked> Whole library (${state.tracks.length} songs)</label>
 <label class="sigma-export-row"><input type="radio" name="sigmaScope" value="selected"> Choose folders and songs</label>
 <div id="sigmaExportSelection" class="hide"><div class="sigma-export-head">Folders (including subfolders)</div><div class="sigma-export-tree">${folders.map(f=>`<label><input type="checkbox" data-sigma-folder value="${escapeHTML(f.id)}"> ${escapeHTML(f.path||'Music')}</label>`).join('')}</div>
 <div class="sigma-export-head">Individual songs</div><div class="sigma-export-tree">${state.tracks.map(t=>`<label><input type="checkbox" data-sigma-track value="${escapeHTML(t.id)}">${escapeHTML(t.title)} · ${escapeHTML(t.artist)}</label>`).join('')}</div></div>
 <div class="message" id="sigmaExportEstimate"></div><button class="btn primary" id="beginSigmaExport">↓ Prepare Sigma Dex ZIP</button></div>`);
 const scope=()=>$('input[name="sigmaScope"]:checked').value;
 const selection=()=>{try{return SigmaDexExport.selectedTrackPlan({tracks:state.tracks,folders:state.folderTree,assignments:state.trackFolders,metadata:state.exportMetadata,scope:scope(),selectedIds:$$('[data-sigma-track]:checked').map(x=>x.value),selectedFolderIds:$$('[data-sigma-folder]:checked').map(x=>x.value)});}catch(e){return {error:e.message,tracks:[],folders:[]}}};
 const update=()=>{$('#sigmaExportSelection').classList.toggle('hide',scope()!=='selected');const p=selection();if(p.error){$('#sigmaExportEstimate').textContent='Check settings: '+p.error;$('#beginSigmaExport').disabled=true;return}const bytes=p.tracks.reduce((n,t)=>n+Number(t.source_bytes||0),0);
 $('#sigmaExportEstimate').textContent=`${p.tracks.length} songs · ${Math.max(0,p.folders.length-1)} folders · ${bytes.toLocaleString()} SSEQ bytes (before ZIP overhead). ${p.tracks.filter(t=>t.loop_enabled).length} looping.`;$('#beginSigmaExport').disabled=!p.tracks.length;};
 $$('input[name="sigmaScope"], [data-sigma-folder], [data-sigma-track]').forEach(x=>x.addEventListener('change',update));update();
 $('#beginSigmaExport').onclick=()=>{const p=selection();if(p.error||!p.tracks.length)return toast(p.error||'Choose music',true);const ids=p.tracks.map(t=>t.id);if(new Set(p.tracks.map(t=>t.event_id).filter(x=>x!==null)).size!==p.tracks.filter(t=>t.event_id!==null).length)return toast('Music/event IDs must be unique across exported songs',true);closeModal();void exportSigmaDex(p)};
}
async function exportSigmaDex(plan){
 if(state.busy)return;const op=SigmaCore.operation();exportOp=op;state.busy=true;const btn=$('#sigmaExportBtn');btn.disabled=true;
 const encoded=new Map();
 try{
  for(let i=0;i<plan.tracks.length;i++){
   op.check();const t=plan.tracks[i];setProgress(`Sigma Dex ${i+1}/${plan.tracks.length}: fetching SSEQ ${t.title}`,100*i/plan.tracks.length);
   const input=await fetchTrack(t.source,op.signal);op.check();
   const data=new Uint8Array(await input.arrayBuffer());
   window.SigmaSSEQ.parse(data,{slot:Number(t.source.sseq_id),profiles:window.SigmaBankProfiles});
   if(t.source.sha256 && await sha256(input)!==t.source.sha256)throw Error('Source SSEQ SHA-256 mismatch: '+t.title);
   encoded.set(t.id,input);
  }
  setProgress('Verifying complete Sigma Dex ZIP',96);
  const data=await SigmaDexExport.packageFiles(plan,encoded,{signal:op.signal,onProgress:(i,n)=>setProgress(`Verifying ${i}/${n}`,96+3*i/n)});
  op.check();const name='sigma-dex-music-export-'+new Date().toISOString().slice(0,10)+'.zip';
  presentArchives([{name,blob:data.blob}],`Verified Sigma Dex music package · ${data.tracks.length} songs`);
 }catch(e){toast((op.canceled?'Export canceled: ':'Sigma Dex export FAILED: ')+e.message,true)}
 finally{encoded.clear();exportOp=null;state.busy=false;btn.disabled=false;clearProgress()}
}
function openExportPicker(kind){
 if(state.busy)return toast('Another operation is in progress',true);
 const all=state.tracks; if(!all.length)return toast('No songs available to export',true);
 const filtered=viewTracks().filter(t=>!t.unavailable),scopeName=state.view.startsWith('playlist:')?'Current playlist':state.view==='liked'?'Favorites / current view':'Current view';
 modal(`<h2>Music backup</h2><p class="hint">Choose exactly which songs to export. This creates verified SSEQ ZIP archives in parts where necessary.</p>
 <label><input type="radio" name="exportScope" value="all" checked> All available songs (${all.length})</label>
 <label><input type="radio" name="exportScope" value="view"> ${escapeHTML(scopeName)} (${filtered.length})</label>
 <label><input type="radio" name="exportScope" value="selected"> Select songs individually</label>
 <div id="exportSelection" class="export-selection hide">${all.map(t=>`<label><input type="checkbox" value="${escapeHTML(t.id)}" data-export-select> ${escapeHTML(t.title)} — ${escapeHTML(t.artist)}</label>`).join('')}</div>
 <button class="btn primary" id="beginExport">Prepare ZIP backup</button>`);
 const toggle=()=>$('#exportSelection').classList.toggle('hide',$('input[name="exportScope"]:checked').value!=='selected');
 $$('input[name="exportScope"]').forEach(e=>e.onchange=toggle);
 $('#beginExport').onclick=()=>{
  const scope=$('input[name="exportScope"]:checked').value;
  const picked=$$('[data-export-select]:checked').map(e=>e.value);
  const tracks=SigmaCore.chooseTracks(all,scope,picked,filtered.map(t=>t.id));
  if(!tracks.length)return toast('Choose at least one song.',true);
  closeModal();
  void backup(tracks);
 };
}
function presentArchives(files,heading){
 const urls=files.map(f=>({...f,url:URL.createObjectURL(f.blob)}));
 modal(`<h2>${escapeHTML(heading)}</h2><p class="hint">Files were verified. Click each part to save it. Browser download permissions may require separate clicks.</p>
 ${urls.map((f,i)=>`<p style="margin:9px 0"><a class="btn" href="${f.url}" download="${escapeHTML(f.name)}">↓ Part ${i+1}/${urls.length} · ${(f.blob.size/1048576).toFixed(1)} MiB</a></p>`).join('')}`);
 archiveUrls=urls.map(f=>f.url);
 // URLs remain available while download modal is open; closing it releases archive memory.
 window.addEventListener('pagehide',()=>urls.forEach(f=>URL.revokeObjectURL(f.url)),{once:true});
}
async function backup(tracks=state.tracks.slice()){
 if(state.busy)return;state.busy=true;const op=SigmaCore.operation();exportOp=op;
 const btn=$('#backupBtn');btn.disabled=true;
 try{
  const parts=SigmaCore.partition(tracks,100*1024*1024),outputs=[];
  for(let k=0;k<parts.length;k++){
   op.check();const subset=parts[k],files=[],manifest={format:'sigma-themes/library-backup-v2',created_at:new Date().toISOString(),
    scope:tracks.length===state.tracks.length?'all':'selection',part:k+1,total_parts:parts.length,tracks:[],
    playlists:state.playlists,items:state.items,likes:state.likes,dsMappings:state.dsMappings,folderTree:state.folderTree,trackFolders:state.trackFolders,exportMetadata:state.exportMetadata};
   for(let i=0;i<subset.length;i++){
    const t=subset[i];op.check();setProgress(`Part ${k+1}/${parts.length}: verifying ${i+1}/${subset.length}`,100*i/Math.max(1,subset.length));
    const audioBlob=await fetchTrack(t,op.signal);
    const name=SigmaCore.sseqBackupPath(t.id);
    window.SigmaSSEQ.parse(new Uint8Array(await audioBlob.arrayBuffer()),{slot:Number(t.sseq_id),profiles:window.SigmaBankProfiles,maxBytes:65536});
    files.push({name,blob:audioBlob});manifest.tracks.push({...t,backup_path:name});
   }
   files.unshift({name:'sigma-library.json',blob:new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'})});
   const zip=await SigmaDS.zip(files,(i,n)=>{op.check();setProgress('Packaging backup',100*i/n)});
   op.check();await SigmaDS.verifyZip(zip);op.check();
   outputs.push({name:`sigma-themes-backup-${new Date().toISOString().slice(0,10)}-part${k+1}of${parts.length}.zip`,blob:zip});
  }
  op.check();presentArchives(outputs,`Verified backup · ${tracks.length} tracks · ${outputs.length} parts`);
 }catch(e){toast((op.canceled?'Backup canceled: ':'Backup FAILED: ')+e.message,true)}
 finally{exportOp=null;state.busy=false;btn.disabled=false;btn.innerHTML='↓ <span>Export</span>';clearProgress()}
}
async function importBackup(file){if(state.busy||!file)return;state.busy=true;try{await SigmaDS.verifyZip(file);const files=await SigmaDS.unzip(file),blob=files.get('sigma-library.json');if(!blob)throw Error('Not a sigma-themes backup');const m=JSON.parse(await blob.text());if(!['sigma-themes/library-backup-v2','sigma-themes/library-backup-v1'].includes(m.format))throw Error('Unsupported backup');if(!Array.isArray(m.tracks)||!Array.isArray(m.playlists)||!Array.isArray(m.items))throw Error('Invalid structure');const invalid=m.tracks.filter(t=>!files.has(t.backup_path));if(invalid.length)throw Error(`${invalid.length} audio files are missing; backup is incomplete`);for(let i=0;i<m.tracks.length;i++){
    const song=m.tracks[i],content=files.get(song.backup_path);
    setProgress(`Verifying backup file ${i+1}/${m.tracks.length}`,100*(i+1)/Math.max(1,m.tracks.length));
    if(Number.isFinite(Number(song.size_bytes))&&content.size!==Number(song.size_bytes))throw Error('Corrupt backup file size: '+song.backup_path);
    if(/^[a-f0-9]{64}$/.test(song.sha256||'')&&(await sha256(content))!==song.sha256)throw Error('Corrupt backup checksum: '+song.backup_path);
   }
   if(!confirm(`Restore ${m.playlists.length} personal playlists and ${m.likes?.length||0} favorites? Songs absent from this public library cannot be restored without re-uploading them.`))return;
 const live=new Set(state.tracks.map(t=>t.id));state.playlists=m.playlists.filter(p=>typeof p.id==='string'&&typeof p.name==='string').slice(0,200);state.items=m.items.filter(i=>state.playlists.some(p=>p.id===i.playlist_id));state.likes=(m.likes||[]).filter(l=>typeof l.track_id==='string');state.dsMappings=m.dsMappings||{};try{SigmaDexExport.folderIndex(m.folderTree||[]);state.folderTree=m.folderTree||[];state.trackFolders=m.trackFolders||{};state.exportMetadata=m.exportMetadata||{}}catch{toast('Backup folder data invalid; kept existing folders',true)}persist();render();toast('Personal playlists and favorites restored. Unavailable song references were preserved.');}
 catch(e){toast('Import failed: '+e.message,true)}finally{state.busy=false;$('#backupInput').value=''}}
function startDrag(e){const h=e.target.closest('.drag-handle');if(!h||e.button!==0||!(state.view==='liked'||state.view.startsWith('playlist:')))return;const row=h.closest('.track');drag={id:row.dataset.id,startY:e.clientY,startX:e.clientX,row,from:row.getBoundingClientRect(),target:null,active:false};h.setPointerCapture(e.pointerId);e.preventDefault()}
function dragMove(e){const d=drag;if(!d)return;if(!d.active&&Math.hypot(e.clientY-d.startY,e.clientX-d.startX)<6)return;if(!d.active){d.active=true;d.row.classList.add('dragging')};$$('.drop-before,.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.track');if(target&&target!==d.row){d.target=target.dataset.id;target.classList.add(e.clientY<target.getBoundingClientRect().top+target.clientHeight/2?'drop-before':'drop-after')};const container=$('#content'),rect=container.getBoundingClientRect();if(e.clientY>rect.bottom-60)container.scrollTop+=13;else if(e.clientY<rect.top+60)container.scrollTop-=13}
function dragEnd(){const d=drag;drag=null;if(!d)return;d.row.classList.remove('dragging');$$('.drop-before,.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));if(!d.active||!d.target)return;const ids=viewTracks().map(t=>t.id),from=ids.indexOf(d.id),to=ids.indexOf(d.target);if(from!==to)reorder(d.id,to-from)}
function queueDragStart(e){const handle=e.target.closest('.queue-handle');if(!handle||e.button!==0)return;const row=handle.closest('[data-queue-row]');queueDrag={from:Number(row.dataset.queueRow),startY:e.clientY,target:null};handle.setPointerCapture(e.pointerId);e.preventDefault()}
function queueDragMove(e){if(!queueDrag)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-queue-row]');if(target)queueDrag.target=Number(target.dataset.queueRow)}
function queueDragEnd(){if(!queueDrag)return;const d=queueDrag;queueDrag=null;if(d.target!==null)moveQueue(d.from,d.target)}
// Keep game-bank IDs internal. A public user chooses a destination slot when uploading,
// while program compatibility is selected automatically by the SSEQ converter.
function openUploadMusicDialog(){
 if(state.busy)return toast('Another operation is in progress',true);
 modal(`<h2>Upload music</h2><p class="hint">Choose the in-game destination for your music. MP3, WAV and other supported sources are converted to validated SSEQ before upload. No source audio is stored.</p>
  <label for="uploadTargetSlot">Game music slot</label>
  <select id="uploadTargetSlot" aria-label="Game music slot"></select>
  <label class="compact-check" style="display:flex;gap:9px;margin:14px 0;align-items:center"><input id="uploadRepeat" type="checkbox"> Loop sequence</label>
  <button id="chooseMusicFiles" type="button" class="btn primary">＋ Choose music files</button>`);
 const internalSlot=$('#hgSlot');
 const chosen=$('#uploadTargetSlot');
 chosen.replaceChildren(...Array.from(internalSlot.options,option=>option.cloneNode(true)));
 chosen.value=internalSlot.value;
 $('#uploadRepeat').checked=$('#hgLoop').checked;
 $('#chooseMusicFiles').onclick=()=>{
  internalSlot.value=chosen.value;
  internalSlot.dispatchEvent(new Event('change'));
  $('#hgLoop').checked=$('#uploadRepeat').checked;
  closeModal();
  $('#fileInput').click();
 };
}
// HeartGold slot/program options derived from the user's local SBNK and bankkart.json.
function setupHeartGoldTargets(){
 const select=$('#hgSlot'),p=$('#hgProgram');if(!select||!p||!window.SigmaBankProfiles)throw Error('HeartGold bank profile unavailable');
 const profiles=window.SigmaBankProfiles;
 const slots=Object.entries(profiles.sequence_slots).filter(([id,v])=>profiles.banks[String(v.bank)]).sort((a,b)=>Number(a[0])-Number(b[0]));
 select.replaceChildren(...slots.map(([id,s])=>{const option=document.createElement('option');option.value=id;option.textContent=`${id} · ${s.name} (bank ${s.bank})`;return option}));
 select.value=profiles.sequence_slots['1028']?'1028':slots[0]?.[0];
 const update=()=>{const info=window.SigmaSSEQ.profileSlot(profiles,Number(select.value)),old=p.value;
  p.replaceChildren(...info.bank.programs.map(pg=>{const option=document.createElement('option');option.value=pg.index;option.textContent=`Program ${pg.index} · SBNK type ${pg.kind}`;return option}));
  p.value=info.bank.programs.some(pg=>String(pg.index)===old)?old:String(info.bank.programs[0]?.index??0);
 };
 select.addEventListener('change',update);update();
}
setupHeartGoldTargets();
// Browser events.
$('#menuBtn').onclick=()=>{$('#sidebar').classList.toggle('open');$('#scrim').classList.toggle('hide')};$('#scrim').onclick=closeMenu;
$('#refreshBtn').onclick=()=>void refreshService();$('#newPlaylist').onclick=createPlaylist;$('#newFolder').onclick=()=>newFolder();$('#sigmaExportBtn').onclick=openSigmaExportPicker;
$('#uploadBtn').onclick=()=>state.ready?openUploadMusicDialog():toast('Configure Vercel and Supabase to enable uploads',true);$('#cancelUpload').onclick=cancelUpload;
$('#fileInput').onchange=e=>void uploadFiles(e.target.files);$('#backupBtn').onclick=()=>openExportPicker('backup');$('#restoreBtn').onclick=()=>$('#backupInput').click();$('#backupInput').onchange=e=>void importBackup(e.target.files[0]);
$('#heroPlay').onclick=()=>{const ids=viewTracks().map(t=>t.id);if(!ids.length)return toast('No songs in this collection');setQueue(ids,false);void playAt(0)};
$('#heroShuffle').onclick=()=>{const ids=viewTracks().map(t=>t.id);if(!ids.length)return toast('No songs in this collection');setQueue(ids,true);void playAt(0)};
$('#playPause').onclick=()=>{if(!state.queue.length){const ids=viewTracks().map(t=>t.id);if(!ids.length)return toast('Upload a song first');setQueue(ids,false);void playAt(0)}else if(audio.paused){if(audio.src){void enableAudio().then(()=>audio.play().catch(e=>toast(e.message,true)))}else void playAt(state.index<0?0:state.index)}else audio.pause()};
$('#prev').onclick=()=>advance(-1);$('#next').onclick=()=>advance(1);$('#shuffleToggle').onclick=toggleShuffle;$('#repeatToggle').onclick=()=>{state.repeat=state.repeat==='off'?'all':state.repeat==='all'?'one':'off';persist();renderPlayer()};$('#queueBtn').onclick=showQueue;
$('#volume').oninput=e=>{state.volume=Number(e.target.value);audio.volume=state.volume;state.muted=false;audio.muted=false;persist();renderPlayer()};$('#mute').onclick=()=>{state.muted=!state.muted;audio.muted=state.muted;persist();renderPlayer()};$('#seek').oninput=e=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*Number(e.target.value)/1000};
$('#normalizeToggle').onchange=e=>{state.normalize=e.target.checked;void enableAudio();applyGain();persist()};$('#normalizeLevel').onchange=e=>{state.target=Number(e.target.value);applyGain();persist()};$('#search').oninput=e=>{state.search=e.target.value;render()};$('#sortBy').onchange=e=>{state.sort=e.target.value;persist();render()};
$('#nav').onclick=e=>{const b=e.target.closest('[data-view]');if(b)openView(b.dataset.view)};$('#playlistNav').onclick=e=>{const b=e.target.closest('[data-view]');if(b)openView(b.dataset.view)};$('#folderNav').onclick=e=>{const b=e.target.closest('[data-view]');if(b)openView(b.dataset.view)};
$('#playlistCards').onclick=e=>{const folder=e.target.closest('[data-folder-action]');if(folder){if(folder.dataset.folderAction==='create')newFolder(state.view.slice(7));else manageFolder(state.view.slice(7));return}const b=e.target.closest('[data-playlist-action]');if(!b)return;let id=state.view.slice(9);if(b.dataset.playlistAction==='rename')renamePlaylist(id);if(b.dataset.playlistAction==='delete')deletePlaylist(id)};
$('#trackList').onclick=e=>{const play=e.target.closest('[data-play-id]'),action=e.target.closest('[data-action]');if(play){setQueue(viewTracks().map(t=>t.id),false,play.dataset.playId);void playAt(0);return}if(!action)return;const id=action.dataset.id;switch(action.dataset.action){case 'like':toggleLike(id);break;case 'add':choosePlaylist(id);break;case 'more':songOptions(id);break;case 'up':reorder(id,-1);break;case 'down':reorder(id,1);break;}};
$('#trackList').onkeydown=e=>{const b=e.target.closest('[data-play-id]');if(b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();b.click()}if(e.target.classList.contains('drag-handle')&&e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();reorder(e.target.closest('.track').dataset.id,e.key==='ArrowUp'?-1:1)}};
$('#trackList').addEventListener('pointerdown',startDrag);window.addEventListener('pointermove',dragMove);window.addEventListener('pointerup',dragEnd);window.addEventListener('pointercancel',dragEnd);
$('#modalRoot').addEventListener('pointerdown',queueDragStart);window.addEventListener('pointermove',queueDragMove);window.addEventListener('pointerup',queueDragEnd);window.addEventListener('pointercancel',()=>{queueDrag=null});
$('#modalRoot').onclick=e=>{const add=e.target.closest('[data-addto]'),newPl=e.target.closest('[data-create-from]'),move=e.target.closest('[data-queue-move]'),play=e.target.closest('[data-queue-play]'),action=e.target.closest('[data-action]');if(add){addPlaylistTrack(add.dataset.track,add.dataset.addto);closeModal()}else if(newPl){const id=newPl.dataset.createFrom;closeModal();createPlaylist();if(state.view.startsWith('playlist:'))addPlaylistTrack(id,state.view.slice(9))}else if(move)moveQueue(Number(move.dataset.queueIndex),Number(move.dataset.queueIndex)+Number(move.dataset.queueMove));else if(play){closeModal();void playAt(Number(play.dataset.queuePlay))}else if(action){if(action.dataset.action==='add'){closeModal();choosePlaylist(action.dataset.id)}else if(action.dataset.action==='download'){const t=state.tracks.find(t=>t.id===action.dataset.id);if(t){closeModal();void fetchTrack(t).then(b=>download(b,((t.original_filename||t.title+'.sseq').replace(/\.[^.]+$/,'')+'.sseq'))).catch(e=>toast(e.message,true))}}}};
audio.onplay=renderPlayer;audio.onpause=renderPlayer;audio.onended=()=>{if(state.repeat==='one'){audio.currentTime=0;void audio.play()}else advance(1)};audio.onloadedmetadata=()=>{if(pendingResume){const id=current()?.id;const seconds=SigmaCore.validResume(pendingResume,id,audio.duration);if(seconds!==null && audio.currentSrc.includes(encodeURIComponent(id))){audio.currentTime=seconds;pendingResume=null;}else if(id&&pendingResume.trackId!==id){pendingResume=null}}renderPlayer()};audio.ontimeupdate=()=>{renderPlayer();const n=Math.floor(audio.currentTime/5);if(n!==historyTick){historyTick=n;persist()}};audio.onerror=()=>{if(audio.src)toast('SSEQ missing or not supported. Try next song.',true)};
window.addEventListener('pagehide',()=>{
 persist();pageActive=false;lifecycleEpoch++;state.ready=false;
 catalogAbort?.abort();configAbort?.abort();audio.pause();stopRealtime();refreshFlight=null;configFlight=null;
});
window.addEventListener('pageshow',e=>{
 if(pageActive)return; // initial pageshow is already handled by init()
 pageActive=true;resumeValidationWatchers();
 // BFCache does not restart scripts: reconnect exactly once, without autoplay.
 void refreshService({silent:true});
});
window.addEventListener('online',()=>{if(pageActive)void refreshService({silent:true})});
document.addEventListener('visibilitychange',()=>{if(pageActive&&!document.hidden)void loadCatalog({silent:true})});
async function init(){
 loadPersonal();audio.volume=state.volume;audio.muted=state.muted;audio.setSoundMode(state.normalize,state.target);render();resumeValidationWatchers();
 await refreshService({silent:true});
 if(!pageActive)return;
 if(pendingResume&&current()){
  const id=pendingResume.trackId;
  audio.slot=Number(current()?.sseq_id);audio.crossOrigin='anonymous';audio.src='/api/audio?id='+encodeURIComponent(id);
  audio.preload='metadata';void audio.load().catch(()=>{});
 }
}
void init();
window.SigmaDebug={state,viewTracks,art,exportSigmaDex,openSigmaExportPicker,backup,loadCatalog,loadConfig,refreshService,sha256,uploadFiles,cancelUpload,openExportPicker,reorder,stopRealtime};
})();
