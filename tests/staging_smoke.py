"""REAL staging read-only checks, no mocks and no database mutations.
Usage: SIGMA_STAGING_URL=https://your-preview.vercel.app python tests/staging_smoke.py
For real upload/Realtime testing, manually add a licensed test file through the Turnstile UI
in one browser and verify it appears in another. Never run write tests against production by default.
"""
import asyncio, os, json
from urllib.parse import urljoin
from playwright.async_api import async_playwright

URL=os.getenv('SIGMA_STAGING_URL','').rstrip('/')
async def main():
 if not URL.startswith('https://'):
  print(json.dumps({'status':'NOT TESTED','reason':'SIGMA_STAGING_URL HTTPS not configured'}));return 2
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  reports=[]
  try:
   for idx in range(2):
    page=await browser.new_page(viewport={'width':390 if idx else 1440,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    response=await page.goto(URL+'/',wait_until='domcontentloaded',timeout=60000)
    assert response and response.ok, f'public site status: {response.status if response else None}'
    await page.wait_for_timeout(1000)
    assert await page.locator('input[type=email],#accountButton').count()==0,'unexpected login UI'
    assert await page.locator('.sigma-sprite:visible').count()>=6,'sprite layout missing'
    config=await page.evaluate("async()=>{const r=await fetch('/api/config');return {status:r.status,data:await r.json()}}")
    catalog=await page.evaluate("async()=>{const r=await fetch('/api/catalog');return {status:r.status,data:await r.json()}}")
    assert config['status']==200 and config['data'].get('ready'),'staging environment not ready'
    assert catalog['status']==200 and isinstance(catalog['data'].get('tracks'),list),'catalog not available'
    assert not errors,errors
    reports.append({'session':idx+1,'tracks':len(catalog['data']['tracks']),'status':'PASS'})
    await page.close()
   assert reports[0]['tracks']==reports[1]['tracks'],'initial catalog differs between browser sessions'
   print(json.dumps({'status':'PASS','staging':URL,'two_sessions':reports,'write_tests':'NOT TESTED (needs controlled Turnstile upload)'}))
   return 0
  finally: await browser.close()
if __name__=='__main__': raise SystemExit(asyncio.run(main()))
