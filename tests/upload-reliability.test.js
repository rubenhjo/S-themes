import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hmac} from '../lib/common.js';
import finish from '../api/upload-finish.js';

const oldFetch=globalThis.fetch;
const id='e7ebec2c-f475-499e-8447-0c46d9ab1c67';
const receipt='a'.repeat(64);
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this},setHeader(){return this},json(b){this.body=b;return this}});
const request=()=>({method:'POST',body:{uploadId:id,receipt,metadata:{slot:1028,title:'QA',artist:'QA'}}});
function configure(){process.env.SUPABASE_URL='https://unit-test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='x'.repeat(64);process.env.UPLOAD_HMAC_SECRET='y'.repeat(64);}
async function simulate(storageStatus){
 configure();const row={id,secret_hash:hmac(receipt),expires_at:new Date(Date.now()+60000).toISOString(),status:'pending',original_filename:'qa.sseq',size_bytes:59,sha256:'f'.repeat(64),extension:'sseq',storage_path:'uploads/'+id+'.sseq'};
 const requests=[];
 try{
  globalThis.fetch=async(url)=>{
   const u=String(url);requests.push(u);
   if(u.includes('/rest/v1/theme_uploads'))return Response.json([row]);
   if(u.includes('/storage/v1/object/authenticated'))return new Response('rejected',{status:storageStatus});
   throw Error('No RPC should execute when Storage cannot be read');
  };
  const r=response();await finish(request(),r);return {r,requests};
 }finally{globalThis.fetch=oldFetch;}
}
test('Storage 404 is a definitive missing object, not a DB failure',async()=>{
 const {r,requests}=await simulate(404);
 assert.equal(r.statusCode,404);assert.equal(r.body.error,'Uploaded file is missing');assert.equal(requests.length,2);
});
test('Storage 403 is never misclassified as missing; upload must not blindly retry PUT',async()=>{
 const original=console.error;let logs=[];console.error=(...args)=>logs.push(args);
 try{const {r,requests}=await simulate(403);
  assert.equal(r.statusCode,502);assert.equal(r.body.code,'SERVICE_UNAVAILABLE');assert.equal(requests.length,2);
  assert.ok(logs.some(x=>String(x[0]).includes('Storage read failed')));
 }finally{console.error=original;}
});
test('Production SQL explicitly grants only server-only upload REST privileges',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261115_upload_pipeline_permissions.sql',import.meta.url),'utf8');
 assert.match(sql,/GRANT SELECT ON TABLE public\.theme_tracks TO service_role/i);
 assert.match(sql,/GRANT SELECT, DELETE ON TABLE public\.theme_uploads TO service_role/i);
 assert.match(sql,/REVOKE ALL ON TABLE public\.theme_uploads FROM PUBLIC, anon, authenticated/i);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.queue_theme_upload/i);
 assert.doesNotMatch(sql,/GRANT (?:ALL|INSERT|UPDATE|DELETE) ON TABLE public\.theme_uploads TO anon/i);
});
test('Retries are preceded by a server-side object check, not an unconditional signed PUT',()=>{
 const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(src,/if\(resumedReservation\)completion=await finishIfStored\(\)/);
 assert.match(src,/isStorageDuplicate\(e\)/);
 assert.match(src,/if\(e\.status===404&&e\.message==='Uploaded file is missing'\)return null/);
 assert.doesNotMatch(src,/x-upsert':['"]true/);
});
