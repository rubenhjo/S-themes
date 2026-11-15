"""Browser UI interactions using synthetic catalog fixtures; does not test remote Supabase."""
import asyncio,json,os
from playwright.async_api import async_playwright
from browser_public import fixture

async def main():
 result={}
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  for w in (390,1440):
   page=await browser.new_page(viewport={'width':w,'height':900},device_scale_factor=1)
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.set_content(fixture(),wait_until='domcontentloaded')
   # Test library payload is synthetic; no live backend request.
   await page.evaluate('''() => {
     const st=window.SigmaDebug.state;
     st.tracks=[
       {id:'a',title:'Mellow',artist:'Sigma',duration_s:5,original_filename:'a.mp3',size_bytes:1500,sha256:'a'.repeat(64)},
       {id:'b',title:'Bolt',artist:'Sigma',duration_s:4,original_filename:'b.mp3',size_bytes:1400,sha256:'b'.repeat(64)},
       {id:'c',title:'Yellow',artist:'Sigma',duration_s:3,original_filename:'c.mp3',size_bytes:1300,sha256:'c'.repeat(64)}
     ];
     document.querySelector('#search').dispatchEvent(new Event('input',{bubbles:true}));
   }''')
   if w==390:await page.locator('#menuBtn').click()
   page.once('dialog',lambda d:d.accept('Battle'))
   await page.locator('#newFolder').click()
   assert await page.locator('#folderNav button').count()==2
   # Name subfolder under the selected Battle folder.
   page.once('dialog',lambda d:d.accept('Wild'))
   await page.locator('#playlistCards [data-folder-action=create]').click()
   assert await page.locator('#folderNav button').count()==3
   if w==390:await page.locator('#menuBtn').click()
   await page.locator('#nav [data-view=all]').click()
   await page.locator('#search').fill('Mellow')
   await page.locator('[data-action=more][data-id=a]').click()
   await page.locator('#editExportTitle').fill('Battle Theme')
   await page.locator('#loopStartInput').fill('1')
   await page.locator('#loopEndInput').fill('4')
   await page.locator('#editTrackFolder').select_option(await page.evaluate('window.SigmaDebug.state.folderTree.at(-1).id'))
   await page.locator('#saveMapping').click()
   assert await page.evaluate('window.SigmaDebug.state.exportMetadata.a.loop_start_sec')==1
   assert await page.evaluate('window.SigmaDebug.state.trackFolders.a===window.SigmaDebug.state.folderTree.at(-1).id')
   await page.locator('#sigmaExportBtn').click()
   assert await page.locator('#sigmaExportEstimate').count()==1
   await page.locator('input[name=sigmaScope][value=selected]').check()
   await page.locator('[data-sigma-folder]').last.check()
   estimate=await page.locator('#sigmaExportEstimate').inner_text()
   assert '1 songs' in estimate,estimate
   await page.locator('#closeDialog').click()
   assert not errors,errors
   result[w]={'folders':3,'export_selection':estimate,'errors':errors}
   await page.close()
  await browser.close()
 print(json.dumps({'status':'PASS','responsive_browser_ui':result},indent=2))
if __name__=='__main__':asyncio.run(main())
