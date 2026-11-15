import {sb,safeError,requireMethod,validUuid,BUCKET,err,env} from '../lib/common.js';
export default async function handler(req,res){
 try{requireMethod(req,'GET');const id=String(req.query.id||'');if(!validUuid(id))throw err(400,'Invalid song ID');
  const rows=await sb('/rest/v1/theme_tracks?id=eq.'+encodeURIComponent(id)+'&select=storage_path&limit=1');if(!rows?.length)throw err(404,'Song unavailable');
  const path=rows[0].storage_path;const signed=await sb('/storage/v1/object/sign/'+BUCKET+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:900})});
  if(!signed?.signedURL)throw err(502,'Could not authorize audio playback');const {url}=env();
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');return res.redirect(302,url+'/storage/v1'+signed.signedURL);
 }catch(e){return safeError(res,e)}
}
