"""QC7 browser: stale upload reservation must not be reused after server rejects it.
Uses Chromium and mocked API/XHR. This is NOT a Supabase staging test.
"""
import asyncio,json,os
from playwright.async_api import async_playwright
from browser_public import fixture
from browser_upload_cancel import INIT

async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  page=await browser.new_page()
  await page.evaluate('() => {'+INIT+'}')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.evaluate('''() => {
   const key='sigma-upload-'+('07'.repeat(32))+'-1028-my-song';
   sessionStorage.setItem(key,JSON.stringify({
    uploadId:'e7ebec2c-f475-499e-8447-0c46d9ab1c67',receipt:'f'.repeat(64),created:Date.now(),
    signedUrl:'https://test.local/old',bucket:'sigma-theme-audio',extension:'sseq',token:'OLD',
    storagePath:'uploads/old.sseq',tusEndpoint:'https://test.local/tus'
   }));
   window.__calls.status=0;
   window.fetch=async(url,options)=>{
    url=String(url);
    if(url.includes('/api/config'))return Response.json({ready:true,maxUploadBytes:47185920,turnstileSiteKey:'SITE'});
    if(url.includes('/api/catalog'))return Response.json({tracks:[]});
    if(url.includes('/api/upload-status')){__calls.status++;const body=JSON.parse(options?.body||'{}');return Response.json({status:body.uploadId==='e7ebec2c-f475-499e-8447-0c46d9ab1c67'?'failed':'validating'});}
    if(url.includes('/api/upload-start')){__calls.start++;return Response.json({uploadId:'69ba7b07-1f80-42bd-8013-10ce5d3fe651',receipt:'a'.repeat(64),
     signedUrl:'https://test.local/new',tusEndpoint:'https://test.local/tus',token:'TOKEN',storagePath:'uploads/new.sseq',bucket:'sigma-theme-audio',extension:'sseq'});}
    if(url.includes('/api/upload-finish')){__calls.finish++;return Response.json({pending:true,message:'Queued'},{status:202});}
    if(url.includes('/api/upload-cancel')){__calls.cancel++;return Response.json({canceled:true});}
    throw Error('unexpected '+url);
   };
   XMLHttpRequest.prototype.send=function(body){__calls.request.push({method:this.method,url:this.url});
     setTimeout(()=>{this.status=200;this.onload?.()},10);
   };
  }''')
  await page.set_content(fixture(),wait_until='domcontentloaded')
  await page.wait_for_function('window.SigmaDebug?.state.ready===true')
  await page.evaluate('''()=>{const data=SigmaSSEQ.build({slot:1028,profiles:SigmaBankProfiles,tracks:[{program:0,notes:[{start:0,duration:48,pitch:60,velocity:96}]}]});
   void SigmaDebug.uploadFiles([new File([data],'my-song.sseq',{type:'application/octet-stream'})],{slot:1028});}''')
  await page.wait_for_function('window.__calls.finish===1',timeout=30000)
  await page.wait_for_timeout(400)
  calls=await page.evaluate('window.__calls')
  assert calls['status']>=1,calls
  assert calls['start']==1,calls
  assert calls['finish']==1,calls
  assert calls['request'][0]['url']=='https://test.local/new',calls
  assert not errors,errors
  print(json.dumps({'status':'PASS','session_revalidated':calls['status'],'new_reservations':calls['start'],'finished':calls['finish'],'errors':errors},indent=2))
  await browser.close()
if __name__=='__main__':asyncio.run(main())
