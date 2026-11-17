import test from 'node:test';
import assert from 'node:assert/strict';
import '../sseq_codec.js';
import '../sigma_arranger.js';

const A=globalThis.SigmaArranger;
test('five-minute, 8000-note arrangement remains complete and fast to prepare',()=>{
 const count=8000, end=300*96;
 const voices=[Array.from({length:count},(_,i)=>({
   pitch:60+i%5,start:Math.floor(i*(end-96)/count),duration:5,
   velocity:90,confidence:.8,
 }))];
 const started=performance.now();
 const state=A.create({voices,sourceDuration:300},{slot:1028});
 const elapsed=performance.now()-started;
 assert.ok(elapsed<5000,`Editor preparation took ${Math.round(elapsed)}ms; O(n²) regression?`);
 assert.ok(state.parts.length<=5);
 assert.equal(state.parts.reduce((sum,p)=>sum+p.notes.length,0),count,'No notes may be lost preparing UI');
 assert.equal(state.sourceDuration,300);
 assert.equal(state.rangeStart,0);
 assert.equal(state.parts.reduce((sum,p)=>sum+A.visibleNotes(p).length,0),count);
});

test('overlap counting respects exact adjacent boundaries and simultaneous chords',()=>{
 const voices=[[{pitch:60,start:0,duration:100,confidence:.9},
  {pitch:62,start:100,duration:100,confidence:.9},
  {pitch:64,start:100,duration:100,confidence:.9},
  {pitch:67,start:100,duration:100,confidence:.9}]];
 const state=A.create({voices,sourceDuration:3},{slot:1028});
 assert.equal(state.parts.reduce((sum,p)=>sum+p.notes.length,0),4);
 assert.ok(state.parts.length<=5);
});
