import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hmac} from '../lib/common.js';
import deleteSong from '../api/song-delete.js';
import {assertStoredSongPath,isAdminDeletionToken} from '../lib/song-deletion.js';
import cleanup from '../api/cleanup.js';
import catalog from '../api/catalog.js';
import audio from '../api/audio.js';

const id='e7ebec2c-f475-499e-8447-0c46d9ab1c67';
const receipt='a'.repeat(64);
const adminKey='b'.repeat(64);
const path='uploads/'+id+'.sseq';
const oldFetch=globalThis.fetch;
function response(){return {statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(s){this.statusCode=s;return this},json(d){this.body=d;return this},end(){return this}}}
function request(body,method='POST'){return {method,body,headers:{}}}
function config(){Object.assign(process.env,{SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(64),UPLOAD_HMAC_SECRET:'h'.repeat(64),SONG_DELETE_ADMIN_TOKEN:adminKey,CRON_SECRET:'cron-secret'})}
function mockRoutes({removeStatus=200,tombstone=true,failMark=false,ownerHash=hmac(receipt),trackDeleted=false}={}){
 const calls=[];
 globalThis.fetch=async(url,options={})=>{
  const u=String(url);calls.push({u,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  if(u.includes('request_theme_song_delete')){
   const b=JSON.parse(options.body);
   if(!b.p_admin && b.p_secret_hash!==ownerHash)return Response.json(null);
   return Response.json(tombstone?{id,storage_path:path,storage_deleted:trackDeleted}:null);
  }
  if(u.includes('mark_theme_song_storage_deleted'))return failMark?Response.json({message:'temporary failure'},{status:503}):Response.json(true);
  if(u.includes('/storage/v1/object/'))return new Response(removeStatus===204?null:'',{status:removeStatus});
  throw Error('Unexpected route: '+u);
 };
 return calls;
}
async function run(body){const res=response();await deleteSong(request({trackId:id,...body}),res);return res}
test('delete: rejects wrong HTTP method, missing credentials, malformed credentials without touching DB',async()=>{
 config();let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Should not call network')};
 for(const [body,method,expected] of [[{receipt},'DELETE',405],[{},'POST',403],[{receipt:'x'},'POST',403],[{receipt,adminToken:adminKey},'POST',403]]){
  const r=response();await deleteSong(request({trackId:id,...body},method),r);assert.equal(r.statusCode,expected);
 }
 assert.equal(calls,0);globalThis.fetch=oldFetch;
});
test('delete: wrong owner receipt cannot tombstone nor delete stored bytes',async()=>{
 config();const calls=mockRoutes();const r=await run({receipt:'c'.repeat(64)});assert.equal(r.statusCode,403);
 assert.equal(calls.filter(c=>c.u.includes('/storage/v1/object/')).length,0);globalThis.fetch=oldFetch;
});
test('delete: correct owner receipt marks the track before removing private Storage object',async()=>{
 config();const calls=mockRoutes();const r=await run({receipt});assert.equal(r.statusCode,200);assert.deepEqual(r.body,{deleted:true,cleanupPending:false});
 const rpc=calls.findIndex(c=>c.u.includes('request_theme_song_delete'));
 const storage=calls.findIndex(c=>c.u.includes('/storage/v1/object/'));
 assert.ok(rpc>=0&&storage>rpc);assert.equal(calls[rpc].body.p_admin,false);
 assert.equal(calls[rpc].body.p_secret_hash,hmac(receipt));assert.equal(calls[storage].method,'DELETE');
 assert.equal(calls.filter(c=>c.u.includes('mark_theme_song_storage_deleted')).length,1);globalThis.fetch=oldFetch;
});
test('delete: administrator key can delete historical songs without an owner receipt',async()=>{
 config();const calls=mockRoutes();const r=await run({adminToken:adminKey});assert.equal(r.statusCode,200);
 const b=calls.find(c=>c.u.includes('request_theme_song_delete')).body;assert.equal(b.p_admin,true);assert.equal(b.p_secret_hash,null);
 assert.ok(!JSON.stringify(r.body).includes(adminKey));globalThis.fetch=oldFetch;
});
test('delete: invalid admin key never reaches Supabase',async()=>{
 config();let count=0;globalThis.fetch=async()=>{count++};
 const r=await run({adminToken:'0'.repeat(64)});assert.equal(r.statusCode,403);assert.equal(count,0);
 assert.equal(isAdminDeletionToken('0'.repeat(64)),false);globalThis.fetch=oldFetch;
});
test('delete: failed Storage deletion is queued without restoring public visibility',async()=>{
 config();const calls=mockRoutes({removeStatus:500});const r=await run({receipt});assert.equal(r.statusCode,202);
 assert.deepEqual(r.body,{deleted:true,cleanupPending:true});assert.equal(calls.some(c=>c.u.includes('mark_theme_song_storage_deleted')),false);
 globalThis.fetch=oldFetch;
});
test('delete: lost DB acknowledgement after Storage 404 retries marking idempotently',async()=>{
 config();const calls=mockRoutes({removeStatus:404});const r=await run({receipt});assert.equal(r.statusCode,200);
 assert.equal(calls.filter(c=>c.u.includes('mark_theme_song_storage_deleted')).length,1);
 globalThis.fetch=oldFetch;
});
test('delete: already tombstoned and confirmed storage removal is idempotent',async()=>{
 config();const calls=mockRoutes({trackDeleted:true});const r=await run({receipt});assert.equal(r.statusCode,200);
 assert.equal(calls.filter(c=>c.u.includes('/storage/v1/object/')).length,0);
 globalThis.fetch=oldFetch;
});
test('delete: Storage path must match server-side canonical UUID path',()=>{
 assert.throws(()=>assertStoredSongPath('../other.sseq',id));
 assert.throws(()=>assertStoredSongPath('uploads/'+id+'.wav',id));
 assert.doesNotThrow(()=>assertStoredSongPath(path,id));
});
test('delete: cleanup cron retries tombstones with the secret-only cron route',async()=>{
 config();const calls=[];
 globalThis.fetch=async(url,opts={})=>{
  const u=String(url);calls.push(u);
  if(u.includes('theme_uploads?'))return Response.json([]);
  if(u.includes('theme_tracks?deleted_at=not.is.null'))return Response.json([{id,storage_path:path}]);
  if(u.includes('/storage/v1/object/'))return new Response(null,{status:204});
  if(u.includes('mark_theme_song_storage_deleted'))return Response.json(true);
  throw Error('Unexpected '+u);
 };
 const r=response();await cleanup({method:'GET',headers:{authorization:'Bearer cron-secret'}},r);
 assert.equal(r.statusCode,200);assert.equal(r.body.songsRemoved,1);assert.equal(r.body.songsPending,0);
 const unauth=response();await cleanup({method:'GET',headers:{}},unauth);assert.equal(unauth.statusCode,403);
 globalThis.fetch=oldFetch;
});
test('delete: public catalog query filters tombstones, and /api/audio returns 404',async()=>{
 config();const urls=[];
 globalThis.fetch=async u=>{urls.push(String(u));return Response.json([])};
 const cr=response();await catalog({method:'GET'},cr);assert.equal(cr.statusCode,200);assert.match(urls[0],/deleted_at=is.null/);
 const ar=response();await audio({method:'GET',query:{id}},ar);assert.equal(ar.statusCode,404);assert.match(urls[1],/deleted_at=is.null/);
 globalThis.fetch=oldFetch;
});
test('delete: SQL enforces owner/admin service-role-only writes and removes hidden tracks from public RLS and quota only after Storage confirmation',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261116220000_song_deletion.sql',import.meta.url),'utf8');
 assert.match(sql,/deleted_at IS NULL AND mime_type/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.request_theme_song_delete\(uuid,text,boolean\) FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.request_theme_song_delete\(uuid,text,boolean\) TO service_role/);
 assert.match(sql,/u\.status='published' AND u\.secret_hash=p_secret_hash/);
 assert.match(sql,/storage_deleted_at IS NULL/);
 assert.doesNotMatch(sql,/GRANT .*DELETE.*theme_tracks TO (?:anon|authenticated)/);
 const html=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(html,/saveOwnerReceipt\(reservation\.uploadId,reservation\.receipt\)/);
 assert.match(html,/showDeleteSongDialog/);
 assert.doesNotMatch(readFileSync(new URL('../api/config.js',import.meta.url),'utf8'),/SONG_DELETE_ADMIN_TOKEN/);
});
