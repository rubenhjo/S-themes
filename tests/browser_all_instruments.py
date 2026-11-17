"""Chromium regression: all instruments visible, and out-of-range cannot export silently."""
import asyncio,os,tempfile
from pathlib import Path
from playwright.async_api import async_playwright
from browser_public import fixture
from browser_sseq_upload_pipeline import MOCK
from browser_midi_five import fake_midi

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  page=await browser.new_page()
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(fixture(),wait_until='domcontentloaded',timeout=15000)
  await page.evaluate('''()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{
   randomUUID:()=>('00000000-0000-4000-8000-'+Math.random().toString().slice(2,14).padEnd(12,'0')),
   subtle:{digest:async()=>new Uint8Array(32).buffer}}})}''')
  await page.evaluate('()=>{window.__originalFetch=window.fetch;'+MOCK+'}')
  await page.evaluate('SigmaDebug.state.ready=true')
  with tempfile.TemporaryDirectory() as t:
   f=Path(t)/'high_note.mid';f.write_bytes(fake_midi(96))
   await page.locator('#uploadBtn').click()
   await page.locator('input[name="uploadMusicMode"][value="combine"]').check()
   await page.locator('#uploadTargetSlot').select_option('1028')
   async with page.expect_file_chooser() as chooser: await page.locator('#chooseMusicFiles').click()
   await (await chooser.value).set_files(str(f))
   await page.locator('#combinedTitle').wait_for(timeout=15000)
   select=page.locator('#midiProgram0')
   options=await select.locator('option').evaluate_all('(els)=>els.map(e=>e.value)')
   expected=await page.evaluate('SigmaBankProfiles.banks["702"].programs.map(p=>String(p.index))')
   assert set(options)==set(['auto',*expected]),(options,expected)
   assert len(options)==len(expected)+1
   # 39 belongs to the bank, but cannot play the high C7 (MIDI 96).
   await select.select_option('39')
   warning=await page.locator('#midiArrangeStatus').inner_text()
   assert 'cannot play MIDI note 96' in warning,warning
   await page.locator('#uploadCombinedMidi').click()
   assert await page.locator('#combinedTitle').count()==1,'Invalid selected instrument must not close the dialog'
   assert await page.evaluate('__qa.starts.length')==0
   await select.select_option('0')
   assert 'compatible' in await page.locator('#midiArrangeStatus').inner_text()
   await page.locator('#uploadCombinedMidi').click()
   await page.locator('#confirmSseqUpload').wait_for(timeout=12000)
   assert await page.evaluate('window.__qa.starts.length')==0,'Review must precede upload'
   await page.locator('#confirmSseqUpload').click()
   await page.wait_for_function('window.__qa.finishes.length===1',timeout=20000)
   assert not errors,errors
   print(f'PASS all {len(expected)} instrument programs visible in bank 702, restricted program selectable with explicit warning, non-silent export validation, compatible export succeeds')
  await browser.close()

if __name__=='__main__':asyncio.run(main())
