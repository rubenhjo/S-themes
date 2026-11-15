import {sb,env,BUCKET} from '../lib/common.js';
// Vercel Cron calls with Authorization: Bearer <CRON_SECRET>. Manual invocation uses same secret.
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).end();
 if(!process.env.CRON_SECRET||req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return res.status(403).json({error:'Forbidden'});
 try{const {url,key}=env();const threshold=new Date(Date.now()-2*60*60*1000).toISOString();
  const stale=await sb('/rest/v1/theme_uploads?status=in.(pending,validating,processing,failed,expired)&created_at=lt.'+encodeURIComponent(threshold)+'&select=id,storage_path&limit=50');
  let removed=0,failed=0;
  for(const row of stale||[]){
   const r=await fetch(url+'/storage/v1/object/'+BUCKET+'/'+row.storage_path,{method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)}).catch(()=>null);
   if(!r || !(r.ok||r.status===404)){failed++;continue}
   await sb('/rest/v1/theme_uploads?id=eq.'+row.id,{method:'DELETE'});removed++;
  }
  return res.status(200).json({stale:stale?.length||0,removed,failed});
 }catch(e){console.error(e);return res.status(502).json({error:'Cleanup failed'})}
}
