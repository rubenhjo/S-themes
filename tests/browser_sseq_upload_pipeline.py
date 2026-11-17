"""Actual Chromium file-input -> client conversion -> PUT -> publish poll -> SSEQ WebAudio.
Cloud APIs are isolated mocks, not proof that Supabase is deployed.
"""
import asyncio, json, os, threading, http.server
from urllib.parse import urlsplit
from playwright.async_api import async_playwright
from browser_public import ROOT, fixture

MOCK = r'''
window.__qa={starts:[],finishes:[],uploads:[],catalog:[],currentId:0};
window.turnstile={render(el,opt){queueMicrotask(()=>opt.callback('t'.repeat(32)));return 'widget'},remove(){},reset(){}};
window.fetch=async (url,opts={})=>{
 const x=String(url); const q=window.__qa;
 if(x.includes('/api/config'))return Response.json({ready:true,maxUploadBytes:65536,turnstileSiteKey:'test-site'});
 if(x.includes('/api/catalog'))return Response.json({tracks:q.catalog,complete:true});
 if(x.includes('/api/upload-start')){
  const body=JSON.parse(opts.body);q.starts.push(body);
  const id='00000000-0000-4000-8000-'+String(++q.currentId).padStart(12,'0');
  return Response.json({uploadId:id,receipt:'a'.repeat(64),signedUrl:'https://storage.test/upload/'+id,extension:'sseq',created:Date.now()});
 }
 if(x.includes('/api/upload-finish')){
  const body=JSON.parse(opts.body);q.finishes.push(body);
  const bytes=q.uploads.at(-1);if(!bytes||new TextDecoder().decode(bytes.slice(0,4))!=='SSEQ')throw Error('Non-SSEQ uploaded');
  const parsed=SigmaSSEQ.parse(bytes,{profiles:SigmaBankProfiles,slot:body.metadata.slot});
  const id=body.uploadId;
  q.catalog.push({id,title:body.metadata.title,artist:body.metadata.artist||'Test',album:'',duration_s:parsed.durationTicks*60/(48*parsed.tempo),size_bytes:bytes.length,sha256:q.starts.at(-1).sha256,original_filename:q.starts.at(-1).name,sseq_id:body.metadata.slot,mime_type:'application/octet-stream',created_at:new Date().toISOString()});
  return Response.json({pending:true,uploadId:id},{status:202});
 }
 if(x.includes('/api/upload-status'))return Response.json({status:'published'});
 if(x.includes('/api/audio'))return new Response(q.uploads[q.catalog.findIndex(t=>t.id===new URL(x,'http://localhost').searchParams.get('id'))],{status:200,headers:{'content-type':'application/octet-stream'}});
 if(x.startsWith('blob:'))return window.__originalFetch(url,opts);
 throw Error('Unexpected network '+x);
};
window.XMLHttpRequest=class {
 constructor(){this.status=200;this.upload={};this._headers={};}
 open(method,url){this.method=method;this.url=url;}
 setRequestHeader(k,v){this._headers[k]=v;}
 async send(data){
  if(this.method!=='PUT')throw Error('Unexpected method '+this.method);
  const b=new Uint8Array(await data.arrayBuffer());window.__qa.uploads.push(b);
  this.upload.onprogress?.({lengthComputable:true,loaded:b.length,total:b.length});
  queueMicrotask(()=>this.onload?.());
 }
 abort(){this.onabort?.();}
};
'''

async def main():
 result={}
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox','--disable-gpu'])
  class TestAssets(http.server.BaseHTTPRequestHandler):
   """Serve actual Worker scripts, not HTML disguised as JavaScript.

   The original fixture served <html></html> for every URL. On a secure
   localhost origin Chromium then creates a real transcription Worker, whose
   request for /sseq_transcribe_worker.js receives HTML and fails. about:blank
   tests did not catch this because creating a relative Worker there fails
   immediately and the converter falls back to the main thread.
   """
   def do_GET(self):
    path=urlsplit(self.path).path
    if path=='/':
     body=b'<html><body>sigma-themes browser test origin</body></html>'
     content_type='text/html; charset=utf-8'
    elif path in ('/sseq_transcribe_worker.js','/sseq_transcribe.js','/sigma_note_refine.js'):
     body=(ROOT/path.removeprefix('/')).read_bytes()
     content_type='text/javascript; charset=utf-8'
    else:
     self.send_error(404,'Asset not found');return
    self.send_response(200)
    self.send_header('Content-Type',content_type)
    self.send_header('Cache-Control','no-store')
    self.send_header('Content-Length',str(len(body)))
    self.end_headers();self.wfile.write(body)
   def log_message(self,*args):pass
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),TestAssets)
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  realCrypto=(os.environ.get('SIGMA_BROWSER_USE_REAL_CRYPTO')=='1')
  for fname in ('melody.wav','melody_b.mp3'):
   page=await browser.new_page()
   page.on('console',lambda msg: print('browser-console',fname,msg.type,msg.text,flush=True) if msg.type=='error' else None)
   if realCrypto:
    await page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded',timeout=7000)
    assert await page.evaluate('!!crypto.subtle'), 'Secure localhost Web Crypto unavailable'
   mockCrypto=not realCrypto
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   # set_content() can reset the about:blank document/global. Install mocks as
   # init script before document creation, like browser_public.py does.
   # Restore fixture APIs AFTER set_content; Playwright replaces about:blank JS globals.
   print('loading fixture',fname,flush=True)
   await page.set_content(fixture(),wait_until='domcontentloaded',timeout=15000)
   print('fixture loaded',fname,flush=True)
   if mockCrypto:
    await page.evaluate('''()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{
     randomUUID:()=>('00000000-0000-4000-8000-'+Math.random().toString().slice(2,14).padEnd(12,'0')),
     subtle:{digest:async()=>new Uint8Array(32).buffer}}})}''')
   assert await page.evaluate('!!crypto.subtle')
   await page.evaluate('()=>{window.__originalFetch=window.fetch;'+MOCK+'}')
   await page.evaluate('()=>SigmaDebug.refreshService({silent:true})')
   await page.wait_for_timeout(600)
   print('debug',await page.evaluate('''()=>({qa:!!window.__qa, debug:!!window.SigmaDebug,state:window.SigmaDebug?.state.ready,connected:window.SigmaDebug?.state.connected,status:document.querySelector('#connectionStatus')?.textContent})'''), 'pageErrors',errors,flush=True)
   await page.wait_for_function('window.SigmaDebug?.state.ready===true',timeout=10000)
   print('service ready',fname,flush=True)
   await page.locator('#fileInput').set_input_files(str(ROOT/'tests/fixtures'/fname))
   print('file selected',fname,flush=True)
   await page.locator('#arrangeAccept').wait_for(timeout=30000)
   assert await page.evaluate('window.__qa.starts.length')==0
   await page.locator('#arrangeAccept').click()
   await page.wait_for_timeout(3000)
   print('after 3s',await page.evaluate('''()=>({starts:__qa.starts.length, uploads:__qa.uploads.length, finishes:__qa.finishes.length, progress:document.querySelector('#uploadProgressText')?.textContent,toast:document.querySelector('#toastRoot')?.textContent,busy:SigmaDebug.state.busy})'''), 'errors', errors,flush=True)
   await page.wait_for_function('window.__qa.finishes.length===1',timeout=50000)
   await page.wait_for_function('window.SigmaDebug.state.tracks.length===1',timeout=10000)
   data=await page.evaluate('''async()=>{const q=window.__qa,bytes=q.uploads[0];
     const parsed=SigmaSSEQ.parse(bytes,{profiles:SigmaBankProfiles,slot:q.finishes[0].metadata.slot});
     return {source_file:q.starts[0].name,upload_extension:q.starts[0].name.split('.').at(-1),
       binary_header:Array.from(bytes.slice(0,4)),size:bytes.length,notes:parsed.notes.map(n=>n.pitch),
       slot:q.finishes[0].metadata.slot,published:q.catalog.length,
       http_uploads:q.uploads.length,original_audio_uploaded:q.uploads.some(b=>new TextDecoder().decode(b.slice(0,4))!=='SSEQ')};}''')
   assert data['notes']==([60,62,64,67] if fname=='melody.wav' else [67,65,62,60]),data
   assert data['upload_extension']=='sseq' and not data['original_audio_uploaded'],data
   await page.locator('#heroPlay').click()
   await page.wait_for_function('window.SigmaDebug.state.playingId!==null',timeout=10000)
   await page.wait_for_timeout(220)
   # Ensure SSEQ player selected, not native audio.src.
   player=await page.evaluate('window.SigmaDebug.state.playingId')
   assert player==data['source_file'].replace('.sseq','') or player,data
   assert not errors,errors
   result[fname]={'status':'PASS UI MOCK' if mockCrypto else 'PASS SECURE-ORIGIN UI MOCK',**data}
   await page.close()
  await browser.close()
  server.shutdown();server.server_close()
 print(json.dumps({'browser_upload_flow':result},indent=2))

if __name__=='__main__':asyncio.run(main())
