"""Browser regression: empty/partial/out-of-order/error catalogs must preserve personal state."""
import asyncio,json,os
from playwright.async_api import async_playwright
from browser_public import fixture

async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  page=await b.new_page()
  await page.evaluate('''()=>{
   const store=new Map();const local={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
   Object.defineProperty(window,'localStorage',{value:local,configurable:true});
   window.__catalog=['a','b','c'];window.__failure=false;
   const create=id=>({id,title:'Song '+id,artist:'Artist',album:'',original_filename:'x.mp3',duration_s:1,sha256:'f'.repeat(64),size_bytes:64,created_at:'2026-11-14'});
   window.fetch=async url=>{
    if(String(url).includes('/api/config'))return Response.json({ready:true});
    if(String(url).includes('/api/catalog')){if(window.__failure)throw Error('Offline');return Response.json({tracks:window.__catalog.map(create)})}
    throw Error('Unexpected '+url)
   };
  }''')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(fixture(),wait_until='domcontentloaded')
  await page.wait_for_function('SigmaDebug.state.tracks.length===3',timeout=5000)
  await page.evaluate('''()=>{
    const s=SigmaDebug.state;s.playlists=[{id:'p',name:'Private favorites'}];
    s.items=[{playlist_id:'p',track_id:'a',position:0},{playlist_id:'p',track_id:'b',position:1},{playlist_id:'p',track_id:'c',position:2}];
    s.likes=[{track_id:'a',position:0},{track_id:'b',position:1}];s.queue=['a','b','c'];s.baseQueue=['a','b','c'];s.playingId='a';s.index=0;
  }''')
  report={}
  for scenario,ids,error in [('empty',[],False),('half',['a'],False),('out_of_order',['c','a','b'],False),('network_error',[],True),('confirmed_missing',['a','c'],False)]:
   await page.evaluate('''([ids,fail])=>{window.__catalog=ids;window.__failure=fail}''',[ids,error])
   await page.evaluate('SigmaDebug.loadCatalog({silent:true})')
   out=await page.evaluate('''()=>{const s=SigmaDebug.state;return {likes:s.likes.map(x=>x.track_id),items:s.items.map(x=>x.track_id),queue:s.queue,playingId:s.playingId,tracks:s.tracks.map(x=>x.id)}}''')
   assert out['likes']==['a','b'],(scenario,out)
   assert out['items']==['a','b','c'],(scenario,out)
   assert out['queue']==['a','b','c'],(scenario,out)
   assert out['playingId']=='a',(scenario,out)
   report[scenario]='PASS'
  assert not errors,errors
  print(json.dumps({'status':'PASS','catalog_regressions':report,'page_errors':errors},indent=2))
  await b.close()
if __name__=='__main__':asyncio.run(main())
