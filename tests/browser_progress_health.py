"""Chromium regression for the real upload progress UI and cancellable audio decode.
Uses in-memory API fixtures; does not contact real Supabase."""
import asyncio, os, json
from playwright.async_api import async_playwright
from browser_public import fixture, ROOT

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox','--disable-gpu'])
  page=await browser.new_page(viewport={'width':640,'height':700})
  errs=[];page.on('pageerror',lambda err:errs.append(str(err)))
  await page.add_init_script('''window.fetch=async url=>{
   if(String(url).includes('/api/config'))return Response.json({ready:false,maxUploadBytes:65536});
   if(String(url).includes('/api/catalog'))return Response.json({tracks:[]});
   return Response.json({error:'test'}, {status:404});};''')
  content=fixture().replace('<script src="sigma_upload_monitor.js" defer></script>',
     '<script>'+(ROOT/'sigma_upload_monitor.js').read_text()+'</script>')
  await page.set_content(content,wait_until='domcontentloaded')
  assert await page.locator('.sigma-monitor').count()==1
  # Decode has activity, elapsed time, and deliberately NO made-up percentage.
  await page.evaluate('''()=>{
   document.querySelector('#uploadProgress').classList.remove('hide');
   document.querySelector('#uploadProgressText').textContent='Decoding source audio';
   window.dispatchEvent(new CustomEvent('sigma:upload-source',{detail:{bytes:452000,extension:'wav'}}));
   window.dispatchEvent(new CustomEvent('sigma:upload-progress',{detail:{text:'Decoding source audio',percent:5,metrics:{fraction:null}}}));
  }''')
  assert await page.locator('#uploadProgress').get_attribute('data-sigma-mode')=='indeterminate'
  assert 'Active' in await page.locator('.sigma-measured').inner_text()
  await page.wait_for_timeout(2000)
  assert await page.locator('.sigma-time').inner_text()!='0:00'
  # Update from measured FFT-frame progress, then from actual upload bytes.
  await page.evaluate('''()=>window.dispatchEvent(new CustomEvent('sigma:upload-progress',{
    detail:{text:'Transcribing melody and timing',percent:26,metrics:{fraction:.5}}
  }))''')
  assert await page.locator('#uploadProgress').get_attribute('data-sigma-mode')=='determinate'
  assert '50% of note analysis' in await page.locator('.sigma-measured').inner_text()
  assert await page.locator('.sigma-steps li:nth-child(2)').get_attribute('class')=='current'
  await page.evaluate('''()=>window.dispatchEvent(new CustomEvent('sigma:upload-progress',{
    detail:{text:'Uploading audio',percent:45,metrics:{fraction:.5}}
  }))''')
  assert '50% of upload' in await page.locator('.sigma-measured').inner_text()
  await page.locator('.sigma-actions button',has_text='Details').click()
  report=json.loads(await page.locator('.sigma-diagnostics').inner_text())
  assert report['fileType']=='wav' and report['percentOfCurrentStage']==50, report
  await page.locator('#cancelUpload').click()
  report=json.loads(await page.locator('.sigma-diagnostics').inner_text())
  assert report['cancelRequested'] is True,report
  await page.evaluate("window.dispatchEvent(new Event('sigma:upload-finished'))")
  # A hung decode must reject when cancelled, without waiting for its OS decoder.
  await page.evaluate('''()=>{window.AudioContext=class {
    decodeAudioData(){return new Promise(()=>{});} close(){return Promise.resolve();}
  };window.__c=new AbortController();window.__f=new File([new Uint8Array(40)],'clip.wav',{type:'audio/wav'});
  window.__task=SigmaTranscribe.transcribeAudio(window.__f,{signal:window.__c.signal})
   .then(()=>({bad:true}),e=>({message:e.message}));}''')
  await page.wait_for_timeout(80)
  await page.evaluate('window.__c.abort()')
  result=await page.evaluate('window.__task')
  assert 'canceled' in result['message'].lower(), result
  assert not errs,errs
  print('PASS progress UI: indeterminate decode, elapsed, measured notes/upload, details, cancel, abortable decode',flush=True)
  await page.close()
  await browser.close()

if __name__=='__main__': asyncio.run(main())
