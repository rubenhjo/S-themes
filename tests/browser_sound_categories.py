"""Sound-first catalog: cross-bank navigation, synth tone groups and manual tagging."""
import asyncio, os
from playwright.async_api import async_playwright
from browser_public import fixture
from browser_sseq_upload_pipeline import MOCK

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1100,'height':850})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(fixture(),wait_until='domcontentloaded')
  await page.evaluate('''()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=>('00000000-0000-4000-8000-'+Math.random().toString().slice(2,14).padEnd(12,'0')),subtle:{digest:async()=>new Uint8Array(32).buffer}}});window.__testStorage={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(k)=>window.__testStorage[k]??null,setItem:(k,v)=>{window.__testStorage[k]=v;}}})}''')
  await page.evaluate('()=>{window.__originalFetch=window.fetch;'+MOCK+'}')
  await page.evaluate('SigmaDebug.state.ready=true')
  await page.locator('#browseHeartGoldBanks').click()
  root='#standaloneInstrumentBrowser'
  assert await page.locator(root+' [data-hg-view="sound"]').get_attribute('aria-pressed')=='true'
  family=page.locator(root+' [data-hg-family]')
  options=await family.locator('option').evaluate_all('(els)=>els.map(e=>e.value)')
  assert all(x in options for x in ['keys','guitar','bass','synth','drums','strings','winds','voice','other'])
  await family.select_option('synth')
  characters=await page.locator(root+' [data-hg-character] option').evaluate_all('(els)=>els.map(e=>e.value)')
  assert all(x in characters for x in ['synth-lead','synth-pad','synth-retro','synth-pluck','synth-bass','synth-digital'])
  await page.locator(root+' [data-hg-character]').select_option('synth-retro')
  rows=page.locator(root+' [data-hg-list] article')
  count=await rows.count();assert 1<=count<=48,count
  bank_ids=await rows.evaluate_all('(els)=>[...new Set(els.map(e=>e.dataset.hgBankId))]')
  assert len(bank_ids)>1,bank_ids
  # Choose an instrument from a different game bank without navigating by game location.
  await rows.locator('[data-hg-choose]').first.click()
  bank=await page.evaluate('SigmaBankProfiles.sequence_slots[document.querySelector("#hgSlot").value].bank')
  assert str(bank)==str(bank_ids[0]),(bank,bank_ids)
  # Manually classify an as-yet-unknown PCM patch, and find it by sound rather than by bank.
  await page.locator(root+' [data-hg-view="bank"]').click()
  await page.locator(root+' [data-hg-bank]').select_option('702')
  row=page.locator(root+' [data-hg-list] article[data-hg-id="0"]')
  await row.locator('[data-hg-tag]').select_option('keys-piano')
  assert 'keys-piano' in (await page.evaluate('localStorage.getItem("sigma-heartgold-sound-categories-v1")'))
  await page.locator(root+' [data-hg-view="sound"]').click()
  await family.select_option('keys')
  assert await page.locator(root+' [data-hg-list] article[data-hg-bank-id="702"][data-hg-id="0"]').count()==1
  await page.locator(root+' [data-hg-character]').select_option('keys-piano')
  assert await page.locator(root+' [data-hg-list] article').count()==1
  assert not errors,errors
  print('PASS: sound families, 8 synth subtypes, all-bank discovery, cross-bank selection, custom piano tag and local search')
  await browser.close()

if __name__=='__main__':asyncio.run(main())
