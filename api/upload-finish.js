import {createHash} from 'node:crypto';
import {parseSseq,getProfile} from '../lib/sseq-server.js';
import {jsonBody,env,sb,rpc,err,safeError,requireMethod,hmac,verifyReceipt,validUuid,BUCKET,MAX_UPLOAD_BYTES,sniff,sanitizeTitle,extensionMime} from '../lib/common.js';
async function checkObject(row,slot){
 const {url,key}=env();const response=await fetch(url+'/storage/v1/object/authenticated/'+BUCKET+'/'+row.storage_path,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(60000)});
 if(response.status===404)throw err(404,'Uploaded file is missing');
 if(!response.ok){
  // A 403 or 500 is NOT proof that Storage lacks the object. Treating it as
  // missing causes an unsafe duplicate PUT during recovery.
  console.error('Storage read failed during upload finalization:',response.status);
  throw err(502,'Could not verify stored SSEQ; check server storage permissions');
 }
 const contentLength=Number(response.headers.get('content-length'));
 if(contentLength>MAX_UPLOAD_BYTES)throw err(413,'Uploaded file is too large');
 let bytes=0,first=Buffer.alloc(0),chunks=[];const hash=createHash('sha256');
 if(!response.body)throw err(400,'Empty upload');
 for await(const chunk of response.body){
  bytes+=chunk.length;if(bytes>MAX_UPLOAD_BYTES)throw err(413,'File exceeds limit');
  if(first.length<64)first=Buffer.concat([first,Buffer.from(chunk.subarray(0,64-first.length))]);
  hash.update(chunk);chunks.push(Buffer.from(chunk));
 }
 if(bytes!==Number(row.size_bytes))throw err(400,'Uploaded byte count differs from request');
 if(hash.digest('hex')!==row.sha256)throw err(400,'Uploaded checksum differs from request');
 if(row.extension!=='sseq'||!sniff(first,row.extension))throw err(400,'Only binary SSEQ files may be published');
 try{const parsed=parseSseq(Buffer.concat(chunks),slot);return {bytes,parsed}}
 catch(e){throw err(400,'SSEQ rejected: '+e.message)}
}
export default async function handler(req,res){
 let row=null;
 try{requireMethod(req,'POST');const b=jsonBody(req);if(!validUuid(b.uploadId)||!(/^[a-f0-9]{64}$/.test(String(b.receipt||''))))throw err(400,'Invalid upload receipt');
  const list=await sb('/rest/v1/theme_uploads?id=eq.'+b.uploadId+'&select=*&limit=1');row=list?.[0];
  if(!row||!verifyReceipt(row.secret_hash,hmac(b.receipt))||Date.parse(row.expires_at)<Date.now())throw err(403,'Upload receipt expired or invalid');
  if(row.status==='validating'||row.status==='processing')return res.status(202).json({pending:true,uploadId:row.id,message:'Audio validation already queued'});
  if(row.status==='published')return res.status(200).json({published:true,uploadId:row.id});
  if(row.status!=='pending')throw err(409,'Upload reservation is no longer valid');
  const metadata=b.metadata&&typeof b.metadata==='object'?b.metadata:{};
  const slot=Number(metadata.slot);try{getProfile(slot)}catch(e){throw err(400,'Invalid HeartGold target: '+e.message)}
  const {bytes,parsed}=await checkObject(row,slot);
  const details={title:sanitizeTitle(metadata.title||row.original_filename.replace(/\.[^.]+$/,''),220),artist:sanitizeTitle(metadata.artist||'Unknown artist',220),album:sanitizeTitle(metadata.album||'',220),duration_s:parsed.durationTicks*60/(parsed.tempo*48)};
  if(!details.title||!details.artist || !Number.isFinite(details.duration_s)||details.duration_s<0||details.duration_s>7200)throw err(400,'Invalid audio metadata');
  // Browser measurements are NOT trusted; worker deliberately does not publish these metrics.
  const parsedLufs=Number(metadata.lufs),parsedPeak=Number(metadata.truePeak);
  const safeMetrics=metadata.lufs!==undefined&&metadata.truePeak!==undefined &&
    Number.isFinite(parsedLufs)&&parsedLufs>=-80&&parsedLufs<=0&&
    Number.isFinite(parsedPeak)&&parsedPeak>=-80&&parsedPeak<=6;
  details.lufs=safeMetrics?parsedLufs:null;
  details.truePeak=safeMetrics?parsedPeak:null;
  const assigned=await rpc('assign_theme_slot',{p_id:row.id,p_secret_hash:row.secret_hash,p_slot:slot});
  if(!assigned)throw err(409,'Could not assign HeartGold slot');
  const queued=await rpc('queue_theme_upload',{p_id:row.id,p_secret_hash:row.secret_hash,p_title:details.title,p_artist:details.artist,p_album:details.album});
  if(!queued)throw err(409,'Upload already queued, canceled, or expired');
  // The server has already downloaded the exact stored bytes, checked SHA-256
  // and run the full SSEQ/bank parser. Complete the fenced publication now,
  // in this upload request: no manual GitHub Actions trigger is required.
  // If the database is temporarily unavailable, leave the existing queued
  // claim for the scheduled fallback worker; never return fake publication.
  let published=null;
  try{
   const claim=await rpc('claim_theme_validation_for_upload',{p_id:row.id,p_secret_hash:row.secret_hash});
   if(claim?.validation_claim_id){
    published=await rpc('publish_theme_upload',{
     p_id:row.id,p_secret_hash:row.secret_hash,p_title:details.title,
     p_artist:details.artist,p_album:details.album,p_duration:details.duration_s,
     p_mime:'application/octet-stream',p_lufs:null,p_peak:null,p_claim_id:claim.validation_claim_id
    });
   }
  }catch(publicationError){
   console.error('Inline SSEQ publication deferred:',String(publicationError.message).slice(0,200));
  }
  res.setHeader('Cache-Control','no-store');
  if(published?.id)return res.status(200).json({published:true,uploadId:row.id,verifiedBytes:bytes,message:'Validated SSEQ published automatically'});
  return res.status(202).json({pending:true,uploadId:row.id,verifiedBytes:bytes,message:'Verified SSEQ queued for automatic retry'});
 }catch(e){return safeError(res,e)}
}
