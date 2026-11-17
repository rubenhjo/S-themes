"""Current SSEQ-only library backup selection regression, real Chromium and ZIP.
HTTP/catalog/audio sources are deliberately mocked; not a production test.
"""
import asyncio,json,os
from playwright.async_api import async_playwright
from browser_public import fixture,ROOT

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  page=await browser.new_page()
  await page.evaluate('''() => {
   const mem=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)}});
   Object.defineProperty(window,'crypto',{configurable:true,value:{subtle:{digest:async()=>new Uint8Array(32).fill(7).buffer},randomUUID:()=>String(Math.random())}});
   window.__audioBytes=new Uint8Array();const oldFetch=window.fetch;
   window.fetch=async url=>{
     if(String(url).startsWith('blob:'))return oldFetch(url);
     if(String(url).includes('/api/config'))return Response.json({ready:true});
     if(String(url).includes('/api/catalog'))return Response.json({tracks:[]});
     if(String(url).includes('/api/audio'))return new Response(window.__audioBytes,{status:200,headers:{'content-length':String(window.__audioBytes.length)}});
     throw Error('Unexpected fetch '+url);
   };window.confirm=()=>true;
  }''')
  errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  await page.set_content(fixture(),wait_until='domcontentloaded')
  data=(ROOT/'tests/fixtures/melody.sseq').read_bytes()
  await page.evaluate('''bytes=>{window.__audioBytes=new Uint8Array(bytes);
    SigmaDebug.state.tracks=['a','b','c'].map(id=>({id,title:'Song '+id,artist:'Artist',original_filename:'song.sseq',sseq_id:1028,sha256:'07'.repeat(32),size_bytes:bytes.length,duration_s:2,created_at:'2026-11-14'}));
    SigmaDebug.state.playlists=[{id:'pl',name:'Playlist one'}];
    SigmaDebug.state.items=[{playlist_id:'pl',track_id:'c',position:0},{playlist_id:'pl',track_id:'a',position:1}];
  }''',list(data))
  ids=[]
  for scope,picked,view,expected in [('selected','b','all',['b']),('view',None,'playlist:pl',['a','c']),('selected','c','all',['c'])]:
   await page.evaluate('v=>{SigmaDebug.state.view=v;SigmaDebug.openExportPicker("backup")}',view)
   await page.locator('input[name="exportScope"][value="'+scope+'"]').check()
   if picked:await page.locator('[data-export-select][value="'+picked+'"]').check()
   await page.locator('#beginExport').click()
   await page.wait_for_function('document.querySelector("#modalRoot a[download]")!==null',timeout=15000)
   result=await page.evaluate('''async()=>{
    const link=document.querySelector('#modalRoot a[download]'),zip=await(await fetch(link.href)).blob();
    await SigmaDS.verifyZip(zip);const entries=await SigmaDS.unzip(zip);
    const manifest=JSON.parse(await entries.get('sigma-library.json').text());
    return {ids:manifest.tracks.map(t=>t.id),sseq:[...entries.keys()].filter(n=>n.endsWith('.sseq')),format:manifest.format};
   }''')
   assert result['ids']==expected,result
   assert len(result['sseq'])==len(expected),result
   assert result['format']=='sigma-themes/library-backup-v2',result
   ids.append(result['ids'])
   await page.locator('#closeDialog').click()
  assert not errors,errors
  print('PASS SSEQ-only backup selected/playlist/selected:',ids,flush=True)
  await browser.close()
if __name__=='__main__':asyncio.run(main())
