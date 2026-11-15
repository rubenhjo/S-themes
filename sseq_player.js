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
 async play(){
  if(this._playing)return;
  // Invalidate pending play() calls when pause(), src= or dispose() happens.
  // A previously blocked fetch/resume must never restart after user pause.
  const generation=++this._generation;
  const model=await this._ensure();
  if(generation!==this._generation||!this._src)return;
  if(!this._audioCtx){
   const Audio=root.AudioContext||root.webkitAudioContext;
   if(!Audio)throw Error('Web Audio unavailable');
   this._audioCtx=new Audio();this._bus=this._audioCtx.createGain();
   this._limiter=this._audioCtx.createDynamicsCompressor();
   this._limiter.threshold.value=-3;this._limiter.knee.value=0;
   this._limiter.ratio.value=20;this._limiter.attack.value=.003;this._limiter.release.value=.12;
   this._bus.connect(this._limiter).connect(this._audioCtx.destination);
   this._gain();
  }
  await this._audioCtx.resume();
  if(generation!==this._generation||!this._src)return;
  this._anchor=this._audioCtx.currentTime-this._time;this._playing=true;
  this._notes=model.notes.map(n=>({...n,seconds:n.start*60/(model.tempo*48),length:n.duration*60/(model.tempo*48)}))
    .sort((a,b)=>a.seconds-b.seconds);
  this._cursor=0;
  while(this._cursor<this._notes.length&&this._notes[this._cursor].seconds+this._notes[this._cursor].length<this._time)this._cursor++;
  this._timer=setInterval(()=>this._tick(),40);this.onplay?.();this._tick();
 }
 _tick(){
  if(!this._playing)return;
  const now=this.currentTime,context=this._audioCtx,through=now+.18;
  while(this._cursor<this._notes.length&&this._notes[this._cursor].seconds<through){
   const n=this._notes[this._cursor++];if(n.seconds+n.length<now)continue;
   const begin=Math.max(context.currentTime,this._anchor+n.seconds);
   const until=Math.max(begin+.016,this._anchor+n.seconds+n.length);
   const osc=context.createOscillator(),g=context.createGain();
   osc.type=n.program%3===0?'triangle':n.program%3===1?'sine':'sawtooth';
   osc.frequency.value=440*Math.pow(2,(n.pitch-69)/12);
   const vel=Math.max(.05,Math.min(1,n.velocity/127));
   g.gain.setValueAtTime(0,begin);g.gain.linearRampToValueAtTime(.52*vel,begin+.008);
   g.gain.setValueAtTime(.52*vel,Math.max(begin+.009,until-.035));
   g.gain.linearRampToValueAtTime(0,until);
   osc.connect(g).connect(this._bus);this._nodes.add(osc);
   osc.onended=()=>{this._nodes.delete(osc);osc.disconnect();g.disconnect()};
   osc.start(begin);osc.stop(until+.002);
  }
  this.ontimeupdate?.();
  if(now>=this._duration+.04){this.pause();this._time=0;this.onended?.()}
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
  this.pause();this._ctl?.abort();this._audioCtx?.close().catch(()=>{});
  this._src='';this._ready=null;this._model=null;this._audioCtx=null;this._bus=null;
 }
}
root.SigmaSeqAudio=SseqAudio;
})(typeof window!=='undefined'?window:globalThis);
