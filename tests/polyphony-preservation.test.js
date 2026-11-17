import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../sseq_transcribe.js';
import '../sseq_codec.js';
const api=globalThis.SigmaTranscribe,S=globalThis.SigmaSSEQ;
globalThis.window={SigmaSSEQ:S};
const root=new URL('./fixtures/polyphony/',import.meta.url);
const profiles=JSON.parse(readFileSync(new URL('../heartgold_bank_profiles.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root)));
for(const name of ['four-note chord','six-note chord','eight-note chord','strong harmonics','four C4 repeats','E2-G2-A2-E2 bass']){
 test('Original MIDI truth survives spectral analysis, lane packaging and Nitro SSEQ: '+name,()=>{
  const row=manifest.find(x=>x.name===name);assert.ok(row);
  const midi=api.readMidi(new Uint8Array(readFileSync(new URL(row.midi,root))));
  const original=midi.allNotes.map(n=>n.pitch).sort((a,b)=>a-b);
  const wav=readFileSync(new URL(row.wav,root));
  assert.equal(wav.toString('ascii',0,4),'RIFF');
  const mono=Float32Array.from({length:(wav.length-44)/2},(_,i)=>wav.readInt16LE(44+i*2)/32768);
  const spectrum=api.spectralFrames(mono,11025);
  const detected=api.smooth(spectrum.frames,spectrum.hopSeconds);
  const voices=[];
  for(let channel=0;channel<spectrum.frames[0].length;channel++){
   const n=detected.filter(e=>e.channel===channel).map(e=>({start:Math.round(e.start*96),duration:Math.max(1,Math.round(e.duration*96)),pitch:e.pitch,velocity:e.velocity}));
   if(n.length)voices.push(n);
  }
  const ctx=S.profileSlot(profiles,1028),plan=api.packTracks(voices,ctx,{preferred:0}),blob=S.build({tracks:plan.tracks,slot:1028,profiles,loop:false});
  const independentlyParsed=S.parse(blob,{slot:1028,profiles}).notes;
  const atAnalysis=detected.map(e=>e.pitch).sort((a,b)=>a-b);
  const atPack=plan.tracks.flatMap(t=>t.notes).map(n=>n.pitch).sort((a,b)=>a-b);
  const atExport=independentlyParsed.map(n=>n.pitch).sort((a,b)=>a-b);
  assert.deepEqual(atAnalysis,original,'analysis lost or invented notes');
  assert.deepEqual(atPack,original,'voice assignment lost or invented notes');
  assert.deepEqual(atExport,original,'SSEQ serialization lost or invented notes');
  assert.ok(blob.length<=65536);
  if(name.endsWith('chord')){
   const concurrent=independentlyParsed.filter(n=>n.start<=20&&n.start+n.duration>20).length;
   assert.equal(concurrent,original.length,'actual simultaneous polyphony lost');
  }
 });
}
