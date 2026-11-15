import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url);
const profiles=JSON.parse(readFileSync(new URL('../heartgold_bank_profiles.json',import.meta.url)));
const context={Uint8Array,ArrayBuffer,DataView,Buffer,Math,Number,Object,Error};context.globalThis=context;
runInNewContext(readFileSync(new URL('../sseq_codec.js',import.meta.url),'utf8'),context);
const S=context.SigmaSSEQ;
function make(notes,slot=1028,loop=true,program=0){return S.build({slot,profiles,loop,tracks:[{program,notes}],tempo:120});}
function notes(){return [{start:0,duration:72,pitch:60,velocity:101},{start:24,duration:72,pitch:64,velocity:90},{start:72,duration:24,pitch:67,velocity:80}];}
test('private user-provided bank metadata includes all mapped HeartGold slots and sample-ranged program IDs',()=>{
 assert.equal(Object.keys(profiles.sequence_slots).length,362);assert.equal(Object.keys(profiles.banks).length,39);
 assert.equal(Object.keys(profiles.wave_archives).length,39);
 assert.equal(profiles.sequence_slots['1028'].bank,702);
 for(const bank of Object.values(profiles.banks))for(const program of bank.programs){
  assert.ok(program.index>=0&&program.index<=127);
  assert.ok(program.pitch_ranges.length>0);
  for(const range of program.pitch_ranges)assert.ok(range[0]>=0&&range[1]<=127&&range[0]<=range[1]);
 }
});
test('Nintendo SSEQ poly mode is 0xC7 00, allowing overlapping notes with accurate onset times',()=>{
 const binary=make(notes());const pos=binary.indexOf(0xc7);
 assert.equal(binary[pos+1],0,'Nintendo defines 0 as POLY; 1 is MONO');
 const parsed=S.parse(binary,{slot:1028,profiles});
 assert.deepEqual(Array.from(parsed.notes,n=>n.start),[0,24,72]);
 assert.deepEqual(Array.from(parsed.notes,n=>n.duration),[72,72,24]);
 assert.equal(parsed.infinite,true);
});
test('reader interprets an incoming mono stream as blocking note lengths',()=>{
 const bin=make([{start:0,duration:24,pitch:60},{start:24,duration:24,pitch:62}]);
 const pos=bin.indexOf(0xc7);bin[pos+1]=1;
 // For mono note mode, the generated explicit rest is now an extra delay.
 const parsed=S.parse(bin,{slot:1028,profiles});
 assert.deepEqual(Array.from(parsed.notes,n=>n.start),[0,48]);
});
test('writer and reader reject invalid program/sample pitch combinations',()=>{
 const slot=Object.entries(profiles.sequence_slots).find(([,v])=>
  profiles.banks[String(v.bank)].programs.some(p=>p.pitch_ranges.some(([lo,hi])=>lo>0||hi<127)));
 assert.ok(slot, 'A genuine restricted-pitch program exists in extracted banks');
 const bank=profiles.banks[String(slot[1].bank)],candidate=bank.programs.find(p=>p.pitch_ranges.some(([lo,hi])=>lo>0||hi<127));
 const outside=Array.from({length:128},(_,n)=>n).find(n=>!candidate.pitch_ranges.some(([a,b])=>n>=a&&n<=b));
 assert.notEqual(outside,undefined);
 assert.throws(()=>make([{start:0,duration:24,pitch:outside}],Number(slot[0]),false,candidate.index),/cannot play note/);
 assert.throws(()=>make([{start:0,duration:24,pitch:60}],1028,false,200),/not defined/);
});
test('SSEQ multi-track pointers and per-track note timings remain independent',()=>{
 const bin=S.build({slot:1028,profiles,tempo:125,loop:false,tracks:[
  {program:0,notes:[{start:0,duration:60,pitch:60},{start:36,duration:30,pitch:64}]},
  {program:1,notes:[{start:12,duration:40,pitch:52},{start:72,duration:40,pitch:55}]}
 ]});
 const result=S.parse(bin,{slot:1028,profiles});
 assert.equal(result.tracks.length,2);assert.equal(result.tempo,125);
 assert.equal(result.notes.length,4);
 assert.deepEqual(Array.from(result.tracks[0].notes,n=>n.start),[0,36]);
 assert.deepEqual(Array.from(result.tracks[1].notes,n=>n.start),[12,72]);
});
test('SSEQ parser rejects malformed bytes, mismatched header and empty tracks',()=>{
 const a=make(notes(),1028,false);const b=a.slice();b[8]^=1;
 assert.throws(()=>S.parse(b,{slot:1028,profiles}),/header/);
 assert.throws(()=>S.parse(new Uint8Array([1,2,3]),{slot:1028,profiles}),/size invalid/);
 assert.throws(()=>S.build({slot:1028,profiles,tracks:[{program:0,notes:[]}]}),/Empty/);
});

test('SSEQ-only Supabase RLS hides non-migrated public legacy recordings',()=>{
 const migration=readFileSync(new URL('../supabase/migrations/20261115_sseq_only.sql',import.meta.url),'utf8');
 assert.match(migration,/CREATE POLICY "public read-only track catalog"/);
 assert.match(migration,/USING\s*\(mime_type\s*=\s*'application\/octet-stream'/);
 assert.match(migration,/sseq_id IS NOT NULL/);
 assert.match(migration,/REVOKE INSERT, UPDATE, DELETE ON public\.theme_tracks FROM anon, authenticated/);
});
