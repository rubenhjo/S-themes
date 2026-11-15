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
function smooth(notes,stepSec,minLen=.11){
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
function spectralFrames(samples,sampleRate,{maxSeconds=360,onProgress,signal}={}){
 const N=2048,hop=256,freqPerBin=sampleRate/N,window=new Float32Array(N);
 for(let i=0;i<N;i++)window[i]=.5-.5*Math.cos(2*Math.PI*i/(N-1));
 const pitchTable=Array.from({length:58},(_,i)=>({pitch:i+35, f:midiToHz(i+35)}));
 const r=new Float32Array(N),im=new Float32Array(N),mag=new Float32Array(N/2),frames=[];
 const count=Math.max(0,Math.floor((Math.min(samples.length,maxSeconds*sampleRate)-N)/hop));
 for(let index=0;index<count;index++){
  if(signal?.aborted)throw Error('Conversion canceled');
  let energy=0;
  for(let j=0;j<N;j++){const v=samples[index*hop+j];energy+=v*v;r[j]=v*window[j];im[j]=0}
  if(energy/N<1e-6){frames.push([null,null]);continue}
  fft(r,im);let max=0;
  for(let j=0;j<mag.length;j++){const v=Math.hypot(r[j],im[j]);mag[j]=v;max=Math.max(max,v)}
  const scored=[];
  for(const {pitch,f} of pitchTable){if(f>=sampleRate/2/3)continue;
   let score=0;for(let h=1;h<=4;h++){const b=f*h/freqPerBin;if(b>=mag.length-2)break;const x=Math.round(b);score+=Math.max(mag[Math.max(1,x-1)],mag[x],mag[x+1])/(h*h)}
   // A fundamental must carry noticeable energy; harmonic-only phantom pitches are reduced.
   const fbin=Math.round(f/freqPerBin);
   if(mag[fbin]<max*.055)score*=.35;
   scored.push({pitch,f,score});
  }
  scored.sort((a,b)=>b.score-a.score);
  const strongest=scored[0];if(!strongest||strongest.score<max*.30){frames.push([null,null]);continue}
  const first={pitch:strongest.pitch,velocity:Math.round(Math.max(55,Math.min(112,80+20*Math.log10(Math.max(.01,max/80))))) };
  // Candidate additional voices: require a REAL spectral fundamental, not
  // just energy at a dominant note's overtones. This is still a heuristic
  // (not source separation) and intentionally tops out at four voices.
  const selected=[strongest];
  for(const s of scored){
   if(selected.length>=4)break;
   if(s.pitch===strongest.pitch || s.score<strongest.score*.17)continue;
   const bin=Math.max(2,Math.round(s.f/freqPerBin));
   const fundamental=Math.max(mag[bin-1],mag[bin],mag[bin+1]);
   if(fundamental<max*.12)continue;
   if(selected.some(p=>Math.abs(p.pitch-s.pitch)<3))continue;
   // Exclude weak higher harmonics of selected lower notes, but retain
   // genuine stronger melodic overtones with substantial fundamentals.
   if(selected.some(p=>{const ratio=s.f/p.f, harmonic=Math.round(ratio);
     return harmonic>=2&&harmonic<=5&&Math.abs(ratio-harmonic)<.04&&fundamental<max*.24;
   }))continue;
   selected.push(s);
  }
  frames.push([...selected.map((s,i)=>({pitch:s.pitch,velocity:Math.max(42,Math.round(first.velocity*Math.pow(.78,i)))})),
    ...Array.from({length:4-selected.length},()=>null)]);
  if(index%180===0)onProgress?.(index/count);
 }
 return {frames,hopSeconds:hop/sampleRate};
}
async function runSpectrum(mono,rate,{signal,onProgress,maxSeconds=360}={}){
 if(typeof Worker==='undefined'){
  if(mono.length>rate*15)throw Error('Background transcription is required for recordings longer than 15 seconds in this browser');
  return spectralFrames(mono,rate,{signal,maxSeconds,onProgress});
 }
 let worker;
 try{worker=new Worker('sseq_transcribe_worker.js');}catch(e){
  if(mono.length>rate*15)throw Error('Could not start background transcription for this recording');
  return spectralFrames(mono,rate,{signal,maxSeconds,onProgress});
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
  worker.postMessage({mono:mono.buffer,rate},[mono.buffer]);
 });
}
async function transcribeAudio(file,{signal,onProgress,maxDuration=360}={}){
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
 const data=await runSpectrum(mono,target,{maxSeconds:maxDuration,signal,onProgress:f=>onProgress?.('Transcribing melody and timing',.15+.74*f)});
 let notes=smooth(data.frames,data.hopSeconds);
 // Exclude extremely short isolated fragments, quantize from real seconds into 48 PPQN @120 bpm.
 notes=notes.filter(n=>n.duration>.11&&n.pitch>=35&&n.pitch<=92).map(n=>({...n,startTick:Math.max(0,Math.round(n.start*96)),durationTick:Math.max(1,Math.round(n.duration*96))}));
 const unique=[...new Set(notes.map(n=>n.pitch))];
 if(notes.length<2||unique.length<2)throw Error('No meaningful melody detected; upload a clearer recording, MIDI, or valid SSEQ');
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
 return {voices,tempo:120,sourceDuration:decoded.duration,method:'untrained spectral multivoice estimate (not reliable for dense mixes)',noteCount:voices.reduce((n,v)=>n+v.length,0)};
}
function midiVLQ(bytes,state){let n=0,k=0;while(k++<4){if(state.i>=bytes.length)throw Error('Truncated MIDI');const x=bytes[state.i++];n=(n<<7)|(x&127);if(!(x&128))return n}throw Error('Invalid MIDI varint')}
function readMidi(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const tag=(pos)=>String.fromCharCode(...b.subarray(pos,pos+4));
 if(b.length<14||tag(0)!=='MThd'||view.getUint32(4)!==6)throw Error('Invalid MIDI header');
 const format=view.getUint16(8),nTracks=view.getUint16(10),ppq=view.getUint16(12);
 if(format>1||nTracks>64||nTracks<1||ppq<12||(ppq&0x8000))throw Error('Unsupported MIDI timing or number of tracks');
 let pos=14,tempo=120;const voices=[];
 for(let t=0;t<nTracks;t++){
  if(pos+8>b.length||tag(pos)!=='MTrk')throw Error('Invalid MIDI track');const limit=pos+8+view.getUint32(pos+4);if(limit>b.length)throw Error('Truncated MIDI track');
  const s={i:pos+8},active=new Map(),notes=[],programs=Array(16).fill(0);let tick=0,status=0;
  while(s.i<limit){tick+=midiVLQ(b,s);if(s.i>=limit)break;let event=b[s.i++];if(event<128){if(!status)throw Error('Invalid MIDI running status');s.i--;event=status}else if(event<240)status=event;
   if(event===0xff){if(s.i>=limit)throw Error('Broken MIDI meta event');const kind=b[s.i++],length=midiVLQ(b,s);if(s.i+length>limit)throw Error('Truncated MIDI meta');if(kind===0x51&&length===3){const us=(b[s.i]<<16)|(b[s.i+1]<<8)|b[s.i+2];if(us)tempo=Math.max(30,Math.min(300,Math.round(60000000/us)));}s.i+=length;continue}
   if(event===0xf0||event===0xf7){const length=midiVLQ(b,s);s.i+=length;continue}
   const type=event&0xf0,channel=event&0xf,n=type===0xc0||type===0xd0?1:2;if(s.i+n>limit)throw Error('Truncated MIDI event');const a=b[s.i++],v=n===2?b[s.i++]:0;
   if(type===0xc0)programs[channel]=a;
   if(type===0x90&&v>0){active.set(channel+':'+a,{tick,velocity:v,program:programs[channel]});}
   if(type===0x80||(type===0x90&&v===0)){
    const key=channel+':'+a,on=active.get(key);if(on){const duration=tick-on.tick;if(duration>0)notes.push({start:Math.round(on.tick*48/ppq),duration:Math.max(1,Math.round(duration*48/ppq)),pitch:a,velocity:on.velocity,program:on.program});active.delete(key)}
   }
  }
  if(notes.length)voices.push(notes);pos=limit;
 }
 if(!voices.length)throw Error('MIDI contains no note events');
 return {voices,tempo,method:'MIDI note events',noteCount:voices.reduce((n,v)=>n+v.length,0)};
}
async function convertFile(file,{profiles,slot,program=null,loop=true,signal,onProgress}={}){
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
 else if(['mp3','wav','flac','ogg','opus','m4a','aac'].includes(extension))model=await transcribeAudio(file,{signal,onProgress});
 else throw Error('Unsupported input: '+extension);
 const programs=context.bank.programs.map(p=>p.index);
 const preferred=program===null?programs[0]:Number(program);
 S.validProgram(context,preferred);
 // Each voice is assigned an instrument that genuinely supports all of its note
 // pitches in the SBNK/SWAR assets for the selected HeartGold SDAT slot.
 // Selecting a program chooses the first/lead voice. Further voice timbres are
 // distinct compatible programs, not a claim of automatic source-instrument ID.
 const usedPrograms=new Set(),programSubstitutions=[];
 const tracks=model.voices.slice(0,8).map((voice,index)=>{
  const notes=voice.map(n=>({start:n.startTick??n.start,duration:n.durationTick??n.duration,pitch:n.pitch,velocity:n.velocity}));
  const candidates=[preferred,...programs.filter(p=>p!==preferred)].filter(p=>
   notes.every(n=>{try{S.validProgram(context,p,n.pitch);return true}catch{return false}}));
  if(!candidates.length)throw Error('No HeartGold instrument in this bank can play all notes in voice '+(index+1));
  // The selected lead program is a preference, not a reason to reject otherwise
  // playable music. A valid SBNK program must cover *every* note of this voice.
  // Previous code unconditionally kept `preferred` on voice 1, causing
  // SSEQ.build() to reject audio even when the bank had compatible programs.
  const selected=index===0 ? candidates[0] : (candidates.find(p=>!usedPrograms.has(p))??candidates[0]);
  if(index===0 && selected!==preferred)programSubstitutions.push({voice:1,requested:preferred,selected});
  usedPrograms.add(selected);
  return {program:selected,notes};
 });
 // Our sequencer writer handles one note onset per track. Split overlapping note onsets
 // into virtual tracks to preserve distinct voices when source permits.
 const expanded=[];
 for(const tr of tracks){for(const note of tr.notes){let target=expanded.find(t=>t.program===tr.program&&(t.notes.length===0||t.notes.at(-1).start<note.start));if(!target){target={program:tr.program,notes:[]};expanded.push(target)}target.notes.push(note)}}
 if(expanded.length>8)throw Error('Arrangement requires more than eight sequencer tracks; reduce source complexity');
 const output=S.build({tracks:expanded,slot,profiles,tempo:model.tempo,loop:!!loop,limit:65536});
 const parsed=S.parse(output,{profiles,slot});
 onProgress?.('Validated SSEQ result',1);
 return {bytes:output,parsed,method:model.method,sourceDuration:model.sourceDuration,notes:model.noteCount,programSubstitutions};
}
return {convertFile,transcribeAudio,readMidi,fft,spectralFrames,smooth};
});
