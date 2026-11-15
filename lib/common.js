import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const MAX_UPLOAD_BYTES = 45 * 1024 * 1024; // 45 MiB, below Free tier's 50 MB ceiling
export const BUCKET = 'sigma-theme-audio';
export const allowedExtensions = new Set(['mp3', 'wav', 'flac', 'ogg', 'opus', 'm4a', 'aac']);
export const extensionMime = {mp3:'audio/mpeg',wav:'audio/wav',flac:'audio/flac',ogg:'audio/ogg',opus:'audio/ogg',m4a:'audio/mp4',aac:'audio/aac'};
export function err(status, message) { const e = new Error(message); e.status = status; return e; }
export function safeError(res, e) { const status=Number.isInteger(e?.status) && e.status>=400 && e.status<=599 ? e.status : 502; if(status>=500) console.error(e); return res.status(status).json({code:status===400?'INVALID_REQUEST':status===409?'CONFLICT':status===413?'PAYLOAD_TOO_LARGE':status===429?'RATE_LIMITED':status>=500?'SERVICE_UNAVAILABLE':'REQUEST_REJECTED',error:status>=500?'Service temporarily unavailable':String(e.message||'Request failed')}); }
export function requireMethod(req, method) { if (req.method!==method) throw err(405, 'Method not allowed'); }
export function jsonBody(req, max=4096) {
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { throw err(400, 'Invalid JSON'); }
  if(!body || typeof body!=='object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body))>max) throw err(400,'Invalid request');
  return body;
}
export function env() {
  const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url) || !key || key.length<30) throw err(503,'Service is not configured');
  return {url,key};
}
export async function sb(path,options={}) {
  const {url,key}=env();
  const response=await fetch(url+path,{...options,headers:{'apikey':key,'Authorization':'Bearer '+key,...options.headers},cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!response.ok) {
    let message=await response.text().catch(()=>response.statusText);
    if(response.status===409 || /duplicate key|duplicate audio checksum/i.test(message)) throw err(409,'This song already exists');
    if(/storage quota exhausted/i.test(message))throw err(507,'The shared music storage is full');
    if(/hourly upload limit|daily upload limit|global daily upload/i.test(message))throw err(429,'Upload rate limit reached');
    console.error('Supabase error:',response.status,message.slice(0,300));
    throw err(response.status>=500?502:400,'Storage/database operation failed');
  }
  if(response.status===204) return null;
  const text=await response.text();
  try{return text?JSON.parse(text):null;}catch{return text;}
}
export async function rpc(name,data){return sb('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
export function sha256(data){return createHash('sha256').update(data).digest('hex');}
export function hmac(data){const key=process.env.UPLOAD_HMAC_SECRET;if(!key || key.length<32) throw err(503,'Upload security is not configured');return createHmac('sha256',key).update(String(data)).digest('hex');}
export function verifyReceipt(a,b) { if(!/^[a-f0-9]{64}$/.test(String(a||'')) || !/^[a-f0-9]{64}$/.test(String(b||''))) return false; return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex')); }
export function newReceipt(){return randomBytes(32).toString('hex');}
export function clientIp(req) {
  // Vercel sanitizes this request header; don't trust arbitrary X-Forwarded-For in production.
  const v=process.env.VERCEL ? (req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for']) : (req.headers['x-forwarded-for'] || req.socket?.remoteAddress);
  const ip=String(Array.isArray(v)?v[0]:v||'').split(',')[0].trim();
  if(!ip || ip.length>80) throw err(503,'Unable to enforce upload rate limits');
  return ip;
}
export function sanitizeTitle(s,max=220){return String(s||'').trim().slice(0,max).replace(/[\u0000-\u001f\u007f]/g,'');}
export function validUuid(s){return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(s||''));}
export function sniff(header,extension){
  const b=Buffer.from(header);
  if(b.length<12)return false;
  switch(extension){
    case 'wav': return b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WAVE';
    case 'flac':return b.toString('ascii',0,4)==='fLaC';
    case 'ogg':case 'opus':return b.toString('ascii',0,4)==='OggS';
    case 'm4a':return b.toString('ascii',4,8)==='ftyp';
    case 'aac':return b[0]===0xff && (b[1]&0xf6)===0xf0;
    case 'mp3': return b.toString('ascii',0,3)==='ID3'||(b[0]===0xff && (b[1]&0xe0)===0xe0 && (b[2]&0x0c)!==0x0c);
    default: return false;
  }
}
export async function verifyTurnstile(token,req){
  const secret=process.env.TURNSTILE_SECRET_KEY;
  const expected=process.env.TURNSTILE_HOSTNAME;
  if(!secret||!expected)throw err(503,'Upload protection is not configured');
  if(typeof token!=='string'||token.length<20||token.length>2048)throw err(400,'Complete the anti-bot challenge');
  const data=new URLSearchParams({secret,response:token,remoteip:clientIp(req)});
  const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:data,signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw err(503,'Verification temporarily unavailable');
  const result=await r.json();
  if(!result.success || result.hostname!==expected || result.action!=='music_upload') throw err(403,'Upload verification failed');
}
