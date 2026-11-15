import {randomUUID} from 'node:crypto';
import {jsonBody,env,sb,rpc,err,safeError,requireMethod,clientIp,hmac,newReceipt,verifyTurnstile,MAX_UPLOAD_BYTES,BUCKET,allowedExtensions,sanitizeTitle} from '../lib/common.js';
export default async function handler(req,res){
 try{requireMethod(req,'POST');const b=jsonBody(req);env();
  const size=Number(b.size),sha=String(b.sha256||'').toLowerCase(),original=String(b.name||''),extension=original.split('.').pop().toLowerCase();
  if(!Number.isSafeInteger(size)||size<30||size>MAX_UPLOAD_BYTES)throw err(413,'SSEQ file must be 30 bytes–64 KiB');
  if(!/^[a-f0-9]{64}$/.test(sha)||!allowedExtensions.has(extension)||original.length>240||!sanitizeTitle(original))throw err(400,'Invalid file name, type or SHA-256');
  await verifyTurnstile(b.turnstileToken,req);
  const receipt=newReceipt(),uploadId=randomUUID(),storagePath='uploads/'+uploadId+'.'+extension;
  const created=await rpc('reserve_theme_upload',{p_id:uploadId,p_secret_hash:hmac(receipt),p_sha256:sha,p_ip_hash:hmac(clientIp(req)),p_name:sanitizeTitle(original),p_size:size,p_path:storagePath,p_extension:extension});
  if(!created)throw err(429,'Upload limit or duplicate detected');
  let signed;
  try{signed=await sb('/storage/v1/object/upload/sign/'+BUCKET+'/'+storagePath,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}
  catch(e){await rpc('fail_theme_upload',{p_id:uploadId,p_secret_hash:hmac(receipt)}).catch(()=>{});throw e}
  if(!signed?.url){await rpc('fail_theme_upload',{p_id:uploadId,p_secret_hash:hmac(receipt)}).catch(()=>{});throw err(502,'Could not create upload URL')}
  const {url}=env(),signedUrl=url+'/storage/v1'+signed.url;
  res.setHeader('Cache-Control','no-store');return res.status(200).json({uploadId,receipt,extension,signedUrl,token:new URL(signedUrl).searchParams.get('token'),bucket:BUCKET,storagePath,tusEndpoint:url.replace('.supabase.co','.storage.supabase.co')+'/storage/v1/upload/resumable'});
 }catch(e){return safeError(res,e)}
}
