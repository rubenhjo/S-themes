"""Optional PRIVATE QA fixture: accepts external audio path; never ships source bytes in archive.
Invoke: python tests/browser_user_audio_local_only.py /path/to/user-owned-recording.m4a
"""
import asyncio,os,sys,json
from pathlib import Path
from playwright.async_api import async_playwright
from browser_public import fixture

async def main(path):
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
  page=await browser.new_page()
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(fixture(),wait_until='domcontentloaded')
  await page.evaluate("()=>{const e=document.createElement('input');e.type='file';e.id='privateFixture';document.body.append(e)}")
  await page.locator('#privateFixture').set_input_files(str(Path(path).resolve()),no_wait_after=True)
  res=await page.evaluate('''async()=>{
   const f=document.querySelector('#privateFixture').files[0],o=await SigmaTranscribe.convertFile(f,{slot:1028,program:0,loop:false,profiles:SigmaBankProfiles});
   return {bytes:o.bytes.length,noteCount:o.parsed.notes.length,tracks:o.parsed.tracks.length,
    durationSeconds:o.parsed.durationTicks*60/(o.parsed.tempo*48),programs:[...new Set(o.parsed.notes.map(n=>n.program))],
    spotPitch:[3.18,6.52,7.36].map(t=>({time:t,notes:o.parsed.notes.filter(n=>{
     const start=n.start*60/(o.parsed.tempo*48),end=(n.start+n.duration)*60/(o.parsed.tempo*48);
     return start<=t+.04&&end>=t-.04;}).map(n=>({pitch:n.pitch,start:(n.start*60/(o.parsed.tempo*48)),dur:n.duration*60/(o.parsed.tempo*48)}))}))};
  }''')
  assert not errors,errors
  print(json.dumps(res,indent=2))
  await browser.close()
if __name__=='__main__':asyncio.run(main(sys.argv[1]))
