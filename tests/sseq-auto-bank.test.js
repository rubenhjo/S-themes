import test from 'node:test';
import assert from 'node:assert/strict';
import {profiles} from '../lib/sseq-server.js';
import '../sseq_transcribe.js';

// The real UI supplies the Web browser global. A MIDI upload can be tested
// without any recording encoder, credentials or original Nintendo samples.
globalThis.window = globalThis;

function lowNoteMidi(){
  const track = Uint8Array.from([
    0x00,0x90,0x14,0x60, 0x60,0x80,0x14,0x00,
    0x00,0x90,0x18,0x60, 0x60,0x80,0x18,0x00,
    0x00,0xff,0x2f,0x00
  ]);
  const bytes = Uint8Array.from([
    0x4d,0x54,0x68,0x64, 0,0,0,6, 0,0, 0,1, 0,96,
    0x4d,0x54,0x72,0x6b, 0,0,0,track.length,...track
  ]);
  return {name:'low-notes.mid',size:bytes.length,arrayBuffer:async()=>bytes.slice().buffer};
}

test('automatic HeartGold instrument fallback preserves MIDI notes and chooses a sample-valid program',async()=>{
  const bank=profiles.banks['702'];
  const restricted=bank.programs.find(p=>p.index===39);
  assert.ok(restricted,'Original bank 702 instrument 39 must exist');
  assert.ok(!restricted.pitch_ranges.some(([lo,hi])=>20>=lo&&20<=hi));
  const result=await globalThis.SigmaTranscribe.convertFile(lowNoteMidi(),{
    profiles,slot:1028,program:39,loop:false
  });
  assert.deepEqual(result.parsed.notes.map(n=>n.pitch),[20,24]);
  assert.ok(result.parsed.notes.every(n=>n.program!==39));
  assert.equal(result.programSubstitutions.length,1);
  assert.equal(result.programSubstitutions[0].requested,39);
  assert.equal(result.programSubstitutions[0].selected,result.parsed.notes[0].program);
  assert.equal(String.fromCharCode(...result.bytes.slice(0,4)),'SSEQ');
});

test('automatic HeartGold fallback does not override a playable selected instrument',async()=>{
  const result=await globalThis.SigmaTranscribe.convertFile(lowNoteMidi(),{
    profiles,slot:1028,program:0,loop:false
  });
  assert.ok(result.parsed.notes.every(n=>n.program===0));
  assert.deepEqual(result.programSubstitutions,[]);
});
