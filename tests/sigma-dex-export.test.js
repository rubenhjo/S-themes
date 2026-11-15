import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const context={Blob,TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView,Float32Array,crypto:webcrypto,console,Math,Date,Promise,Map,Set,Error,Number,String,Object,Array};context.globalThis=context;
for(const file of ['ds_audio.js','sseq_codec.js','sigma_dex_export.js'])runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
context.SigmaBankProfiles=JSON.parse(readFileSync(new URL('../heartgold_bank_profiles.json',import.meta.url),'utf8'));
const {SigmaDexExport:E,SigmaDS:DS,SigmaSSEQ:S}=context;
const clone=x=>JSON.parse(JSON.stringify(x));
const bank=S.profileSlot(context.SigmaBankProfiles,1028);
const prog=bank.bank.programs.find(p=>[60,62,64,67].every(n=>p.pitch_ranges.some(([lo,hi])=>lo<=n&&n<=hi))).index;
function raw(){return S.build({slot:1028,profiles:context.SigmaBankProfiles,tempo:120,loop:true,tracks:[{program:prog,notes:[{start:0,duration:20,pitch:60},{start:24,duration:20,pitch:62},{start:48,duration:20,pitch:64},{start:72,duration:20,pitch:67}]}]});}
const audio=new Blob([raw()],{type:'application/octet-stream'}),sha=await E.sha256(audio);
const sample=(id,title)=>({id,title,artist:'Composer',original_filename:id+'.sseq',duration_s:1.0,size_bytes:audio.size,sha256:sha,mime_type:'application/octet-stream',sseq_id:1028,created_at:new Date().toISOString()});
const folders=[{id:'battle',parent_id:'root',name:'Battle'},{id:'wild',parent_id:'battle',name:'Wild'},{id:'other',parent_id:'root',name:'Other'}];
const tracks=[sample('song1','Same'),sample('song2','Same'),sample('song3','Else')];
const assignments={song1:'wild',song2:'wild',song3:'other'};
const plan=(opts={})=>E.selectedTrackPlan({tracks,folders,assignments,metadata:{},...opts});
test('folder nesting, cycle prevention and duplicate titles preserve unique IDs',()=>{
 assert.equal(E.folderIndex(folders).get('wild').path,'Battle/Wild');
 assert.throws(()=>E.folderIndex([...folders,{id:'self',name:'Cycle',parent_id:'self'}]),/cycle/i);
 assert.throws(()=>E.createFolder(folders,'Wild','battle','twin'),/Duplicate/);
 assert.throws(()=>E.moveFolder(folders,'battle','wild'),/cycle/);
 assert.equal(new Set(plan().tracks.map(x=>x.file)).size,3);
});
test('selection includes exactly chosen folders, subfolders or individual songs',()=>{
 const one=plan({scope:'selected',selectedFolderIds:['wild']});
 assert.deepEqual(clone(one.tracks.map(t=>t.id)),['song1','song2']);
 const two=plan({scope:'selected',selectedFolderIds:['wild'],selectedIds:['song3']});
 assert.deepEqual(clone(two.tracks.map(t=>t.id)),['song1','song2','song3']);
});
test('metadata and overlapping game IDs are validated',()=>{
 assert.throws(()=>plan({metadata:{song1:{loop_start_sec:.8,loop_end_sec:.2}}}),/loop/);
 assert.throws(()=>plan({metadata:{song1:{event_id:65536}}}),/event ID/);
 assert.throws(()=>plan({metadata:{song1:{event_id:99},song2:{event_id:99}}}),/Duplicate/);
});
test('SSEQ ZIP pack has no WAV/MP3, hashes match and original bytes are preserved',async()=>{
 const p=plan({scope:'selected',selectedFolderIds:['wild']});
 const encoded=new Map(p.tracks.map(t=>[t.id,audio]));const result=await E.packageFiles(p,encoded,{id:'testpack',createdAt:'2026-11-15T00:00:00Z'});
 assert.equal(result.manifest.format,'sigma-themes/sigma-dex-sseq-pack');assert.equal(result.manifest.track_count,2);
 const zip=await DS.unzip(result.blob);
 assert.equal(zip.has('manifest.json'),true);assert.equal(zip.has('checksums.sha256'),true);
 assert.ok([...zip.keys()].every(path=>!path.startsWith('music/')||path.endsWith('.sseq')));
 assert.deepEqual(clone(await E.verifyPackage(result.blob)),{ok:true,tracks:2,bytes:result.blob.size});
 for(const t of result.tracks){assert.equal(await E.sha256(zip.get(t.file)),sha);assert.deepEqual(new Uint8Array(await zip.get(t.file).arrayBuffer()),new Uint8Array(await audio.arrayBuffer()))}
});
test('missing, non-sequence or corrupted source is rejected before export',async()=>{
 const p=plan({scope:'selected',selectedIds:['song1']});
 await assert.rejects(E.packageFiles(p,new Map()),/missing music files/i);
 await assert.rejects(E.packageFiles(p,new Map([['song1',new Blob(['RIFF bad WAV'])]])),/SSEQ|size/i);
 const broken=new Uint8Array(await audio.arrayBuffer());broken[8]^=1;
 await assert.rejects(E.packageFiles(p,new Map([['song1',new Blob([broken])]])),/header/i);
 const ctl=new AbortController();ctl.abort();await assert.rejects(E.packageFiles(p,new Map([['song1',audio]]),{signal:ctl.signal}),/canceled/);
});
test('10 and 200 item libraries retain exact selection without ID collisions',async()=>{
 const many=Array.from({length:200},(_,i)=>sample('song-'+i,'Same'));
 const full=E.selectedTrackPlan({tracks:many,folders,assignments:{},metadata:{}});
 assert.equal(full.tracks.length,200);assert.equal(new Set(full.tracks.map(t=>t.file)).size,200);
 const small=E.selectedTrackPlan({tracks:many.slice(0,10),folders,assignments:{},metadata:{}});
 const result=await E.packageFiles(small,new Map(small.tracks.map(t=>[t.id,audio])));
 assert.equal((await E.verifyPackage(result.blob)).tracks,10);
});
test('ZIP corruption cannot falsely verify as complete',async()=>{
 const p=plan({scope:'selected',selectedIds:['song1']});const result=await E.packageFiles(p,new Map([['song1',audio]]));
 const damaged=new Uint8Array(await result.blob.arrayBuffer());damaged[250]^=0xff;
 await assert.rejects(E.verifyPackage(new Blob([damaged])),/ZIP|checksum|corrupt|mismatch|Invalid/i);
});
