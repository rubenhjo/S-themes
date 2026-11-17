/* Web Audio preview of STORED Nitro SSEQ note events. It never substitutes
 * source MP3/WAV audio or embeds copyrighted HeartGold samples. Its oscillator
 * timbres and listening-level controls are APPROXIMATIONS, not game playback
 * or calibrated -14 LUFS normalization.
 */
(function(root){
'use strict';
class SseqAudio{
 constructor(){
  this._src='';this._time=0;this._duration=0;this._playing=false;
  this._audioCtx=null;this._bus=null;this._limiter=null;this._nodes=new Set();
  this._timer=null;this._anchor=0;this._ready=null;this._ctl=null;
  this._volume=.8;this._muted=false;this._normalized=true;this._target=-14;
  this._generation=0;this._model=null;this._notes=[];this._cursor=0;
  this._resumeTask=null;this._activationBlocked=false;this._recoverTask=null;
  this.onplay=null;this.onpause=null;this.onended=null;
  this.onloadedmetadata=null;this.ontimeupdate=null;this.onerror=null;
  this.slot=null;this.preload='none';
 }
 get isSigmaSseq(){return true}
 get src(){return this._src}
 get currentSrc(){return this._src}
 set src(value){
  this.pause();this._ctl?.abort();this._src=String(value||'');this._ready=null;
  this._model=null;this._duration=0;this._time=0;
 }
 removeAttribute(attr){if(attr==='src')this.src=''}
 get duration(){return this._duration}
 get currentTime(){return this._playing?Math.min(this._duration,Math.max(0,this._audioCtx.currentTime-this._anchor)):this._time}
 set currentTime(value){
  const sec=Number(value);if(!Number.isFinite(sec))return;
  const wasPlaying=this._playing;this.pause();
  this._time=Math.max(0,Math.min(this._duration||0,sec));this.ontimeupdate?.();
  if(wasPlaying)void this.play().catch(e=>this.onerror?.(e));
 }
 get paused(){return !this._playing}
 set volume(value){const n=Number(value);this._volume=Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;this._gain()}
 get volume(){return this._volume}
 set muted(value){this._muted=!!value;this._gain()}
 get muted(){return this._muted}
 setSoundMode(enabled,target=-14){
  this._normalized=!!enabled;
  const val=Number(target);this._target=[-19,-14,-11].includes(val)?val:-14;
  this._gain();
 }
 // This is a *relative SSEQ synth listening level* rather than real LUFS
 // normalization. An AudioContext compressor limits summed oscillator peaks.
 _gain(){
  if(!this._bus||!this._audioCtx)return;
  const relative=this._normalized?Math.pow(10,(this._target+14)/20):1;
  const value=this._muted?0:Math.min(.24,this._volume*.19*relative);
  this._bus.gain.setTargetAtTime(value,this._audioCtx.currentTime,.035);
 }
 // On iOS a user tap must unlock Web Audio BEFORE the first network await.
 // Safari's audioSession playback category also lets music use the normal
 // media route (instead of treating the synthesizer as a silent-mode effect).
 _initAudioContext(){
  if(this._audioCtx && this._audioCtx.state!=='closed')return this._audioCtx;
  const Audio=root.AudioContext||root.webkitAudioContext;
  if(!Audio)throw Error('Web Audio is unavailable in this browser');
  this._audioCtx=new Audio();this._bus=this._audioCtx.createGain();
  this._limiter=this._audioCtx.createDynamicsCompressor();
  this._limiter.threshold.value=-3;this._limiter.knee.value=0;
  this._limiter.ratio.value=20;this._limiter.attack.value=.003;this._limiter.release.value=.12;
  this._bus.connect(this._limiter).connect(this._audioCtx.destination);
  this._gain();
  return this._audioCtx;
 }
 primeFromGesture(){
  // Never call await or fetch before this method from a play-button handler.
  try{
   const session=root.navigator?.audioSession;
   if(session && 'type' in session)session.type='playback';
  }catch{} // Audio Session API is optional; normal Web Audio still works.
  if(this._activationBlocked&&this._audioCtx?.state!=='running'){
   const old=this._audioCtx;
   this._audioCtx=null;this._bus=null;this._limiter=null;
   this._resumeTask=null;this._activationBlocked=false;
   try{Promise.resolve(old?.close()).catch(()=>{})}catch{}
  }
  const context=this._initAudioContext();
  if(context.state!=='running'){
   try{this._resumeTask=Promise.resolve(context.resume());this._resumeTask.catch(()=>{})}
   catch(error){this._resumeTask=Promise.reject(error);this._resumeTask.catch(()=>{})}
  }
  // The tiny silent buffer is intentionally started inside the gesture.
  // It is not a substitute for the saved SSEQ and emits no audible sound.
  try{
   if(context.createBufferSource&&context.createBuffer){
    const silent=context.createBufferSource();
    silent.buffer=context.createBuffer(1,1,context.sampleRate);
    silent.connect(context.destination);silent.start(0);
   }
  }catch{}
 }
 async _waitForAudio(){
  const context=this._audioCtx;
  if(!context)throw Error('Web Audio was not initialized');
  if(context.state==='running')return;
  const request=this._resumeTask||Promise.resolve().then(()=>context.resume());
  try{
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('iPhone audio activation timed out')),3000);
    Promise.resolve(request).then(()=>{clearTimeout(timer);resolve()},e=>{clearTimeout(timer);reject(e)});
   });
  }catch(error){
   this._activationBlocked=true;
   throw Error('Audio was blocked or interrupted. Tap Play again in Safari. ('+error.message+')');
  }
  if(context.state!=='running'){
   this._activationBlocked=true;
   throw Error('Audio is '+context.state+'. Tap Play again to unlock iPhone audio.');
  }
  this._activationBlocked=false;
 }
 async recoverIfInterrupted(){
  if(!this._playing||!this._audioCtx||this._audioCtx.state==='running')return;
  if(this._recoverTask)return this._recoverTask;
  const context=this._audioCtx;
  this._recoverTask=(async()=>{
   try{
    this._resumeTask=Promise.resolve(context.resume());
    await this._waitForAudio();
   }catch(error){
    if(this._audioCtx===context&&this._playing){
     this.pause();
     this.onerror?.(Error('iPhone paused the audio session. Tap Play to resume.'));
    }
   }
  })().finally(()=>{this._recoverTask=null});
  return this._recoverTask;
 }
 async load(){return this._ensure()}
 async _ensure(){
  if(this._ready)return this._ready;
  if(!this._src)throw Error('No SSEQ song selected');
  const controller=new AbortController();this._ctl=controller;const src=this._src;
  this._ready=(async()=>{
   const r=await fetch(src,{signal:controller.signal});
   if(!r.ok)throw Error('SSEQ unavailable (HTTP '+r.status+')');
   const data=new Uint8Array(await r.arrayBuffer());
   if(controller.signal.aborted||src!==this._src)throw Error('Loading stopped');
   const parsed=root.SigmaSSEQ.parse(data,{profiles:root.SigmaBankProfiles,slot:this.slot});
   if(controller.signal.aborted||src!==this._src)throw Error('Loading stopped');
   this._model=parsed;this._duration=parsed.durationTicks*60/(parsed.tempo*48);
   this.onloadedmetadata?.();return parsed;
  })().catch(e=>{
   if(src===this._src){this._ready=null;if(!controller.signal.aborted)this.onerror?.(e)}
   throw e;
  });return this._ready;
 }
 async play({primed=false}={}){
  if(this._playing)return;
  // Invalidate pending play() calls when pause(), src= or dispose() happens.
  // A previously blocked fetch/resume must never restart after user pause.
  const generation=++this._generation;
  if(!primed)this.primeFromGesture(); // Direct Play taps unlock synchronously.
  const model=await this._ensure();
  if(generation!==this._generation||!this._src)return;
  await this._waitForAudio();
  if(generation!==this._generation||!this._src)return;
  this._anchor=this._audioCtx.currentTime-this._time;this._playing=true;
  this._notes=model.notes.map(n=>({...n,seconds:n.start*60/(model.tempo*48),length:n.duration*60/(model.tempo*48)}))
    .sort((a,b)=>a.seconds-b.seconds);
  this._cursor=0;
  while(this._cursor<this._notes.length&&this._notes[this._cursor].seconds+this._notes[this._cursor].length<this._time)this._cursor++;
  this._timer=setInterval(()=>this._tick(),40);this.onplay?.();this._tick();
 }
 // Render a validated SSEQ program using the selected slot's original SBNK/SWAR
 // data when privately imported. No Nintendo samples are packaged or uploaded.
 _scheduleNote(n,begin,until){
  const ctx=this._audioCtx,profiles=root.SigmaBankProfiles;
  let bankId=null,original=null,program=null;
  try{
   if(profiles&&Number.isInteger(Number(this.slot))&&this.slot!==null){
    const slot=root.SigmaSSEQ.profileSlot(profiles,Number(this.slot));
    bankId=slot.bankId;
    program=slot.bank.programs.find(p=>p.index===n.program);
    original=root.SigmaHeartGoldSources?.originalWave(bankId,n.program,n.pitch,profiles)||null;
   }
  }catch(error){console.warn('Original HeartGold preview unavailable:',error)}
  const gain=ctx.createGain(),velocity=Math.max(.05,Math.min(1,n.velocity/127));
  const span=Math.max(.016,until-begin);
  if(original&&typeof root.SigmaHeartGoldSources?.schedulePcm==='function'){
   const voice=root.SigmaHeartGoldSources.schedulePcm(ctx,this._bus,original,{note:n.pitch,start:begin,end:until,velocity:n.velocity});
   const node=voice.node;this._nodes.add(node);
   node.onended=()=>{this._nodes.delete(node);try{node.disconnect();voice.pan?.disconnect();voice.gain.disconnect()}catch{}};
   return {original:true,bankId,program:n.program,loop:voice.loop};
  }
  if(original){
   const {wave,definition}=original;
   const buffer=ctx.createBuffer(1,wave.samples.length,wave.rate);
   buffer.copyToChannel(wave.samples,0);
   const node=ctx.createBufferSource();node.buffer=buffer;
   node.playbackRate.value=Math.pow(2,(n.pitch-definition.baseNote)/12);
   if(wave.loop&&wave.loopWords>0){
    const byteOffset=wave.loopWords*4;
    const sampleOffset=wave.type===0?byteOffset:wave.type===1?byteOffset/2:Math.max(1,1+(byteOffset-4)*2);
    if(sampleOffset>0&&sampleOffset<wave.samples.length-1){
     node.loop=true;node.loopStart=sampleOffset/wave.rate;
     node.loopEnd=wave.samples.length/wave.rate;
    }
   }
   // Nitro ADSR bytes are encoded coefficients, not milliseconds. Browser
   // preview uses a conservative approximation; SSEQ export never modifies them.
   const attack=.006+.055*(127-definition.attack)/127;
   const release=Math.min(.16,Math.max(.012,.11*(127-definition.release)/127));
   const sustain=Math.max(.03,Math.min(.8,definition.sustain/127));
   gain.gain.setValueAtTime(0,begin);
   gain.gain.linearRampToValueAtTime(.43*velocity,Math.min(until,begin+attack));
   gain.gain.setValueAtTime(.43*velocity*sustain,Math.max(begin+attack,until-release));
   gain.gain.linearRampToValueAtTime(0,until);
   const pan=ctx.createStereoPanner?.();
   if(pan){pan.pan.value=Math.max(-1,Math.min(1,(definition.pan-64)/63));node.connect(pan).connect(gain)}
   else node.connect(gain);
   gain.connect(this._bus);
   this._nodes.add(node);
   node.onended=()=>{this._nodes.delete(node);try{node.disconnect();pan?.disconnect();gain.disconnect()}catch{}};
   node.start(begin);node.stop(until+.002);
   return {original:true,bankId,program:n.program,loop:!!node.loop};
  }
  const osc=ctx.createOscillator();
  const kind=program?.kind;
  // Explicit SBNK instrument kind, NOT the program index modulo three.
  osc.type=kind===2?'square':kind===3?'sawtooth':kind===17?'triangle':'sine';
  osc.frequency.value=440*Math.pow(2,(n.pitch-69)/12);
  gain.gain.setValueAtTime(0,begin);
  gain.gain.linearRampToValueAtTime(.52*velocity,Math.min(until,begin+.008));
  gain.gain.setValueAtTime(.52*velocity,Math.max(begin+.009,until-.035));
  gain.gain.linearRampToValueAtTime(0,until);
  osc.connect(gain).connect(this._bus);this._nodes.add(osc);
  osc.onended=()=>{this._nodes.delete(osc);try{osc.disconnect();gain.disconnect()}catch{}};
  osc.start(begin);osc.stop(until+.002);
  return {original:false,bankId,program:n.program,loop:false};
 }
 _tick(){
  if(!this._playing)return;
  const now=this.currentTime,context=this._audioCtx,through=now+.18;
  while(this._cursor<this._notes.length&&this._notes[this._cursor].seconds<through){
   const n=this._notes[this._cursor++];if(n.seconds+n.length<now)continue;
   const begin=Math.max(context.currentTime,this._anchor+n.seconds);
   const until=Math.max(begin+.016,this._anchor+n.seconds+n.length);
   this._scheduleNote(n,begin,until);

  }
  this.ontimeupdate?.();
  // currentTime is capped at duration, so comparing with duration + .04
  // made onended unreachable and prevented queue advance/repeat.
  if(now>=this._duration&&this._duration>0){this.pause();this._time=0;this.onended?.()}
 }
 pause(){
  ++this._generation;
  if(this._playing){
   this._time=this.currentTime;this._playing=false;
   clearInterval(this._timer);this._timer=null;
   for(const node of this._nodes){try{node.stop()}catch{}}
   this._nodes.clear();this.onpause?.();
  }
 }
 dispose(){
  this.pause();this._ctl?.abort();
  try{Promise.resolve(this._audioCtx?.close()).catch(()=>{})}catch{}
  this._src='';this._ready=null;this._model=null;this._audioCtx=null;this._bus=null;
  this._limiter=null;this._resumeTask=null;this._activationBlocked=false;
 }
}
root.SigmaSeqAudio=SseqAudio;
})(typeof window!=='undefined'?window:globalThis);
