"""Chromium UI export selection tests using mocked catalog/audio HTTP responses.
Actual ZIP writer/reader and manifest are exercised, no real Supabase involved.
"""
import asyncio, json, os
from playwright.async_api import async_playwright
from browser_public import fixture

async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  page=await b.new_page()
  await page.evaluate('''() => {
    const mem=new Map(),storage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
    Object.defineProperty(window,'localStorage',{value:storage,configurable:true});
    Object.defineProperty(window,'crypto',{value:{subtle:{digest:async()=>new Uint8Array(32).fill(7).buffer},randomUUID:()=>String(Math.random())},configurable:true});
    window.__audioBytes=new Uint8Array(64);window.__audioBytes.set([73,68,51]);
    const originalFetch=window.fetch;window.fetch=async url=>{
      if(String(url).startsWith('blob:'))return originalFetch(url);
      if(String(url).includes('/api/config'))return Response.json({ready:true});
      if(String(url).includes('/api/catalog'))return Response.json({tracks:[]});
      if(String(url).includes('/api/audio'))return new Response(window.__audioBytes,{status:200,headers:{'content-length':'64'}});
      throw Error('Unexpected request '+url)
    };
    window.confirm=()=>true;
  }''')
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(fixture(),wait_until='domcontentloaded')
  await page.evaluate('''() => {
    SigmaDebug.state.tracks=['a','b','c'].map((id,i)=>({id,title:'Song '+id,artist:'Artist',original_filename:'song.mp3',sha256:'07'.repeat(32),size_bytes:64,duration_s:1,created_at:'2026-11-14'}));
    SigmaDebug.state.playlists=[{id:'pl',name:'Playlist one'}];SigmaDebug.state.items=[{playlist_id:'pl',track_id:'c',position:0},{playlist_id:'pl',track_id:'a',position:1}];
    SigmaDS.convert=async()=>SigmaDS.encodeImaWav([new Float32Array(200),new Float32Array(200)],32728,true);
  }''')
  # exactly one chosen HeartGold track
  await page.evaluate("SigmaDebug.openExportPicker('ds')")
  await page.locator('input[name="exportScope"][value="selected"]').check()
  await page.locator('[data-export-select][value="b"]').check()
  await page.locator('#beginExport').click()
  await page.wait_for_function('document.querySelector(\'#modalRoot a[download]\')!==null',timeout=15000)
  result1=await page.evaluate('''async()=>{const url=document.querySelector('#modalRoot a[download]').href;const zip=await(await fetch(url)).blob();await SigmaDS.verifyZip(zip);const entries=await SigmaDS.unzip(zip);const m=JSON.parse(await entries.get('manifest.json').text());return {ids:m.tracks.map(x=>x.id),keys:[...entries.keys()]}}''')
  assert result1['ids']==['b'],result1
  assert len([x for x in result1['keys'] if x.endswith('.wav')])==1,result1
  await page.locator('#closeDialog').click()
  # playlist view only
  await page.evaluate("SigmaDebug.state.view='playlist:pl';SigmaDebug.openExportPicker('ds')")
  await page.locator('input[name="exportScope"][value="view"]').check()
  await page.locator('#beginExport').click()
  await page.wait_for_function('document.querySelector(\'#modalRoot a[download]\')!==null',timeout=15000)
  result2=await page.evaluate('''async()=>{const url=document.querySelector('#modalRoot a[download]').href;const b=await(await fetch(url)).blob();const e=await SigmaDS.unzip(b);return JSON.parse(await e.get('manifest.json').text()).tracks.map(t=>t.id)}''')
  assert result2==['a','c'],result2
  await page.locator('#closeDialog').click()
  # selected backup exact list
  await page.evaluate("SigmaDebug.openExportPicker('backup')")
  await page.locator('input[name="exportScope"][value="selected"]').check()
  await page.locator('[data-export-select][value="c"]').check()
  await page.locator('#beginExport').click()
  await page.wait_for_function('document.querySelector(\'#modalRoot a[download]\')!==null',timeout=15000)
  result3=await page.evaluate('''async()=>{const url=document.querySelector('#modalRoot a[download]').href;const b=await(await fetch(url)).blob();await SigmaDS.verifyZip(b);const e=await SigmaDS.unzip(b);return JSON.parse(await e.get('sigma-library.json').text()).tracks.map(t=>t.id)}''')
  assert result3==['c'],result3
  assert not errors,errors
  print(json.dumps({'ds_selected':result1['ids'],'ds_playlist':result2,'backup_selected':result3,'status':'PASS','page_errors':errors},indent=2))
  await b.close()
if __name__=='__main__':asyncio.run(main())
