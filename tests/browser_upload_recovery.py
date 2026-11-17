"""Regression for upload state reconciliation (mocked APIs, not live Supabase).
First scenario: PUT succeeds but /upload-finish fails; retry must reuse the
existing signed reservation and finish without a second PUT.
Second scenario: signed PUT replies 400 Asset Already Exists; server verifies
and accepts exact stored SSEQ instead of overwriting it.
"""
import asyncio, json, os
from playwright.async_api import async_playwright
from browser_public import ROOT, fixture

MOCK = r'''
window.__qa={mode:'MODE',starts:0,puts:0,finishes:0,statusCalls:0,finished:false};
window.turnstile={render(el,opt){queueMicrotask(()=>opt.callback('t'.repeat(32)));return 'widget'},remove(){},reset(){}};
window.fetch=async (url,opts={})=>{
 const x=String(url),q=window.__qa;
 if(x.includes('/api/config'))return Response.json({ready:true,maxUploadBytes:65536,turnstileSiteKey:'test-site'});
 if(x.includes('/api/catalog'))return Response.json({tracks:[],complete:true});
 if(x.includes('/api/upload-start')){
  q.starts++;
  return Response.json({uploadId:'00000000-0000-4000-8000-000000000001',receipt:'a'.repeat(64),signedUrl:'https://storage.test/upload/sseq',extension:'sseq',created:Date.now()});
 }
 if(x.includes('/api/upload-status')){q.statusCalls++;return Response.json({status:'pending'})}
 if(x.includes('/api/upload-finish')){
  q.finishes++;
  if(q.mode==='finish-failed'&&q.finishes===1)
   return Response.json({code:'INVALID_REQUEST',error:'Storage/database operation failed'},{status:400});
  q.finished=true;
  return Response.json({pending:true,uploadId:'00000000-0000-4000-8000-000000000001'},{status:202});
 }
 if(x.startsWith('blob:'))return window.__originalFetch(url,opts);
 throw Error('Unexpected fetch '+x);
};
window.XMLHttpRequest=class {
 constructor(){this.status=0;this.upload={};this.responseText='';}
 open(method,url){this.method=method;this.url=url;}
 setRequestHeader(k,v){}
 getResponseHeader(k){return null;}
 send(data){
  if(this.method!=='PUT')throw Error('Unexpected '+this.method);
  const q=window.__qa;q.puts++;
  if(q.mode==='existing-object'){
   this.status=400;this.responseText=JSON.stringify({message:'The resource already exists',code:'ResourceAlreadyExists'});
  }else{this.status=200;this.responseText='{}';}
  queueMicrotask(()=>this.onload?.());
 }
 abort(){this.onabort?.();}
};
'''

async def test_scenario(browser, mode):
 page=await browser.new_page()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.set_content(fixture(),wait_until='domcontentloaded',timeout=15000)
 await page.evaluate('''()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{
   randomUUID:()=>('00000000-0000-4000-8000-000000000001'),
   subtle:{digest:async()=>new Uint8Array(32).buffer}}})}''')
 await page.evaluate('()=>{window.__originalFetch=window.fetch;'+MOCK.replace('MODE',mode)+'}')
 await page.evaluate('SigmaDebug.refreshService({silent:true})')
 await page.wait_for_function('SigmaDebug.state.ready===true',timeout=10000)
 song=str(ROOT/'tests/fixtures/melody.sseq')
 await page.locator('#fileInput').set_input_files(song)
 await page.locator('#confirmSseqUpload').wait_for(timeout=15000)
 await page.locator('#confirmSseqUpload').click()
 await page.wait_for_function('window.__qa.finishes===1',timeout=20000)
 if mode=='finish-failed':
  await page.wait_for_function('SigmaDebug.state.busy===false',timeout=10000)
  first=await page.evaluate('({starts:__qa.starts,puts:__qa.puts,finishes:__qa.finishes})')
  assert first=={'starts':1,'puts':1,'finishes':1},first
  await page.locator('#fileInput').set_input_files(song)
  await page.locator('#confirmSseqUpload').wait_for(timeout=15000)
  await page.locator('#confirmSseqUpload').click()
  await page.wait_for_function('window.__qa.finished===true',timeout=20000)
  after=await page.evaluate('({starts:__qa.starts,puts:__qa.puts,finishes:__qa.finishes,statusCalls:__qa.statusCalls})')
  assert after['starts']==1 and after['puts']==1 and after['finishes']==2 and after['statusCalls']>=1,after
 else:
  await page.wait_for_function('window.__qa.finished===true',timeout=15000)
  after=await page.evaluate('({starts:__qa.starts,puts:__qa.puts,finishes:__qa.finishes})')
  assert after=={'starts':1,'puts':1,'finishes':1},after
 assert not errors,errors
 print('PASS',mode,after,flush=True)
 await page.close()

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox','--disable-gpu'])
  try:
   await test_scenario(browser,'finish-failed')
   await test_scenario(browser,'existing-object')
  finally:
   await browser.close()

if __name__=='__main__': asyncio.run(main())
