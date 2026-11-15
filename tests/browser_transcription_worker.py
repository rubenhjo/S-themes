"""Verify that the actual offline FFT Worker runs and produces a valid SSEQ.

Works without local HTTP navigation, including locked-down browser environments.
The Worker is assembled from the exact source files: only its relative importScripts
line is replaced by the real, inline sseq_transcribe.js implementation.
"""
import asyncio
import base64
import json
import os
from playwright.async_api import async_playwright
from browser_public import ROOT


async def main():
    worker_source = (ROOT/'sseq_transcribe_worker.js').read_text()
    import_line = "importScripts('sseq_transcribe.js');"
    assert worker_source.count(import_line) == 1
    worker_source = (ROOT/'sseq_transcribe.js').read_text() + '\n' + worker_source.replace(import_line, '')
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True,
            executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,
            args=['--no-sandbox','--disable-gpu'])
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda err: errors.append(str(err)))
        await page.set_content('<html><body>FFT worker check</body></html>')
        await page.add_script_tag(path=str(ROOT/'sseq_codec.js'))
        await page.add_script_tag(content='window.SigmaBankProfiles = ' + (ROOT/'heartgold_bank_profiles.json').read_text() + ';')
        await page.add_script_tag(path=str(ROOT/'sseq_transcribe.js'))
        await page.evaluate('''(workerSource)=>{
            const realWorker = window.Worker;
            const url = URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
            window.__workerBlobURL = url;
            window.__workerStarts = 0;
            window.Worker = class extends realWorker {
                constructor(script,options) {
                    if(String(script)==='sseq_transcribe_worker.js') {
                        window.__workerStarts++;
                        super(url,options);
                    } else { super(script,options); }
                }
            };
        }''', worker_source)
        output=[]
        for name, expected in [('melody.wav',[60,62,64,67]),('melody_b.mp3',[67,65,62,60])]:
            raw=base64.b64encode((ROOT/'tests/fixtures'/name).read_bytes()).decode()
            result=await page.evaluate('''async ({name,b64})=>{
                const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
                const f=new File([bytes],name,{type:name.endsWith('.mp3')?'audio/mpeg':'audio/wav'});
                const result=await SigmaTranscribe.convertFile(f,{profiles:SigmaBankProfiles,slot:1028,program:0});
                const parsed=SigmaSSEQ.parse(result.bytes,{profiles:SigmaBankProfiles,slot:1028});
                return {file:name,header:Array.from(result.bytes.slice(0,4)),notes:parsed.notes.map(x=>x.pitch),
                        bytes:result.bytes.length,workers:window.__workerStarts};
            }''',{'name':name,'b64':raw})
            assert result['header']==[83,83,69,81],result
            assert result['notes']==expected,result
            assert result['workers']==len(output)+1,result
            output.append(result)
        await page.evaluate('URL.revokeObjectURL(window.__workerBlobURL)')
        assert not errors,errors
        await browser.close()
    print('PASS actual Blob worker + browser WAV/MP3 → valid SSEQ:',json.dumps(output))


if __name__=='__main__': asyncio.run(main())
