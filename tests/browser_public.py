"""Browser-only UI smoke test. Page and API responses are injected, NOT a deployed Supabase integration test."""
import asyncio, json, re, base64, os
from pathlib import Path
from playwright.async_api import async_playwright
from browser_sprite_fixtures import install_sprite_mock

ROOT=Path(__file__).resolve().parents[1]
def fixture():
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link[^>]+fonts.googleapis[^>]*>', '', html)
    html=re.sub(r'<link[^>]+fonts.gstatic[^>]*>', '', html)
    html=html.replace('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>','')
    html=html.replace('<script src="ds_audio.js"></script>', '<script>'+(ROOT/'ds_audio.js').read_text()+'</script>')
    html=html.replace('<script src="metadata.js"></script>', '<script>'+(ROOT/'metadata.js').read_text()+'</script>')
    html=html.replace('<script src="client_core.js"></script>', '<script>'+(ROOT/'client_core.js').read_text()+'</script>')
    html=html.replace('<script src="app.js" defer></script>', '<script>'+(ROOT/'app.js').read_text()+'</script>')
    html=html.replace('<script src="sigma_dex_export.js"></script>', '<script>'+(ROOT/'sigma_dex_export.js').read_text()+'</script>')
    # Offline visual fixture: distinct synthetic images replace remote GitHub requests. This tests placement only.
    sprite_js=(ROOT/'sigma_dex_sprites.js').read_text()
    sprite_js=sprite_js.replace("image.src = SOURCE_ROOT + path;", "image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"80\" height=\"80\"><circle cx=\"40\" cy=\"40\" r=\"34\" fill=\"hsl('+(index*27)+',58%,62%)\"/><rect x=\"29\" y=\"25\" width=\"22\" height=\"22\" fill=\"white\" /></svg>');")
    html=html.replace('<script src="sigma_dex_sprites.js" defer></script>', '<script>'+sprite_js+'</script>')
    html=html.replace('<link rel="stylesheet" href="sigma_dex_sprites.css">', '<style>'+(ROOT/'sigma_dex_sprites.css').read_text()+'</style>')
    def inline_sprite(match):
        path=ROOT/match.group(0)
        return 'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
    html=re.sub(r'sprites2/[\w-]+\.png',inline_sprite,html)
    return html

async def main():
  results={}
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
    for w,h in [(1440,900),(768,1000),(390,844)]:
      page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
      await install_sprite_mock(page)
      await page.add_init_script('''
       const originalFetch=window.fetch;
       window.fetch=async (url,options)=>{
         if(String(url).includes('/api/config')) return new Response(JSON.stringify({ready:false,maxUploadBytes:47185920}),{status:200,headers:{'Content-Type':'application/json'}});
         if(String(url).includes('/api/catalog')) return new Response(JSON.stringify({tracks:[]}),{status:200,headers:{'Content-Type':'application/json'}});
         return originalFetch(url,options);
       }
      ''')
      errs=[]
      page.on('pageerror',lambda err: errs.append(str(err)))
      print('setting content',w,flush=True);await page.set_content(fixture(),wait_until='domcontentloaded',timeout=20000);print('content loaded',w,flush=True)
      await page.wait_for_timeout(500)
      print('taking screenshot',w,flush=True);await page.screenshot(path=str(ROOT/'tests'/f'public-{w}.png'),full_page=False,timeout=15000)
      count=await page.locator('.sigma-dex-float').count()
      visible=await page.locator('.sigma-dex-float:visible').count()
      overflow=await page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
      signup=await page.locator('input[type=email],#accountButton').count()
      assert count>=6,count
      assert not overflow,(w, 'horizontal overflow')
      assert not signup,(w, 'sign in UI')
      assert not errs,(w, errs)
      page.once('dialog',lambda dialog: dialog.accept('My test playlist'))
      if w<=750: await page.locator('#menuBtn').click()
      await page.locator('#newPlaylist').click()
      await page.wait_for_timeout(100)
      playlists=await page.locator('#playlistNav button').count()
      distinct=await page.locator('.sigma-dex-float').evaluate_all('(imgs) => new Set(imgs.map(i => i.src)).size')
      assert distinct>=6,distinct
      results[str(w)]={'sprites':count,'visible':visible,'distinct':distinct,'h_overflow':overflow,'signup':signup,'local_playlist_created':playlists==1,'errors':errs[:3]}
      await page.close()
    print(json.dumps(results,indent=2))
    await browser.close()

if __name__=='__main__': asyncio.run(main())
