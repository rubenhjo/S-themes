"""Regression: technical HeartGold bank controls stay off the public main page.
The target slot/loop are chosen in the upload dialog without exposing program IDs.
"""
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
        page.on('pageerror',lambda err: errors.append(str(err)))
        await page.set_content(fixture(),wait_until='domcontentloaded',timeout=20000)
        assert await page.locator('#sseqTargetPanel').is_hidden(), 'Technical bank panel remains visible'
        await page.evaluate('SigmaDebug.state.ready=true')
        await page.locator('#uploadBtn').click()
        assert await page.locator('#uploadTargetSlot').is_visible(), 'Music slot should be chosen at upload time'
        assert await page.locator('#chooseMusicFiles').is_visible()
        assert await page.locator('#hgProgram').is_hidden(), 'Instrument program should be automatic, not public UI'
        values=await page.locator('#uploadTargetSlot option').evaluate_all('(options)=>options.map(o=>o.value)')
        assert values, 'No validated bank slot options'
        target='1030' if '1030' in values else values[-1]
        await page.locator('#uploadTargetSlot').select_option(target)
        await page.locator('#uploadRepeat').uncheck()
        async with page.expect_file_chooser() as selection:
            await page.locator('#chooseMusicFiles').click()
        chooser=await selection.value
        assert chooser.is_multiple()
        assert await page.locator('#hgSlot').input_value()==target
        assert not await page.locator('#hgLoop').is_checked()
        assert await page.locator('#uploadTargetSlot').count()==0
        assert not errors,errors
        print('PASS: hidden technical controls, music-slot upload dialog, automatic instrument, loop and chooser')
        await browser.close()

if __name__=='__main__': asyncio.run(main())
