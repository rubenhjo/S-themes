#!/usr/bin/env node
/** Owner-only batch import. Never bundle server keys in the frontend or run in a public API.
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/admin-import.mjs ./my-music
 * Optional: --dry-run, --csv=metadata.csv (columns filename,title,artist,album), --retry=3.
 */
import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {createReadStream,promises as fs} from 'node:fs';
import {resolve,extname,basename,join} from 'node:path';
import {BUCKET,extensionMime,allowedExtensions,sniff,MAX_UPLOAD_BYTES,sanitizeTitle} from '../lib/common.js';
import {parseMetadataCSV} from '../lib/csv.js';
import {validateAudioFile} from '../lib/media-validation.js';
import {adminUploadOutcome} from '../lib/admin-recovery.js';

const snooze=ms=>new Promise(r=>setTimeout(r,ms));
const args=process.argv.slice(2),dirArg=args.find(a=>!a.startsWith('--'));
const dry=args.includes('--dry-run');
const csvArg=args.find(a=>a.startsWith('--csv='));
const retries=Math.max(1,Math.min(6,Number(args.find(a=>a.startsWith('--retry='))?.split('=')[1]||3)));
const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!dirArg||!url||!secret||secret.length<30){console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/admin-import.mjs DIRECTORY [--dry-run] [--csv=metadata.csv]');process.exit(2)}
if(!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url)){console.error('Invalid Supabase URL');process.exit(2)}
const headers={apikey:secret,Authorization:'Bearer '+secret};
async function request(path,opts={}){
 for(let attempt=1;attempt<=retries;attempt++){
  try{
   const r=await fetch(url+path,{...opts,headers:{...headers,...opts.headers},signal:AbortSignal.timeout(180000)});
   if(r.ok)return r;
   if(![408,425,429,500,502,503,504].includes(r.status)||attempt===retries)throw Error(`${r.status}: ${(await r.text()).slice(0,250)}`);
  }catch(e){if(attempt===retries)throw e}
  await snooze(700*attempt*attempt);
 }
}
async function metadata(csvPath){return csvPath?parseMetadataCSV(await fs.readFile(csvPath,'utf8')):new Map()}
async function checksum(path){const h=createHash('sha256');for await(const part of createReadStream(path))h.update(part);return h.digest('hex')}
async function storageDelete(path){try{await request(`/storage/v1/object/${BUCKET}/${path}`,{method:'DELETE'})}catch(e){console.error('WARNING: orphan may require manual removal:',path,e.message)}}
async function importOne(path,record){const stat=await fs.stat(path),filename=basename(path),ext=extname(path).slice(1).toLowerCase();
 if(!allowedExtensions.has(ext)||stat.size<64||stat.size>MAX_UPLOAD_BYTES)throw Error(`Format/size not allowed: ${filename} (${stat.size} bytes)`);
 const handle=await fs.open(path,'r');let first=Buffer.alloc(64);try{await handle.read(first,0,64,0)}finally{await handle.close()}
 if(!sniff(first,ext))throw Error('Audio signature rejected: '+filename);
 const hash=await checksum(path);
 const query=await request('/rest/v1/theme_tracks?sha256=eq.'+hash+'&select=id&limit=1');
 if((await query.json()).length)return {status:'duplicate',filename};
 const id=randomUUID(),objectPath=`uploads/${id}.${ext}`,stem=filename.replace(/\.[^.]+$/,''),split=stem.split(/\s+[-–—]\s+/);
 const title=sanitizeTitle(record.title||(split.length>1?split.slice(1).join(' - '):stem));
 const artist=sanitizeTitle(record.artist||(split.length>1?split[0]:'Unknown artist'));
 const album=sanitizeTitle(record.album||'');
 const checked=await validateAudioFile(path,{extension:ext,expectedHash:hash,expectedBytes:stat.size});
 if(dry)return {status:'dry-run',filename,size:stat.size,title,artist,sha256:hash,codec:checked.codec};
 const secretHash=randomBytes(32).toString('hex');
 const reserve=await request('/rest/v1/rpc/reserve_admin_theme_upload',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({p_id:id,p_secret_hash:secretHash,p_sha256:hash,p_name:filename,p_size:stat.size,p_path:objectPath,p_extension:ext})});
 if(!(await reserve.json()))throw Error('Storage quota or duplicate rejection');
 const body=createReadStream(path);
 try{
  const uploaded=await fetch(url+`/storage/v1/object/${BUCKET}/${objectPath}`,{
   method:'POST',headers:{...headers,'Content-Type':extensionMime[ext],'x-upsert':'false'},body,duplex:'half',signal:AbortSignal.timeout(180000)});
  if(!uploaded.ok)throw Error('Storage upload failed '+uploaded.status+': '+(await uploaded.text()).slice(0,150));
  const queued=await request('/rest/v1/rpc/queue_theme_upload',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({p_id:id,p_secret_hash:secretHash,p_title:title,p_artist:artist,p_album:album})});
  if(!(await queued.json()))throw Error('Queued validation was not confirmed');
  return {status:'queued for server validation',filename,id,size:stat.size};
 }catch(e){
  // The queue operation may have COMMITTED despite a lost HTTP response.
  // Never delete a successfully queued/processing file. Never guess on network failure.
  let remote;
  try{
   const q=await request(`/rest/v1/theme_uploads?id=eq.${id}&select=id,status,sha256&limit=1`);
   remote=(await q.json())?.[0];
  }catch(checkError){
   throw Error(`Upload outcome is uncertain for ${id}; Storage left intact for reconciliation. `+
      `Original error: ${e.message}; status check: ${checkError.message}`);
  }
  const outcome=adminUploadOutcome(remote,hash);
  if(outcome==='published')return {status:'published',filename,id,size:stat.size,recovered:true};
  if(outcome==='queued')return {status:'queued for server validation',filename,id,size:stat.size,recovered:true};
  if(outcome==='unknown')throw Error(`Upload status is uncertain for ${id}; no destructive cleanup was attempted: ${e.message}`);
  if(outcome==='fail-first'){
   // Atomically transition out of pending BEFORE deleting bytes.
   const response=await request('/rest/v1/rpc/fail_theme_upload',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({p_id:id,p_secret_hash:secretHash})});
   if(!(await response.json()))throw Error(`Upload status changed during cleanup for ${id}; Storage preserved for reconciliation`);
  }
  await storageDelete(objectPath);
  throw e;
 }
}
const path=resolve(dirArg),st=await fs.stat(path),list=st.isDirectory()?(await fs.readdir(path)).map(f=>join(path,f)): [path];
const records=await metadata(csvArg?resolve(csvArg.slice(6)):null);
let ok=0,duplicate=0,failed=0;
for(let i=0;i<list.length;i++){
 const entry=list[i];if(!(await fs.stat(entry)).isFile())continue;
 if(!allowedExtensions.has(extname(entry).slice(1).toLowerCase()))continue;
 process.stdout.write(`[${i+1}/${list.length}] ${basename(entry)} ... `);
 try{const outcome=await importOne(entry,records.get(basename(entry))||{});
  if(outcome.status==='duplicate')duplicate++;else ok++;
  console.log(outcome.status, outcome.id||'');
 }catch(e){failed++;console.error('FAIL:',e.message)}
}
console.log(`Completed: ${ok} ${dry?'validated':'queued'}, ${duplicate} duplicates, ${failed} errors.`);
if(failed)process.exitCode=1;
