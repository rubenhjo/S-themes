export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).end();
  const url=process.env.SUPABASE_URL||'';
  const anonKey=process.env.SUPABASE_ANON_KEY||'';
  const ready=!!(url&&anonKey&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.TURNSTILE_SITE_KEY&&process.env.TURNSTILE_SECRET_KEY&&process.env.TURNSTILE_HOSTNAME&&process.env.UPLOAD_HMAC_SECRET);
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({ready,turnstileSiteKey:process.env.TURNSTILE_SITE_KEY||null,realtime:ready?{url,anonKey}:null,maxUploadBytes:45*1024*1024});
}
