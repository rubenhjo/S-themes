"""Account-free song deletion modal: mocked server, never a live database test."""
import asyncio, os, json
from playwright.async_api import async_playwright
from browser_public import fixture

ID='e7ebec2c-f475-499e-8447-0c46d9ab1c67'
SECOND='e7ebec2c-f475-499e-8447-0c46d9ab1c68'
RECEIPT='a'*64
ADMIN='b'*64

async def run(browser, owner):
    page=await browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    init_js='''(()=>{const args=__ARGS__;
      const values={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return values[k]||null},setItem(k,v){values[k]=String(v)},removeItem(k){delete values[k]}}});
      window.__deleteCalls=[];
      window.__tracks=[
       {id:args.id,title:'Same bytes A',artist:'QA',album:'',duration_s:2,sha256:'f'.repeat(64),created_at:'2026-11-16T00:00:00Z',size_bytes:64,mime_type:'application/octet-stream',sseq_id:1028},
       {id:args.second,title:'Same bytes B',artist:'QA',album:'',duration_s:2,sha256:'f'.repeat(64),created_at:'2026-11-15T00:00:00Z',size_bytes:64,mime_type:'application/octet-stream',sseq_id:1028}
      ];
      if(args.owner)localStorage.setItem('sigma-themes-song-owner-receipts-v1',JSON.stringify({[args.id]:args.receipt}));
      window.fetch=async(url,options={})=>{
       const u=String(url);
       if(u.includes('/api/config'))return Response.json({ready:false,maxUploadBytes:65536});
       if(u.includes('/api/catalog'))return Response.json({tracks:window.__tracks,complete:true});
       if(u.includes('/api/song-delete')){
         const body=JSON.parse(options.body||'{}');window.__deleteCalls.push(body);
         if(body.trackId!==args.id || (args.owner?body.receipt!==args.receipt:body.adminToken!==args.admin))return Response.json({error:'Unauthorized'},{status:403});
         window.__tracks=window.__tracks.filter(t=>t.id!==args.id);
         return Response.json({deleted:true,cleanupPending:false});
       }
       throw Error('Unexpected request '+u);
      };
    })()'''
    await page.evaluate(init_js.replace('__ARGS__',json.dumps({'id':ID,'second':SECOND,'owner':owner,'receipt':RECEIPT,'admin':ADMIN})))
    await page.set_content(fixture(),wait_until='domcontentloaded',timeout=25000)
    await page.wait_for_function('SigmaDebug?.state.tracks.length===2',timeout=10000)
    await page.locator('[data-action="more"][data-id="'+ID+'"]').click()
    assert await page.locator('#deleteSharedSong').is_visible()
    await page.locator('#deleteSharedSong').click()
    assert await page.locator('#confirmDeleteSong').is_disabled()
    if owner:
       assert await page.locator('#deleteSongMethod').input_value()=='owner'
       assert await page.locator('#deleteSongSecretBlock').is_hidden()
    else:
       await page.locator('#deleteSongMethod').select_option('admin')
       await page.locator('#deleteSongSecret').fill(ADMIN)
    assert await page.evaluate('window.__deleteCalls.length')==0
    await page.locator('#deleteSongConfirm').fill('DELETE')
    await page.locator('#confirmDeleteSong').click()
    await page.wait_for_function('window.__deleteCalls.length===1',timeout=15000)
    await page.wait_for_function('SigmaDebug.state.tracks.length===1',timeout=15000)
    assert await page.locator('#trackList .track').count()==1
    assert await page.locator('#trackList .track').first.get_attribute('data-id')==SECOND
    sent=await page.evaluate('window.__deleteCalls[0]')
    assert sent['trackId']==ID
    assert ('receipt' in sent)==owner,sent
    assert ('adminToken' in sent)==(not owner),sent
    assert not errors,errors
    await page.close()
    print('PASS', 'owner' if owner else 'admin','delete UI, original identical-hash song preserved')

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  try:
   await run(browser,True)
   await run(browser,False)
  finally:
   await browser.close()

if __name__=='__main__':asyncio.run(main())
