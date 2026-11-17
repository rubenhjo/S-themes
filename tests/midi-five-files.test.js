import test from 'node:test';
import assert from 'node:assert/strict';
import {profiles} from '../lib/sseq-server.js';
import '../sseq_transcribe.js';

// Synthetic self-created SMF inputs: no original music, bank samples or ROM assets.
globalThis.window=globalThis;
const T=globalThis.SigmaTranscribe,S=globalThis.SigmaSSEQ;
function vlq(n){const x=[n&127];while((n>>=7)>0)x.unshift((n&127)|128);return x;}
const u32=n=>[n>>>24&255,n>>>16&255,n>>>8&255,n&255];
const u16=n=>[n>>>8&255,n&255];
const evt=(delta,...bytes)=>[...vlq(delta),...bytes];
const tempo=(delta,us)=>evt(delta,0xff,0x51,3,us>>>16&255,us>>>8&255,us&255);
const on=(delta,pitch,velocity=95,channel=0)=>evt(delta,0x90|channel,pitch,velocity);
const off=(delta,pitch,channel=0)=>evt(delta,0x80|channel,pitch,0);
const done=()=>evt(0,0xff,0x2f,0);
function mid(name,ppq,parts,format=1){
 const chunks=parts.map(part=>[...Array.from('MTrk',c=>c.charCodeAt(0)),...u32(part.length),...part]);
 const bytes=Uint8Array.from([...Array.from('MThd',c=>c.charCodeAt(0)),...u32(6),...u16(format),...u16(parts.length),...u16(ppq),...chunks.flat()]);
 return {name,size:bytes.length,arrayBuffer:async()=>bytes.slice().buffer,bytes};
}
function simple(name,pitch,ppq=480,ntracks=1){
 return mid(name,ppq,Array.from({length:ntracks},(_,i)=>[...on(0,pitch+i),...off(ppq,pitch+i),...done()]));
}
test('SMF tempo map and 480 PPQ versus 960 PPQ preserve real seconds',async()=>{
 const a=mid('lead.mid',480,[[...tempo(0,500000),...on(0,60),...off(480,60),...tempo(0,1000000),...on(0,62),...off(480,62),...done()]],0);
 const b=mid('chords.mid',960,[[...on(0,67),...off(960,67),...on(0,69),...off(1920,69),...done()]],0);
 const model=T.readMidi(a.bytes);
 assert.equal(model.ppq,480);assert.equal(model.tempoEvents.at(-1).tick,480);
 assert.ok(Math.abs(model.durationSeconds-1.5)<.000001);
 assert.deepEqual(model.allNotes.map(n=>[n.startTick,n.durationTick]),[[0,48],[48,96]]);
 const result=await T.combineMidiFiles([a,b],{slot:1028,profiles,programs:[0,1],loop:true});
 assert.equal(result.parsed.tracks.length,2);
 assert.deepEqual([...new Set(result.parsed.notes.map(n=>n.program))].sort(),[0,1]);
 const p=result.parsed.notes.map(n=>[n.pitch,n.start,n.duration]);
 assert.deepEqual(p.sort((x,y)=>x[0]-y[0]),[[60,0,48],[62,48,96],[67,0,48],[69,48,96]]);
 assert.equal(result.parsed.durationTicks,144);
 assert.ok(result.bytes.length<=65536);
});
test('up to 5 uploaded MIDI files overlay at t=0 and keep 5 separate HeartGold sounds',async()=>{
 const files=Array.from({length:5},(_,i)=>simple(`${i}.mid`,60+i));
 const a=await T.combineMidiFiles(files,{slot:1028,profiles,programs:[0,1,2,3,4],loop:false});
 assert.equal(a.fileCount,5);assert.equal(a.parsed.tracks.length,5);
 assert.deepEqual(a.parsed.notes.map(n=>n.program).sort((x,y)=>x-y),[0,1,2,3,4]);
 assert.ok(a.parsed.notes.every(n=>n.start===0));
 await assert.rejects(()=>T.combineMidiFiles([...files,files[0]],{slot:1028,profiles}),/one and five/);
 await assert.rejects(()=>T.combineMidiFiles([{name:'audio.wav'}],{slot:1028,profiles}),/MIDI files only/);
});
test('nine source tracks can pack into one SSEQ voice without note loss',async()=>{
 const file=simple('9-tracks.mid',70,480,9);
 const out=await T.combineMidiFiles([file],{slot:1028,profiles,programs:[0],loop:true});
 assert.equal(out.parsed.tracks.length,1);
 assert.equal(out.parsed.notes.length,9);
 assert.equal(new Set(out.parsed.notes.map(n=>n.start)).size,1);
 assert.deepEqual(out.parsed.notes.map(n=>n.pitch),Array.from({length:9},(_,i)=>70+i));
});
test('selected incompatible program fails with precise file/part/note and compatible alternatives',async()=>{
 const data=simple('bass.mid',20);
 await assert.rejects(()=>T.combineMidiFiles([data],{slot:1028,profiles,programs:[39]}),/bass.mid.*program 39.*MIDI (?:note|pitch) 20.*Compatible (?:HeartGold )?programs/);
});
test('per-track/channel override takes precedence over file instrument',async()=>{
 const midi=mid('split.mid',480,[[...on(0,60,95,0),...on(0,64,95,1),...off(480,60,0),...off(0,64,1),...done()]],0);
 const a=await T.combineMidiFiles([midi],{slot:1028,profiles,programs:[0],trackPrograms:{'0:0:1':1}});
 assert.equal(a.parsed.tracks.length,2);
 assert.equal(a.parsed.notes.find(n=>n.pitch===60).program,0);
 assert.equal(a.parsed.notes.find(n=>n.pitch===64).program,1);
});
test('loops align short and long tracks; no early restart when two parts have different lengths',async()=>{
 const fast=simple('short.mid',60),long=mid('long.mid',480,[[...on(0,64),...off(960,64),...done()]],0);
 const out=await T.combineMidiFiles([fast,long],{slot:1028,profiles,programs:[0,1],loop:true});
 assert.equal(out.parsed.tracks.length,2);
 assert.ok(out.parsed.tracks.every(t=>t.loopEndTick===96),out.parsed.tracks);
});
test('corrupt MIDI rejected with no SSEQ export',async()=>{
 const f={name:'bad.mid',size:5,arrayBuffer:async()=>new Uint8Array([1,2,3,4,5]).buffer};
 await assert.rejects(()=>T.combineMidiFiles([f],{slot:1028,profiles}),/Invalid MIDI header/);
});
