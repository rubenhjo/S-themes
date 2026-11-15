import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readCatalog} from '../api/catalog.js';
import {jsonBody,safeError} from '../lib/common.js';
import uploadStatus from '../api/upload-status.js';

const root=new URL('../',import.meta.url);
function row(i){return {id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,created_at:new Date(1731600000000-i*1000).toISOString(),title:'Track '+i};}
function parseCursor(path){const m=path.match(/id\.lt\.([0-9a-f-]{36})/);return m?Number(m[1].slice(-12)):null;}
function pagedClient(count,{serverMax=1000,insert=false,mutate=false}={}){
 const rows=Array.from({length:count},(_,i)=>row(i));let calls=0;
 return async url=>{
  calls++;const limit=Number(url.match(/&limit=(\d+)/)?.[1]||0);
  assert.ok(limit>0 && limit<=serverMax,'Client must not assume Supabase returns >1000 rows');
  const cursor=parseCursor(url);
  if(insert&&calls===2)rows.unshift(row(-1)); // newer row visible on later refresh, not during snapshot pagination
  if(mutate&&calls===2)rows.splice(200,1);
  const start=cursor===null?0:rows.findIndex(x=>Number(x.id.slice(-12))===cursor)+1;
  return rows.slice(start,start+Math.min(limit,serverMax));
 };
}
for(const n of [0,1,999,1000,1001,1500]){
 test(`ST-030 stable keyset pagination returns exactly ${n} songs`,async()=>{
  const rows=await readCatalog(pagedClient(n));assert.equal(rows.length,n);
  assert.equal(new Set(rows.map(x=>x.id)).size,n);
  for(let i=1;i<rows.length;i++)assert.ok(rows[i-1].created_at>=rows[i].created_at);
 });
}
test('ST-030 newly inserted tracks do not shift cursor; later refresh includes them',async()=>{
 const records=await readCatalog(pagedClient(1500,{insert:true}));assert.equal(records.length,1500);
});
test('ST-030 rejects duplicate IDs rather than claiming complete catalog',async()=>{
 let calls=0;
 await assert.rejects(readCatalog(async()=>{calls++;return Array.from({length:500},(_,i)=>row(calls===1?i:400+i))}),/duplicate row/);
});
test('ST-036 invalid JSON is a client error with stable machine-readable code',()=>{
 assert.throws(()=>jsonBody({body:'{ broken json'}),e=>e.status===400&&/Invalid JSON/.test(e.message));
 const res={status(n){this.statusCode=n;return this},json(v){this.jsonBody=v;return this}};
 safeError(res,Object.assign(new Error('Invalid JSON'),{status:400}));
 assert.equal(res.statusCode,400);assert.equal(res.jsonBody.code,'INVALID_REQUEST');
 assert.ok(!JSON.stringify(res.jsonBody).includes('stack'));
});
test('ST-036 all JSON POST endpoints use common strict parser before reading Supabase',async()=>{
 const endpoints=['upload-start','upload-finish','upload-cancel','upload-status'];
 for(const name of endpoints){
  const {default:handler}=await import('../api/'+name+'.js');
  let response;
  const res={status(n){this.statusCode=n;return this},json(v){response=v;return this},setHeader(){return this}};
  await handler({method:'POST',body:'{"',headers:{}},res);
  assert.equal(res.statusCode,400,`Expected 400 for ${name}`);
  assert.equal(response.code,'INVALID_REQUEST');
 }
});
test('ST-034 validation pipeline does not directly publish in upload-finish',()=>{
 const source=readFileSync(new URL('../api/upload-finish.js',import.meta.url),'utf8');
 assert.match(source,/rpc\('queue_theme_upload'/);
 assert.doesNotMatch(source,/rpc\('publish_theme_upload'/);
 const worker=readFileSync(new URL('../scripts/validate-pending.mjs',import.meta.url),'utf8');
 assert.match(worker,/parseSseq/);
 assert.match(worker,/rpc\('publish_theme_upload'/);
});
test('ST-035 quota migration serializes all public reservations and counts real object bytes',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261114_qc7_validation_quota.sql',import.meta.url),'utf8');
 assert.match(sql,/pg_advisory_xact_lock\(98765431\)/);
 assert.match(sql,/theme_accounted_bytes/);assert.match(sql,/storage\.objects/);
 assert.match(sql,/v_used\+p_size>v_limit/);
 assert.match(sql,/in \('pending','validating','processing'\)/);
});
test('ST-037 new reservations are checked with upload-status before being re-used',()=>{
 const source=readFileSync(new URL('app.js',root),'utf8');
 assert.match(source,/getJSON\('\/api\/upload-status'/);
 assert.match(source,/if\(status\.status==='pending'\)reservation=candidate/);
 assert.match(source,/if\(!reservation\)sessionRemove\('sigma-upload-'/);
});

test('ST-030 transient pagination failure is retried, nontransient 400 is not',async()=>{
 let calls=0;
 const rows=await readCatalog(async()=>{calls++;if(calls===1)throw Object.assign(Error('temporary'),{status:502});return [row(0)]});
 assert.equal(calls,2);assert.equal(rows.length,1);
 calls=0;
 await assert.rejects(readCatalog(async()=>{calls++;throw Object.assign(Error('invalid'),{status:400})}),/invalid/);
 assert.equal(calls,1);
});

test('ST-037 finish is idempotent when the same receipt is already queued, without publishing twice',async()=>{
 const {default:finish}=await import('../api/upload-finish.js');
 const {hmac}=await import('../lib/common.js');
 const old=globalThis.fetch;
 process.env.SUPABASE_URL='https://example.supabase.co';
 process.env.SUPABASE_SERVICE_ROLE_KEY='a'.repeat(64);
 process.env.UPLOAD_HMAC_SECRET='b'.repeat(64);
 const id='e7ebec2c-f475-499e-8447-0c46d9ab1c67',receipt='c'.repeat(64);
 const base={id,secret_hash:hmac(receipt),expires_at:new Date(Date.now()+3600000).toISOString()};
 let status='validating',calls=[];
 try{
  globalThis.fetch=async url=>{calls.push(String(url));if(String(url).includes('/rest/v1/theme_uploads'))return Response.json([{...base,status}]);throw Error('Must not requeue/re-publish')};
  const res={status(n){this.statusCode=n;return this},json(v){this.body=v;return this},setHeader(){return this}};
  await finish({method:'POST',body:{uploadId:id,receipt},headers:{}},res);
  assert.equal(res.statusCode,202);assert.equal(res.body.pending,true);assert.equal(calls.length,1);
  calls=[];status='published';
  const res2={status(n){this.statusCode=n;return this},json(v){this.body=v;return this},setHeader(){return this}};
  await finish({method:'POST',body:{uploadId:id,receipt},headers:{}},res2);
  assert.equal(res2.statusCode,200);assert.equal(res2.body.published,true);assert.equal(calls.length,1);
 }finally{globalThis.fetch=old}
});
