"""Browser regression: 39 banks, all program options, instrument search, previews, bank-linked export."""
import asyncio,os,tempfile
from pathlib import Path
from playwright.async_api import async_playwright
from browser_public import fixture
from browser_sseq_upload_pipeline import MOCK
from browser_midi_five import fake_midi

async def main():
 async with async_playwright() as playwright:
  browser=await playwright.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1100,'height':830})
  errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  await page.set_content(fixture(),wait_until='domcontentloaded')
  await page.evaluate('''()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{
   randomUUID:()=>('00000000-0000-4000-8000-'+Math.random().toString().slice(2,14).padEnd(12,'0')),
   subtle:{digest:async()=>new Uint8Array(32).buffer}}})}''')
  await page.evaluate('()=>{window.__originalFetch=window.fetch;'+MOCK+'}')
  await page.evaluate('SigmaDebug.state.ready=true')
  # Standalone instrument explorer always visible, even if upload disabled.
  await page.locator('#browseHeartGoldBanks').click()
  banks=await page.locator('#standaloneInstrumentBrowser [data-hg-bank] option').count()
  assert banks==39,banks
  await page.locator('#standaloneInstrumentBrowser [data-hg-view="bank"]').click()
  await page.locator('#standaloneInstrumentBrowser [data-hg-bank]').select_option('701')
  assert await page.locator('#standaloneInstrumentBrowser [data-hg-list] article').count()==128
  assert await page.locator('#standaloneInstrumentBrowser [data-hg-bank-details]').inner_text()!=''
  await page.locator('#standaloneInstrumentBrowser [data-hg-search]').fill('square wave')
  assert await page.locator('#standaloneInstrumentBrowser [data-hg-list] article').count()>0
  await page.locator('#standaloneInstrumentBrowser [data-hg-search]').fill('')
  await page.locator('#standaloneInstrumentBrowser [data-hg-list] article').first.locator('[data-hg-play]').click()
  await page.locator('#standaloneInstrumentBrowser [data-hg-list] article').first.locator('[data-hg-choose]').click()
  assert await page.locator('#hgSlot').input_value() in ['1217','1218'] or await page.evaluate('SigmaBankProfiles.sequence_slots[document.querySelector("#hgSlot").value].bank===701')
  await page.locator('#closeDialog').click()
  # Upload flow can select any bank and choose one instrument for single file.
  await page.locator('#uploadBtn').click()
  assert await page.locator('#uploadTargetBank option').count()==39
  await page.locator('#uploadTargetBank').select_option('720')
  assert await page.locator('#uploadTargetSlot').count()==1
  slot=await page.locator('#uploadTargetSlot').input_value()
  assert await page.evaluate(f'SigmaBankProfiles.sequence_slots["{slot}"].bank')==720
  await page.locator('#uploadTargetProgram').select_option('0')
  await page.locator('#previewUploadProgram').click()
  assert not errors,errors
  await page.locator('#closeDialog').click()
  # Combining all five can independently choose instruments in another bank.
  with tempfile.TemporaryDirectory() as temp:
   paths=[]
   for i in range(5):
    path=Path(temp)/f'bank_{i}.mid';path.write_bytes(fake_midi(60+i));paths.append(str(path))
   await page.locator('#uploadBtn').click()
   await page.locator('input[name="uploadMusicMode"][value="combine"]').check()
   await page.locator('#uploadTargetBank').select_option('701')
   async with page.expect_file_chooser() as chooser:await page.locator('#chooseMusicFiles').click()
   await (await chooser.value).set_files(paths)
   await page.locator('#combinedTitle').wait_for(timeout=10000)
   assert await page.locator('#arrangementInstrumentBrowser [data-hg-bank] option').count()==39
   await page.locator('#arrangementInstrumentBrowser [data-hg-view="bank"]').click()
   await page.locator('#arrangementInstrumentBrowser [data-hg-bank]').select_option('702')
   assert await page.locator('#arrangedBank').inner_text()=='702'
   assert await page.locator('#arrangementInstrumentBrowser [data-hg-list] article').count()==68
   for i in range(5):
    await page.locator('#hgFileTarget').select_option(str(i))
    await page.locator('#arrangementInstrumentBrowser [data-hg-list] [data-hg-choose="%s"]'%i).click()
    assert await page.locator('#midiProgram%s'%i).input_value()==str(i)
   await page.locator('[data-preview-file="0"]').click()
   await page.locator('#uploadCombinedMidi').click()
   await page.locator('#confirmSseqUpload').wait_for(timeout=12000)
   assert await page.evaluate('window.__qa.starts.length')==0,'Review must precede upload'
   await page.locator('#confirmSseqUpload').click()
   await page.wait_for_function('window.__qa.finishes.length===1',timeout=20000)
   assert not errors,errors
   res=await page.evaluate('''()=>({bank:SigmaBankProfiles.sequence_slots[__qa.finishes[0].metadata.slot]?.bank,programs:[...new Set(SigmaSSEQ.parse(__qa.uploads[0],{profiles:SigmaBankProfiles,slot:__qa.finishes[0].metadata.slot}).notes.map(n=>n.program))].sort((a,b)=>a-b)})''')
   assert res['bank']==702,res
   assert res['programs']==[0,1,2,3,4],res
  print('PASS: 39 banks; bank 701 has 128 programs; bank 702 has 68; preview, search, local selected bank, 5 independent MIDI assignments, combined exported SSEQ')
  await browser.close()
if __name__=='__main__':asyncio.run(main())
