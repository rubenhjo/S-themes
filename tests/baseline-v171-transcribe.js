/* Offline, lightweight note extractor for user-supplied audio.
 * IMPORTANT: not a full score reconstruction model. Dense mixes are NOT validated
 * for melodic similarity; the UI and QC report disclose that limitation.
 * Source audio remains inside the browser, and ONLY the SSEQ bytes get uploaded.
 */
(function(root,factory){const api=factory();root.SigmaTranscribe=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const midiToHz=n=>440*Math.pow(2,(n-69)/12);
const MAX_SOURCE_BYTES=128*1024*1024; // Refuse unsafe in-browser allocations before reading source bytes.
function fft(real,imag){const n=real.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let x=real[i];real[i]=real[j];real[j]=x;x=imag[i];imag[i]=imag[j];imag[j]=x;}}
 for(let len=2;len<=n;len*=2){const theta=-2*Math.PI/len,wr0=Math.cos(theta),wi0=Math.sin(theta);for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){let k=i+j,q=k+len/2;const tr=wr*real[q]-wi*imag[q],ti=wr*imag[q]+wi*real[q];real[q]=real[k]-tr;imag[q]=imag[k]-ti;real[k]+=tr;imag[k]+=ti;const next=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=next;}}}}
function smooth(notes,stepSec,minLen=.14){
 const sequences=[], tracks=notes[0]?.length||1;
 for(let channel=0;channel<tracks;channel++){
  let active=null;
  for(let i=0;i<=notes.length;i++){
   const pitch=i===notes.length?null:notes[i][channel]?.pitch??null;
   if(active&&pitch!==active.pitch){const duration=(i-active.frame)*stepSec;if(duration>=minLen)sequences.push({channel,pitch:active.pitch,start:active.frame*stepSec,duration,velocity:active.velocity});active=null}
   if(pitch!==null&&!active)active={pitch,frame:i,velocity:notes[i][channel].velocity};
  }
 }
 return sequences;
}
// Lightweight YIN-style cumulative normalized difference function. Restrict
// to bass ambiguity; polyphonic mixtures are intentionally not treated as
// ground-truth pitch. Uses a bounded 768-sample probe for mobile Workers.
function yinBass(samples,offset,rate){
 const usable=Math.min(1024,samples.length-offset),lo=Math.floor(rate/midiToHz(54)),hi=Math.ceil(rate/midiToHz(35));
 if(usable<hi+128)return null;
 let cumulative=0,best=1,bestTau=0;
 for(let tau=1;tau<=hi;tau++){
  let difference=0;
  for(let j=0;j<usable-hi;j++){const delta=samples[offset+j]-samples[offset+j+tau];difference+=delta*delta;}
  cumulative+=difference;
  if(tau<lo)continue;
  const cmnd=difference*tau/Math.max(1e-12,cumulative);
  if(cmnd<best){best=cmnd;bestTau=tau;}
 }
 if(best<.22){const pitch=Math.round(69+12*Math.log2(rate/(bestTau*440)));
  if(pitch>=35&&pitch<=54)return {pitch,confidence:1-best};}
 return null;
}
function spectralFrames(samples,sampleRate,{maxSeconds=360,onProgress,signal,mode='melody-chords'}={}){
 const N=2048,hop=256,freqPerBin=sampleRate/N,window=new Float32Array(N);
 for(let i=0;i<N;i++)window[i]=.5-.5*Math.cos(2*Math.PI*i/(N-1));
 const pitchTable=Array.from({length:58},(_,i)=>({pitch:i+35, f:midiToHz(i+35)}));
 const r=new Float32Array(N),im=new Float32Array(N),mag=new Float32Array(N/2),frames=[];
 const maxVoices=mode==='melody'?1:8;let previous=Array(maxVoices).fill(null),bassEstimate=null;
 const count=Math.max(0,Math.floor((Math.min(samples.length,maxSeconds*sampleRate)-N)/hop));
 for(let index=0;index<count;index++){
  if(signal?.aborted)throw Error('Conversion canceled');
  let energy=0,local=0;
  for(let j=0;j<N;j++){const v=samples[index*hop+j];energy+=v*v;if(j<hop)local+=v*v;r[j]=v*window[j];im[j]=0}
  if(energy/N<1e-6||local/hop<1e-6){frames.push(Array(maxVoices).fill(null));previous=Array(maxVoices).fill(null);continue}
  fft(r,im);let max=0;
  for(let j=0;j<mag.length;j++){const v=Math.hypot(r[j],im[j]);mag[j]=v;max=Math.max(max,v)}
  const scored=[];
  for(const {pitch,f} of pitchTable){if(f>=sampleRate/2/3)continue;
   let score=0;for(let h=1;h<=4;h++){const b=f*h/freqPerBin;if(b>=mag.length-2)break;const x=Math.round(b);score+=Math.max(mag[Math.max(1,x-1)],mag[x],mag[x+1])/h}
   // A fundamental must carry noticeable energy; harmonic-only phantom pitches are reduced.
   const fbin=Math.round(f/freqPerBin);
   if(mag[fbin]<max*.055)score*=.35;
   scored.push({pitch,f,score});
  }
  scored.sort((a,b)=>b.score-a.score);
  let strongest=scored[0];
  if(strongest?.pitch<=53){
   if(index%3===0 || !bassEstimate)bassEstimate=yinBass(samples,index*hop,sampleRate);
   const match=scored.find(x=>x.pitch===bassEstimate?.pitch);
   if(match && bassEstimate.confidence>.85 && match.score>strongest.score*.25)strongest=match;
  }else bassEstimate=null;
  if(!strongest||strongest.score<max*.30){frames.push(Array(maxVoices).fill(null));previous=Array(maxVoices).fill(null);continue}
  const first={pitch:strongest.pitch,velocity:Math.round(Math.max(55,Math.min(112,80+20*Math.log10(Math.max(.01,max/80))))) };
  // Candidate additional voices must have independent spectral fundamentals.
  // Eight candidate lanes are available; thresholds reject harmonic ghosts.
  const selected=[strongest];
  const bassSolo=!!(bassEstimate && bassEstimate.confidence>.96 && strongest.pitch===bassEstimate.pitch);
  for(const s of scored){
   if(bassSolo || selected.length>=maxVoices)break;
   if(s.pitch===strongest.pitch || s.score<strongest.score*.17)continue;
   const bin=Math.max(2,Math.round(s.f/freqPerBin));
   const fundamental=Math.max(mag[bin-1],mag[bin],mag[bin+1]);
   if(fundamental<max*.12)continue;
   if(selected.some(p=>Math.abs(p.pitch-s.pitch)<3))continue;
   // Exclude weak higher harmonics of selected lower notes, but retain
   // genuine stronger melodic overtones with substantial fundamentals.
   if(selected.some(p=>{const ratio=s.f/p.f, harmonic=Math.round(ratio);
     return harmonic>=2&&harmonic<=5&&Math.abs(ratio-harmonic)<.04;
   }))continue;
   selected.push(s);
  }
  // Keep voice identities stable instead of re-labelling score ranks every
  // frame; swapping score order mid-phrase used to create phantom note-ons.
  const placed=Array(maxVoices).fill(null),unused=selected.slice();
  for(let ch=0;ch<maxVoices;ch++){
   if(previous[ch]===null)continue;
   const ix=unused.findIndex(candidate=>candidate.pitch===previous[ch]);
   if(ix>=0)placed[ch]=unused.splice(ix,1)[0];
  }
  for(const candidate of unused){const free=placed.findIndex(x=>x===null);if(free>=0)placed[free]=candidate}
  previous=placed.map(p=>p?.pitch??null);
  frames.push(placed.map((s,i)=>s?{pitch:s.pitch,velocity:Math.max(42,Math.round(first.velocity*Math.pow(.85,i)))}:null));
  if(index%180===0)onProgress?.(index/count);
 }
 return {frames,hopSeconds:hop/sampleRate};
}
async function runSpectrum(mono,rate,{signal,onProgress,maxSeconds=360,mode='melody-chords'}={}){
 if(typeof Worker==='undefined'){
  if(mono.length>rate*15)throw Error('Background transcription is required for recordings longer than 15 seconds in this browser');
  return spectralFrames(mono,rate,{signal,maxSeconds,onProgress,mode});
 }
 let worker;
 try{worker=new Worker('sseq_transcribe_worker.js');}catch(e){
  if(mono.length>rate*15)throw Error('Could not start background transcription for this recording');
  return spectralFrames(mono,rate,{signal,maxSeconds,onProgress,mode});
 }
 return await new Promise((resolve,reject)=>{
  let done=false;const finish=(error,result)=>{
   if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',onAbort);worker.terminate();
   error?reject(error):resolve(result);
  };
  const onAbort=()=>finish(Error('Conversion canceled'));
  const timer=setTimeout(()=>finish(Error('Transcription worker exceeded 180 seconds')),180000);
  if(signal?.aborted)return finish(Error('Conversion canceled'));
  signal?.addEventListener('abort',onAbort,{once:true});
  worker.onmessage=e=>{
   if(Number.isFinite(e.data?.progress)){onProgress?.(e.data.progress);return;}
   if(e.data?.error)finish(Error(e.data.error));else if(e.data?.result)finish(null,e.data.result);
  };
  worker.onerror=e=>finish(Error('Transcription worker failed: '+(e.message||'unknown')));
  worker.postMessage({mono:mono.buffer,rate,mode},[mono.buffer]);
 });
}
async function transcribeAudio(file,{signal,onProgress,maxDuration=360,audioMode='melody-chords'}={}){
 if(Number(file?.size)>MAX_SOURCE_BYTES)throw Error('Recording exceeds the 128 MiB browser decoding limit');
 if(typeof AudioContext==='undefined'&&typeof webkitAudioContext==='undefined')throw Error('Audio decoding is not available in this browser');
 const Audio=window.AudioContext||window.webkitAudioContext;
 const ctx=new Audio();let decoded;
 // AudioContext.decodeAudioData is not cancellable itself. Race its Promise with
 // abort and a bounded timeout so the UI does not wait forever on a hung decoder.
 const guarded=(work,ms)=>new Promise((resolve,reject)=>{
  let settled=false;const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);
   signal?.removeEventListener('abort',onAbort);error?reject(error):resolve(value)};
  const onAbort=()=>done(Error('Conversion canceled'));
  const timer=setTimeout(()=>done(Error('Audio decoding timed out; the browser may have stalled')),ms);
  if(signal?.aborted){done(Error('Conversion canceled'));return;}
  signal?.addEventListener('abort',onAbort,{once:true});
  Promise.resolve().then(work).then(value=>done(null,value),error=>done(error));
 });
 try{
  onProgress?.('Decoding source audio',.05);
  const buffer=await guarded(()=>file.arrayBuffer(),30000);
  decoded=await guarded(()=>ctx.decodeAudioData(buffer),file.size>12*1024*1024?180000:90000);
  if(signal?.aborted)throw Error('Conversion canceled');
 }catch(e){if(signal?.aborted)throw Error('Conversion canceled');throw Error('Could not decode audio source: '+e.message)}
 finally{void ctx.close().catch(()=>{})}
 if(decoded.duration<.15||!Number.isFinite(decoded.duration)||decoded.duration>maxDuration)throw Error('Audio must be 0.15–'+maxDuration+' seconds long for this offline converter');
 const channels=decoded.numberOfChannels,sr=decoded.sampleRate,target=11025,len=Math.floor(decoded.duration*target),mono=new Float32Array(len);
 // Chunking prevents long resampling loops from blocking click handlers,
 // timers and cancel. A cancelled resample exits before creating a SSEQ file.
 const sourceChannels=Array.from({length:Math.min(channels,2)},(_,c)=>decoded.getChannelData(c));
 const channelWeight=1/sourceChannels.length;
 for(let i=0;i<len;i++){
  if(i%8192===0){
   if(signal?.aborted)throw Error('Conversion canceled');
   if(i){onProgress?.('Preparing audio for note analysis',.07+.07*i/Math.max(1,len));
    await new Promise(resolve=>setTimeout(resolve,0));}
  }
  const idx=i*sr/target,base=Math.floor(idx),f=idx-base;
  for(const ch of sourceChannels)mono[i]+=((ch[base]||0)*(1-f)+(ch[base+1]||0)*f)*channelWeight;
 }
 if(signal?.aborted)throw Error('Conversion canceled');
 onProgress?.('Extracting note candidates',.15);
 const data=await runSpectrum(mono,target,{maxSeconds:maxDuration,signal,mode:audioMode,onProgress:f=>onProgress?.('Transcribing melody and timing',.15+.74*f)});
 let notes=smooth(data.frames,data.hopSeconds);
 // Exclude extremely short isolated fragments, quantize from real seconds into 48 PPQN @120 bpm.
 notes=notes.filter(n=>n.duration>.11&&n.pitch>=35&&n.pitch<=92).map(n=>({...n,startTick:Math.max(0,Math.round(n.start*96)),durationTick:Math.max(1,Math.round(n.duration*96))}));
 const unique=[...new Set(notes.map(n=>n.pitch))];
 if(notes.length<1)throw Error('No audible note detected; try a clearer recording or MIDI');
 const voices=[];
 for(let c=0;c<(data.frames[0]?.length||1);c++){
  const seq=notes.filter(n=>n.channel===c).sort((a,b)=>a.startTick-b.startTick);
  if(!seq.length)continue;
  // Quantization can merge adjacent notes at identical ticks; choose the strongest.
  const noCollisions=[];for(const n of seq){if(noCollisions.at(-1)?.start===n.startTick){if(n.velocity>noCollisions.at(-1).velocity)noCollisions.pop();else continue}
   noCollisions.push({start:n.startTick,duration:n.durationTick,pitch:n.pitch,velocity:n.velocity});}
  voices.push(noCollisions);
 }
 if(!voices.length)throw Error('Transcription produced no valid notes');
 onProgress?.('Building SSEQ',.96);
 return {voices,tempo:120,sourceDuration:decoded.duration,method:'melody-first harmonic-filtered spectrum estimate (not reliable for dense mixes)',noteCount:voices.reduce((n,v)=>n+v.length,0)};
}
function midiVLQ(bytes,state,limit=bytes.length){let n=0,k=0;while(k++<4){if(state.i>=limit)throw Error('Truncated MIDI');const x=bytes[state.i++];n=(n<<7)|(x&127);if(!(x&128))return n}throw Error('Invalid MIDI varint')}
// Parse SMF 0/1 with a song-wide tempo map. MIDI channel/program values are
// retained as source metadata; they are NOT HeartGold SBNK program numbers.
function readMidi(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const tag=pos=>String.fromCharCode(...b.subarray(pos,pos+4));
 if(b.length<14||tag(0)!=='MThd'||view.getUint32(4)!==6)throw Error('Invalid MIDI header');
 const format=view.getUint16(8),nTracks=view.getUint16(10),division=view.getUint16(12);
 if(format>1||nTracks>64||nTracks<1||division<12||(division&0x8000))throw Error('Unsupported MIDI timing or number of tracks');
 let pos=14;const tempoEvents=[{tick:0,us:500000,track:-1,order:-1}],events=[];
 for(let t=0;t<nTracks;t++){
  if(pos+8>b.length||tag(pos)!=='MTrk')throw Error('Invalid MIDI track');
  const limit=pos+8+view.getUint32(pos+4);if(limit>b.length)throw Error('Truncated MIDI track');
  const s={i:pos+8};let tick=0,status=0,order=0;
  while(s.i<limit){tick+=midiVLQ(b,s,limit);if(s.i>=limit)throw Error('Truncated MIDI event');let code=b[s.i++];
   if(code<128){if(!status)throw Error('Invalid MIDI running status');s.i--;code=status}
   else if(code<240)status=code;else status=0;
   if(code===0xff){if(s.i>=limit)throw Error('Broken MIDI meta event');const kind=b[s.i++],length=midiVLQ(b,s,limit);if(s.i+length>limit)throw Error('Truncated MIDI meta');
    if(kind===0x51&&length===3){const us=(b[s.i]<<16)|(b[s.i+1]<<8)|b[s.i+2];if(us<1000||us>60000000)throw Error('Invalid MIDI tempo');tempoEvents.push({tick,us,track:t,order:order++})}
    s.i+=length;continue;
   }
   if(code===0xf0||code===0xf7){const length=midiVLQ(b,s,limit);if(s.i+length>limit)throw Error('Truncated MIDI SysEx');s.i+=length;continue;}
   const type=code&0xf0,ch=code&0xf,amount=type===0xc0||type===0xd0?1:2;
   if(code>=240||s.i+amount>limit)throw Error('Unsupported or truncated MIDI event');
   const note=b[s.i++],value=amount===2?b[s.i++]:0;
   if(note>127||value>127)throw Error('Invalid MIDI data byte');
   events.push({tick,type,ch,note,value,track:t,order:order++});
  }
  pos=limit;
 }
 tempoEvents.sort((a,b)=>a.tick-b.tick||a.track-b.track||a.order-b.order);
 const map=[];let seconds=0,prevTick=0,us=500000;
 for(const event of tempoEvents){seconds+=(event.tick-prevTick)*us/(division*1000000);prevTick=event.tick;us=event.us;
  if(map.length&&map.at(-1).tick===event.tick)map[map.length-1]={tick:event.tick,seconds,us};
  else map.push({tick:event.tick,seconds,us});
 }
 const toSeconds=tick=>{let lo=0,hi=map.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(map[mid].tick<=tick)lo=mid;else hi=mid-1}
  const e=map[lo];return e.seconds+(tick-e.tick)*e.us/(division*1000000)};
 // Channels are global inside a MIDI file; note ordering is stable for simultaneous events.
 events.sort((a,b)=>a.tick-b.tick||a.track-b.track||a.order-b.order);
 const programs=Array(16).fill(0),active=new Map(),notes=[];
 for(const event of events){const {type,ch,note,value,tick,track}=event;
  if(type===0xc0){programs[ch]=note;continue}
  const key=ch+':'+note;
  if(type===0x90&&value>0){if(!active.has(key))active.set(key,[]);active.get(key).push({tick,velocity:value,program:programs[ch],track,ch});continue}
  if(type===0x80||(type===0x90&&value===0)){
   const stack=active.get(key),on=stack?.shift();if(!stack?.length)active.delete(key);
   if(!on||tick<=on.tick)continue;
   const startSeconds=toSeconds(on.tick),endSeconds=toSeconds(tick);
   notes.push({pitch:note,velocity:on.velocity,program:on.program,channel:on.ch,sourceTrack:on.track,
    startSeconds,endSeconds,start:Math.max(0,Math.round(startSeconds*96)),duration:Math.max(1,Math.round(endSeconds*96)-Math.round(startSeconds*96))});
  }
 }
 if(!notes.length)throw Error('MIDI contains no complete note-on/off pairs');
 // A single source lane is one MIDI track + channel + source program. Program
 // changes stay attributable to individual notes when explicit overrides are used.
 const lanes=new Map();for(const n of notes){const k=n.sourceTrack+':'+n.channel+':'+n.program;
  if(!lanes.has(k))lanes.set(k,[]);lanes.get(k).push(n)}
 const voices=[...lanes.values()].map(v=>v.sort((a,b)=>a.start-b.start||a.pitch-b.pitch));
 return {voices,tempo:120,sourcePpq:division,sourceFormat:format,tempoMap:map,ppq:division,tempoEvents:map,allNotes:notes.map(n=>({...n,startTick:n.start,durationTick:n.duration})),durationSeconds:Math.max(...notes.map(n=>n.endSeconds)),
  method:'MIDI note events with tempo map',noteCount:notes.length,
  sourceDuration:Math.max(...notes.map(n=>n.endSeconds))};
}
function compatiblePrograms(context,notes){return context.bank.programs.map(p=>p.index).filter(index=>notes.every(n=>{
 try{window.SigmaSSEQ.validProgram(context,index,n.pitch);return true}catch{return false}}));}
function assignProgram(context,notes,preferred,locked=false,description='voice'){
 const compatible=compatiblePrograms(context,notes);
 if(!compatible.length)throw Error('No playable HeartGold program in bank '+context.bankId+' for '+description+' (check pitch coverage)');
 if(preferred===null||preferred===undefined||preferred===''||preferred==='auto')return {selected:compatible[0],compatible};
 const n=Number(preferred);if(!Number.isInteger(n))throw Error('Invalid instrument for '+description);
 if(locked&&!compatible.includes(n)){
  const bad=notes.find(note=>{try{window.SigmaSSEQ.validProgram(context,n,note.pitch);return false}catch{return true}});
  throw Error(description+': program '+n+' cannot play MIDI pitch '+bad?.pitch+'. Compatible HeartGold programs: '+compatible.join(', '));
 }
 return {selected:compatible.includes(n)?n:compatible[0],compatible};
}
function packTracks(modelVoices,context,{preferred=null,locked=false,perVoicePrograms=[],voiceLabels=[]}={}){
 const tracks=new Map(),substitutions=[];
 modelVoices.forEach((voice,i)=>{
  if(!voice.length)return;
  const notes=voice.map(n=>({start:n.startTick??n.start,duration:n.durationTick??n.duration,pitch:n.pitch,velocity:n.velocity}));
  const selection=perVoicePrograms[i]??(i===0?preferred:null);
  const resolved=assignProgram(context,notes,selection,locked&&selection!==null,voiceLabels[i]||('voice '+(i+1)));
  if(selection!==null&&selection!==undefined&&selection!=='auto'&&Number(selection)!==resolved.selected)
   substitutions.push({voice:i+1,requested:Number(selection),selected:resolved.selected});
  if(!tracks.has(resolved.selected))tracks.set(resolved.selected,[]);
  tracks.get(resolved.selected).push(...notes);
 });
 if(tracks.size>16)throw Error('The arrangement requires '+tracks.size+' different programs; SSEQ supports at most 16 independent tracks');
 return {tracks:[...tracks].map(([program,notes])=>({program,notes:notes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch)})),programSubstitutions:substitutions};
}
async function combineMidiFiles(files,{profiles,slot,programPerFile=[],trackOverrides={},fileSettings=[],programs,trackPrograms,loop=true,signal,onProgress}={}){
 if(programs!==undefined)programPerFile=programs;
 if(trackPrograms!==undefined)trackOverrides=trackPrograms;
 if(!Array.isArray(files)||!files.length||files.length>5)throw Error('Choose between one and five MIDI files');
 const S=window.SigmaSSEQ,context=S.profileSlot(profiles,slot),voices=[],labels=[],perVoicePrograms=[];
 const hasSolo=fileSettings.some(x=>x?.solo);
 for(let i=0;i<files.length;i++){
  if(signal?.aborted)throw Error('Conversion canceled');const file=files[i];
  if(!/\.midi?$/i.test(file.name))throw Error('MIDI files only: expected .mid or .midi: '+file.name);
  if(file.size>4*1024*1024)throw Error('MIDI file exceeds 4 MiB: '+file.name);
  const settings=fileSettings[i]||{};
  if(settings.mute||(hasSolo&&!settings.solo))continue;
  const offset=Number(settings.offsetSeconds??0),volume=Number(settings.velocityPercent??100);
  if(!Number.isFinite(offset)||offset<0||offset>3600||!Number.isFinite(volume)||volume<1||volume>200)
   throw Error('Invalid file offset or velocity for '+file.name);
  const offsetTick=Math.round(offset*96);
  const model=readMidi(new Uint8Array(await file.arrayBuffer()));
  for(const originalVoice of model.voices){
   const voice=originalVoice.map(n=>({...n,start:n.start+offsetTick,
    velocity:Math.max(1,Math.min(127,Math.round(n.velocity*volume/100)))}));
   const lane=voice[0],label=file.name+' / track '+(lane.sourceTrack+1)+' / channel '+(lane.channel+1);
   const key=i+':'+lane.sourceTrack+':'+lane.channel;
   perVoicePrograms.push(Object.prototype.hasOwnProperty.call(trackOverrides,key)?trackOverrides[key]:(programPerFile[i]??null));
   labels.push(label);voices.push(voice);
  }
  onProgress?.('Reading MIDI '+(i+1)+'/'+files.length,.05+.35*(i+1)/files.length);
 }
 const plan=packTracks(voices,context,{perVoicePrograms,voiceLabels:labels,locked:true});
 const bytes=S.build({tracks:plan.tracks,slot,profiles,tempo:120,loop,limit:65536});
 const parsed=S.parse(bytes,{slot,profiles});
 if(parsed.notes.length!==voices.flat().length)throw Error('MIDI notes changed during SSEQ packaging');
 onProgress?.('Validated combined SSEQ',1);
 return {fileCount:files.length,bytes,parsed,method:'Combined '+files.length+' MIDI files (absolute-time synchronized)',sourceDuration:parsed.durationTicks/96,
  noteCount:parsed.notes.length,programSubstitutions:plan.programSubstitutions};
}
async function convertFile(file,{profiles,slot,program=null,loop=true,signal,onProgress,audioMode='melody-chords'}={}){
 const S=window.SigmaSSEQ;if(!S)throw Error('SSEQ codec unavailable');const context=S.profileSlot(profiles,slot);
 const extension=file.name.split('.').pop().toLowerCase();
 if(extension==='sseq'){
  if(Number(file.size)>65536)throw Error('SSEQ exceeds the 64 KiB target budget');
  const content=new Uint8Array(await file.arrayBuffer());const parsed=S.parse(content,{profiles,slot});onProgress?.('Validated existing SSEQ',1);
  return {bytes:content,parsed,method:'validated existing SSEQ (original bytes preserved)',sourceDuration:parsed.durationTicks*60/(48*parsed.tempo)};
 }
 let model;
 if(extension==='mid'||extension==='midi'){
  if(Number(file.size)>4*1024*1024)throw Error('MIDI source exceeds the 4 MiB parsing limit');
  model=readMidi(new Uint8Array(await file.arrayBuffer()));
 }
 else if(['mp3','wav','flac','ogg','opus','m4a','aac'].includes(extension))model=await transcribeAudio(file,{signal,onProgress,audioMode});
 else throw Error('Unsupported input: '+extension);
 const plan=packTracks(model.voices,context,{preferred:program,locked:false});
 const tracks=plan.tracks,programSubstitutions=plan.programSubstitutions;
 const output=S.build({tracks,slot,profiles,tempo:model.tempo,loop:!!loop,limit:65536});
 const parsed=S.parse(output,{profiles,slot});
 // Listening-only separate parts. Neither part is uploaded or exported unless
 // the user explicitly submits a new arrangement.
 const parts={};
 if(!['mid','midi'].includes(extension)&&model.voices.length>1){
  for(const [kind,subset] of [['melody',model.voices.slice(0,1)],['accompaniment',model.voices.slice(1)]]){
   const plan=packTracks(subset,context,{preferred:program});
   if(plan.tracks.length)parts[kind]=S.build({tracks:plan.tracks,slot,profiles,tempo:model.tempo,loop:false,limit:65536});
  }
 }
 onProgress?.('Validated SSEQ result',1);
 return {bytes:output,parsed,parts,method:model.method,sourceDuration:model.sourceDuration,notes:model.noteCount,programSubstitutions};
}
return {convertFile,combineMidiFiles,transcribeAudio,readMidi,fft,spectralFrames,smooth,yinBass,packTracks,bankCandidates:compatiblePrograms};
});
