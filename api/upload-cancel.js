import {jsonBody,env,sb,rpc,err,safeError,requireMethod,hmac,verifyReceipt,validUuid,BUCKET} from '../lib/common.js';
/** Account-free upload cancellation: receipt capability is scoped to one pending reservation.
 * Mark the reservation failed BEFORE deleting stored bytes so publication cannot race with cleanup.
 * A late cancellation cannot undo an already committed publish (returns HTTP 409).
 */
export default async function handler(req,res){
 try{
  requireMethod(req,'POST');
  const b=jsonBody(req);
  if(!validUuid(b.uploadId)||!(/^[a-f0-9]{64}$/.test(String(b.receipt||''))))throw err(400,'Invalid cancellation receipt');
  const rows=await sb(`/rest/v1/theme_uploads?id=eq.${b.uploadId}&select=id,secret_hash,status,storage_path&limit=1`);
  const row=rows?.[0];
  if(!row||!verifyReceipt(row.secret_hash,hmac(b.receipt)))throw err(403,'Unknown upload receipt');
  if(row.status==='published')throw err(409,'This song has already been published');
  if(['pending','validating','processing'].includes(row.status)){
   const failed=await rpc('fail_theme_upload',{p_id:row.id,p_secret_hash:row.secret_hash});
   if(!failed)throw err(409,'Upload status changed; refresh and inspect the library');
  }
  // Storage delete may fail if an in-flight TUS request still has an open handle. Cleanup cron will retry.
  const {url,key}=env();
  let cleanupPending=false;
  try{
   const response=await fetch(`${url}/storage/v1/object/${BUCKET}/${row.storage_path}`,{
    method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)
   });
   cleanupPending=!(response.ok||response.status===404);
  }catch{cleanupPending=true}
  if(!cleanupPending){try{await sb('/rest/v1/theme_uploads?id=eq.'+row.id,{method:'DELETE'});}catch{cleanupPending=true}}
  res.setHeader('Cache-Control','no-store');
  return res.status(cleanupPending?202:200).json({canceled:true,cleanupPending});
 }catch(e){return safeError(res,e)}
}
