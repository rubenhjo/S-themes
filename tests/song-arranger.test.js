import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../sseq_codec.js';
import '../sigma_arranger.js';
const A=globalThis.SigmaArranger,S=globalThis.SigmaSSEQ;
const profiles=JSON.parse(readFileSync(new URL('../heartgold_bank_profiles.json',import.meta.url)));
const voice=(pitches,start=20,duration=85)=>pitches.map(pitch=>({pitch,start,duration,velocity:96,confidence:.73}));
const model=notes=>({voices:[notes],sourceDuration:1.6});
test('Five editable parts never mean five simultaneous notes: eight survive one SSEQ',()=>{
 const arr=A.create(model(voice([48,52,55,60,64,67,71,74])),{slot:1028});
 assert.ok(arr.parts.length<=5);const result=A.build(arr,{profiles,slot:1028});
 assert.equal(result.parsed.notes.length,8);
 assert.equal(result.parsed.notes.filter(n=>n.start<=20&&n.start+n.duration>20).length,8);
 assert.equal(result.bytes.length<=65536,true);
});
test('Unchecking a part removes its notes from export, solo does not',()=>{
 const m=model([...voice([43,48,52,55,67],18,94),{pitch:69,start:160,duration:30,velocity:97,confidence:.91}]);
 const state=A.create(m,{slot:1028});const main=A.build(state,{profiles});
 state.parts.forEach(p=>{p.solo=true});assert.deepEqual(A.build(state,{profiles}).bytes,main.bytes);
 state.loopPreview=true;state.rangeStart=.5;state.rangeEnd=1;assert.deepEqual(A.build(state,{profiles}).bytes,main.bytes);
 const disabled=state.parts.find(p=>p.role==='bass')||state.parts.at(-1);disabled.included=false;
 assert.equal(A.build(state,{profiles}).parsed.notes.length,main.parsed.notes.length-disabled.notes.length);
});
test('Manual removal identifies single C4 strike and persists through program and filters, undo restores',()=>{
 const events=[12,64,118,173].map(start=>({pitch:60,start,duration:30,velocity:95,confidence:.89}));
 const state=A.create(model(events),{slot:1028});const part=state.parts[0];
 const original=A.build(state,{profiles});assert.equal(original.parsed.notes.length,4);
 A.update(state,part.id,'exclude',part.notes[1].id);
 A.update(state,part.id,'filter','more');
 A.update(state,part.id,'program',0);
 assert.deepEqual(A.build(state,{profiles}).parsed.notes.map(n=>n.start),[12,118,173]);
 A.update(state,part.id,'undo');assert.equal(A.build(state,{profiles}).parsed.notes.length,4);
});
test('Program, volume and timing survive SSEQ parse, preview scope is not export scope',()=>{
 const state=A.create(model([...voice([48,52,55],15,88),...voice([70],15,30)]),{slot:1028});
 const part=state.parts.find(p=>p.notes.some(n=>n.pitch===70));assert.ok(part);
 const valid=A.supportedPrograms(S.profileSlot(profiles,1028),part.notes,S);
 assert.ok(valid.length>1);A.update(state,part.id,'program',valid[1]);A.update(state,part.id,'volume',60);
 const result=A.build(state,{profiles});const specific=result.parsed.notes.find(n=>n.pitch===70);
 assert.equal(specific.program,valid[1]);assert.equal(specific.velocity,58);assert.equal(specific.start,15);
 const partPreview=A.build(state,{profiles,partId:part.id,loop:false});assert.equal(partPreview.parsed.notes.length,1);
 assert.deepEqual(A.build(state,{profiles}).bytes,result.bytes);
});
test('Filter is local to part and unplayable instrument is a visible error rather than silent replacement',()=>{
 const state=A.create(model([...voice([43,52],20),...voice([70,74],21)]),{slot:1028});
 const part=state.parts.find(x=>x.role==='bass');assert.ok(part);const before=state.parts.filter(x=>x!==part).map(x=>A.visibleNotes(x).length);
 A.update(state,part.id,'filter','safe');const after=state.parts.filter(x=>x!==part).map(x=>A.visibleNotes(x).length);
 assert.deepEqual(after,before);
 const ctx=S.profileSlot(profiles,1028),other=ctx.bank.programs.find(x=>x.pitch_ranges?.length&&x.pitch_ranges.every(([lo,hi])=>!(43>=lo&&43<=hi)));
 if(other){A.update(state,part.id,'filter','balanced');A.update(state,part.id,'program',other.index);assert.throws(()=>A.build(state,{profiles}),/cannot play MIDI notes/)}
});

test('A held chord with delayed melody is not collapsed into a single chord part',()=>{
 const held=voice([48,52,55],34,120),lead=[{pitch:67,start:35,duration:40,confidence:.9,velocity:90},{pitch:69,start:87,duration:40,confidence:.9,velocity:90},{pitch:72,start:141,duration:32,confidence:.9,velocity:90}];
 const state=A.create(model([...held,...lead]),{slot:1028});
 assert.deepEqual(state.parts.map(p=>p.role),['melody','bass','chords']);
 const result=A.build(state,{profiles});
 assert.equal(result.parsed.notes.length,6);
 const bass=state.parts.find(p=>p.role==='bass');
 const before=A.build(state,{profiles}).parsed.notes.filter(n=>n.pitch>=64);
 A.update(state,bass.id,'filter','safe');
 const after=A.build(state,{profiles}).parsed.notes.filter(n=>n.pitch>=64);
 assert.deepEqual(after,before,'Bass confidence slider cannot alter melody');
});
test('Uncertain low candidate can be auditioned and excluded without altering Auto reference',()=>{
 const reference={voices:[[{pitch:65,start:290,duration:70,velocity:85,confidence:.93}]],
  candidateVoices:[[{pitch:44,start:708,duration:12,velocity:45,confidence:.42}]],sourceDuration:7.744};
 const state=A.create(reference,{slot:1028});const part=state.parts[0];
 const auto=A.build(state,{profiles});assert.equal(auto.parsed.notes.length,1);
 A.update(state,part.id,'filter','more');
 const withCandidate=A.build(state,{profiles});assert.deepEqual(withCandidate.parsed.notes.map(n=>n.pitch).sort((a,b)=>a-b),[44,65]);
 const unique=part.notes.find(n=>n.pitch===44).id;
 A.update(state,part.id,'exclude',unique);
 assert.deepEqual(A.build(state,{profiles}).bytes,auto.bytes);
 A.update(state,part.id,'undo');assert.equal(A.build(state,{profiles}).parsed.notes.length,2);
});
