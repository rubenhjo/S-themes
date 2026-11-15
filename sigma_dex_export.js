/* Sigma-dex import contract v1 — pure folder/planning and self-checking export helpers.
   Only sigma-themes is modified. No assumptions about the future Sigma-dex receiver. */
((root) => {
  'use strict';
  const FORMAT='sigma-themes/sigma-dex-sseq-pack',VERSION=2,RATE=0;
  const MAX_FOLDER_DEPTH=12,MAX_TRACKS=1500;
  const validId=s=>typeof s==='string'&&s.length>=1&&s.length<=160&&!/[\u0000-\u001f]/.test(s);
  const safeName=(s)=>{
    if(typeof s!=='string'||!s.trim())throw Error('Missing folder or track name');
    if(/(^|[\\/])\.{1,2}([\\/]|$)/.test(s.trim()))throw Error('Unsafe name');
    const n=s.normalize('NFC').trim().replace(/[\\/<>:"|?*\u0000-\u001f]/g,'_').replace(/\s+/g,' ').replace(/[. ]+$/,'');
    if(!n||n==='.'||n==='..')throw Error('Unsafe name');
    return n.slice(0,75);
  };
  const safeTrackId=id=>{
    if(!validId(id))throw Error('Invalid track ID');
    const bytes=new TextEncoder().encode(id);
    return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
  };
  function folderIndex(folders){
    if(!Array.isArray(folders)||folders.length>1500)throw Error('Invalid folder tree');
    const map=new Map([['root',{id:'root',name:'Music',parent_id:null,path:''}]]);
    for(const f of folders){
      if(!f||!validId(f.id)||f.id==='root'||map.has(f.id))throw Error('Duplicate or invalid folder ID');
      map.set(f.id,{id:f.id,name:safeName(f.name),parent_id:f.parent_id||'root'});
    }
    const seen=new Set(),resolve=(id,chain=new Set())=>{
      const x=map.get(id);if(!x)throw Error('Folder parent missing');
      if(x.path!==undefined)return x.path;
      if(chain.has(id)||chain.size>=MAX_FOLDER_DEPTH)throw Error('Folder cycle or hierarchy too deep');
      chain.add(id); const parent=map.get(x.parent_id); if(!parent)throw Error('Folder parent missing');
      const path=resolve(parent.id,chain);chain.delete(id);
      x.path=path?path+'/'+x.name:x.name;
      return x.path;
    };
    for(const [id,f] of map)resolve(id);
    const twins=new Set();
    for(const f of map.values())if(f.id!=='root'){
      const key=f.parent_id+'|'+f.name.toLowerCase();if(twins.has(key))throw Error('Duplicate folder names among siblings');twins.add(key);
    }
    return map;
  }
  function createFolder(folders,name,parent='root',id){
    const proposed={id:id||globalThis.crypto?.randomUUID?.()||('folder-'+Date.now()),name:safeName(name),parent_id:parent};
    const next=[...folders,proposed];folderIndex(next);return next;
  }
  function moveFolder(folders,id,parent){
    if(id==='root')throw Error('Cannot move root folder');
    const next=folders.map(f=>f.id===id?{...f,parent_id:parent}:f);
    if(!next.some(f=>f.id===id))throw Error('Unknown folder');folderIndex(next);return next;
  }
  function selectedTrackPlan({tracks,folders=[],assignments={},metadata={},scope='all',selectedIds=[],selectedFolderIds=[]}){
    if(!Array.isArray(tracks)||tracks.length>MAX_TRACKS)throw Error('Too many tracks');
    const index=folderIndex(folders);const ids=new Set();
    const all=tracks.map(t=>{if(!t||!validId(t.id)||ids.has(t.id))throw Error('Duplicate or invalid track ID');ids.add(t.id);return t});
    const requestedIds=new Set(selectedIds||[]),requestedFolders=new Set(selectedFolderIds||[]);
    if(!['all','selected'].includes(scope))throw Error('Invalid selection mode');
    if(scope==='selected'){
      for(const id of requestedIds)if(!ids.has(id))throw Error('Unknown selected track ID: '+id);
      for(const id of requestedFolders)if(!index.has(id))throw Error('Unknown selected folder ID: '+id);
    }
    const includesFolder=(folderId)=>{
      let cursor=folderId;
      while(cursor){if(requestedFolders.has(cursor))return true;cursor=index.get(cursor)?.parent_id}
      return false;
    };
    const result=[],fileNames=new Set(),musicIds=new Set();
    for(const t of all){
      const folder_id=assignments[t.id]||'root';
      if(!index.has(folder_id))throw Error('Track references deleted folder');
      if(scope==='selected'&&!requestedIds.has(t.id)&&!includesFolder(folder_id))continue;
      const extra=metadata[t.id]||{};
      const title=String(extra.title||t.title||'').trim(),artist=String(extra.artist||t.artist||'').trim();
      if(!title||!artist)throw Error('Incomplete track metadata for '+t.id);
      const duration=Number(t.duration_s);
      if(!Number.isFinite(duration)||duration<=0||duration>720)throw Error('Invalid track duration for '+t.id);
      const loop=extra.loop_enabled!==false;
      const start=loop?Number(extra.loop_start_sec??0):null;
      const end=loop?Number(extra.loop_end_sec??duration):null;
      if(loop&&(!Number.isFinite(start)||!Number.isFinite(end)||start<0||start>=end||end>duration+.05))throw Error('Invalid loop points for '+title);
      const event=extra.event_id===undefined||extra.event_id===null||extra.event_id===''?null:Number(extra.event_id);
      if(event!==null&&(!Number.isInteger(event)||event<0||event>65535))throw Error('Invalid music/event ID');
      if(event!==null&&musicIds.has(event))throw Error('Duplicate music/event ID');
      if(event!==null)musicIds.add(event);
      const folder=index.get(folder_id);
      const basename=safeName(title).replace(/\s/g,'_')+'-'+safeTrackId(t.id)+'.sseq';
      const file='music/'+(folder.path?folder.path+'/':'')+basename;
      if(fileNames.has(file))throw Error('Export filename collision');fileNames.add(file);
      result.push({id:t.id,title,artist,original_filename:t.original_filename||'unknown',folder_id,folder_path:folder.path,file,duration_s:duration,loop_enabled:loop,loop_start_sec:start,loop_end_sec:end,event_id:event,source_sha256:t.sha256||null,source_bytes:Number(t.size_bytes)||null,source:t});
    }
    const included=new Set(['root']);
    for(const t of result){let k=t.folder_id;while(k&&!included.has(k)){included.add(k);k=index.get(k)?.parent_id}}
    if(scope==='all')for(const f of index.values())included.add(f.id);
    else for(const fId of requestedFolders){let k=fId;while(k&&!included.has(k)){included.add(k);k=index.get(k)?.parent_id}}
    const resultFolders=[...index.values()].filter(f=>included.has(f.id)).map(f=>({...f})).sort((a,b)=>a.path.localeCompare(b.path));
    return {tracks:result,folders:resultFolders};
  }
  function wavInfo(blob){return blob.slice(0,8192).arrayBuffer().then(buffer=>{
    const data=new Uint8Array(buffer),dv=new DataView(buffer);
    const str=(p,n)=>String.fromCharCode(...data.slice(p,p+n));
    if(data.length<44||str(0,4)!=='RIFF'||str(8,4)!=='WAVE')throw Error('Invalid RIFF WAVE');
    if(dv.getUint32(4,true)!==blob.size-8)throw Error('Incorrect RIFF file size');
    let at=12,fmt=null,smpl=null,frames=null,hasData=false;
    while(at+8<=dv.byteLength){const name=str(at,4),size=dv.getUint32(at+4,true),p=at+8;
      if(p+size>blob.size)throw Error('Invalid WAV chunk length');
      if(name==='fmt '){if(size<16||p+16>dv.byteLength)throw Error('Invalid WAV fmt');fmt={codec:dv.getUint16(p,true),channels:dv.getUint16(p+2,true),rate:dv.getUint32(p+4,true),blockAlign:dv.getUint16(p+12,true)};}
      if(name==='fact'&&size>=4&&p+4<=dv.byteLength)frames=dv.getUint32(p,true);
      if(name==='data'&&size>0)hasData=true;
      if(name==='smpl'&&size>=60&&p+60<=dv.byteLength){smpl={start:dv.getUint32(p+44,true),end:dv.getUint32(p+48,true)};}
      at=p+size+(size%2);if(at>=dv.byteLength)break;
    }
    if(!hasData||!fmt||fmt.codec!==17||fmt.channels!==2||fmt.rate!==RATE||!Number.isInteger(frames)||frames<1)throw Error('Unsupported Sigma Dex audio format');
    if(smpl&&(smpl.start>=smpl.end||smpl.end>=frames))throw Error('Invalid WAV loop chunk');
    return {...fmt,frames,smpl};
  })}
  const sha256=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const jsonBlob=obj=>new Blob([JSON.stringify(obj,null,2)+'\n'],{type:'application/json'});
  function assertPath(path){if(typeof path!=='string'||!path||path.startsWith('/')||path.includes('\\')||path.split('/').some(s=>s==='..'||s==='.'||!s))throw Error('Invalid ZIP path');}
  async function packageFiles(plan,encoded,{id='export-'+Date.now(),createdAt=new Date().toISOString(),onProgress,signal}={}){
    if(!root.SigmaDS||!root.SigmaSSEQ||!root.SigmaBankProfiles)throw Error('SSEQ or ZIP tools unavailable');
    const check=()=>{if(signal?.aborted)throw Error('Export canceled')};check();
    const files=[],records=[];
    if(plan.tracks.length!==encoded.size)throw Error('Export missing music files');
    const ids=new Set();
    for(const [i,t] of plan.tracks.entries()){
      check();const blob=encoded.get(t.id);if(!blob||!blob.size)throw Error('Missing SSEQ: '+t.id);
      assertPath(t.file);if(!t.file.endsWith('.sseq'))throw Error('Only .sseq music files are allowed');
      const slot=Number(t.source.sseq_id);if(!Number.isInteger(slot))throw Error('Missing HeartGold bank slot for '+t.title);
      const data=new Uint8Array(await blob.arrayBuffer()),parsed=root.SigmaSSEQ.parse(data,{profiles:root.SigmaBankProfiles,slot,maxBytes:65536});
      const digest=await sha256(blob);
      if(t.source_sha256&&digest!==t.source_sha256)throw Error('Stored SSEQ hash differs: '+t.title);
      if(ids.has(t.id))throw Error('Duplicate track ID');ids.add(t.id);
      const bank=root.SigmaSSEQ.profileSlot(root.SigmaBankProfiles,slot);
      const out={id:t.id,title:t.title,artist:t.artist,original_filename:t.original_filename,
        exported_filename:t.file.split('/').at(-1),file:t.file,folder_id:t.folder_id,
        folder_path:t.folder_path,source_sha256:t.source_sha256,format:'SSEQ',codec:'Nitro sequence',
        bank_id:bank.bankId,source_slot:slot,source_symbol:bank.symbol,
        wave_archives:bank.bank.wave_archive_slots.filter(x=>x!==null),
        duration_s:parsed.durationTicks*60/(parsed.tempo*48),tempo:parsed.tempo,
        notes:parsed.notes.length,loop_enabled:parsed.infinite,event_id:t.event_id,
        bytes:blob.size,sha256:digest};
      records.push(out);files.push({name:t.file,blob});onProgress?.(i+1,plan.tracks.length);
    }
    const folders=plan.folders.map(f=>({...f}));
    const manifest={format:FORMAT,version:VERSION,export_id:id,created_at:createdAt,
      producer:'sigma-themes',game:'Pokemon HeartGold US',bank_profile_sha256:root.SigmaBankProfiles.source_sdat_sha256,
      folder_count:folders.length-1,track_count:records.length,
      tracks:records,folders_file:'folders.json',tracks_file:'tracks.json',checksums_file:'checksums.sha256',
      note:'Contains only validated SSEQ music, metadata and checksums. No ROM, SBNK, SWAR, or streaming audio.'};
    files.push({name:'folders.json',blob:jsonBlob(folders)},
               {name:'tracks.json',blob:jsonBlob(records)},
               {name:'manifest.json',blob:jsonBlob(manifest)});
    const lines=[];for(const f of files){check();lines.push((await sha256(f.blob))+'  '+f.name)}
    files.push({name:'checksums.sha256',blob:new Blob([lines.join('\n')+'\n'],{type:'text/plain'})});
    files.push({name:'README.txt',blob:new Blob(['Sigma Dex SSEQ pack v2. Import into a receiver that implements the versioned contract.\nNo original Nintendo files or HeartGold ROM are distributed.\n'])});
    const cost=files.reduce((n,f)=>n+f.blob.size+256+f.name.length,0);
    if(cost>0xffffffff-65536*300)throw Error('ZIP32 size limit; reduce the selected songs.');
    const zip=await root.SigmaDS.zip(files);check();await verifyPackage(zip,{signal});check();
    return {blob:zip,manifest,folders,tracks:records};
  }
  async function verifyPackage(zip,{signal}={}){
    if(!root.SigmaDS||!root.SigmaSSEQ||!root.SigmaBankProfiles)throw Error('Validator unavailable');
    const check=()=>{if(signal?.aborted)throw Error('Validation canceled')};check();
    await root.SigmaDS.verifyZip(zip,{signal});const entries=await root.SigmaDS.unzip(zip);check();
    const read=async n=>{const b=entries.get(n);if(!b)throw Error('Missing '+n);return b.text()};
    const manifest=JSON.parse(await read('manifest.json')),
          tracks=JSON.parse(await read('tracks.json')),
          folders=JSON.parse(await read('folders.json'));
    if(manifest.format!==FORMAT||manifest.version!==VERSION||!Array.isArray(tracks)||!Array.isArray(folders)||
       manifest.track_count!==tracks.length||manifest.folder_count!==folders.length-1||
       JSON.stringify(manifest.tracks)!==JSON.stringify(tracks))throw Error('Invalid SSEQ pack manifest');
    const index=folderIndex(folders.filter(f=>f.id!=='root')),trackIds=new Set(),paths=new Set(),eventIds=new Set();
    for(const t of tracks){check();
      if(!validId(t.id)||trackIds.has(t.id)||!index.has(t.folder_id))throw Error('Duplicate track or unknown folder');trackIds.add(t.id);
      assertPath(t.file);if(paths.has(t.file)||!t.file.endsWith('.sseq')||!t.file.startsWith('music/'))throw Error('Invalid SSEQ ZIP path');paths.add(t.file);
      if(t.folder_path!==index.get(t.folder_id).path)throw Error('Folder metadata mismatch');
      if(t.event_id!==null){if(!Number.isInteger(t.event_id)||eventIds.has(t.event_id))throw Error('Duplicate/invalid music assignment');eventIds.add(t.event_id)}
      const blob=entries.get(t.file);if(!blob||blob.size!==t.bytes||await sha256(blob)!==t.sha256)throw Error('Missing/corrupted SSEQ '+t.file);
      const parsed=root.SigmaSSEQ.parse(new Uint8Array(await blob.arrayBuffer()),{profiles:root.SigmaBankProfiles,slot:t.source_slot,maxBytes:65536});
      if(parsed.notes.length!==t.notes||parsed.tempo!==t.tempo||parsed.infinite!==t.loop_enabled||
         root.SigmaSSEQ.profileSlot(root.SigmaBankProfiles,t.source_slot).bankId!==t.bank_id)throw Error('SSEQ/bank metadata mismatch '+t.id);
    }
    const expected=new Set(['manifest.json','folders.json','tracks.json','checksums.sha256','README.txt',...tracks.map(t=>t.file)]);
    if(entries.size!==expected.size||[...entries.keys()].some(n=>!expected.has(n)))throw Error('Extra/missing ZIP contents');
    const lines=(await read('checksums.sha256')).trim().split('\n');if(lines.length!==expected.size-2)throw Error('Incomplete checksum list');
    const recorded=new Set();for(const line of lines){const m=/^([a-f0-9]{64})  (.+)$/.exec(line);
      if(!m||recorded.has(m[2])||!entries.has(m[2])||await sha256(entries.get(m[2]))!==m[1])throw Error('Invalid checksum list');recorded.add(m[2]);}
    for(const name of expected)if(name!=='checksums.sha256'&&name!=='README.txt'&&!recorded.has(name))throw Error('Missing checksum '+name);
    return {ok:true,tracks:tracks.length,bytes:zip.size};
  }
  root.SigmaDexExport={FORMAT,VERSION,safeName,folderIndex,createFolder,moveFolder,selectedTrackPlan,sha256,packageFiles,verifyPackage};
})(typeof window!=='undefined'?window:globalThis);
