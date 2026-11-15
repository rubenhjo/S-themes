#!/usr/bin/env node
/** Trusted validation worker. Intended to run from GitHub Actions with Supabase
 * secrets, ffprobe and ffmpeg preinstalled. Never exposed as a public API.
 * A song is published only after checksum, header, container/codec, duration,
 * channel/rate and FULL decode checks succeed.
 */
import {mkdtemp,rm} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseSseq} from '../lib/sseq-server.js';
import {readFile} from 'node:fs/promises';
import {boundedBytes} from '../lib/stream-limit.js';
import {BUCKET,MAX_UPLOAD_BYTES,extensionMime} from '../lib/common.js';
const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url)||!key||key.length<30){
 console.error('Missing trusted Supabase worker credentials');process.exit(2);
}
const auth={apikey:key,Authorization:'Bearer '+key};
async function request(path,options={}){
 const response=await fetch(url+path,{...options,headers:{...auth,...options.headers},signal:AbortSignal.timeout(110000)});
 if(!response.ok)throw Error('Supabase operation rejected ('+response.status+')');
 if(response.status===204)return null;const text=await response.text();return text?JSON.parse(text):null;
}
async function rpc(name,data){return request('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
async function removeObject(row){
 const r=await fetch(`${url}/storage/v1/object/${BUCKET}/${row.storage_path}`,{method:'DELETE',headers:auth,signal:AbortSignal.timeout(20000)});
 if(!r.ok&&r.status!==404)throw Error('Could not remove rejected Storage object: '+r.status);
}
async function processOne(row){
 const directory=await mkdtemp(join(tmpdir(),'sigma-audio-'));
 const filename=join(directory,'incoming.'+row.extension);
 try{
  const r=await fetch(`${url}/storage/v1/object/authenticated/${BUCKET}/${row.storage_path}`,{
   headers:auth,signal:AbortSignal.timeout(100000)});
  if(!r.ok||!r.body)throw Error('Uploaded Storage object missing');
  if(Number(r.headers.get('content-length'))>MAX_UPLOAD_BYTES)throw Error('Audio object exceeds allowed size');
  await pipeline(Readable.fromWeb(r.body),boundedBytes(MAX_UPLOAD_BYTES),createWriteStream(filename));
  if(row.extension!=='sseq')throw Error('Legacy audio requires migration; cannot publish raw recordings');
  const data=await readFile(filename);const info=parseSseq(data,Number(row.validation_slot));
  const duration=info.durationTicks*60/(48*info.tempo);
  const current=await request(`/rest/v1/theme_uploads?id=eq.${row.id}&select=status,validation_claim_id&limit=1`);
  if(current?.[0]?.status!=='processing'||current?.[0]?.validation_claim_id!==row.validation_claim_id)
    throw Error('Upload validation claim changed or was canceled');
  const published=await rpc('publish_theme_upload',{
   p_id:row.id,p_secret_hash:row.secret_hash,p_title:row.validation_title,
   p_artist:row.validation_artist,p_album:row.validation_album||'',
   p_duration:duration,p_mime:'application/octet-stream',p_lufs:null,p_peak:null,p_claim_id:row.validation_claim_id
  });
  if(!published?.id)throw Error('Database did not confirm published song');
  console.log('VALIDATED/PUBLISHED SSEQ',row.id,'notes',info.notes.length,'slot',row.validation_slot,'bytes',data.length);
  return true;
 }catch(e){
  // Only reject still-processing rows. A canceled reservation cannot be re-published.
  console.error('REJECTED',row.id,String(e.message).slice(0,200));
  try{
   const rejected=await rpc('reject_theme_validation',{p_id:row.id,p_reason:'SSEQ format or instrument validation failed',p_claim_id:row.validation_claim_id});
   if(rejected)await removeObject(row);
  }catch(cleanupError){console.error('CLEANUP PENDING',row.id,cleanupError.message)}
  return false;
 }finally{await rm(directory,{recursive:true,force:true});}
}
// Recover bytes from abandoned reservations. Delete Storage first and the
// reservation second; failed deletions remain quota-accounted for the next run.
async function cleanupStale(){
 const expired=new Date().toISOString(),failedBefore=new Date(Date.now()-30*60*1000).toISOString();
 const q1=`/rest/v1/theme_uploads?status=in.(pending,validating,processing,failed,expired)&expires_at=lt.${encodeURIComponent(expired)}&select=id,storage_path,status&limit=50`;
 const q2=`/rest/v1/theme_uploads?status=eq.failed&created_at=lt.${encodeURIComponent(failedBefore)}&select=id,storage_path,status&limit=50`;
 const seen=new Set();
 for(const q of [q1,q2]){
  for(const row of await request(q)||[]){
   if(seen.has(row.id))continue;seen.add(row.id);
   try{
    await removeObject(row);
    await request(`/rest/v1/theme_uploads?id=eq.${row.id}&status=neq.published`,{method:'DELETE'});
   }catch(e){console.error('Deferred orphan cleanup',row.id,e.message)}
  }
 }
}
await cleanupStale();
let count=0,failed=0;
for(let i=0;i<20;i++){
 const row=await rpc('claim_theme_validation',{});
 if(!row)break;
 if(await processOne(row))count++;else failed++;
}
console.log(`Processed ${count+failed} songs: published=${count}, rejected=${failed}`);
if(failed)process.exitCode=1;
