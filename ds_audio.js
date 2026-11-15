/* sigma-themes Nintendo DS audio export helpers.
   Game audio: standard RIFF/WAVE IMA ADPCM (0x11), NOT an SSEQ or a modified SDAT.
   Target: NWAV-enabled hg-engine / NitroWAV-type stream player. No network required. */
(function(root){'use strict';
 const TARGET_RATE=32728, STEP=[7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767];
 const CHANGE=[-1,-1,-1,-1,2,4,6,8];
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 const u8=t=>new TextEncoder().encode(t);
 function pcm16(v){return Math.round(clamp(v,-1,1)* (v<0?32768:32767));}
 function put4(buffer,at,str){for(let i=0;i<4;i++)buffer[at+i]=str.charCodeAt(i);}
 function putChunk(dv,at,name,length){for(let i=0;i<4;i++)dv.setUint8(at+i,name.charCodeAt(i));dv.setUint32(at+4,length,true);return at+8;}
 // WAV IMA-ADPCM encoding: sample predictor and step index persist within each block, reset per block.
 function nibble(sample,state){
   let delta=sample-state.pred, code=0, sign=0;if(delta<0){sign=8;delta=-delta;}
   const step=STEP[state.index];let remainder=delta;
   if(remainder>=step){code|=4;remainder-=step;}
   if(remainder>=(step>>1)){code|=2;remainder-=step>>1;}
   if(remainder>=(step>>2)){code|=1;}
   let d=step>>3;if(code&4)d+=step;if(code&2)d+=step>>1;if(code&1)d+=step>>2;
   state.pred=clamp(state.pred+(sign?-d:d),-32768,32767);
   state.index=clamp(state.index+CHANGE[code],0,88);
   return code|sign;
 }
 function normalizedLoop(loop,frames,rate,blockFrames=1){
   if(!loop)return null;
   if(loop===true)return {start:0,end:frames-1};
   if(typeof loop!=='object')throw Error('Invalid loop options');
   const a=Number(loop.start??0),b=Number(loop.end??(frames/rate));
   if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||a>=b||b>frames/rate+.005)throw Error('Invalid loop points');
   const start=Math.max(0,Math.min(frames-2,Math.round(a*rate/blockFrames)*blockFrames));
   const endExclusive=Math.min(frames,Math.max(start+1,Math.round(b*rate/blockFrames)*blockFrames));
   if(start>=endExclusive||start>=frames-1)throw Error('Loop too short to encode');
   return {start,end:endExclusive-1};
 }
 function encodeImaWav(channels,rate=TARGET_RATE,loops=false){
   const count=channels.length;if(count<1||count>2)throw Error('Only mono/stereo supported');
   const frames=channels[0].length;
   if(frames===0||channels.some(c=>c.length!==frames))throw Error('Channels must have the same non-zero length');
   const align=256*count;const perBlock=1+(align-4*count)*2/count;
   const blocks=Math.ceil(frames/perBlock),dataSize=blocks*align;
   const loopPoints=normalizedLoop(loops,frames,rate,perBlock);
   const loopSize=loopPoints?68:0; // 8 chunk + 60 bytes smpl payload
   const offset=12+8+20+8+4+loopSize+8;
   const bytes=new Uint8Array(offset+dataSize+(dataSize%2));const dv=new DataView(bytes.buffer);
   put4(bytes,0,'RIFF');dv.setUint32(4,bytes.length-8,true);put4(bytes,8,'WAVE');
   let p=putChunk(dv,12,'fmt ',20);
   dv.setUint16(p,0x11,true);dv.setUint16(p+2,count,true);dv.setUint32(p+4,rate,true);
   dv.setUint32(p+8,Math.round(rate*align/perBlock),true);dv.setUint16(p+12,align,true);
   dv.setUint16(p+14,4,true);dv.setUint16(p+16,2,true);dv.setUint16(p+18,perBlock,true);
   p=putChunk(dv,p+20,'fact',4);dv.setUint32(p,frames,true);p+=4;
   if(loopPoints){
     p=putChunk(dv,p,'smpl',60);dv.setUint32(p+8,Math.round(1e9/rate),true);
     dv.setUint32(p+12,60,true);dv.setUint32(p+28,1,true); // one loop
     dv.setUint32(p+36,0,true);dv.setUint32(p+40,0,true); // identifier, forward
     dv.setUint32(p+44,loopPoints.start,true);dv.setUint32(p+48,loopPoints.end,true);
     dv.setUint32(p+52,0,true);dv.setUint32(p+56,0,true);p+=60;
   }
   p=putChunk(dv,p,'data',dataSize);
   for(let b=0;b<blocks;b++){
     const base=p+b*align,start=b*perBlock,states=[];
     for(let c=0;c<count;c++){
       const pred=pcm16(channels[c][Math.min(start,frames-1)]);
       const state={pred,index:0};states.push(state);
       dv.setInt16(base+c*4,pred,true);dv.setUint8(base+c*4+2,0);dv.setUint8(base+c*4+3,0);
     }
     // Each block: 4 bytes per channel, alternating every 8 samples.
     for(let group=0;group<(perBlock-1)/8;group++){
       for(let c=0;c<count;c++){
         const target=base+4*count+group*4*count+c*4;
         for(let pair=0;pair<4;pair++){
           const i=start+1+group*8+pair*2;
           const a=pcm16(channels[c][Math.min(i,frames-1)]);
           const d=pcm16(channels[c][Math.min(i+1,frames-1)]);
           bytes[target+pair]=nibble(a,states[c])|(nibble(d,states[c])<<4);
         }
       }
     }
   }
   return new Blob([bytes],{type:'audio/wav'});
 }
 function encodePcmWav(channels,rate=TARGET_RATE,loops=false){
   const count=channels.length,frames=channels[0].length,amount=frames*count*2,loopSize=loops?68:0;
   const loopPoints=normalizedLoop(loops,frames,rate);
   const offset=44+(loopPoints?68:0);const output=new Uint8Array(offset+amount);const dv=new DataView(output.buffer);
   put4(output,0,'RIFF');dv.setUint32(4,output.length-8,true);put4(output,8,'WAVE');
   let p=putChunk(dv,12,'fmt ',16);dv.setUint16(p,1,true);dv.setUint16(p+2,count,true);
   dv.setUint32(p+4,rate,true);dv.setUint32(p+8,rate*count*2,true);dv.setUint16(p+12,count*2,true);dv.setUint16(p+14,16,true);p+=16;
   if(loopPoints){p=putChunk(dv,p,'smpl',60);dv.setUint32(p+8,Math.round(1e9/rate),true);dv.setUint32(p+12,60,true);dv.setUint32(p+28,1,true);dv.setUint32(p+44,loopPoints.start,true);dv.setUint32(p+48,loopPoints.end,true);p+=60;}
   p=putChunk(dv,p,'data',amount);
   for(let i=0;i<frames;i++)for(let c=0;c<count;c++)dv.setInt16(p+(i*count+c)*2,pcm16(channels[c][i]),true);
   return new Blob([output],{type:'audio/wav'});
 }
 async function convert(file,{rate=TARGET_RATE,channels=2,format='adpcm',loop=false,onProgress,signal}={}){
   const check=()=>{if(signal?.aborted)throw Object.assign(new Error('Export canceled'),{name:'AbortError'})};check();
   if(!file||file.size===0)throw Error('No audio file');
   if(file.size>180*1024*1024)throw Error('Audio source is over 180 MB; prepare it as a smaller WAV first');
   if(!('AudioContext'in root||'webkitAudioContext'in root)||!root.OfflineAudioContext)throw Error('Browser does not support offline audio conversion');
   const AudioCtx=root.AudioContext||root.webkitAudioContext;
   const ctx=new AudioCtx();let raw;
   try{onProgress?.('Decoding');raw=await ctx.decodeAudioData(await file.arrayBuffer());check();}
   finally{await ctx.close().catch(()=>{});}
   if(!Number.isFinite(raw.duration)||raw.duration>12*60)throw Error('Maximum conversion duration is 12 minutes per song');
   const frameCount=Math.ceil(raw.duration*rate);
   const offline=new root.OfflineAudioContext(channels,frameCount,rate);
   const src=offline.createBufferSource();src.buffer=raw;src.connect(offline.destination);src.start(0);
   onProgress?.('Resampling');const result=await offline.startRendering();check();
   onProgress?.('Encoding '+(format==='pcm16'?'PCM16':'IMA-ADPCM'));
   const parts=[];for(let c=0;c<channels;c++)parts.push(result.getChannelData(c));
   // Encode in a dedicated Web Worker so large songs do not block playback and navigation.
   if(root.Worker){
     const transferable=parts.map(c=>new Float32Array(c));
     const worker=new root.Worker('ds_encode_worker.js');
     try{
       const buffer=await new Promise((resolve,reject)=>{
         const onAbort=()=>{cleanup();reject(Object.assign(new Error('Export canceled'),{name:'AbortError'}))};
         const cleanup=()=>signal?.removeEventListener('abort',onAbort);
         signal?.addEventListener('abort',onAbort,{once:true});
         worker.onmessage=e=>{cleanup();e.data?.error?reject(Error(e.data.error)):resolve(e.data?.audio)};
         worker.onerror=e=>{cleanup();reject(Error(e.message||'Audio encoder worker crashed'))};
         worker.postMessage({id:'ds',channels:transferable,rate,format,loop},transferable.map(c=>c.buffer));
       });
       check();if(!(buffer instanceof ArrayBuffer))throw Error('DS encoder returned invalid audio');
       return new Blob([buffer],{type:'audio/wav'});
     }finally{worker.terminate()}
   }
   // Strict fallback on browsers that disable workers: may briefly block UI.
   await new Promise(ok=>setTimeout(ok,0));check();
   return format==='pcm16'?encodePcmWav(parts,rate,loop):encodeImaWav(parts,rate,loop);
 }
 // Uncompressed ZIP writer; avoids external dependencies, retains exact audio bytes.
 const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let x=i;for(let n=0;n<8;n++)x=x&1?(x>>>1)^0xedb88320:(x>>>1);t[i]=x>>>0;}return t;})();
 function crc32(bytes){let crc=0xffffffff;for(let i=0;i<bytes.length;i++)crc=(crc>>>8)^CRC_TABLE[(crc^bytes[i])&255];return (crc^0xffffffff)>>>0;}
 async function zip(files,onProgress){
   if(files.length>65535)throw Error('Too many files');
   const body=[],directory=[];let offset=0;
   if(files.reduce((n,f)=>n+(f.blob?.size||0),0)>0xffffffff-65536*300)throw Error('Archive exceeds ZIP32 size; export smaller batches');
   for(let i=0;i<files.length;i++){
     let {name,blob}=files[i];name=String(name).replace(/\\/g,'/').replace(/(^\/+|\.\.)/g,'').slice(0,220);
     if(!name)throw Error('Empty filename');
     if(!blob||typeof blob.size!=='number')throw Error('Invalid ZIP file');
     if(blob.size>0xffffffff)throw Error('File exceeds ZIP32 limit');
     const filename=u8(name);
     // Chunked CRC: even a 100 MB audio file never needs to be duplicated into RAM.
     let working=0xffffffff;
     for(let at=0;at<blob.size;at+=1024*1024){
       const part=new Uint8Array(await blob.slice(at,at+1024*1024).arrayBuffer());
       for(let j=0;j<part.length;j++)working=(working>>>8)^CRC_TABLE[(working^part[j])&255];
     }
     const crc=(working^0xffffffff)>>>0;
     const local=new Uint8Array(30+filename.length),v=new DataView(local.buffer);
     v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);
     v.setUint32(18,blob.size,true);v.setUint32(22,blob.size,true);v.setUint16(26,filename.length,true);local.set(filename,30);
     const central=new Uint8Array(46+filename.length),d=new DataView(central.buffer);
     d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);
     d.setUint32(20,blob.size,true);d.setUint32(24,blob.size,true);d.setUint16(28,filename.length,true);d.setUint32(42,offset,true);central.set(filename,46);
     body.push(local,blob);directory.push(central);offset+=local.length+blob.size;
     onProgress?.(i+1,files.length);
   }
   const dirSize=directory.reduce((sum,b)=>sum+b.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
   ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);
   ev.setUint32(12,dirSize,true);ev.setUint32(16,offset,true);
   return new Blob([...body,...directory,end],{type:'application/zip'});
 }

 // Read ZIP32 STORE archives with no decompression dependency. Used for sigma-themes backups.
 // Entries are mapped to Blob slices without materializing every audio file in RAM.
 async function unzip(blob){
   if(!blob||blob.size>1024*1024*1024)throw Error('Backup exceeds 1 GB browser import limit');
   const n=Math.min(blob.size,65557),tail=new Uint8Array(await blob.slice(blob.size-n).arrayBuffer());
   let end=-1;for(let i=tail.length-22;i>=0;i--){if(tail[i]===80&&tail[i+1]===75&&tail[i+2]===5&&tail[i+3]===6){end=i;break;}}
   if(end<0)throw Error('ZIP end-of-central-directory is missing');
   const ev=new DataView(tail.buffer),count=ev.getUint16(end+10,true),dirBytes=ev.getUint32(end+12,true),dirOffset=ev.getUint32(end+16,true);
   if(count>10000||dirBytes>8*1024*1024||dirOffset+dirBytes>blob.size)throw Error('ZIP directory is invalid or too large');
   const data=new Uint8Array(await blob.slice(dirOffset,dirOffset+dirBytes).arrayBuffer()),dv=new DataView(data.buffer),files=new Map();
   let p=0;for(let i=0;i<count;i++){
     if(p+46>data.length||dv.getUint32(p,true)!==0x02014b50)throw Error('Corrupted ZIP central directory');
     const mode=dv.getUint16(p+10,true),compressed=dv.getUint32(p+20,true),size=dv.getUint32(p+24,true);
     const nameBytes=dv.getUint16(p+28,true),extra=dv.getUint16(p+30,true),comment=dv.getUint16(p+32,true),localOffset=dv.getUint32(p+42,true);
     if(mode!==0||compressed!==size)throw Error('This backup format only supports uncompressed ZIP entries');
     if(nameBytes>220||p+46+nameBytes+extra+comment>data.length)throw Error('Invalid ZIP filename');
     const name=new TextDecoder().decode(data.slice(p+46,p+46+nameBytes));
     if(!name||name.startsWith('/')||name.includes('..')||name.includes('\\')||files.has(name))throw Error('Unsafe ZIP entry name');
     const local=new DataView(await blob.slice(localOffset,localOffset+30).arrayBuffer());
     if(local.byteLength<30||local.getUint32(0,true)!==0x04034b50)throw Error('Invalid local ZIP record');
     const start=localOffset+30+local.getUint16(26,true)+local.getUint16(28,true);
     if(start+size>blob.size)throw Error('Truncated ZIP entry');
     files.set(name,blob.slice(start,start+size));p+=46+nameBytes+extra+comment;
   }
   return files;
 }

 // Verify every entry byte using the CRC32 stored in each ZIP32 local record.
 // Exports are ZIP STORE and stay as Blob slices; avoids loading the whole archive in RAM.
 async function verifyZip(blob,{signal,onProgress}={}){
   const entries=await unzip(blob),names=[...entries.keys()];let i=0;
   // unzip() validates offsets and lengths; validate the central CRC against raw bytes too.
   const n=Math.min(blob.size,65557),tail=new Uint8Array(await blob.slice(blob.size-n).arrayBuffer());
   let end=-1;for(let j=tail.length-22;j>=0;j--)if(tail[j]===80&&tail[j+1]===75&&tail[j+2]===5&&tail[j+3]===6){end=j;break}
   if(end<0)throw Error('ZIP directory missing');
   const eov=new DataView(tail.buffer),directoryOffset=eov.getUint32(end+16,true),directoryBytes=eov.getUint32(end+12,true);
   const cd=new Uint8Array(await blob.slice(directoryOffset,directoryOffset+directoryBytes).arrayBuffer());
   const view=new DataView(cd.buffer);let at=0;
   for(const name of names){
     if(signal?.aborted)throw Object.assign(new Error('Export canceled'),{name:'AbortError'});
     if(view.getUint32(at,true)!==0x02014b50)throw Error('Damaged ZIP central directory');
     const filenameLength=view.getUint16(at+28,true),extraLength=view.getUint16(at+30,true),commentLength=view.getUint16(at+32,true);
     const stored=view.getUint32(at+16,true),contents=entries.get(name);let crc=0xffffffff;
     for(let pos=0;pos<contents.size;pos+=1024*1024){
       if(signal?.aborted)throw Object.assign(new Error('Export canceled'),{name:'AbortError'});
       const chunk=new Uint8Array(await contents.slice(pos,pos+1024*1024).arrayBuffer());
       for(let k=0;k<chunk.length;k++)crc=(crc>>>8)^CRC_TABLE[(crc^chunk[k])&255];
     }
     if(((crc^0xffffffff)>>>0)!==stored)throw Error('ZIP checksum mismatch: '+name);
     at+=46+filenameLength+extraLength+commentLength;onProgress?.(++i,names.length);
   }
   return {files:names.length,bytes:blob.size};
 }
 root.SigmaDS={rate:TARGET_RATE,normalizedLoop,encodeImaWav,encodePcmWav,convert,zip,unzip,verifyZip};
})(typeof window!=='undefined'?window:globalThis);
