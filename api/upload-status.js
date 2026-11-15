import {jsonBody,sb,err,safeError,requireMethod,hmac,verifyReceipt,validUuid} from '../lib/common.js';
/** Read own upload's asynchronous validation status using a high-entropy receipt. */
export default async function handler(req,res){
 try{
  requireMethod(req,'POST');const b=jsonBody(req);
  if(!validUuid(b.uploadId)||!(/^[a-f0-9]{64}$/.test(String(b.receipt||''))))throw err(400,'Invalid upload receipt');
  const rows=await sb(`/rest/v1/theme_uploads?id=eq.${b.uploadId}&select=id,secret_hash,status,validation_error&limit=1`);
  const row=rows?.[0];if(!row||!verifyReceipt(row.secret_hash,hmac(b.receipt)))throw err(403,'Invalid upload receipt');
  res.setHeader('Cache-Control','no-store');return res.status(200).json({status:row.status,error:row.status==='failed'?'Audio validation failed':null});
 }catch(e){return safeError(res,e)}
}
