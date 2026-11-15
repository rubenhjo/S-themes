import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {parseSseq,profiles} from '../lib/sseq-server.js';
import '../ds_audio.js';
import '../sigma_dex_export.js';

// Node 22 WebCrypto is the same SHA-256 primitive used by browser exporter.
globalThis.crypto ??= webcrypto;
globalThis.SigmaBankProfiles = profiles;
const S=globalThis.SigmaSSEQ, E=globalThis.SigmaDexExport;
const notes=[{pitch:60,start:0,duration:48,velocity:95},{pitch:64,start:48,duration:48,velocity:92},{pitch:67,start:96,duration:48,velocity:93}];
const sample=(slot=1028,program=0,extra={})=>S.build({slot,profiles,loop:true,tracks:[{program,notes}],...extra});
const hash=b=>createHash('sha256').update(b).digest('hex');
const entry=(i,b)=>({id:`a${i}`,title:i%2?'Repeated Title':'Test '+i,artist:'QA',duration_s:1.5,sha256:hash(b),size_bytes:b.length,sseq_id:1028,original_filename:'uploaded.sseq'});

test('Profiles are metadata from 39 bank sources and 362 HeartGold target slots',()=>{
 assert.equal(Object.keys(profiles.banks).length,39);assert.equal(Object.keys(profiles.sequence_slots).length,362);
 assert.equal(profiles.sequence_slots['1028'].bank,702);
 assert.ok(profiles.banks['702'].programs.some(p=>p.index===0));
 assert.ok(!JSON.stringify(profiles).includes('data:audio'));
});
test('Nitro SSEQ binary round-trips notes, tempo, program, and infinite loop',()=>{
 const b=sample();const p=parseSseq(b,1028);
 assert.equal(Buffer.from(b).toString('ascii',0,4),'SSEQ');assert.equal(p.bytes,b.length);
 assert.deepEqual(p.notes.map(n=>n.pitch),notes.map(n=>n.pitch));assert.equal(p.tempo,120);assert.equal(p.infinite,true);
 assert.ok(b.length<65536);
});
test('Two genuine SSEQ tracks produce independent programmed voices',()=>{
 const b=S.build({slot:1028,profiles,loop:false,tracks:[{program:0,notes:notes.slice(0,2)},{program:1,notes:[{pitch:48,start:0,duration:96,velocity:77}]}]});
 const p=parseSseq(b,1028);assert.equal(p.tracks.length,2);assert.equal(p.notes.length,3);
 assert.equal(p.notes.find(n=>n.pitch===48).program,1);assert.equal(p.infinite,false);
});
test('Unknown bank slot and unsupported instrument index are rejected',()=>{
 assert.throws(()=>sample(42),/Unknown HeartGold/);
 assert.throws(()=>sample(1028,127),/not defined/);
});
test('Sample pitch ranges in actual HeartGold banks are enforced',()=>{
 const found=Object.entries(profiles.sequence_slots).find(([,item])=>{
   const bank=profiles.banks[item.bank];return bank?.programs.some(pg=>pg.pitch_ranges.some(([a,b])=>a>0||b<127));
 });
 assert.ok(found,'At least one SBNK contains a partial-range program');
 const [slot,info]=found;const pg=profiles.banks[info.bank].programs.find(pg=>pg.pitch_ranges.some(([a,b])=>a>0||b<127));
 const outside=Array.from({length:128},(_,n)=>n).find(n=>!pg.pitch_ranges.some(([a,b])=>n>=a&&n<=b));
 assert.notEqual(outside,undefined);
 assert.throws(()=>S.build({slot:Number(slot),profiles,tracks:[{program:pg.index,notes:[{pitch:outside,start:0,duration:48,velocity:90}]}]}),/cannot play note|not backed by samples/);
});
test('Corrupt headers, empty files, unsupported sequence command, and invalid notes are rejected',()=>{
 const b=sample();for(const idx of [0,4,8,16,24]){const edit=b.slice();edit[idx]^=3;assert.throws(()=>parseSseq(edit,1028))}
 assert.throws(()=>parseSseq(new Uint8Array(0),1028));
 const edit=b.slice(), idx=edit.indexOf(0xc7);assert.ok(idx>0);edit[idx]=0xe9;assert.throws(()=>parseSseq(edit,1028),/Unsupported/);
 assert.throws(()=>S.build({slot:1028,profiles,tracks:[{program:0,notes:[]}]}),/Empty/);
});
test('SSEQ size limits are enforced without allocating excessive sequences',()=>{
 assert.throws(()=>S.build({slot:1028,profiles,tracks:[{program:0,notes}],limit:35}),/exceeds/);
});
test('SSEQ-only Sigma Dex ZIP has exact selected tracks, folder hierarchy, and hashes',async()=>{
 const bytes=sample(), tracks=Array.from({length:10},(_,i)=>entry(i,bytes));
 const folders=[{id:'battle',name:'Battle',parent_id:'root'},{id:'wild',name:'Wild',parent_id:'battle'}];
 const assignments=Object.fromEntries(tracks.map((t,i)=>[t.id,i%2?'wild':'root']));
 const plan=E.selectedTrackPlan({tracks,folders,assignments,scope:'selected',selectedFolderIds:['wild'],selectedIds:['a0']});
 assert.equal(plan.tracks.length,6);
 const blobs=new Map(plan.tracks.map(t=>[t.id,new Blob([bytes])]));
 const {blob,manifest}=await E.packageFiles(plan,blobs,{id:'qa-fixed',createdAt:'2026-11-15T00:00:00.000Z'});
 assert.equal(manifest.track_count,6);assert.equal(manifest.version,2);
 const out=await E.verifyPackage(blob);assert.equal(out.tracks,6);
 const files=await SigmaDS.unzip(blob);assert.equal([...files.keys()].filter(x=>x.startsWith('music/')).length,6);
 for(const t of manifest.tracks){assert.ok(t.file.endsWith('.sseq'));assert.equal(hash(Buffer.from(await files.get(t.file).arrayBuffer())),t.sha256);assert.equal(t.bank_id,702)}
 assert.ok(![...files.keys()].some(n=>/\.(mp3|wav|flac)$/i.test(n)));
});
test('Sigma Dex refuses incomplete/corrupt ZIP and forged/invalid SSEQ bytes',async()=>{
 const b=sample(),t=entry(1,b),plan=E.selectedTrackPlan({tracks:[t]});
 await assert.rejects(E.packageFiles(plan,new Map()),/missing music files/);
 await assert.rejects(E.packageFiles(plan,new Map([[t.id,new Blob([new Uint8Array(35)])]])),/Invalid Nitro SSEQ/);
 const good=await E.packageFiles(plan,new Map([[t.id,new Blob([b])]]));
 const corrupt=Uint8Array.from(await good.blob.arrayBuffer());corrupt[Math.floor(corrupt.length/2)]^=0x20;
 await assert.rejects(E.verifyPackage(new Blob([corrupt])),/CRC|ZIP|checksum|corrupt|inflate|Invalid|Uncompressed/i);
});
test('Already stored SSEQ can be re-exported byte-for-byte with same SHA-256',async()=>{
 const b=sample(),track=entry(1,b),plan=E.selectedTrackPlan({tracks:[track]});
 const a=await E.packageFiles(plan,new Map([[track.id,new Blob([b])]]));
 const c=await E.packageFiles(plan,new Map([[track.id,new Blob([b])]]));
 assert.equal(a.tracks[0].sha256,c.tracks[0].sha256);
 assert.equal(hash(Buffer.from(await (await SigmaDS.unzip(a.blob)).get(a.tracks[0].file).arrayBuffer())),hash(b));
});

test('SSEQ library backup filenames cannot retain MP3/WAV source extension or traverse folders',async()=>{
 await import('../client_core.js');
 const core=globalThis.SigmaCore;
 assert.equal(core.sseqBackupPath('abc-123'),'audio/abc-123.sseq');
 assert.equal(core.sseqBackupPath('../sample.mp3'),'audio/..%2Fsample.mp3.sseq');
 assert.equal(core.sseqBackupPath('song/wav'),'audio/song%2Fwav.sseq');
 assert.throws(()=>core.sseqBackupPath(''),/Invalid backup/);
});
