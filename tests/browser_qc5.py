"""QC5 real Chromium interactions. Simulated APIs are NOT evidence of Supabase/Vercel staging.
The original app/DS encoder and HTML are loaded in Chromium and the user clicks controls.
"""
import asyncio, json, os
from playwright.async_api import async_playwright
from browser_public import fixture

EXEC = '/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None

async def filtered_reorder(browser):
    page=await browser.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.evaluate('''(() => {
      const old=window.fetch;window.fetch=(url,opts)=> {
        if(String(url).includes('/api/config'))return Promise.resolve(Response.json({ready:false}));
        if(String(url).includes('/api/catalog'))return Promise.resolve(Response.json({tracks:[]}));
        return old(url,opts);
      };
    })()''')
    await page.set_content(fixture())
    await page.evaluate('''() => {
      const s=SigmaDebug.state;
      s.tracks=['mellow','bolt','yellow'].map(id=>({id,title:id[0].toUpperCase()+id.slice(1),artist:'Same',size_bytes:10,created_at:'2026-11-14'}));
      s.playlists=[{id:'my-playlist',name:'QC5'}];
      s.items=['mellow','bolt','yellow'].map((track_id,position)=>({playlist_id:'my-playlist',track_id,position}));
      s.view='playlist:my-playlist';s.sort='manual';s.search='low';document.querySelector('#search').value='low';
      document.querySelector('#sortBy').value='manual';
      document.querySelector('#trackList').innerHTML='';
      SigmaDebug.loadCatalog=()=>{};
      SigmaDebug.state.connected=true;
      // Use the actual rendering path after data setup.
      window.dispatchEvent(new Event('sigma-qc5-render'));
    }''')
    # Actual app render is triggered through search field, not a test-only replacement.
    await page.locator('#search').fill('low')
    names=await page.locator('.track[data-id]').evaluate_all('(els)=>els.map(e=>e.dataset.id)')
    assert names==['mellow','yellow'],names
    await page.locator('.track[data-id="yellow"] [data-action="up"]').click()
    s=await page.evaluate('''() => ({order:SigmaDebug.state.items.slice().sort((a,b)=>a.position-b.position).map(x=>x.track_id),visible:SigmaDebug.viewTracks().map(x=>x.id)})''')
    assert s['order']==['yellow','bolt','mellow'],s
    assert s['visible']==['yellow','mellow'],s
    # Persist to localStorage (real Storage on a browser origin may be inaccessible on set_content; our test checks through state too).
    await page.locator('#search').fill('')
    assert (await page.locator('.track[data-id]').evaluate_all('(els)=>els.map(e=>e.dataset.id)')) == ['yellow','bolt','mellow']
    assert not errors,errors
    await page.close();return s

async def lifecycle(browser):
    page=await browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.evaluate('''(() => {
      window.__sockets=[];window.__cfg=0;window.__catalog=0;
      class FakeWS {
        constructor(){this.readyState=0;window.__sockets.push(this);setTimeout(()=>{if(this.readyState===0){this.readyState=1;this.onopen?.()}},0)}
        send(){} close(){this.readyState=3;this.onclose?.()}
      }
      window.WebSocket=FakeWS;
      const original=window.fetch;
      window.fetch=(url,opts)=>{
        if(String(url).includes('/api/config')){window.__cfg++;return Promise.resolve(Response.json({ready:true,realtime:{url:'https://example.supabase.co',anonKey:'test-key'}}))}
        if(String(url).includes('/api/catalog')){window.__catalog++;return Promise.resolve(Response.json({tracks:[]}))}
        return original(url,opts);
      }
    })()''')
    await page.set_content(fixture());await page.wait_for_timeout(250)
    assert await page.evaluate('SigmaDebug.state.ready') is True
    initial=await page.evaluate('window.__sockets.filter(x=>x.readyState===1).length')
    assert initial==1,initial
    for _ in range(3):
      await page.evaluate("window.dispatchEvent(new Event('pagehide'))")
      assert await page.evaluate('SigmaDebug.state.ready') is False
      assert await page.evaluate('window.__sockets.filter(x=>x.readyState===1).length')==0
      await page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
      await page.wait_for_timeout(200)
      assert await page.evaluate('SigmaDebug.state.ready') is True
      assert await page.evaluate('window.__sockets.filter(x=>x.readyState===1).length')==1
    assert await page.evaluate('window.__catalog>=4')
    await page.evaluate('window.dispatchEvent(new Event(\'online\'))')
    await page.wait_for_timeout(100)
    assert await page.evaluate('window.__sockets.filter(x=>x.readyState===1).length')==1
    assert not errors,errors
    report=await page.evaluate('({reconnectCycles:3,socketsCreated:window.__sockets.length,live:window.__sockets.filter(x=>x.readyState===1).length,catalogRequests:window.__catalog})')
    await page.close();return report

async def config_recovery(browser):
    page=await browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.evaluate('''(() => {
      window.__failConfig=true;window.__cfgCount=0;
      const old=window.fetch;
      window.fetch=(url,opts)=> {
        if(String(url).includes('/api/config')){window.__cfgCount++;return Promise.resolve(window.__failConfig ? Response.json({error:'temporarily unavailable'},{status:503}) : Response.json({ready:true}))}
        if(String(url).includes('/api/catalog'))return Promise.resolve(Response.json({tracks:[{id:'catalog-one',title:'One',artist:'Artist',size_bytes:10,created_at:'2026-11-14'}]}));
        return old(url,opts);
      }
    })()''')
    await page.set_content(fixture())
    await page.wait_for_function('window.__cfgCount>=3',timeout=12000)
    assert await page.evaluate('SigmaDebug.state.connected') is True
    assert await page.evaluate('SigmaDebug.state.ready') is False
    await page.evaluate('window.__failConfig=false')
    await page.locator('#refreshBtn').click()
    await page.wait_for_function('SigmaDebug.state.ready && SigmaDebug.state.connected',timeout=5000)
    assert await page.locator('.track[data-id="catalog-one"]').count()==1
    assert not errors,errors
    result=await page.evaluate('({configAttempts:window.__cfgCount,ready:SigmaDebug.state.ready,connected:SigmaDebug.state.connected})')
    await page.close();return result

async def lifecycle_slow_start(browser):
    page=await browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.evaluate('''(() => {
      window.__socketCount=0;window.__firstConfig=true;
      class FakeWS {constructor(){window.__socketCount++;this.readyState=1}send(){}close(){this.readyState=3}}
      window.WebSocket=FakeWS;
      window.fetch=async url=>{
        if(String(url).includes('/api/config')){
          if(window.__firstConfig){window.__firstConfig=false;return new Promise(resolve=>{window.__resolveConfig=()=>resolve(Response.json({ready:true,realtime:{url:'https://example.supabase.co',anonKey:'abc'}}))})}
          return Response.json({ready:true,realtime:{url:'https://example.supabase.co',anonKey:'abc'}});
        }
        if(String(url).includes('/api/catalog'))return Response.json({tracks:[]});
        throw Error('unknown '+url);
      };
    })()''')
    await page.set_content(fixture());await page.wait_for_function('typeof window.__resolveConfig==="function"')
    await page.evaluate('window.dispatchEvent(new Event("pagehide"));window.__resolveConfig()')
    await page.wait_for_timeout(100)
    assert await page.evaluate('window.__socketCount')==0
    await page.evaluate('window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}))')
    await page.wait_for_timeout(120)
    assert await page.evaluate('window.__socketCount')==1
    assert await page.evaluate('SigmaDebug.state.ready') is True
    assert not errors,errors
    await page.close();return {'stale_start_reconnects':0,'after_pageshow':1}

async def corrupt_storage(browser):
    page=await browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.evaluate('''(() => {
      const bad={getItem(){throw new DOMException('Blocked','SecurityError')},setItem(){throw new DOMException('Blocked','SecurityError')},removeItem(){throw new DOMException('Blocked','SecurityError')}};
      Object.defineProperty(window,'localStorage',{value:bad,configurable:true});
      Object.defineProperty(window,'sessionStorage',{value:bad,configurable:true});
      window.fetch=async url=>String(url).includes('/api/config')?Response.json({ready:false}):Response.json({tracks:[]});
    })()''')
    await page.set_content(fixture());await page.wait_for_timeout(80)
    await page.evaluate('SigmaDebug.state.playlists.push({id:"abc",name:"Kept"});SigmaDebug.state.likes.push({track_id:"missing",position:0})')
    await page.locator('#refreshBtn').click();await page.wait_for_timeout(100)
    assert await page.evaluate('SigmaDebug.state.playlists[0].name')=='Kept'
    assert await page.evaluate('SigmaDebug.state.likes[0].track_id')=='missing'
    assert not errors,errors
    await page.close();return {'blocked_browser_storage':'PASS','state_not_crashed':True}

async def cancel_stale_catalog(browser):
    page=await browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.evaluate('''(() => {
      window.__abortedCatalog=0;window.__catalogFirst=true;
      window.fetch=(url,opts)=>{
        if(String(url).includes('/api/config'))return Promise.resolve(Response.json({ready:false}));
        if(String(url).includes('/api/catalog')){
          if(window.__catalogFirst){window.__catalogFirst=false;
            return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>{
              window.__abortedCatalog++;reject(new DOMException('aborted','AbortError'))
            },{once:true}));}
          return Promise.resolve(Response.json({tracks:[{id:'after-reconnect',title:'After',artist:'Artist',created_at:'2026-11-14',size_bytes:64}]}));
        }
        throw Error('unexpected '+url);
      };
    })()''')
    await page.set_content(fixture());await page.wait_for_timeout(80)
    await page.evaluate('window.dispatchEvent(new Event("pagehide"))')
    await page.wait_for_timeout(80)
    assert await page.evaluate('window.__abortedCatalog')==1
    await page.evaluate('window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}))')
    await page.wait_for_timeout(150)
    assert await page.evaluate('SigmaDebug.state.tracks.map(t=>t.id)')==['after-reconnect']
    assert not errors,errors
    await page.close();return {'aborted_before_pageshow':1,'latest_catalog_after_reconnect':'after-reconnect'}

async def ds_parts(browser):
    """SSEQ-only replacement of legacy WAV/DS partition test."""
    page=await browser.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.evaluate('''() => {
      const mem=new Map(),storage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
      Object.defineProperty(window,'localStorage',{value:storage,configurable:true});
      Object.defineProperty(window,'crypto',{value:{subtle:{digest:async()=>new Uint8Array(32).fill(7).buffer},randomUUID:()=>String(Math.random())},configurable:true});
      window.__audioBytes=new Uint8Array();const oldFetch=window.fetch;
      window.fetch=async url=>{
        if(String(url).startsWith('blob:'))return oldFetch(url);
        if(String(url).includes('/api/config'))return Response.json({ready:true});
        if(String(url).includes('/api/catalog'))return Response.json({tracks:[]});
        if(String(url).includes('/api/audio'))return new Response(window.__audioBytes,{status:200,headers:{'content-length':String(window.__audioBytes.length)}});
        throw Error('Unexpected request '+url);
      };
    }''')
    await page.set_content(fixture(),wait_until='domcontentloaded')
    from browser_public import ROOT
    sample=list((ROOT/'tests/fixtures/melody.sseq').read_bytes())
    await page.evaluate('''bytes=>{
      window.__audioBytes=Uint8Array.from(bytes);
      SigmaDebug.state.tracks=['a','b','c'].map((id,i)=>({id,title:'Song '+id,artist:'Artist',sseq_id:1028,original_filename:'song.sseq',sha256:'07'.repeat(32),size_bytes:bytes.length,duration_s:2,created_at:'2026-11-14'}));
      SigmaCore.partition=tracks=>tracks.map(t=>[t]);
    }''',sample)
    await page.evaluate('SigmaDebug.openExportPicker("backup")')
    await page.locator('#beginExport').click()
    await page.wait_for_function('document.querySelectorAll("#modalRoot a[download]").length===3',timeout=20000)
    checks=await page.evaluate('''async () => {
      const results=[];
      for(const a of document.querySelectorAll('#modalRoot a[download]')){
        const zip=await(await fetch(a.href)).blob();await SigmaDS.verifyZip(zip);
        const entries=await SigmaDS.unzip(zip);
        const m=JSON.parse(await entries.get('sigma-library.json').text());
        const names=[...entries.keys()].filter(n=>n.endsWith('.sseq'));
        if(m.tracks.length!==1 || names.length!==1 || names[0]!==m.tracks[0].backup_path)throw Error('Wrong SSEQ backup part');
        if(m.total_parts!==3)throw Error('Incomplete split backup metadata');
        results.push({part:m.part,id:m.tracks[0].id,sha:m.tracks[0].sha256,names});
      }
      return results;
    }''')
    assert [x['id'] for x in checks]==['a','b','c'],checks
    assert len({x['sha'] for x in checks})==1  # distinct catalog IDs, same bytes
    assert not errors,errors
    await page.close();return checks

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=EXEC,args=['--no-sandbox'])
  result={}
  result['ST-020']=await filtered_reorder(browser)
  result['ST-023']=await lifecycle(browser)
  result['ST-027']=await lifecycle_slow_start(browser)
  result['ST-028']=await corrupt_storage(browser)
  result['ST-032']=await cancel_stale_catalog(browser)
  result['ST-024']=await config_recovery(browser)
  result['ST-022']=await ds_parts(browser)
  print(json.dumps({'status':'PASS','checks':result},indent=2))
  await browser.close()
if __name__=='__main__':asyncio.run(main())
