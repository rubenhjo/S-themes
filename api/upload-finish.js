import {createHash} from 'node:crypto';
import {jsonBody,env,sb,rpc,err,safeError,requireMethod,hmac,verifyReceipt,validUuid,BUCKET,MAX_UPLOAD_BYTES,sniff,sanitizeTitle,extensionMime} from '../lib/common.js';
async function checkObject(row){
 const {url,key}=env();const response=await fetch(url+'/storage/v1/object/authenticated/'+BUCKET+'/'+row.storage_path,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw err(400,'Uploaded file is missing');
 const contentLength=Number(response.headers.get('content-length'));
 if(contentLength>MAX_UPLOAD_BYTES)throw err(413,'Uploaded file is too large');
 let bytes=0,first=Buffer.alloc(0);const hash=createHash('sha256');
 if(!response.body)throw err(400,'Empty upload');
 for await(const chunk of response.body){
  bytes+=chunk.length;if(bytes>MAX_UPLOAD_BYTES)throw err(413,'File exceeds limit');
  if(first.length<64)first=Buffer.concat([first,Buffer.from(chunk.subarray(0,64-first.length))]);
  hash.update(chunk);
 }
 if(bytes!==Number(row.size_bytes))throw err(400,'Uploaded byte count differs from request');
 if(hash.digest('hex')!==row.sha256)throw err(400,'Uploaded checksum differs from request');
 if(!sniff(first,row.extension))throw err(400,'Audio file signature does not match extension');
 return bytes;
}
export default async function handler(req,res){
 let row=null;
 try{requireMethod(req,'POST');const b=jsonBody(req);if(!validUuid(b.uploadId)||!(/^[a-f0-9]{64}$/.test(String(b.receipt||''))))throw err(400,'Invalid upload receipt');
  const list=await sb('/rest/v1/theme_uploads?id=eq.'+b.uploadId+'&select=*&limit=1');row=list?.[0];
  if(!row||!verifyReceipt(row.secret_hash,hmac(b.receipt))||Date.parse(row.expires_at)<Date.now())throw err(403,'Upload receipt expired or invalid');
  if(row.status==='validating'||row.status==='processing')return res.status(202).json({pending:true,uploadId:row.id,message:'Audio validation already queued'});
  if(row.status==='published')return res.status(200).json({published:true,uploadId:row.id});
  if(row.status!=='pending')throw err(409,'Upload reservation is no longer valid');
  const bytes=await checkObject(row);const metadata=b.metadata&&typeof b.metadata==='object'?b.metadata:{};
  const details={title:sanitizeTitle(metadata.title||row.original_filename.replace(/\.[^.]+$/,''),220),artist:sanitizeTitle(metadata.artist||'Unknown artist',220),album:sanitizeTitle(metadata.album||'',220),duration_s:Number(metadata.duration)||0};
  if(!details.title||!details.artist || !Number.isFinite(details.duration_s)||details.duration_s<0||details.duration_s>7200)throw err(400,'Invalid audio metadata');
  // Browser measurements are NOT trusted; worker deliberately does not publish these metrics.
  const parsedLufs=Number(metadata.lufs),parsedPeak=Number(metadata.truePeak);
  const safeMetrics=metadata.lufs!==undefined&&metadata.truePeak!==undefined &&
    Number.isFinite(parsedLufs)&&parsedLufs>=-80&&parsedLufs<=0&&
    Number.isFinite(parsedPeak)&&parsedPeak>=-80&&parsedPeak<=6;
  details.lufs=safeMetrics?parsedLufs:null;
  details.truePeak=safeMetrics?parsedPeak:null;
  const queued=await rpc('queue_theme_upload',{p_id:row.id,p_secret_hash:row.secret_hash,p_title:details.title,p_artist:details.artist,p_album:details.album});
  if(!queued)throw err(409,'Upload already queued, canceled, or expired');
  res.setHeader('Cache-Control','no-store');return res.status(202).json({pending:true,uploadId:row.id,verifiedBytes:bytes,message:'Queued for full server-side audio validation'});
 }catch(e){return safeError(res,e)}
}
