import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import cancel from '../api/upload-cancel.js';
import {hmac} from '../lib/common.js';

function core(){
 const context={AbortController,AbortSignal,setTimeout,clearTimeout,console,URL};
 vm.runInNewContext(readFileSync(new URL('../client_core.js',import.meta.url),'utf8'),context);
 return context.SigmaCore;
}
function res(){return {code:200,status(n){this.code=n;return this},json(x){this.body=x;return this},setHeader(){return this}}}
function req(body){return {method:'POST',body,headers:{}}}
function setupEnv(){process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='abc'.repeat(32);process.env.UPLOAD_HMAC_SECRET='a'.repeat(64)}

test('upload cancellation preempts all retry attempts for both PUT and TUS work',async()=>{
 const c=core(),op=c.operation();let attempts=0;
 const task=c.retryTransient(async()=>{attempts++;op.cancel();const err=new Error('Network interrupted');err.code='NETWORK_ERROR';throw err}, {signal:op.signal,attempts:5,baseDelay:5});
 await assert.rejects(task,e=>e.code==='USER_CANCELLED');
 assert.equal(attempts,1);
});
test('a cancel is terminal, while network/server/timeout can retry',async()=>{
 const c=core();for(const k of ['cancelled','network','server','timeout','permanent']){
  const err=Object.assign(new Error(k),k==='cancelled'?{name:'AbortError'}:k==='network'?{code:'NETWORK_ERROR'}:k==='server'?{status:503}:k==='timeout'?{code:'TIMEOUT'}:{status:400});
  assert.equal(c.classify(err),k);
 }
 const o=c.operation();o.cancel();assert.throws(()=>o.check(),e=>e.code==='USER_CANCELLED');
});
test('Turnstile challenge times out instead of hanging and removes widget',async()=>{
 const c=core();let removed=0;
 const turnstile={render(){return 123},remove(){removed++}};
 await assert.rejects(c.turnstileToken({turnstile,siteKey:'SITE',element:{},timeoutMs:25,retries:0}),e=>e.code==='TIMEOUT');
 assert.equal(removed,1);
});
test('Turnstile expires once, resets, and can complete a later verification',async()=>{
 const c=core();let opts,reset=0,removed=0;
 const t={render(_el,o){opts=o;queueMicrotask(()=>o['expired-callback']());return 11},reset(){reset++;queueMicrotask(()=>opts.callback('valid-token'))},remove(){removed++}};
 const token=await c.turnstileToken({turnstile:t,siteKey:'SITE',element:{},timeoutMs:1000,retries:1});
 assert.equal(token,'valid-token');assert.equal(reset,1);assert.equal(removed,1);
});
test('Turnstile waiting challenge is abortable and cannot return a late token',async()=>{
 const c=core();let callback,removed=0;const o=c.operation();
 const t={render(_el,options){callback=options.callback;return 42},remove(){removed++}};
 const work=c.turnstileToken({turnstile:t,element:{},siteKey:'SITE',signal:o.signal,timeoutMs:1000});
 o.cancel();callback('late-token');
 await assert.rejects(work,e=>e.code==='USER_CANCELLED');assert.equal(removed,1);
});
test('temporary empty or partial catalog cannot prune personal references',()=>{
 const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const fn=js.slice(js.indexOf('function cleanQueue(){'),js.indexOf('function missingTrack('));
 assert.doesNotMatch(fn,/state\.likes\s*=\s*state\.likes\.filter/);
 assert.doesNotMatch(fn,/state\.items\s*=\s*state\.items\.filter/);
 const {sessionSnapshot,validResume}=core();
 const session=sessionSnapshot({playingId:'song-a',queue:['song-a'],view:'playlist:x'},63,1000);
 assert.equal(session.trackId,'song-a');assert.equal(session.context,'playlist:x');assert.equal(validResume(session,'song-a',100),63);
 assert.equal(validResume(session,'song-b',100),null);
});
test('selected/playlist/all exports include the exact requested song IDs',()=>{
 const c=core(),tracks=[{id:'a'},{id:'b'},{id:'c'}];
 assert.deepEqual(c.chooseTracks(tracks,'selected',['b','a']).map(x=>x.id),['a','b']);
 assert.deepEqual(c.chooseTracks(tracks,'view',[],['c']).map(x=>x.id),['c']);
 assert.equal(c.chooseTracks(tracks,'all').length,3);
 assert.throws(()=>c.assertDistinctMappings(tracks,{a:{sseq_id:77},b:{sseq_id:77}}));
 assert.equal(c.partition([{id:'a',size_bytes:30},{id:'b',size_bytes:30}],50).length,2);
});
test('server cancellation rejects forged receipt and published song',async()=>{
 setupEnv();const id='e7ebec2c-f475-499e-8447-0c46d9ab1c67';const receipt='b'.repeat(64);
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async (url)=>{
   if(String(url).includes('theme_uploads'))return Response.json([{id,secret_hash:hmac(receipt),status:'published',storage_path:'uploads/'+id+'.mp3'}]);
   throw Error('No mutation allowed');
  };
  const forged=res();await cancel(req({uploadId:id,receipt:'c'.repeat(64)}),forged);assert.equal(forged.code,403);
  const published=res();await cancel(req({uploadId:id,receipt}),published);assert.equal(published.code,409);
 }finally{globalThis.fetch=old}
});
test('server cancellation fails reservation before deleting partial storage',async()=>{
 setupEnv();const id='e7ebec2c-f475-499e-8447-0c46d9ab1c67',receipt='b'.repeat(64),sequence=[];
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async (url,opts={})=>{
   const u=String(url);sequence.push(u);
   if(u.includes('theme_uploads'))return Response.json([{id,secret_hash:hmac(receipt),status:'pending',storage_path:'uploads/'+id+'.mp3'}]);
   if(u.includes('fail_theme_upload'))return Response.json(true);
   if(u.includes('/storage/v1/object/'))return new Response(null,{status:204});
   throw Error('Unexpected request '+u)
  };
  const r=res();await cancel(req({uploadId:id,receipt}),r);
  assert.equal(r.code,200);assert.equal(r.body.canceled,true);
  assert.match(sequence[1],/fail_theme_upload/);assert.match(sequence[2],/storage\/v1\/object/);
 }finally{globalThis.fetch=old}
});
test('next/previous skip unavailable tracks without editing the persistent queue',()=>{
 const c=core(),queue=['a','missing','b','other'];const live=new Set(['a','b']);
 assert.equal(c.nextPlayableIndex(queue,0,1,live,'off'),2);
 assert.equal(c.nextPlayableIndex(queue,2,-1,live,'off'),0);
 assert.equal(c.nextPlayableIndex(queue,2,1,live,'off'),-1);
 assert.equal(c.nextPlayableIndex(queue,2,1,live,'all'),0);
 assert.deepEqual(queue,['a','missing','b','other']);
});
