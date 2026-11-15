import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const root = new URL('../', import.meta.url);
function core(){const context={AbortController,AbortSignal,setTimeout,clearTimeout,console,URL};vm.runInNewContext(readFileSync(new URL('client_core.js',root),'utf8'),context);return context.SigmaCore;}
const arr=x=>Array.from(x);
const ids=['mellow','bolt','yellow'];
const visible=['mellow','yellow'];

test('ST-020 filtered playlist: Mellow/Bolt/Yellow moves Yellow upward without moving Bolt',()=>{
 const c=core();const newOrder=arr(c.reorderVisibleSlots(ids,visible,'yellow',-1));
 assert.deepEqual(newOrder,['yellow','bolt','mellow']);
 assert.deepEqual(ids,['mellow','bolt','yellow']);
 assert.deepEqual(arr(c.reorderVisibleSlots(newOrder,visible,'yellow',1)),ids);
});
test('ST-020 boundary, duplicate titles with distinct IDs, rapid successive reorder and unfiltered lists',()=>{
 const c=core();const full=['a1','hidden','a2','z'];const shown=['a1','a2','z'];
 assert.deepEqual(arr(c.reorderVisibleSlots(full,shown,'a1',-1)),full);
 assert.deepEqual(arr(c.reorderVisibleSlots(full,shown,'z',1)),full);
 const twice=c.reorderVisibleSlots(c.reorderVisibleSlots(full,shown,'z',-1),shown,'z',-1);
 assert.deepEqual(arr(twice),['z','hidden','a1','a2']);
 assert.deepEqual(arr(c.reorderVisibleSlots(ids,ids,'yellow',-1)),['mellow','yellow','bolt']);
 assert.throws(()=>c.reorderVisibleSlots(['duplicate','duplicate'],['duplicate'],'duplicate',1),/Duplicate track ID/);
});
test('ST-021 client_core script loaded once and no duplicate local script names',()=>{
 const html=readFileSync(new URL('index.html',root),'utf8');
 const src=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(x=>x[1]);
 assert.equal(src.filter(x=>x==='client_core.js').length,1);
 assert.equal(src.length,new Set(src).size,'Duplicate script URL found');
 assert.ok(src.indexOf('client_core.js')<src.indexOf('app.js'));
 const css=[...html.matchAll(/<link\b[^>]*href=["']([^"']+\.css)["']/g)].map(x=>x[1]);
 assert.equal(css.length,new Set(css).size);
});
test('ST-022 independent one-part, two-part, three-part DS manifests, complete ID inventory',()=>{
 const c=core();const files=[1,2,3,4,5].map(i=>({name:`music/${i}.wav`,blob:new Blob([new Uint8Array(i+1)])}));
 const base={export_id:'RUN-1',format:'sigma-themes/heartgold-audio-pack-v3',tracks:files.map((f,i)=>({id:String(i+1),file:f.name,output_sha256:createHash('sha256').update(Buffer.alloc(i+2)).digest('hex'),sseq_id:100+i}))};
 for(const limit of [100,12,7]){
  const parts=arr(c.partitionDS(files,limit));
  if(limit===100)assert.equal(parts.length,1);
  if(limit===12)assert.ok(parts.length>=2);
  if(limit===7)assert.ok(parts.length>=3);
  const seen=[];
  for(let i=0;i<parts.length;i++){
   const manifest=c.dsPartManifest(base,parts[i],i+1,parts.length);
   assert.equal(manifest.part,i+1);assert.equal(manifest.total_parts,parts.length);
   assert.equal(manifest.complete_export_id,'RUN-1');
   assert.deepEqual(arr(manifest.tracks.map(t=>t.file)),arr(parts[i].map(x=>x.name)));
   assert.ok(manifest.tracks.every(t=>/^[a-f0-9]{64}$/.test(t.output_sha256)));
   seen.push(...manifest.tracks.map(t=>t.id));
  }
  assert.deepEqual(seen,['1','2','3','4','5']);
 }
 assert.throws(()=>c.partitionDS([{name:'too-large.wav',blob:new Blob([new Uint8Array(21)])}],20),/exceeds/);
 assert.throws(()=>c.dsPartManifest(base,[{name:'other',blob:new Blob([])}],1,1),/mismatch/);
});
test('ST-023/ST-024 source includes pageshow recovery, single polling path and config retry with timeouts',()=>{
 const js=readFileSync(new URL('app.js',root),'utf8');
 assert.match(js,/window\.addEventListener\('pageshow'/);
 assert.match(js,/function stopRealtime\(\)/);
 assert.match(js,/async function refreshService\(/);
 assert.match(js,/SigmaCore\.retryTransient\(/);
 assert.match(js,/loadConfig\(\{silent:true\}\),loadCatalog\(\{silent:true\}\)/);
 assert.match(js,/refreshTimer!==null/); // Regression depends on separate browser scenario test below, not this static check alone.
});
test('ST-026 cached TUS URL cannot send signed token to a foreign origin or unrelated path',()=>{
 const c=core(),base='https://project.storage.supabase.co/storage/v1/upload/resumable';
 assert.equal(c.validateTusURL('/storage/v1/upload/resumable/abc',base),'https://project.storage.supabase.co/storage/v1/upload/resumable/abc');
 assert.throws(()=>c.validateTusURL('https://attacker.test/storage/v1/upload/resumable/abc',base),/Untrusted/);
 assert.throws(()=>c.validateTusURL('https://project.storage.supabase.co/other',base),/Untrusted/);
 assert.throws(()=>c.validateTusURL('http://project.storage.supabase.co/storage/v1/upload/resumable/abc',base),/Untrusted/);
});
test('ST-028 corrupted local playlists/favorites are normalized and volume zero is preserved',()=>{
 const c=core(),s=c.normalizePersonalState({playlists:[null,{id:'p',name:'Mine'},{id:'p',name:'Duplicate'}],
  items:[null,{track_id:'a',playlist_id:'p',position:0}],likes:[null,{track_id:'gone',position:0}],
  queue:['a',null,0,'gone'],volume:0,sort:'unexpected',dsMappings:null});
 assert.equal(s.volume,0);assert.equal(s.playlists.length,1);assert.equal(s.items.length,1);
 assert.equal(s.likes.length,1);assert.deepEqual(arr(s.queue),['a','gone']);
 assert.equal(s.sort,'added');assert.equal(s.muted,false);
});
test('ST-026 TUS resume entry is tied to upload reservation, not only song hash',()=>{
 const c=core(),hash='a'.repeat(64);
 const old=c.tusSessionKey(hash,'old-upload');const next=c.tusSessionKey(hash,'new-upload');
 assert.notEqual(old,next);assert.ok(old.includes('old-upload'));
 assert.throws(()=>c.tusSessionKey(hash,'../../stolen'),/Invalid/);
});
test('ST-020 negative control: the previous filtered comparator cannot order hidden entries',()=>{
 const old=[{track_id:'mellow'},{track_id:'bolt'},{track_id:'yellow'}],rank=new Map([['yellow',0],['mellow',1]]);
 old.sort((a,b)=>rank.get(a.track_id)-rank.get(b.track_id));
 assert.notDeepEqual(old.map(x=>x.track_id),['yellow','bolt','mellow']);
 const c=core();assert.deepEqual(arr(c.reorderVisibleSlots(ids,visible,'yellow',-1)),['yellow','bolt','mellow']);
});
test('ST-024 config retry classifies HTTP 500/502/503/504 as transient',()=>{
 const c=core();for(const status of [500,502,503,504])assert.equal(c.classify(Object.assign(new Error('temporary'),{status})),'server');
 assert.equal(c.classify(new c.TimeoutError()),'timeout');
 assert.equal(c.classify(Object.assign(new Error('offline'),{code:'NETWORK_ERROR'})),'network');
});
