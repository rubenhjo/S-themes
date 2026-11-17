import test from 'node:test';
import assert from 'node:assert/strict';
import {profiles} from '../lib/sseq-server.js';
import '../sseq_player.js';

test('SSEQ player uses the actual selected bank sample, pitch, pan and loop if private source exists',()=>{
 const calls=[];
 const gain=()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){return this},disconnect(){}});
 const instrument={wave:{samples:Float32Array.from([.1,.2,.3,.4,.5,.6,.7,.8]),rate:22050,type:0,loop:true,loopWords:1},definition:{baseNote:60,attack:100,release:70,sustain:90,pan:32}};
 let originalCalls=0;
 globalThis.SigmaBankProfiles=profiles;
 globalThis.SigmaSSEQ={profileSlot:(_p,slot)=>({bankId:702,bank:profiles.banks['702']})};
 globalThis.SigmaHeartGoldSources={originalWave(bankId,program,note){originalCalls++;assert.deepEqual([bankId,program,note],[702,21,64]);return instrument;}};
 const player=new globalThis.SigmaSeqAudio();player.slot=1028;player._bus=gain();
 player._audioCtx={
  createGain:gain,createBuffer(_channels,len,rate){assert.equal(len,8);assert.equal(rate,22050);return {copyToChannel(data){assert.equal(data.length,8)}}},
  createStereoPanner(){return {pan:{value:0},connect(){return this},disconnect(){}}},
  createBufferSource(){const node={buffer:null,playbackRate:{value:1},loop:false,connect(){return this},start(t){calls.push(['start',t])},stop(t){calls.push(['stop',t])},disconnect(){}};calls.push(['source',node]);return node},
  createOscillator(){throw Error('Should not produce a synthetic oscillator when original PCM is loaded')}
 };
 const result=player._scheduleNote({program:21,pitch:64,velocity:88},1,1.7);
 assert.equal(originalCalls,1);assert.equal(result.original,true);assert.equal(result.loop,true);
 const source=calls.find(e=>e[0]==='source')[1];
 assert.ok(Math.abs(source.playbackRate.value-2**(4/12))<1e-8);
 assert.equal(source.loopStart,4/22050);assert.equal(source.loopEnd,8/22050);
 assert.deepEqual(calls.filter(e=>e[0]!=='source'),[['start',1],['stop',1.702]]);
 player.dispose();
 delete globalThis.SigmaHeartGoldSources;
});

test('Without imported samples the SSEQ player chooses SBNK kind rather than program modulo three',()=>{
 const ctx={createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){return this},disconnect(){}}},createOscillator(){return {frequency:{value:0},type:'',connect(){return this},start(){},stop(){},disconnect(){}}}};
 globalThis.SigmaBankProfiles=profiles;
 globalThis.SigmaSSEQ={profileSlot:()=>({bankId:702,bank:{programs:[{index:34,kind:2}]}})};
 const player=new globalThis.SigmaSeqAudio();player.slot=1028;player._bus=ctx.createGain();player._audioCtx=ctx;
 const choice=player._scheduleNote({program:34,pitch:60,velocity:100},0,.3);
 assert.equal(choice.original,false);assert.equal(choice.program,34);
 player.dispose();
});
