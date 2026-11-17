import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const playerSource=fs.readFileSync(new URL('../sseq_player.js',import.meta.url),'utf8');
const appSource=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function makeHarness(){
 const logs=[]; let gesture=false; let releaseFetch=null;
 const nodes=(extra={})=>({connect(to){return to},disconnect(){},...extra});
 class FakeAudioContext {
  constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=48000;this.destination=nodes();logs.push('context-created')}
  createGain(){return nodes({gain:{setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){}}})}
  createDynamicsCompressor(){return nodes({threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}})}
  createBuffer(){return {}}
  createBufferSource(){return nodes({start(){logs.push('silent-prime')},stop(){}})}
  createOscillator(){return nodes({type:'sine',frequency:{value:0},onended:null,start(){logs.push('note-start')},stop(){}})}
  resume(){logs.push('resume('+gesture+')');if(!gesture)return new Promise(()=>{});this.state='running';return Promise.resolve()}
  close(){this.state='closed';return Promise.resolve()}
 }
 const root={AudioContext:FakeAudioContext,webkitAudioContext:null,
  navigator:{audioSession:{type:'auto'}},SigmaBankProfiles:{},
  SigmaSSEQ:{parse(){return {tempo:120,durationTicks:96,notes:[{start:0,duration:24,program:0,pitch:60,velocity:100}]}}},
  fetch(){logs.push('fetch-start');return new Promise(resolve=>{releaseFetch=()=>resolve({ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer})})},
  AbortController, setInterval,clearInterval,setTimeout,clearTimeout};
 const sandbox=vm.createContext({...root,globalThis:null});
 sandbox.globalThis=sandbox;
 vm.runInContext(playerSource,sandbox);
 return {sandbox,logs,beginGesture(){gesture=true},endGesture(){gesture=false},finishFetch(){assert.ok(releaseFetch);releaseFetch()}};
}

test('iOS: AudioContext is created and resumed synchronously on tap BEFORE async SSEQ fetch',async()=>{
 const h=makeHarness();const audio=new h.sandbox.SigmaSeqAudio();
 audio.src='/api/audio?id=test';audio.slot=1028;
 h.beginGesture();const playing=audio.play();h.endGesture();
 assert.deepEqual(h.logs.slice(0,4),['context-created','resume(true)','silent-prime','fetch-start']);
 assert.equal(h.sandbox.navigator.audioSession.type,'playback');
 assert.equal(audio._audioCtx.state,'running');
 h.finishFetch();await playing;
 assert.equal(audio.paused,false);
 assert.ok(audio._bus);
 assert.ok(h.logs.includes('note-start'),'a decoded SSEQ note should reach the oscillator');
 audio.pause();audio.dispose();
});

test('iOS: interrupted audio returns to a tappable paused state, new gesture recovers with fresh context',async()=>{
 const h=makeHarness();const audio=new h.sandbox.SigmaSeqAudio();
 audio.src='/api/audio?id=test';audio.slot=1028;
 h.beginGesture();const playing=audio.play();h.endGesture();h.finishFetch();await playing;
 const first=audio._audioCtx;
 first.state='interrupted';first.resume=()=>Promise.reject(new Error('iOS interruption'));
 let interruption=null;audio.onerror=e=>interruption=e.message;
 await audio.recoverIfInterrupted();
 assert.equal(audio.paused,true);
 assert.match(interruption,/Tap Play to resume/);
 assert.equal(audio._activationBlocked,true);
 h.beginGesture();await audio.play();h.endGesture();
 assert.notEqual(audio._audioCtx,first);
 assert.equal(audio._audioCtx.state,'running');
 assert.equal(audio.paused,false);
 audio.dispose();
});

test('UI: player primes audio before awaiting load, and iOS recovery is wired to visibility',()=>{
 const start=appSource.indexOf('async function playAt(');
 const end=appSource.indexOf('function stop()',start);
 const body=appSource.slice(start,end);
 assert.ok(body.indexOf('audio.primeFromGesture()')>=0);
 assert.ok(body.indexOf('audio.primeFromGesture()')<body.indexOf('await audio.load()'));
 assert.match(body,/audio\.play\(\{primed:true\}\)/);
 assert.match(appSource,/visibilitychange[^\n]+audio\.recoverIfInterrupted\(\)/);
 assert.match(appSource,/pageshow[^\n]+audio\.recoverIfInterrupted\(\)/);
});
