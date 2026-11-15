"""Unavailable catalog must not remain indefinitely labelled 'Connecting'."""
import asyncio
import os
from playwright.async_api import async_playwright
from browser_public import fixture


async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,
            executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,
            args=['--no-sandbox'])
        page=await browser.new_page()
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        await page.set_content(fixture(),wait_until='domcontentloaded',timeout=20000)
        await page.evaluate('''()=>{window.fetch=async url=>{
            if(String(url).includes('/api/config')) return Response.json({ready:true,maxUploadBytes:65536,turnstileSiteKey:'qa'});
            if(String(url).includes('/api/catalog')) return Response.json({error:'Database relation unavailable'},{status:503});
            throw Error('unexpected request '+url);
        }}''')
        await page.evaluate('SigmaDebug.refreshService({silent:true})')
        await page.wait_for_function("document.querySelector('#connectionStatus').textContent.includes('Catalog unavailable')")
        failure=await page.locator('#accountStatus').inner_text()
        assert 'Vercel logs' in failure,failure
        await page.evaluate('''()=>{window.fetch=async url=>{
            if(String(url).includes('/api/config'))return Response.json({ready:true,maxUploadBytes:65536,turnstileSiteKey:'qa'});
            if(String(url).includes('/api/catalog'))return Response.json({tracks:[],complete:true});
            throw Error('unexpected request '+url);
        }}''')
        await page.evaluate('SigmaDebug.refreshService({silent:true})')
        await page.wait_for_function("document.querySelector('#connectionStatus').textContent.includes('Shared library')")
        assert 'Public library online' in await page.locator('#accountStatus').inner_text()
        assert not errors,errors
        await browser.close()
    print('PASS status: failed catalog -> actionable message; recovered catalog -> shared library')


if __name__=='__main__':asyncio.run(main())
