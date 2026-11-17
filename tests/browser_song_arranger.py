"""Real standard file chooser, offline mock API. Assert SSEQ bytes, not only UI labels.
One ordinary WAV/MP3 upload, no MIDI supplied by a visitor.
"""
import asyncio, os, json
from playwright.async_api import async_playwright
from browser_public import fixture,ROOT
from browser_sseq_upload_pipeline import MOCK

async def page_setup(browser):
 page=await browser.new_page(viewport={'width':390,'height':844})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.set_content(fixture(),wait_until='domcontentloaded',timeout=20000)
 await page.evaluate('''()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=>('00000000-0000-4000-8000-'+Math.random().toString().slice(2,14).padEnd(12,'0')),subtle:{digest:async()=>new Uint8Array(32).buffer}}})}''')
 await page.evaluate('()=>{window.__originalFetch=window.fetch;'+MOCK+'}')
 await page.evaluate('SigmaDebug.state.ready=true')
 return page,errors

async def test_case(browser,ext):
 page,errors=await page_setup(browser)
 try:
  if ext=='wav':name='eight_note_chord'
  else:name='eight_note_chord'
  source=ROOT/'tests/fixtures/polyphony'/f'{name}.{ext}'
  # Normal UI, not direct access to arranger model.
  await page.locator('#uploadBtn').click()
  assert await page.locator('#uploadAudioMode option').count()==3
  assert await page.locator('#uploadAudioMode').input_value()=='auto'
  await page.locator('#uploadTargetSlot').select_option('1028')
  async with page.expect_file_chooser() as chooser:await page.locator('#chooseMusicFiles').click()
  await (await chooser.value).set_files(str(source))
  await page.locator('#arrangeAccept').wait_for(timeout=30000)
  assert await page.locator('.arrange-part').count()<=5
  assert await page.locator('.arrange-note').count()==8
  assert not await page.evaluate('__qa.starts.length'), 'No upload before user confirmation'
  # 8-note chord must survive despite a five-part UI maximum.
  before=await page.evaluate('''()=>{const ui=window.SigmaArranger;return document.querySelectorAll(".arrange-note").length}''')
  assert before==8
  # User exclusion is note-specific and changes exported SSEQ.
  await page.locator('[data-note]').first.click()
  await page.locator('[data-exclude]').click()
  assert await page.locator('.arrange-note.excluded').count()==1
  await page.locator('[data-undo]').first.click()
  assert await page.locator('.arrange-note.excluded').count()==0
  # Preview solo is independent of export; listening-loop is independent of game loop.
  await page.locator('#arrangeListenLoop').check()
  await page.locator('#arrangeGameLoop').uncheck()
  await page.locator('#arrangeAccept').click()
  await page.wait_for_function('__qa.finishes.length===1',timeout=30000)
  result=await page.evaluate('''()=>{const b=__qa.uploads[0];const p=SigmaSSEQ.parse(b,{slot:1028,profiles:SigmaBankProfiles});return {notes:p.notes.length,slot:__qa.finishes[0].metadata.slot,bytes:b.length,loop:p.infinite,starts:__qa.starts.length,finishes:__qa.finishes.length}}''')
  assert result['notes']==8 and result['slot']==1028 and result['bytes']<=65536 and not result['loop'] and result['starts']==1 and result['finishes']==1,result
  assert not errors,errors
  print('PASS real file picker + Arranger + publish',ext,result,flush=True)
 finally:await page.close()

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  for ext in ('wav','mp3'):await test_case(browser,ext)
  await browser.close()

if __name__=='__main__':asyncio.run(main())
