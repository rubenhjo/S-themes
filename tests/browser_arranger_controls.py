"""Arranger controls exercised through real file chooser with mocked network.
No production credentials, user recordings or Nintendo samples are used.
"""
import asyncio, os
from playwright.async_api import async_playwright
from browser_public import fixture,ROOT
from browser_sseq_upload_pipeline import MOCK

async def setup(browser):
 page=await browser.new_page(viewport={'width':390,'height':844})
 page.set_default_timeout(10000)
 errs=[]
 page.on('pageerror',lambda e:errs.append(str(e)))
 await page.set_content(fixture(),wait_until='domcontentloaded')
 await page.evaluate('()=>{window.__originalFetch=window.fetch;'+MOCK+'}')
 await page.evaluate('SigmaDebug.state.ready=true')
 await page.evaluate('''()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=>('00000000-0000-4000-8000-'+Math.random().toString().slice(2,14).padEnd(12,'0')),subtle:{digest:async()=>new Uint8Array(32).buffer}}})}''')
 await page.evaluate('''()=>{const original=SigmaSSEQ.build;window.__built=[];SigmaSSEQ.build=function(x){const result=original(x);window.__built.push(Array.from(result));return result}}''')
 return page,errs

async def test_editor(browser,ext):
 page,errs=await setup(browser)
 try:
  await page.locator('#uploadBtn').click()
  await page.locator('#uploadTargetSlot').select_option('1028')
  await page.locator('#uploadAudioMode').select_option('auto')
  async with page.expect_file_chooser() as chooser:await page.locator('#chooseMusicFiles').click()
  await (await chooser.value).set_files(str(ROOT/'tests/fixtures/polyphony'/f'melody_after_350ms_silence.{ext}'))
  await page.locator('#arrangeAccept').wait_for(timeout=45000)
  def part(role):return page.locator('.arrange-part').filter(has=page.locator('.arrange-part-title strong',has_text=role))
  assert await page.locator('.arrange-part').count()==3,await page.locator('.arrange-part-title').all_text_contents()
  melody=part('Melodi'); bass=part('Bass'); chords=part('Akkorder')
  program_options=await melody.locator('select[data-setting="program"] option').evaluate_all('(nodes)=>nodes.map(n=>n.value)')
  selected=next(n for n in program_options if n not in ('auto','0'))
  await melody.locator('select[data-setting="program"]').select_option(selected)
  melody=part('Melodi')
  await melody.locator('input[data-setting="volume"]').evaluate("el=>{el.value='65';el.dispatchEvent(new Event('change',{bubbles:true}))}")
  melody=part('Melodi')
  melody_count_before=int((await melody.locator('.arrange-part-title span').inner_text()).split()[0])
  bass=part('Bass')
  await bass.locator('select[data-setting="filter"]').select_option('safe')
  assert int((await part('Melodi').locator('.arrange-part-title span').inner_text()).split()[0])==melody_count_before
  # Undo only the bass filter; it must not change melody or chord choices.
  await part('Bass').locator('select[data-setting="filter"]').select_option('balanced')
  await part('Melodi').locator('.arrange-note').first.click()
  await part('Melodi').locator('[data-exclude]').click()
  assert await part('Melodi').locator('.arrange-note.excluded').count()==1
  await part('Akkorder').locator('input[data-setting="included"]').uncheck()
  await page.locator('#arrangeFrom').fill('0.45')
  await page.locator('#arrangeTo').fill('1.55')
  await page.locator('#arrangeListenLoop').check()
  await page.locator('#arrangeGameLoop').uncheck()
  await page.locator('#arrangeFull').click()
  assert await page.evaluate('window.__built.length')>0
  preview_bytes=await page.evaluate('window.__built.at(-1)')
  await page.locator('#arrangeAccept').click(timeout=10000)
  await page.wait_for_function('window.__qa.finishes.length===1',timeout=12000)
  actual=await page.evaluate('''()=>{const bytes=__qa.uploads[0];const parsed=SigmaSSEQ.parse(bytes,{profiles:SigmaBankProfiles,slot:1028});return {bytes:Array.from(bytes),notes:parsed.notes.map(n=>({pitch:n.pitch,program:n.program,velocity:n.velocity,start:n.start})),loop:parsed.infinite,slot:__qa.finishes[0].metadata.slot}}''')
  assert actual['bytes']==preview_bytes,'Full SSEQ preview must have exactly the published bytes'
  assert actual['slot']==1028 and not actual['loop']
  assert 2<=len(actual['notes'])<=4,actual
  assert len([n for n in actual['notes'] if n['program']==int(selected)])==melody_count_before-1,actual
  assert any(n['velocity']<75 for n in actual['notes']),actual
  assert not errs,errs
  print('PASS arranged melody/bass/chord editing, preview hash identity, published SSEQ',ext,{
    'notes':len(actual['notes']),'melody_program':selected,'bytes':len(actual['bytes'])},flush=True)
 finally:await page.close()

async def test_single_repeated(browser):
 page,errs=await setup(browser)
 try:
  await page.locator('#fileInput').set_input_files(str(ROOT/'tests/fixtures/polyphony/four_c4_repeats.wav'))
  await page.locator('#arrangeAccept').wait_for(timeout=45000)
  assert await page.locator('.arrange-note').count()==4
  await page.locator('.arrange-note').nth(1).click()
  await page.locator('[data-exclude]').click()
  await page.locator('#arrangeAccept').click()
  await page.wait_for_function('__qa.finishes.length===1',timeout=45000)
  actual=await page.evaluate('''()=>SigmaSSEQ.parse(__qa.uploads[0],{profiles:SigmaBankProfiles,slot:1028}).notes.map(n=>({pitch:n.pitch,start:n.start}))''')
  assert len(actual)==3 and all(n['pitch']==60 for n in actual)
  assert len(set(n['start'] for n in actual))==3
  assert not errs,errs
  print('PASS repeated C4 one-strike exclusion keeps 3 other strikes',flush=True)
 finally:await page.close()

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  try:
   for ext in ('wav','mp3'):await test_editor(browser,ext)
   await test_single_repeated(browser)
  finally:await browser.close()
if __name__=='__main__':asyncio.run(main())
