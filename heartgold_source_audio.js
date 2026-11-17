/* Optional local-only original HeartGold SBNK/SWAR inspection and previews.
 * Files must match SHA256 hashes in the already authenticated metadata pack.
 * No imported source files are uploaded to the server or included in SSEQ.
 */
(function(root){
'use strict';
const banks=new Map(),archives=new Map();
const MAGIC=(bytes,start)=>String.fromCharCode(...bytes.subarray(start,start+4));
function bytesFrom(data){return data instanceof Uint8Array?data:new Uint8Array(data);}
function safeReadInfo(bytes,offset){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(offset<0||offset+10>bytes.length)throw Error('SBNK truncated instrument note info');
 return {waveId:view.getUint16(offset,true),archiveSlot:view.getUint16(offset+2,true),baseNote:bytes[offset+4],attack:bytes[offset+5],decay:bytes[offset+6],sustain:bytes[offset+7],release:bytes[offset+8],pan:bytes[offset+9]};
}
function parseSBNK(data){
 const b=bytesFrom(data),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length<0x40||MAGIC(b,0)!=='SBNK'||MAGIC(b,0x10)!=='DATA')throw Error('Invalid SBNK bank file');
 const count=v.getUint32(0x38,true);if(count>512||0x3c+count*4>b.length)throw Error('Invalid SBNK instrument table');
 const programs=[];
 for(let index=0;index<count;index++){
  const record=0x3c+index*4,kind=b[record],offset=v.getUint16(record+1,true);if(!kind||!offset){programs.push(null);continue;}
  const regions=[];
  if(kind<=3||kind===4){regions.push({low:0,high:127,type:kind,...safeReadInfo(b,offset)});}
  else if(kind===16){
   if(offset+2>b.length)throw Error('Truncated drum kit');
   const low=b[offset],high=b[offset+1];if(low>high||high>127)throw Error('Invalid drum range');
   for(let pitch=low;pitch<=high;pitch++){
    const at=offset+2+(pitch-low)*12;
    if(at+12>b.length)throw Error('Truncated drum entry');
    const type=b[at+1];if(type)regions.push({low:pitch,high:pitch,type,...safeReadInfo(b,at+2)});
   }
  }else if(kind===17){
   if(offset+8>b.length)throw Error('Truncated key split');
   const limits=Array.from(b.subarray(offset,offset+8)).filter(x=>x>0);let low=0;
   for(let i=0;i<limits.length;i++){
    const at=offset+8+i*12;if(at+12>b.length)throw Error('Truncated key split entry');
    const type=b[at+1],high=limits[i];if(low<=high&&type)regions.push({low,high,type,...safeReadInfo(b,at+2)});
    low=high+1;
   }
  }else throw Error('Unsupported SBNK instrument type '+kind);
  programs.push({index,kind,regions});
 }
 return {programs};
}
const STEPS=[7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767];
const INDEX=[-1,-1,-1,-1,2,4,6,8];
function decodeWave(data,offset,limit){
 const b=bytesFrom(data),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(offset+12>limit)throw Error('Truncated SWAR wave info');
 const type=b[offset],loop=!!b[offset+1],rate=v.getUint16(offset+2,true),loopWords=v.getUint16(offset+6,true),nonloopWords=v.getUint32(offset+8,true);
 if(type>2||rate<500||rate>96000)throw Error('Invalid wave type/sample rate');
 const start=offset+12,size=(loopWords+nonloopWords)*4;
 if(start+size>limit||size>20*1024*1024)throw Error('SWAR sample size exceeds available bytes');
 let samples;
 if(type===0){samples=new Float32Array(size);for(let i=0;i<size;i++)samples[i]=(b[start+i]<<24>>24)/128;}
 else if(type===1){samples=new Float32Array(size/2);for(let i=0;i<samples.length;i++)samples[i]=v.getInt16(start+i*2,true)/32768;}
 else{
  if(size<4)throw Error('Truncated ADPCM sample');
  let predictor=v.getInt16(start,true),idx=Math.max(0,Math.min(88,b[start+2]));
  samples=new Float32Array(1+(size-4)*2);samples[0]=predictor/32768;let n=1;
  for(let i=start+4;i<start+size;i++)for(const shift of [0,4]){
   const nib=(b[i]>>shift)&15,step=STEPS[idx];let delta=step>>3;
   if(nib&1)delta+=step>>2;if(nib&2)delta+=step>>1;if(nib&4)delta+=step;
   predictor=Math.max(-32768,Math.min(32767,predictor+((nib&8)?-delta:delta)));
   idx=Math.max(0,Math.min(88,idx+INDEX[nib&7]));samples[n++]=predictor/32768;
  }
 }
 return {rate,samples,type,loop,loopWords};
}
function parseSWAR(data){
 const b=bytesFrom(data),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length<0x3c||MAGIC(b,0)!=='SWAR'||MAGIC(b,0x10)!=='DATA')throw Error('Invalid SWAR sample archive');
 const count=v.getUint32(0x38,true);if(count>16384||0x3c+count*4>b.length)throw Error('Invalid SWAR index');
 const offsets=Array.from({length:count},(_,i)=>v.getUint32(0x3c+i*4,true));
 if(offsets.some((n,i)=>n<0x3c+count*4||n>=b.length||(i>0&&n<=offsets[i-1])))throw Error('Invalid SWAR wave offsets');
 return {bytes:b,offsets,cache:new Map()};
}
function getWave(archive,idx){
 if(!Number.isInteger(idx)||idx<0||idx>=archive.offsets.length)throw Error('Wave index out of archive');
 if(!archive.cache.has(idx))archive.cache.set(idx,decodeWave(archive.bytes,archive.offsets[idx],archive.offsets[idx+1]||archive.bytes.length));
 return archive.cache.get(idx);
}
async function sha256(data){
 if(!root.crypto?.subtle)throw Error('Secure browser context (HTTPS or localhost) required to verify instrument hashes');
 const value=await root.crypto.subtle.digest('SHA-256',data);
 return [...new Uint8Array(value)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function importFiles(files,profiles){
 const expected=new Map();
 for(const [id,data] of Object.entries(profiles.banks)){const hash=data.source_sbnk_sha256;expected.set(hash,[...(expected.get(hash)||[]),'bank:'+id]);}
 for(const [id,data] of Object.entries(profiles.wave_archives)){const hash=data.source_swar_sha256;expected.set(hash,[...(expected.get(hash)||[]),'wave:'+id]);}
 let successful=0,skipped=0;const errors=[];
 const list=Array.from(files);if(list.length>170)throw Error('Limit source batch to 170 bank/sample files');
 for(const file of list){
  try{
   if(file.size>20*1024*1024)throw Error('source file larger than 20 MiB');
   const raw=await file.arrayBuffer(),bytes=new Uint8Array(raw),kind=MAGIC(bytes,0);
   if(kind!=='SBNK'&&kind!=='SWAR')throw Error('not an SBNK/SWAR file');
   const matches=expected.get(await sha256(raw));if(!matches)throw Error('not a matching original HeartGold US bank/sample file (SHA-256 mismatch)');
   for(const match of matches){const [type,id]=match.split(':');
    if((type==='bank'&&kind!=='SBNK')||(type==='wave'&&kind!=='SWAR'))throw Error('file type mismatch');
    if(type==='bank')banks.set(Number(id),parseSBNK(bytes));else archives.set(Number(id),parseSWAR(bytes));}
   successful++;
  }catch(error){skipped++;errors.push(`${file.name}: ${error.message}`)}
 }
 return {successful,skipped,errors,bankCount:banks.size,waveCount:archives.size};
}
function details(bankId,program){return banks.get(Number(bankId))?.programs?.[program]||null;}
function originalWave(bankId,program,note,profiles){
 const info=details(bankId,program);if(!info)return null;
 const def=info.regions.find(r=>note>=r.low&&note<=r.high);if(!def||def.type!==1)return null;
 const bank=profiles.banks[String(bankId)],archiveId=bank?.wave_archive_slots?.[def.archiveSlot];
 if(archiveId===null||archiveId===undefined)return null;
 const archive=archives.get(Number(archiveId));if(!archive)return null;
 const wave=getWave(archive,def.waveId);
 return {wave,definition:def,archiveId};
}
// The instrument picker and complete SSEQ player MUST use the same PCM
// scheduling, root key, loop interpretation, pan and envelope implementation.
// DS ADSR bytes are not seconds; these are intentionally approximate mappings
// and never serialized into SSEQ.
const contextBuffers=new WeakMap();
function pcmLoopPoints(wave){
 if(!wave.loop || !wave.loopWords)return null;
 const bytes=wave.loopWords*4;
 const start=wave.type===0?bytes:wave.type===1?bytes/2:Math.max(1,1+(bytes-4)*2);
 if(!Number.isSafeInteger(start)||start<1||start>=wave.samples.length-1)return null;
 return {start:start/wave.rate,end:wave.samples.length/wave.rate};
}
function pcmEnvelope(def){
 // Conservative bounded preview approximation (NOT Nintendo's ADSR tables).
 // Keep attack, decay, sustain and release as four distinct stages.
 const byte=x=>Math.max(0,Math.min(127,Number(x)||0));
 return {attack:.004+.14*(127-byte(def.attack))/127,
  decay:.025+.22*(127-byte(def.decay))/127,
  sustain:Math.max(.02,Math.min(.99,byte(def.sustain)/127)),
  release:.012+.19*(127-byte(def.release))/127};
}
function schedulePcm(ctx,output,original,{note,start,end,velocity=100}={}){
 const {wave,definition}=original;
 if(!(end>start)||!Number.isInteger(note)||note<0||note>127)throw Error('Invalid PCM voice schedule');
 let buffers=contextBuffers.get(ctx);if(!buffers){buffers=new WeakMap();contextBuffers.set(ctx,buffers)}
 let buffer=buffers.get(wave);
 if(!buffer){buffer=ctx.createBuffer(1,wave.samples.length,wave.rate);buffer.copyToChannel(wave.samples,0);buffers.set(wave,buffer)}
 const src=ctx.createBufferSource();src.buffer=buffer;
 src.playbackRate.value=Math.pow(2,(note-definition.baseNote)/12);
 const points=pcmLoopPoints(wave);
 if(points){src.loop=true;src.loopStart=points.start;src.loopEnd=points.end}
 const volume=Math.max(.002,Math.min(1,Number(velocity)/127))*.43;
 const env=pcmEnvelope(definition),held=end-start;
 const atk=Math.min(env.attack,held*.40),dec=Math.min(env.decay,Math.max(0,held*.60-atk));
 const release=Math.min(env.release,held*.25), releaseBegin=Math.max(start+atk+dec,end-release);
 const gain=ctx.createGain();
 gain.gain.setValueAtTime(0,start);
 gain.gain.linearRampToValueAtTime(volume,start+atk);
 gain.gain.linearRampToValueAtTime(volume*env.sustain,start+atk+dec);
 gain.gain.setValueAtTime(volume*env.sustain,releaseBegin);
 gain.gain.linearRampToValueAtTime(0,end);
 const pan=ctx.createStereoPanner?.();
 if(pan){pan.pan.value=Math.max(-1,Math.min(1,(definition.pan-64)/63));src.connect(pan).connect(gain)}
 else src.connect(gain);
 gain.connect(output);
 src.start(start);src.stop(end+.002);
 return {node:src,gain,pan,loop:!!src.loop,envelope:env};
}
function loaded(){return {banks:[...banks.keys()],archives:[...archives.keys()]};}
root.SigmaHeartGoldSources={parseSBNK,parseSWAR,decodeWave,getWave,importFiles,details,originalWave,pcmLoopPoints,pcmEnvelope,schedulePcm,loaded};
})(typeof globalThis==='object'?globalThis:window);
