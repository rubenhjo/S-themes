"""Regression tests for SSEQ preview play/pause cancellation, source changes,
volume zero, and sound-level controls. Real Chromium/WebAudio; no live backend.
"""
import asyncio, json, os, base64
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox','--disable-gpu'])
  page=await browser.new_page()
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content('<html><body>Sound regression</body></html>')
  await page.add_script_tag(path=str(ROOT/'sseq_codec.js'))
  await page.add_script_tag(content='window.SigmaBankProfiles='+ (ROOT/'heartgold_bank_profiles.json').read_text() +';')
  await page.add_script_tag(path=str(ROOT/'sseq_player.js'))
  data=base64.b64encode((ROOT/'tests/fixtures/melody.sseq').read_bytes()).decode()
  outcome=await page.evaluate('''async (encoded)=>{
    const file=Uint8Array.from(atob(encoded),ch=>ch.charCodeAt(0));
    const blob=new Blob([file],{type:'application/octet-stream'});
    const url=URL.createObjectURL(blob);
    const results={};
    // 1. Pause while initial fetch is pending: no late autoplay.
    let finish;
    const originalFetch=window.fetch;
    window.fetch=(...args)=>new Promise(r=>finish=()=>r(new Response(file)));
    const a=new SigmaSeqAudio();a.src='https://example.test/slow.sseq';a.slot=1028;
    const pending=a.play();
    await Promise.resolve();
    a.pause();finish();await pending;
    results.pause_during_fetch=a.paused&&!a._playing&&a.currentTime===0&&a._nodes.size===0;
    a.dispose();
    // 2. Changing source invalidates the first loading promise.
    let finishFirst;
    window.fetch=(address)=>address==='old.sseq'?new Promise(r=>finishFirst=()=>r(new Response(file))):Promise.resolve(new Response(file));
    const b=new SigmaSeqAudio();b.slot=1028;b.src='old.sseq';
    const oldPlay=b.play().then(()=>true,()=>false);
    await Promise.resolve();b.src='new.sseq';finishFirst();await oldPlay;
    results.old_source_never_plays=b.paused && b.src==='new.sseq' && b._nodes.size===0;
    b.dispose();
    // 3. Real SSEQ plays and can be paused after decoding.
    window.fetch=originalFetch;
    const c=new SigmaSeqAudio();c.slot=1028;c.src=url;
    c.setSoundMode(true,-14);
    await c.load();await c.play();
    await new Promise(r=>setTimeout(r,125));
    results.real_play_and_pause=!c.paused && c.currentTime>0;
    c.pause();results.real_play_and_pause &&=c.paused;
    // 4. OFF, QUIET, NORMAL, LOUD change actual gain value and mute works.
    let last=null;
    c._bus={gain:{setTargetAtTime(value){last=value}}};
    c._audioCtx={currentTime:0};c.volume=.8;c.muted=false;
    c.setSoundMode(false,-14);const off=last;
    c.setSoundMode(true,-19);const quiet=last;
    c.setSoundMode(true,-14);const normal=last;
    c.setSoundMode(true,-11);const loud=last;
    c.volume=0;const zero=last;
    c.volume=.8;c.muted=true;const mute=last;
    results.gain_controls=quiet<normal&&normal<loud&&off===normal&&zero===0&&mute===0;
    results.levels={off,quiet,normal,loud,zero,mute};
    c._audioCtx=null;c._bus=null;c.dispose();URL.revokeObjectURL(url);
    return results;
  }''',data)
  assert all(outcome.get(k) for k in ('pause_during_fetch','old_source_never_plays','real_play_and_pause','gain_controls')),outcome
  assert not errors,errors
  await browser.close()
  print(json.dumps({'status':'PASS','checks':outcome,'page_errors':errors},indent=2))

if __name__=='__main__':asyncio.run(main())
