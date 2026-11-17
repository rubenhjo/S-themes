import test from 'node:test';
import assert from 'node:assert/strict';
import audio from '../api/audio.js';
const ID='e7ebec2c-f475-499e-8447-0c46d9ab1c67';
function res(){return {headers:{},code:200,setHeader(k,v){this.headers[k]=v;return this},status(c){this.code=c;return this},json(o){this.body=o;return this},redirect(c,u){this.code=c;this.url=u;return this},end(){return this}}}
test('private SSEQ playback URL has short expiry to limit old signed links after deletion',async()=>{
 const oldFetch=globalThis.fetch;const env={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY};
 process.env.SUPABASE_URL='https://tests.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='z'.repeat(64);
 let expires=0;
 try{
  globalThis.fetch=async(url,options={})=>{url=String(url);
   if(url.includes('/rest/v1/theme_tracks?'))return Response.json([{storage_path:'uploads/'+ID+'.sseq',mime_type:'application/octet-stream',sseq_id:1028}]);
   if(url.includes('/storage/v1/object/sign/')){expires=JSON.parse(options.body).expiresIn;return Response.json({signedURL:'/object/sign/sigma-theme-audio/test?token=fake'})}
   throw Error('Unexpected '+url);
  };
  const r=res();await audio({method:'GET',query:{id:ID}},r);
  assert.equal(expires,60);assert.equal(r.code,302);
  assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(r.headers['Referrer-Policy'],'no-referrer');
 }finally{globalThis.fetch=oldFetch;for(const [k,v] of Object.entries(env)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});
