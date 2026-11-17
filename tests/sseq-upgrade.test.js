import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {profiles} from '../lib/sseq-server.js';
import '../sseq_transcribe.js';
globalThis.window=globalThis;
const T=globalThis.SigmaTranscribe,S=globalThis.SigmaSSEQ;
const vlq=n=>{const a=[n&127];while(n>>=7)a.unshift(128|(n&127));return a};
const word=n=>[n>>8&255,n&255],dword=n=>[n>>>24&255,n>>>16&255,n>>>8&255,n&255];
const mkMidi=(ppq,tracks)=>{
 const header=[...Buffer.from('MThd'),0,0,0,6,...word(1),...word(tracks.length),...word(ppq)];
 const content=tracks.flatMap(track=>{
  let p=0,bytes=[];for(const [time,...msg] of track){bytes.push(...vlq(time-p),...msg);p=time}
  bytes.push(0,0xff,0x2f,0);return [...Buffer.from('MTrk'),...dword(bytes.length),...bytes];
 });return Uint8Array.from([...header,...content]);
};
const asFile=(name,bytes)=>({name,size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer});
const noteEvents=(ppq,pitch,quarterCount=1,tempo=500000,channel=0)=>[
 [0,0xff,0x51,0x03,tempo>>16&255,tempo>>8&255,tempo&255],
 [0,0xc0|channel,7],[0,0x90|channel,pitch,100],
 [quarterCount*ppq,0x80|channel,pitch,0]
];
const toSseq=async(files,programPerFile,other={})=>T.combineMidiFiles(files,{profiles,slot:1028,loop:true,programPerFile,...other});
function sineClip(notes,duration=2.6,rate=11025){
 const s=new Float32Array(Math.ceil(rate*duration));
 for(const [pitch,start,length,amplitudes=[.5]] of notes){
  const hz=440*2**((pitch-69)/12);
  for(let j=0;j<Math.floor(length*rate);j++){
   const i=Math.floor(start*rate)+j;if(i>=s.length)break;
   const env=Math.min(1,j/300,(length*rate-j)/300);
   amplitudes.forEach((v,k)=>s[i]+=v*env*Math.sin(2*Math.PI*(k+1)*hz*j/rate));
  }
 }
 return s;
}
const decoded=notes=>{
 const s=sineClip(notes);const a=T.spectralFrames(s,11025,{mode:'melody-chords'});
 return T.smooth(a.frames,a.hopSeconds).sort((x,y)=>x.start-y.start||x.pitch-y.pitch);
};
test('MIDI 480/960 PPQ plus explicit HeartGold programs become one SSEQ with simultaneous notes',async()=>{
 const a=asFile('lead.mid',mkMidi(480,[noteEvents(480,60)]));
 const b=asFile('chords.mid',mkMidi(960,[noteEvents(960,64,1,500000,0)]));
 const r=await toSseq([a,b],[0,1]);
 assert.deepEqual(r.parsed.notes.map(n=>[n.pitch,n.program,n.start,n.duration]).sort((a,b)=>a[0]-b[0]),[[60,0,0,48],[64,1,0,48]]);
 assert.equal(r.parsed.tempo,120);assert.equal(r.parsed.tracks.length,2);
 assert.ok(r.bytes.length<65536);assert.equal(r.parsed.infinite,true);
 const path=fileURLToPath(new URL('./fixtures/combined_480_960.sseq',import.meta.url));writeFileSync(path,r.bytes);
});
test('MIDI tempo map: one quarter 120 BPM and one quarter 60 BPM take 1.50 seconds',async()=>{
 const src=mkMidi(480,[
  [[0,0xff,0x51,0x03,0x07,0xa1,0x20],[0,0x90,60,110],[480,0x80,60,0],
   [480,0xff,0x51,0x03,0x0f,0x42,0x40],[480,0x90,62,110],[960,0x80,62,0]]
 ]);
 const model=T.readMidi(src);assert.equal(model.tempo,120);
 assert.deepEqual(model.voices.flat().map(n=>[n.start,n.duration]),[[0,48],[48,96]]);
 assert.equal(model.sourceDuration,1.5);
 const result=await toSseq([asFile('changing.mid',src)],[0]);
 assert.equal(result.parsed.durationTicks,144);assert.equal(result.parsed.durationTicks/96,1.5);
});
test('9 independent MIDI tracks are packed losslessly when bank program is shared',async()=>{
 const all=Array.from({length:9},(_,i)=>noteEvents(480,60+i));
 const file=asFile('nine.mid',mkMidi(480,all));
 const r=await toSseq([file],[0]);
 assert.equal(r.parsed.notes.length,9);assert.equal(r.parsed.tracks.length,1);
 assert.equal(new Set(r.parsed.notes.map(n=>n.pitch)).size,9);
});
test('16 programs supported and all track loops end at one common tick',()=>{
 const tracks=Array.from({length:16},(_,i)=>({program:i,notes:[{pitch:60,start:i*2,duration:24,velocity:80}]}));
 const bytes=S.build({tracks,profiles,slot:1028,tempo:120,loop:true});const parsed=S.parse(bytes,{profiles,slot:1028});
 assert.equal(parsed.tracks.length,16);assert.equal(parsed.notes.length,16);
 assert.equal(new Set(parsed.tracks.map(t=>t.loopEndTick)).size,1);
 assert.equal(parsed.tracks[0].loopEndTick,54);
 assert.equal(parsed.durationTicks,54);
 assert.throws(()=>S.build({tracks:[...tracks,tracks[0]],profiles,slot:1028}),/16/);
});
test('Instrument lock forbids bank-invalid pitch with specific alternatives',async()=>{
 const b=asFile('low.mid',mkMidi(480,[noteEvents(480,20)]));
 await assert.rejects(toSseq([b],[39]),/low\.mid.*pitch 20.*Compatible HeartGold programs/);
});
test('Same MIDI channel in different source files does not collapse selected bank programs',async()=>{
 const r=await toSseq([
  asFile('a.mid',mkMidi(480,[noteEvents(480,60,1,500000,0)])),
  asFile('b.mid',mkMidi(960,[noteEvents(960,64,1,500000,0)]))
 ],[0,1]);
 assert.deepEqual(new Set(r.parsed.notes.map(n=>n.program)),new Set([0,1]));
});
test('Invalid or truncated MIDI fails instead of producing fake SSEQ',()=>{
 assert.throws(()=>T.readMidi(new Uint8Array([0,1,2])),/Invalid MIDI/);
 const bytes=mkMidi(480,[noteEvents(480,60)]).slice(0,-4);
 assert.throws(()=>T.readMidi(bytes),/Truncated MIDI/);
});
test('Harmonic-rich solo stays four notes; repeated C4 and bass notes are not discarded',()=>{
 const solo=decoded([57,59,62,64].map((p,i)=>[p,.10+i*.55,.32,[.32,.65,.36,.19]]));
 assert.deepEqual(solo.map(n=>n.pitch),[57,59,62,64]);
 const repeated=decoded([0,1,2,3].map(i=>[60,.1+i*.45,.34]));
 assert.deepEqual(repeated.map(n=>n.pitch),[60,60,60,60]);
 const bass=decoded([40,43,45,40].map((p,i)=>[p,.1+i*.45,.34]));
 assert.deepEqual(bass.map(n=>n.pitch),[40,43,45,40]);
 for(const notes of [solo,repeated,bass])assert.ok(notes.every(n=>n.duration>=.14));
});
test('Synthetic three-note chord retains all pitches after 350ms lead-in',()=>{
 const notes=decoded([60,64,67].map(p=>[p,.35,.55]));
 assert.deepEqual(new Set(notes.map(n=>n.pitch)),new Set([60,64,67]));
 assert.ok(notes.every(n=>Math.abs(n.start-.35)<.05));
});
test('Six simultaneous non-harmonic source notes remain six notes, not four',()=>{
 const pitches=[60,63,66,69,73,77];const notes=decoded(pitches.map(p=>[p,.35,.65,[.45]]));
 assert.deepEqual(new Set(notes.map(n=>n.pitch)),new Set(pitches));
 assert.equal(notes.length,6);
});
