/* Pure browser-side operational helpers. No accounts and no network calls at import time. */
(function(root){
  'use strict';
  class CancelledError extends Error {constructor(){super('Avbrutt av brukeren');this.name='CancelledError';this.code='USER_CANCELLED';}}
  class TimeoutError extends Error {constructor(message='Operation timed out'){super(message);this.name='TimeoutError';this.code='TIMEOUT';}}
  function aborted(signal){if(signal?.aborted)throw new CancelledError();}
  function operation(){
    const controller=new AbortController();let xhr=null;
    return {signal:controller.signal, get canceled(){return controller.signal.aborted},
      setXHR(r){aborted(controller.signal);xhr=r},clearXHR(r){if(xhr===r)xhr=null},
      cancel(){if(controller.signal.aborted)return;controller.abort();try{xhr?.abort()}catch{}},
      check(){aborted(controller.signal)} };
  }
  function classify(error){
    if(error?.code==='USER_CANCELLED'||error?.name==='AbortError'||error?.name==='CancelledError')return 'cancelled';
    if(error?.code==='TIMEOUT'||error?.name==='TimeoutError')return 'timeout';
    if(error?.code==='NETWORK_ERROR'||error instanceof TypeError||error?.status===0)return 'network';
    const s=Number(error?.status);
    if(s===408||s===425||s===429||s>=500&&s<=599)return 'server';
    return 'permanent';
  }
  function delay(ms,signal){aborted(signal);return new Promise((resolve,reject)=>{
    const onAbort=()=>{clearTimeout(timer);reject(new CancelledError())};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve()},ms);
    signal?.addEventListener('abort',onAbort,{once:true});
  });}
  async function retryTransient(fn,{signal,attempts=3,baseDelay=300}={}){
    let last;for(let i=0;i<attempts;i++){
      aborted(signal);
      try{return await fn(i)}catch(e){last=e;if(!['timeout','network','server'].includes(classify(e))||i===attempts-1)throw e;
        await delay(Math.min(8000,baseDelay*Math.pow(2,i)),signal);
      }
    }throw last;
  }
  function sessionSnapshot(s,time,now=Date.now()){
    const trackId=typeof s.playingId==='string'&&s.playingId?s.playingId:null;
    return {trackId,seconds:trackId&&Number.isFinite(time)&&time>=0?time:0,
      savedAt:now,context:String(s.view||'all'),queue:Array.isArray(s.queue)?s.queue.slice(0,5000):[]};
  }
  function validResume(snapshot,trackId,duration){
    if(!snapshot || snapshot.trackId!==trackId || !Number.isFinite(snapshot.seconds)||snapshot.seconds<0)return null;
    if(!Number.isFinite(duration)||duration<=0)return null;
    return Math.min(snapshot.seconds,Math.max(0,duration-0.35));
  }
  function nextPlayableIndex(queue,index,step,available,repeat='off'){
    if(!queue.length)return -1;
    let pos=index;
    for(let attempt=0;attempt<queue.length;attempt++){
      pos+=step;
      if(pos<0||pos>=queue.length){
        if(repeat!=='all')return -1;
        pos=(pos+queue.length)%queue.length;
      }
      if(available.has(queue[pos]))return pos;
    }
    return -1;
  }
  function chooseTracks(tracks,scope,selected=[],viewIds=[]){
    const ids=new Set(scope==='selected'?selected:scope==='view'?viewIds:tracks.map(t=>t.id));
    return tracks.filter(t=>ids.has(t.id));
  }
  function assertDistinctMappings(tracks,mappings){
    const seen=new Set();for(const t of tracks){const id=mappings[t.id]?.sseq_id;
      if(id===null||id===undefined||id==='')continue;
      if(!Number.isInteger(id)||id<0||id>65535||seen.has(id))throw Error(`Invalid or duplicate HeartGold sequence ID: ${id}`);
      seen.add(id);
    }return true;
  }
  function partition(tracks,maxBytes=120*1024*1024){
    const parts=[];let current=[],size=0;
    for(const t of tracks){const bytes=Number(t.size_bytes)||0;
      if(bytes>maxBytes)throw Error(`Single file exceeds archive limit: ${t.title||t.id}`);
      if(size+bytes>maxBytes&&current.length){parts.push(current);current=[];size=0}
      current.push(t);size+=bytes;
    }
    if(current.length||!parts.length)parts.push(current);
    return parts;
  }
  function normalizePersonalState(raw){
    const v=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const str=x=>typeof x==='string'&&x.length>0&&x.length<256;
    const uniq=(values,getKey)=>{const found=new Set();return values.filter(x=>{const key=getKey(x);if(found.has(key))return false;found.add(key);return true})};
    const playlists=uniq((Array.isArray(v.playlists)?v.playlists:[]).filter(x=>x&&str(x.id)&&str(x.name)).slice(0,300),x=>x.id);
    const items=uniq((Array.isArray(v.items)?v.items:[]).filter(x=>x&&str(x.track_id)&&str(x.playlist_id)).slice(0,10000),x=>x.playlist_id+'|'+x.track_id).map((x,i)=>({...x,position:Number.isFinite(Number(x.position))?Number(x.position):i}));
    const likes=uniq((Array.isArray(v.likes)?v.likes:[]).filter(x=>x&&str(x.track_id)).slice(0,10000),x=>x.track_id).map((x,i)=>({...x,position:Number.isFinite(Number(x.position))?Number(x.position):i}));
    const queue=(Array.isArray(v.queue)?v.queue:[]).filter(str).slice(0,10000);
    const baseQueue=(Array.isArray(v.baseQueue)?v.baseQueue:[]).filter(str).slice(0,10000);
    const volume=Number(v.volume);
    return {...v,playlists,items,likes,queue,baseQueue,
      volume:Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):.8,
      view:typeof v.view==='string'&&(v.view==='all'||v.view==='liked'||v.view.startsWith('playlist:'))?v.view:'all',
      playingId:str(v.playingId)?v.playingId:null,
      dsMappings:v.dsMappings&&typeof v.dsMappings==='object'&&!Array.isArray(v.dsMappings)?v.dsMappings:{},
      index:Number.isInteger(v.index)?v.index:-1,
      repeat:['off','one','all'].includes(v.repeat)?v.repeat:'off',
      target:[-19,-14,-11].includes(Number(v.target))?Number(v.target):-14,
      sort:['added','artist','title','manual'].includes(v.sort)?v.sort:'added',
      normalize:v.normalize!==false,shuffle:v.shuffle===true,muted:v.muted===true};
  }
  /** Never submit a stored TUS URL to a different host or unrelated path. */
  function validateTusURL(location,endpoint){
    const base=new URL(endpoint),candidate=new URL(location,base);
    if(base.protocol!=='https:'||candidate.protocol!=='https:'||candidate.origin!==base.origin||
       !(candidate.pathname===base.pathname||candidate.pathname.startsWith(base.pathname.replace(/\/$/,'')+'/')))
      throw Error('Untrusted TUS resume destination');
    return candidate.href;
  }
  function tusSessionKey(hash,uploadId){
    if(!/^[a-f0-9]{64}$/i.test(String(hash||'')) || !/^[a-z0-9-]{8,80}$/i.test(String(uploadId||'')))throw Error('Invalid TUS reservation identity');
    return 'sigma-tus-'+hash+'-'+uploadId;
  }
  /** Swap two visible IDs in the complete order, leaving hidden IDs at exactly their original slots.
      Distinct immutable track IDs are required; titles are never used as ordering keys. */
  function reorderVisibleSlots(fullIds, visibleIds, movedId, delta){
    const ids=fullIds.slice(),visible=new Set(visibleIds);
    if(ids.length!==new Set(ids).size)throw Error('Duplicate track ID in personal list');
    const slots=ids.map((id,i)=>visible.has(id)?i:-1).filter(i=>i>=0);
    const source=slots.findIndex(i=>ids[i]===movedId),target=source+delta;
    if(source<0||target<0||target>=slots.length)return ids;
    [ids[slots[source]],ids[slots[target]]]=[ids[slots[target]],ids[slots[source]]];
    return ids;
  }
  /** Partition DS output audio before metadata is appended to every independent ZIP part. */
  function partitionDS(files,maxBytes=100*1024*1024){
    if(!Number.isFinite(maxBytes)||maxBytes<=0)throw Error('Invalid archive part size');
    const parts=[];let group=[],size=0;
    for(const file of files){
      const length=Number(file.blob?.size);
      if(!Number.isFinite(length)||length<0)throw Error('Invalid DS output size');
      if(length>maxBytes)throw Error('Single DS audio file exceeds part size');
      if(size+length>maxBytes&&group.length){parts.push(group);group=[];size=0}
      group.push(file);size+=length;
    }
    if(group.length)parts.push(group);
    return parts;
  }
  function dsPartManifest(master,partFiles,part,total){
    const names=new Set(partFiles.map(f=>f.name));
    const selected=master.tracks.filter(t=>names.has(t.file));
    if(selected.length!==partFiles.length || new Set(selected.map(x=>x.file)).size!==selected.length)throw Error('DS manifest/audio mismatch');
    return {...master,tracks:selected,part,total_parts:total,part_track_count:selected.length,
      complete_export_track_count:master.tracks.length,
      complete_export_id:master.export_id};
  }
  // Cloudflare passes a diagnostic error code to error-callback. It must never
  // be discarded: domain/sitekey faults cannot be repaired by resetting a widget.
  function turnstileIssue(rawCode,hostname=''){
    const raw=String(rawCode??'');
    const code=/^\d{5,8}$/.test(raw)?raw:'unknown';
    const suffix=code==='unknown'?'':` (Cloudflare ${code})`;
    const host=/^[a-z0-9.-]{1,253}$/i.test(hostname)?hostname:'this website';
    if(code==='110200'||code==='400021')return {code,permanent:true,
      message:`Cloudflare Turnstile has not authorized ${host}${suffix}. The website owner must add this exact domain to the Turnstile widget's allowed hostnames.`};
    if(['110100','110110','400020','400070'].includes(code))return {code,permanent:true,
      message:`Cloudflare Turnstile sitekey is invalid, missing or disabled${suffix}. The website owner must check TURNSTILE_SITE_KEY in Vercel and the widget in Cloudflare.`};
    if(code==='200100')return {code,permanent:true,
      message:`Cloudflare verification encountered a clock/cache problem${suffix}. Check device clock and reload the website without cache.`};
    if(code==='200500')return {code,permanent:false,
      message:`Cloudflare verification iframe could not load${suffix}. Check ad blockers, browser privacy extensions, network filtering and challenges.cloudflare.com.`};
    if(code==='110600'||code==='110620')return {code,permanent:false,
      message:`Cloudflare verification timed out${suffix}. Complete the challenge and retry.`};
    if(code.startsWith('300')||code.startsWith('600'))return {code,permanent:false,
      message:`Cloudflare challenge failed${suffix}. Try again in a normal browser without VPN or blocking extensions.`};
    return {code,permanent:false,
      message:`Cloudflare bot verification failed${suffix}. Check browser console for the Turnstile error code.`};
  }
  function turnstileToken({turnstile,element,siteKey,action='music_upload',signal,timeoutMs=45000,retries=1}){
    aborted(signal);
    if(!siteKey||typeof siteKey!=='string')return Promise.reject(Error('Cloudflare Turnstile sitekey is missing from /api/config. Check TURNSTILE_SITE_KEY in Vercel.'));
    if(!turnstile?.render||!turnstile?.remove) return Promise.reject(Error('Bot-beskyttelsen kunne ikke lastes. Kontroller at challenges.cloudflare.com ikke blokkeres.'));
    return new Promise((resolve,reject)=>{
      let widgetId=null,settled=false,timer=null,tries=0,retryTimer=null;
      const clean=()=>{clearTimeout(timer);clearTimeout(retryTimer);signal?.removeEventListener('abort',onAbort);
        if(widgetId!==null){try{turnstile.remove(widgetId)}catch{}}};
      const finish=(error,token)=>{if(settled)return;settled=true;clean();error?reject(error):resolve(token)};
      const onAbort=()=>finish(new CancelledError());
      signal?.addEventListener('abort',onAbort,{once:true});
      const onProblem=(message)=>{
        if(settled)return true;
        if(tries++<retries&&typeof turnstile.reset==='function'){
          retryTimer=setTimeout(()=>{if(!settled&&!signal?.aborted)try{turnstile.reset(widgetId)}catch{finish(Error(message))}},600);
        }else finish(Error(message));
        return true;
      };
      timer=setTimeout(()=>finish(new TimeoutError('Bot-verifisering tok for lang tid. Prøv igjen.')),timeoutMs);
      try{widgetId=turnstile.render(element,{sitekey:siteKey,action,
        callback:token=>{if(typeof token!=='string'||!token)finish(Error('Ugyldig verifisering'));else finish(null,token)},
        'error-callback':(errorCode)=>{
          const issue=turnstileIssue(errorCode,String(root.location?.hostname||''));
          console.warn('Cloudflare Turnstile widget error:',issue.code);
          if(issue.permanent)finish(Error(issue.message));else onProblem(issue.message);
          return true;
        },
        'expired-callback':()=>onProblem('Bot-verifisering utløp. Prøv igjen.'),
        'timeout-callback':()=>onProblem('Bot-verifisering utløp. Prøv igjen.'),
        retry:'never','refresh-expired':'manual'});
        if(settled){try{turnstile.remove(widgetId)}catch{}}
      }catch(e){finish(e)}
    });
  }

  /** Backups contain approved SSEQ bytes, independent of source recording filename.
      Escape the stable track identifier so it cannot introduce directory separators. */
  function sseqBackupPath(trackId){
    if(typeof trackId!=='string'||!trackId||trackId.length>160)throw Error('Invalid backup track ID');
    return 'audio/'+encodeURIComponent(trackId)+'.sseq';
  }
  root.SigmaCore={CancelledError,TimeoutError,aborted,operation,classify,delay,retryTransient,sessionSnapshot,validResume,nextPlayableIndex,chooseTracks,assertDistinctMappings,partition,normalizePersonalState,validateTusURL,tusSessionKey,reorderVisibleSlots,partitionDS,dsPartManifest,turnstileIssue,turnstileToken,sseqBackupPath};
})(globalThis);
