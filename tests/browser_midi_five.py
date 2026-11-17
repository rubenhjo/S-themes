"""Chromium real upload UI with 5 synthetic MIDI files, mocked server (no real production changes)."""
import asyncio, os, tempfile
from pathlib import Path
from playwright.async_api import async_playwright
from browser_public import fixture
from browser_sseq_upload_pipeline import MOCK

def fake_midi(note):
    raw=bytes([0,0x90,note,95,0x83,0x60,0x80,note,0,0,0xff,0x2f,0])
    return b'MThd'+(6).to_bytes(4,'big')+b'\x00\x00\x00\x01\x01\xe0'+b'MTrk'+len(raw).to_bytes(4,'big')+raw

async def main():
    async with async_playwright() as p, asyncio.timeout(90):
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
        page=await browser.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.set_content(fixture(),wait_until='domcontentloaded',timeout=15000)
        await page.evaluate('''()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{
             randomUUID:()=>('00000000-0000-4000-8000-'+Math.random().toString().slice(2,14).padEnd(12,'0')),
             subtle:{digest:async()=>new Uint8Array(32).buffer}
        }})}''')
        await page.evaluate('()=>{window.__originalFetch=window.fetch;'+MOCK+'}')
        await page.evaluate('SigmaDebug.state.ready=true')
        with tempfile.TemporaryDirectory() as tmp:
            filepaths=[]
            for i in range(5):
                f=Path(tmp)/f'instrument_{i}.mid';f.write_bytes(fake_midi(60+i));filepaths.append(str(f))
            await page.locator('#uploadBtn').click()
            await page.locator('input[name="uploadMusicMode"][value="combine"]').check()
            await page.locator('#uploadTargetSlot').select_option('1028')
            async with page.expect_file_chooser() as chooser:
                await page.locator('#chooseMusicFiles').click()
            await (await chooser.value).set_files(filepaths)
            await page.locator('#combinedTitle').wait_for(timeout=15000)
            assert await page.locator('[data-midi-row]').count()==5
            for i in range(5):
                await page.locator(f'#midiProgram{i}').select_option(str(i))
                assert await page.locator(f'#midiProgram{i} option').count()>20
            await page.locator('#combinedTitle').fill('Five-part original')
            await page.locator('#uploadCombinedMidi').click()
            await page.locator('#confirmSseqUpload').wait_for(timeout=12000)
            assert await page.evaluate('window.__qa.starts.length')==0,'Review must precede upload'
            await page.locator('#confirmSseqUpload').click()
            await page.wait_for_function('window.__qa.finishes.length===1',timeout=20000)
            check=await page.evaluate('''()=>{
              const q=window.__qa,parsed=SigmaSSEQ.parse(q.uploads[0],{profiles:SigmaBankProfiles,slot:1028});
              return {starts:q.starts.length,uploads:q.uploads.length,finishes:q.finishes.length,
                title:q.finishes[0].metadata.title,programs:[...new Set(parsed.notes.map(n=>n.program))].sort((a,b)=>a-b),
                noteCount:parsed.notes.length,bytes:q.uploads[0].length,tracks:parsed.tracks.length};
            }''')
            assert check=={'starts':1,'uploads':1,'finishes':1,'title':'Five-part original','programs':[0,1,2,3,4],'noteCount':5,'bytes':check['bytes'],'tracks':5},check
            assert check['bytes']<=65536
            assert not errors,errors
            print('PASS browser: 5 MIDI rows, 5 compatible instrument selects, one saved SSEQ:',check)
        await browser.close()

if __name__=='__main__':asyncio.run(main())
