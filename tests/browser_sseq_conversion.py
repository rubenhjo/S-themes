"""Actual Chromium conversion of WAV and MP3 without score/MIDI input."""
import asyncio, json, base64
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-gpu'])
  page=await browser.new_page()
  # Avoid application initialization: controlled offline test page with same production scripts.
  await page.set_content('<html><body>Sequence QA</body></html>')
  await page.add_script_tag(path=str(ROOT/'sseq_codec.js'))
  await page.add_script_tag(content='window.SigmaBankProfiles = '+(ROOT/'heartgold_bank_profiles.json').read_text()+';')
  await page.add_script_tag(path=str(ROOT/'sseq_transcribe.js'))
  await page.add_script_tag(path=str(ROOT/'sseq_player.js'))
  errors=[]
  page.on('pageerror',lambda e: errors.append(str(e)))
  for fname in ['melody.wav','melody_b.mp3','melody_with_chords.wav','melody.mid','melody.sseq']:
   await page.evaluate('(b64)=>window._audioB64=b64',base64.b64encode((ROOT/'tests/fixtures'/fname).read_bytes()).decode())
   result=await page.evaluate('''async (fname)=>{
      const b=Uint8Array.from(atob(window._audioB64),c=>c.charCodeAt(0));const file=new File([b],fname,{type:fname.endsWith('.mp3')?'audio/mpeg':'audio/wav'});
      const r=await window.SigmaTranscribe.convertFile(file,{profiles:window.SigmaBankProfiles,slot:1028,program:0});
      const d=window.SigmaSSEQ.parse(r.bytes,{profiles:window.SigmaBankProfiles,slot:1028});
      return {bytes:r.bytes.length, notes:d.notes.map(n=>n.pitch),duration:d.durationTicks*60/(48*d.tempo),method:r.method,header:[...r.bytes.slice(0,4)],encoded:btoa(String.fromCharCode(...r.bytes))};
    }''',fname)
   expected=[60,62,64,67] if fname in ('melody.wav','melody.mid','melody.sseq') else [67,65,62,60] if fname=='melody_b.mp3' else None
   if expected is not None:assert result['notes']==expected,(fname,result)
   if fname=='melody_with_chords.wav':
    # Unlike the previous monophonic estimator, the new heuristic must retain
    # at least the synthetic triad's three accompaniment pitch classes.
    # This is a limited fixture, NOT proof of full mixed-song transcription.
    assert {48,52,55}.issubset(result['notes']), (fname,result)
    assert {60,62,65,67}.issubset(result['notes']), (fname,result)
   produced=base64.b64decode(result.pop('encoded'))
   if fname=='melody.sseq':assert produced==(ROOT/'tests/fixtures/melody.sseq').read_bytes(), 'SSEQ passthrough changed bytes'
   elif fname.endswith(('.wav','.mp3')):(ROOT/'tests/fixtures'/ (fname.rsplit('.',1)[0]+'.sseq')).write_bytes(produced)
   print(fname, json.dumps(result))
   if fname=='melody.wav':
    player=await page.evaluate('''async()=>{const b=Uint8Array.from(atob(window._audioB64),c=>c.charCodeAt(0));const wav=new File([b],'demo.wav',{type:'audio/wav'});const out=await SigmaTranscribe.convertFile(wav,{profiles:SigmaBankProfiles,slot:1028,program:0});const u=URL.createObjectURL(new Blob([out.bytes]));const a=new SigmaSeqAudio();a.slot=1028;a.src=u;await a.load();await a.play();const playing=!a.paused;await new Promise(r=>setTimeout(r,120));const t=a.currentTime;a.pause();const paused=a.paused;a.dispose();URL.revokeObjectURL(u);return {playing,paused,time:t};}''')
    assert player['playing'] and player['paused'] and player['time']>0,player
    print('SSEQ WebAudio preview',player)
  # Check size limits BEFORE allocating/decoding arbitrary large source data.
  oversize=await page.evaluate('''async()=>{
    try{await SigmaTranscribe.convertFile({name:'gigantic.wav',size:129*1024*1024,arrayBuffer(){throw Error('Must never read bytes')}} ,{profiles:SigmaBankProfiles,slot:1028});return false}
    catch(e){return String(e.message).includes('128 MiB')}
  }''')
  assert oversize,'Oversized source must be rejected before reading/decoding'
  bad=await page.evaluate('''async()=>{try{await SigmaTranscribe.convertFile(new File([Uint8Array.from([0,1,2,3])],'corrupt.mp3'),{profiles:SigmaBankProfiles,slot:1028});return false}catch(e){return String(e.message).includes('decode')||String(e.message).includes('Could not')}}''')
  assert bad,'Corrupt MP3 must fail'
  print('corrupt MP3: correctly rejected; page errors',errors[:6])
  await browser.close()

if __name__=='__main__':asyncio.run(main())
