import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url);
const context={Blob,TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView,Float32Array,crypto:webcrypto,console,Math,Date,Promise,Map,Set,Error,Number,String,Object,Array};
context.globalThis=context;
runInNewContext(readFileSync(new URL('../ds_audio.js',import.meta.url),'utf8'),context);
runInNewContext(readFileSync(new URL('../sigma_dex_export.js',import.meta.url),'utf8'),context);
const {SigmaDexExport:E,SigmaDS:DS}=context;
const clone=x=>JSON.parse(JSON.stringify(x));
const sample=(id,title,folder='root')=>({id,title,artist:'Composer',original_filename:'source.mp3',duration_s:1.2,size_bytes:200,sha256:'a'.repeat(64),created_at:new Date().toISOString()});
const folders=[{id:'battle',parent_id:'root',name:'Battle'},{id:'wild',parent_id:'battle',name:'Wild'},{id:'other',parent_id:'root',name:'Other'}];
const tracks=[sample('song1','Same'),sample('song2','Same'),sample('song3','Else')];
const assignments={song1:'wild',song2:'wild',song3:'other'};
const plan=(opts={})=>E.selectedTrackPlan({tracks,folders,assignments,metadata:{},...opts});
const makeWav=(loop)=>DS.encodeImaWav([new Float32Array(32728).fill(.1),new Float32Array(32728).fill(-.1)],32728,loop);

test('folders: nesting, moves and no cycles or same-name siblings',()=>{
 assert.equal(E.folderIndex(folders).get('wild').path,'Battle/Wild');
 assert.throws(()=>E.folderIndex([...folders,{id:'self',name:'Thing',parent_id:'self'}]),/cycle/i);
 assert.throws(()=>E.createFolder(folders,'Wild','battle','twin'),/Duplicate folder/);
 assert.throws(()=>E.moveFolder(folders,'battle','wild'),/cycle/i);
 assert.equal(E.createFolder(folders,'Gym','battle','gym').length,4);
});
test('safe path handling and duplicate titles with unique IDs',()=>{
 assert.throws(()=>E.safeName('../'),/Unsafe name/);
 assert.equal(E.safeName('Intro/Theme:One'),'Intro_Theme_One');
 const p=plan();assert.equal(p.tracks.length,3);
 assert.notEqual(p.tracks[0].file,p.tracks[1].file);
 assert.equal(p.tracks[0].folder_path,'Battle/Wild');
 assert.equal(new Set(p.tracks.map(t=>t.file)).size,3);
});
test('folder-only and multi-folder selections preserve exact songs and metadata',()=>{
 const single=plan({scope:'selected',selectedFolderIds:['wild']});
 assert.deepEqual(clone(single.tracks.map(x=>x.id)),['song1','song2']);
 assert.deepEqual(clone(plan({scope:'selected',selectedFolderIds:['wild','other']}).tracks.map(x=>x.id)),['song1','song2','song3']);
 const none=plan({scope:'selected',selectedFolderIds:['battle'],selectedIds:['song3']});
 assert.equal(none.tracks.length,3);
 assert.equal(new Set(none.tracks.map(t=>t.id)).size,3);
});
test('metadata and invalid loop/event ID reject before encoding',()=>{
 assert.throws(()=>plan({metadata:{song1:{loop_start_sec:1.1,loop_end_sec:.2}}}),/loop points/);
 assert.equal(plan({metadata:{song1:{artist:''}}}).tracks[0].artist,'Composer');
 assert.throws(()=>plan({metadata:{song1:{event_id:65536}}}),/music\/event ID/);
});
test('WAV loop start/end frame aligned to ADPCM blocks, no loop when disabled',async()=>{
 const a=makeWav({start:.12,end:.76});const i=await E.wavInfo(a);
 assert.equal(i.codec,17);assert.equal(i.channels,2);assert.equal(i.rate,32728);
 assert.ok(Math.abs(i.smpl.start/32728-.12)<.01);
 assert.ok(Math.abs((i.smpl.end+1)/32728-.76)<.01);
 assert.equal(i.smpl.start%505,0);
 assert.equal((i.smpl.end+1)%505,0);
 assert.equal((await E.wavInfo(makeWav(false))).smpl,null);
});
test('v1 pack: manifest, file hash, folders, WAV and loops validated',async()=>{
 const p=plan({scope:'selected',selectedFolderIds:['wild'],metadata:{song1:{loop_start_sec:.12,loop_end_sec:.76},song2:{loop_enabled:false}}});
 const blobs=new Map([['song1',makeWav({start:.12,end:.76})],['song2',makeWav(false)]]);
 const built=await E.packageFiles(p,blobs,{id:'pack-test',createdAt:'2026-11-15T00:00:00.000Z'});
 assert.equal(built.manifest.format,E.FORMAT);assert.equal(built.manifest.track_count,2);
 assert.equal(built.tracks[0].loop_enabled,true);assert.equal(built.tracks[1].loop_enabled,false);
 assert.deepEqual(clone(await E.verifyPackage(built.blob)),{ok:true,tracks:2,folders:3,bytes:built.blob.size});
 const zip=await DS.unzip(built.blob);
 assert.equal(zip.has('manifest.json'),true);assert.equal(zip.has('checksums.sha256'),true);
});
test('missing song and bad RIFF are rejected, aborted export stops',async()=>{
 const p=plan({scope:'selected',selectedIds:['song1']});
 await assert.rejects(E.packageFiles(p,new Map()),/missing audio files/);
 await assert.rejects(E.packageFiles(p,new Map([['song1',new Blob(['not WAV'])]])),/Invalid RIFF/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(E.packageFiles(p,new Map([['song1',makeWav(true)]]),{signal:controller.signal}),/canceled/);
});
test('duplicate IDs and conflicting folder references are rejected',()=>{
 assert.throws(()=>E.selectedTrackPlan({tracks:[sample('x','X'),sample('x','X')]}),/Duplicate/);
 assert.throws(()=>plan({assignments:{song1:'deleted',song2:'wild',song3:'other'}}),/deleted folder/);
});
test('10-song selected export and 200-song large library keep stable IDs and exact membership',async()=>{
 const trackSet=Array.from({length:200},(_,i)=>sample('test-'+String(i).padStart(3,'0'),'Common theme'));
 const p=E.selectedTrackPlan({tracks:trackSet,folders,assignments:Object.fromEntries(trackSet.map((t,i)=>[t.id,i%2?'battle':'other'])),scope:'all'});
 assert.equal(p.tracks.length,200);
 assert.equal(new Set(p.tracks.map(t=>t.file)).size,200);
 const blob=DS.encodeImaWav([new Float32Array(700),new Float32Array(700)],32728,false);
 const first10=E.selectedTrackPlan({tracks:trackSet.slice(0,10),folders,metadata:Object.fromEntries(trackSet.slice(0,10).map(t=>[t.id,{loop_enabled:false}]))});
 const encoded=new Map(first10.tracks.map(t=>[t.id,blob]));
 const out=await E.packageFiles(first10,encoded);
 assert.equal((await E.verifyPackage(out.blob)).tracks,10);
});
test('ZIP corruption is detected, not reported as success',async()=>{
 const p=plan({scope:'selected',selectedIds:['song1']});
 const good=await E.packageFiles(p,new Map([['song1',makeWav(true)]]));
 const bytes=new Uint8Array(await good.blob.arrayBuffer());
 bytes[220]^=0xff;
 await assert.rejects(E.verifyPackage(new Blob([bytes])),/ZIP|checksum|Invalid|mismatch/);
});
