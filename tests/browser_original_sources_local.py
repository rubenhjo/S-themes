"""Optional PRIVATE-source Chromium integration. Never commit Nintendo bank files.
Run: python tests/browser_original_sources_local.py '/path/to/HeartGold_instrumentfiler_US.zip'
Checks real SBNK/SWAR browser import and both preview+SSEQ PCM voice routes.
It does not prove DS hardware audio equivalence or audible quality.
"""
import asyncio,base64,zipfile,sys,json,os,hashlib
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
async def main(path):
 if not path or not Path(path).exists():
  print('NOT TESTED: private source ZIP path missing');return 2
 with zipfile.ZipFile(path) as z:
  keys=[x for x in z.namelist() if x.startswith(('SBNK/702_','SWAR/700_','SWAR/702_')) and x.endswith(('.sbnk','.swar'))]
  sources=[{'name':name.split('/')[-1],'b64':base64.b64encode(z.read(name)).decode()} for name in keys]
 assert len(sources)==3,sources
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
  page=await browser.new_page()
  # This restricted CI container blocks loopback browser navigation. Host Python
  # hashlib behind a test-only crypto.subtle.digest shim: hashes are REAL SHA256.
  # No fake acceptance hashes, no network access, and originals remain private.
  await page.set_content('<html><body>Private bank QA</body></html>')
  await page.expose_function('privateTestSha256',lambda values:list(hashlib.sha256(bytes(values)).digest()))
  await page.evaluate('''()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{subtle:{digest:async (alg,buf)=>{if(alg!=='SHA-256')throw Error('Unsupported hash'); return Uint8Array.from(await window.privateTestSha256([...new Uint8Array(buf)])).buffer}}}})}''')
  await page.add_script_tag(content='window.SigmaBankProfiles='+ (ROOT/'heartgold_bank_profiles.json').read_text()+';')
  for f in ['sseq_codec.js','heartgold_source_audio.js','heartgold_instruments.js','sseq_player.js']:
   await page.add_script_tag(path=str(ROOT/f))
  result=await page.evaluate('''async sources=>{
    if(!crypto.subtle)throw Error('No secure context for private bank verification');
    const files=sources.map(({name,b64})=>new File([Uint8Array.from(atob(b64),x=>x.charCodeAt(0))],name));
    const imported=await SigmaHeartGoldSources.importFiles(files,SigmaBankProfiles);
    if(imported.skipped)throw Error(JSON.stringify(imported.errors));
    let program=null;
    for(const p of SigmaBankProfiles.banks['702'].programs){
      const wave=SigmaHeartGoldSources.originalWave(702,p.index,60,SigmaBankProfiles);
      if(wave&&wave.wave.samples.length>100){program=p;break}
    }
    if(!program)throw Error('No sample-backed program found');
    const original=SigmaHeartGoldSources.originalWave(702,program.index,60,SigmaBankProfiles);
    const engine=new SigmaSeqAudio();engine.slot=1028;engine._audioCtx=new AudioContext();engine._bus=engine._audioCtx.createGain();engine._bus.connect(engine._audioCtx.destination);
    const events=[];const saved=SigmaHeartGoldSources.schedulePcm;
    SigmaHeartGoldSources.schedulePcm=function(...args){events.push(args[3].note);return saved(...args)};
    const sseq=engine._scheduleNote({pitch:60,velocity:95,program:program.index},engine._audioCtx.currentTime+.1,engine._audioCtx.currentTime+.5);
    const preview=SigmaInstrumentLibrary.preview(program,60,702,SigmaBankProfiles);
    SigmaHeartGoldSources.schedulePcm=saved;engine.dispose();
    return {imported,program:program.index,sseq,preview,sharedPcmCalls:events,loop:original.wave.loop};
  }''', sources)
  assert result['imported']['successful']==3,result
  assert result['sseq']['original'] is True,result
  assert result['preview']['synthetic'] is False,result
  assert result['sharedPcmCalls']==[60,60],result
  print('PASS private source browser sample route:',json.dumps(result))
  await browser.close()
 return 0
if __name__=='__main__':
 path=sys.argv[1] if len(sys.argv)>1 else None
 raise SystemExit(asyncio.run(main(path)))
