"""Screenshot-diff verification: at least six unique Sigma sprite motifs visibly affect each viewport.
This detects 'six images exist in DOM but hidden behind opaque panels' regressions.
"""
import asyncio, io, json, os
from PIL import Image, ImageChops
from playwright.async_api import async_playwright
from browser_public import fixture
from browser_sprite_fixtures import install_sprite_mock

async def main():
 out={}
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  for w,h in [(390,844),(768,900),(1440,900),(1920,1080)]:
   page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
   await install_sprite_mock(page)
   await page.evaluate('''() => {
     window.fetch=async url=>String(url).includes('/api/config')?Response.json({ready:false}):Response.json({tracks:[]});
   }''')
   await page.set_content(fixture(),wait_until='domcontentloaded');await page.wait_for_timeout(250)
   await page.evaluate('''() => {
     const groups=new Map();for(const img of document.querySelectorAll('.sigma-dex-float')){
       const key=img.getAttribute('src');if(!groups.has(key))groups.set(key,groups.size);
       img.dataset.qcSpriteGroup=groups.get(key);
     }
   }''')
   total=await page.evaluate("new Set([...document.querySelectorAll('.sigma-dex-float')].map(i=>i.dataset.qcSpriteGroup)).size")
   base=Image.open(io.BytesIO(await page.screenshot())).convert('RGB')
   visible=[]
   for i in range(total):
    if len(visible)>=6:break  # Six genuinely visible distinct motifs are the acceptance threshold.
    await page.evaluate('''(i)=>document.querySelectorAll(`[data-qc-sprite-group="${i}"]`).forEach(img=>img.style.visibility='hidden')''',i)
    other=Image.open(io.BytesIO(await page.screenshot())).convert('RGB')
    diff=ImageChops.difference(base,other)
    pixels=diff.convert('L').point(lambda x:255 if x>7 else 0).histogram()[255]
    if pixels>50:visible.append(i)
    await page.evaluate('''(i)=>document.querySelectorAll(`[data-qc-sprite-group="${i}"]`).forEach(img=>img.style.visibility='')''',i)
   overflow=await page.evaluate('document.documentElement.scrollWidth>window.innerWidth')
   assert not overflow,(w,'horizontal overflow')
   assert len(visible)>=6,(w,visible,total)
   out[w]={'distinct_sprite_motifs':total,'visibly_affecting_pixels':len(visible),'horizontal_overflow':overflow}
   await page.close()
  print(json.dumps({'status':'PASS','viewports':out},indent=2))
  await browser.close()
if __name__=='__main__':asyncio.run(main())
