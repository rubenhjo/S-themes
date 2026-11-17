import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/upload-start.js';
const read=relative=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const sql=read('docs/legacy_migrations/20261116_inline_sseq_publication.sql');

test('release schema preserves 39 banks and 2,593 selectable SBNK programs',()=>{
 const data=JSON.parse(read('heartgold_bank_profiles.json'));
 assert.equal(Object.keys(data.banks).length,39);
 assert.equal(Object.values(data.banks).reduce((sum,b)=>sum+b.programs.length,0),2593);
 assert.deepEqual(Object.keys(data.banks).map(Number).sort((a,b)=>a-b),Array.from({length:39},(_,i)=>700+i));
});
test('last migration uses 30/100/500 quotas and permits separate songs with equal hashes',()=>{
 assert.match(sql,/v_count>=30\b/);
 assert.match(sql,/v_count>=100\b/);
 assert.match(sql,/v_count>=500\b/);
 assert.match(sql,/pg_advisory_xact_lock\(/);
 assert.match(sql,/DROP INDEX IF EXISTS public\.theme_tracks_unique_sequence/i);
 assert.match(sql,/DROP CONSTRAINT IF EXISTS theme_tracks_sha256_key/i);
 const body=sql.slice(sql.indexOf('create or replace function public.reserve_theme_upload('),sql.indexOf('CREATE OR REPLACE FUNCTION public.claim_theme_validation_for_upload('));
 assert.doesNotMatch(body,/where\s+sha256\s*=\s*p_sha256/i);
 assert.match(read('app.js'),/sigma-upload-'\+hash\+'-'\+slot\+'-'\+encodeURIComponent\(metadata\.title\)/);
});
test('API finalization checks stored SSEQ then claims fenced inline publication',()=>{
 const api=read('api/upload-finish.js');
 assert.match(api,/parseSseq\(Buffer\.concat\(chunks\),slot\)/);
 assert.match(api,/claim_theme_validation_for_upload/);
 assert.match(api,/publish_theme_upload/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.claim_theme_validation_for_upload\(uuid,text\) TO service_role/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.claim_theme_validation_for_upload\(uuid,text\) FROM PUBLIC,anon,authenticated/);
});

test('hourly, daily and global SQL quota errors are surfaced as HTTP 429, never disguised as 502',async()=>{
 const existing=globalThis.fetch;
 const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','UPLOAD_HMAC_SECRET','TURNSTILE_SECRET_KEY','TURNSTILE_HOSTNAME'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(40),UPLOAD_HMAC_SECRET:'h'.repeat(40),TURNSTILE_SECRET_KEY:'t'.repeat(30),TURNSTILE_HOSTNAME:'test.example'});
 try{
  for(const failure of ['Hourly upload limit reached','Daily upload limit reached','Global daily upload capacity reached']){
   let reservations=0;
   globalThis.fetch=async url=>{
    if(String(url).includes('/siteverify'))return Response.json({success:true,hostname:'test.example',action:'music_upload'});
    if(String(url).includes('/rpc/reserve_theme_upload')){reservations++;return Response.json({message:failure},{status:400});}
    throw Error('Unexpected HTTP route '+url);
   };
   const req={method:'POST',headers:{'x-forwarded-for':'203.0.113.10'},body:{size:80,name:'melody.sseq',sha256:'a'.repeat(64),turnstileToken:'x'.repeat(32)}};
   const res={statusCode:null,payload:null,status(s){this.statusCode=s;return this;},json(p){this.payload=p;return this;},setHeader(){}};
   await handler(req,res);
   assert.equal(res.statusCode,429,failure);
   assert.equal(res.payload.code,'RATE_LIMITED',failure);
   assert.equal(reservations,1);
  }
 }finally{
  globalThis.fetch=existing;
  for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
 }
});
