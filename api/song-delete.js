import {jsonBody,err,safeError,requireMethod,hmac,validUuid,rpc} from '../lib/common.js';
import {isValidSecret,isAdminDeletionToken,removeSongObject} from '../lib/song-deletion.js';

/** Delete a public SSEQ only with its uploader's 256-bit receipt or the
 * separately configured administrator key. Never accept unauthenticated deletes.
 * SQL marks it hidden atomically BEFORE Storage deletion; cron retries Storage.
 */
export default async function handler(req,res){
 try{
  requireMethod(req,'POST');
  const b=jsonBody(req);
  const id=String(b.trackId||'');
  if(!validUuid(id))throw err(400,'Invalid song ID');
  const hasReceipt=isValidSecret(b.receipt);
  const hasAdminToken=isValidSecret(b.adminToken);
  if(hasReceipt===hasAdminToken)throw err(403,'Provide either a valid owner receipt or an administrator key');
  const admin=hasAdminToken;
  if(admin&&!isAdminDeletionToken(b.adminToken))throw err(403,'Invalid administrator key');
  const tombstone=await rpc('request_theme_song_delete',{
   p_id:id,p_secret_hash:hasReceipt?hmac(b.receipt):null,p_admin:admin
  });
  if(!tombstone||tombstone.id!==id)throw err(403,'Song not found or deletion not authorized');
  // The path is obtained from the server's DB, not from an untrusted HTTP body.
  const cleanupPending=tombstone.storage_deleted?false:!(await removeSongObject(tombstone.storage_path,id));
  res.setHeader('Cache-Control','no-store');
  return res.status(cleanupPending?202:200).json({deleted:true,cleanupPending});
 }catch(e){return safeError(res,e)}
}
