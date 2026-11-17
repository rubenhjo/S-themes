import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const scope={Uint8Array,DataView,Float32Array,ArrayBuffer,Map,WeakMap,Math,Number,Set,Promise,Error,console};scope.globalThis=scope;
vm.createContext(scope);
vm.runInContext(readFileSync(new URL('../heartgold_source_audio.js',import.meta.url),'utf8'),scope);
const S=scope.SigmaHeartGoldSources;
function ctx(){const events=[],sources=[];const c={events,sources,created:0,createBuffer(){c.created++;return {copyToChannel(data){assert.ok(data instanceof Float32Array)}}},
createBufferSource(){const s={loop:false,playbackRate:{value:1},connect(){return this},start(t){events.push(['start',t])},stop(t){events.push(['stop',t])},disconnect(){}};sources.push(s);return s},
createGain(){return {gain:{setValueAtTime(v,t){events.push(['set',v,t])},linearRampToValueAtTime(v,t){events.push(['ramp',v,t])}},connect(){return this}}},
createStereoPanner(){return {pan:{value:0},connect(){return this}}}};return c;}
const wave={samples:Float32Array.from([.0,.1,.2,.1,.0,-.1,-.2,-.1]),rate:22050,type:0,loopWords:1,loop:true};
const instrument={wave,definition:{baseNote:60,attack:0,decay:50,sustain:64,release:80,pan:96}};
test('real-source loop mapping uses sample types and never invents empty loops',()=>{
 assert.ok(Math.abs(S.pcmLoopPoints(wave).start-4/22050)<1e-12);
 assert.equal(S.pcmLoopPoints({...wave,loopWords:0}),null);
 assert.equal(S.pcmLoopPoints({...wave,loopWords:4}),null);
 assert.equal(S.pcmLoopPoints({...wave,type:1,loopWords:1}).start,2/22050);
});
test('sample player applies a distinct ADSR stage, pitch, pan and loop; caches decoded audio buffer',()=>{
 const c=ctx(),sink={connect(){return this}};
 const one=S.schedulePcm(c,sink,instrument,{note:72,start:1,end:2,velocity:80});
 const two=S.schedulePcm(c,sink,instrument,{note:60,start:3,end:4,velocity:80});
 assert.equal(one.loop,true);assert.equal(one.node.playbackRate.value,2);
 assert.equal(one.node.loopStart,4/22050);assert.equal(one.node.loopEnd,8/22050);
 assert.equal(one.pan.pan.value,(96-64)/63);
 assert.equal(c.created,1,'must reuse the same sample buffer on polyphonic notes');
 assert.equal(c.events.filter(e=>e[0]==='ramp').length,6);
 assert.ok(c.events.some(e=>e[0]==='ramp'&&e[2]>1&&e[2]<1.15),'attack must be non-zero');
 assert.ok(c.events.some(e=>e[0]==='ramp'&&e[2]>1.15&&e[2]<1.5),'decay must be distinct');
 assert.ok(c.events.some(e=>e[0]==='ramp'&&e[2]===2),'release must reach zero at note end');
 assert.equal(two.node.playbackRate.value,1);
});
test('real SWAR with zero samples is a valid empty archive',()=>{
 const b=new Uint8Array(0x3c),v=new DataView(b.buffer);b.set([83,87,65,82],0);b.set([68,65,84,65],16);v.setUint32(0x38,0,true);
 assert.equal(S.parseSWAR(b).offsets.length,0);
});
