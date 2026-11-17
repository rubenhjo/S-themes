"""Chromium UI: two source MIDI files -> one reviewed SSEQ -> one reservation.
API, Storage, Turnstile and catalogue are isolated mocks, not production proof.
"""
import asyncio,os
from pathlib import Path
from playwright.async_api import async_playwright
from browser_public import ROOT,fixture
from browser_sseq_upload_pipeline import MOCK

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox','--disable-gpu'])
  page=await browser.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  await page.set_content(fixture(),wait_until='domcontentloaded')
  await page.evaluate('''()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{
   randomUUID:()=>('00000000-0000-4000-8000-'+Math.random().toString().slice(2,14).padEnd(12,'0')),
   subtle:{digest:async()=>new Uint8Array(32).buffer}}})}''')
  await page.evaluate('()=>{window.__originalFetch=window.fetch;'+MOCK+'}')
  await page.evaluate('()=>SigmaDebug.refreshService({silent:true})')
  await page.wait_for_function('SigmaDebug.state.ready===true',timeout=10000)
  await page.locator('#uploadBtn').click()
  await page.locator('input[name="uploadMusicMode"][value="combine"]').check()
  async with page.expect_file_chooser() as f:
   await page.locator('#chooseMusicFiles').click()
  chooser=await f.value
  data=(ROOT/'tests/fixtures/melody.mid').read_bytes()
  await chooser.set_files([{'name':'lead.mid','mimeType':'audio/midi','buffer':data},
                           {'name':'chords.mid','mimeType':'audio/midi','buffer':data}])
  await page.locator('#combinedTitle').fill('Two MIDI composition')
  await page.locator('#midiProgram0').select_option('0')
  await page.locator('#midiProgram1').select_option('1')
  assert await page.locator('[data-midi-row] details').count()==2
  await page.locator('#uploadCombinedMidi').click()
  await page.locator('#confirmSseqUpload').wait_for(timeout=15000)
  assert await page.locator('[data-sseq-preview]').count()>=1
  assert await page.evaluate('window.__qa.starts.length')==0,'Preview must happen before any reservation'
  await page.locator('#confirmSseqUpload').click()
  await page.wait_for_function('window.__qa.finishes.length===1',timeout=30000)
  result=await page.evaluate('''()=>{
   const q=window.__qa;const parsed=SigmaSSEQ.parse(q.uploads[0],{slot:1028,profiles:SigmaBankProfiles});
   return {starts:q.starts.length,puts:q.uploads.length,finishes:q.finishes.length,
    programs:[...new Set(parsed.notes.map(n=>n.program))],notes:parsed.notes.length,
    title:q.finishes[0].metadata.title,bytes:q.uploads[0].length,
    onlySseq:new TextDecoder().decode(q.uploads[0].slice(0,4))==='SSEQ'};
  }''')
  assert result['starts']==result['puts']==result['finishes']==1,result
  assert result['programs']==[0,1],result
  assert result['notes']==8 and result['onlySseq'],result
  assert result['title']=='Two MIDI composition',result
  assert not errs,errs
  print('PASS Chromium multi-MIDI import + review + SSEQ-only upload:',result)
  await browser.close()

if __name__=='__main__':asyncio.run(main())
