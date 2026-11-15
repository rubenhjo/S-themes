"""Offline image fixture ONLY for checking layout, placement and responsiveness.
Real Sigma-dex asset accessibility must be checked separately against GitHub Pages.
"""
import io,hashlib
from PIL import Image,ImageDraw
from urllib.parse import urlparse

def mock_image(name):
 digest=hashlib.sha256(name.encode()).digest()
 im=Image.new('RGBA',(80,80),(0,0,0,0))
 dr=ImageDraw.Draw(im)
 dr.ellipse((8,8,70,70),fill=(70+digest[0]%160,60+digest[1]%160,70+digest[2]%160,255))
 dr.rectangle((30,18,51,40),fill=(255,255,255,190))
 out=io.BytesIO(); im.save(out,format='PNG'); return out.getvalue()
async def install_sprite_mock(page):
 async def handler(route):
  name=route.request.url.split('/')[-2]
  await route.fulfill(status=200,body=mock_image(name),content_type='image/png')
 await page.route('**/assets/sprites*/**/front.png',handler)
