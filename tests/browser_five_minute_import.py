"""300-second WAV/MP3, through the genuine upload file picker, note editor,
and mocked validation server. The originals stay local; only SSEQ is submitted.
Generates test audio in temporary storage, not in the public source archive.
"""
import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path
import math
import time
from array import array
from playwright.async_api import async_playwright
from browser_song_arranger import page_setup
from browser_public import ROOT

# about:blank fixture has no /sseq_transcribe_worker.js path; rehost the EXACT
# production Worker sources on a local Blob URL for the isolated browser test.
source=(ROOT/'sseq_transcribe_worker.js').read_text()
imports="importScripts('sigma_note_refine.js','sseq_transcribe.js');"
assert source.count(imports)==1
WORKER_SOURCE=(ROOT/'sigma_note_refine.js').read_text()+'\n'+(ROOT/'sseq_transcribe.js').read_text()+'\n'+source.replace(imports,'')


def create_fixture(folder: Path):
    rate,seconds=11025,300
    # Deliberately standard-library only: CI needs no NumPy installation.
    # Generate 150 measured 1.67-second notes with gaps across 300 seconds.
    samples=array('h')
    active=int(1.67*rate)
    segment=2*rate
    for step in range(150):
        pitch=[60,62,64,67,69][step%5]
        frequency=440*2**((pitch-69)/12)
        start=int(.06*rate)
        for j in range(segment):
            k=j-start
            if 0<=k<active:
                envelope=min(1.,k/(rate*.018),(active-k)/(rate*.04))
                samples.append(int(32767*.44*math.sin(2*math.pi*frequency*k/rate)*envelope))
            else:samples.append(0)
    wav=folder/'five_minutes.wav'
    with wave.open(str(wav),'wb') as f:
        f.setnchannels(1); f.setsampwidth(2);f.setframerate(rate)
        f.writeframes(samples.tobytes())
    # A normal CD-quality stereo WAV is 52.9 MB for five minutes. Test that,
    # not just a tiny low-rate toy recording that hides decoding/memory cost.
    stereo=folder/'five_minutes_44100_stereo.wav'
    subprocess.run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-i',str(wav),
                    '-ar','44100','-ac','2','-codec:a','pcm_s16le',str(stereo)],check=True,timeout=80)
    mp3=folder/'five_minutes_44100_stereo.mp3'
    subprocess.run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-i',str(stereo),
                    '-codec:a','libmp3lame','-b:a','192k',str(mp3)],check=True,timeout=80)
    return stereo,mp3


async def run_file(browser,source):
    started=time.monotonic()
    print('Preparing page for long '+source.suffix,flush=True)
    page,errors=await page_setup(browser)
    print('Page prepared in %.2fs for %s'%(time.monotonic()-started,source.suffix),flush=True)
    await page.evaluate('''(workerSource)=>{
      const RealWorker=window.Worker;
      const url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
      window.__longWorkerUrl=url;window.__longWorkerStarts=0;
      window.Worker=class extends RealWorker {
        constructor(script,options){if(String(script)==='sseq_transcribe_worker.js'){
           window.__longWorkerStarts++;super(url,options);
        }else super(script,options);} 
      };
    }''',WORKER_SOURCE)
    print('Starting long '+source.suffix,flush=True)
    try:
        await page.locator('#uploadBtn').click()
        await page.locator('#uploadTargetSlot').select_option('1028')
        async with page.expect_file_chooser() as choice:
            await page.locator('#chooseMusicFiles').click()
        await (await choice.value).set_files(str(source))
        await page.locator('#arrangeAccept').wait_for(timeout=120000)
        print('Arranger ready for '+source.suffix,flush=True)
        assert await page.locator('.arrange-part').count()<=5
        assert await page.locator('.arrange-note').count()<250,'Long song must show a bounded note window'
        first=await page.locator('#arrangeWindowLabel').inner_text()
        assert '15.00s' in first and '300.00s' in first,first
        assert not await page.evaluate('__qa.starts.length')
        await page.locator('#arrangeNext').click()
        next_section=await page.locator('#arrangeWindowLabel').inner_text()
        assert '15.00s' in next_section and '30.00s' in next_section,next_section
        await page.locator('#arrangeFrom').fill('285')
        await page.locator('#arrangeFrom').blur()
        await page.locator('#arrangeTo').fill('300')
        await page.locator('#arrangeTo').blur()
        assert await page.locator('.arrange-note').count()>0,'Final 15 seconds must remain editable'
        await page.locator('#arrangeAccept').click()
        print('Submission requested for '+source.suffix,flush=True)
        await page.wait_for_function('__qa.finishes.length===1',timeout=30000)
        result=await page.evaluate('''()=>{
          const bytes=__qa.uploads[0];
          const parsed=SigmaSSEQ.parse(bytes,{slot:1028,profiles:SigmaBankProfiles});
          return {bytes:bytes.length,notes:parsed.notes.length,
                  endSeconds:parsed.durationTicks*60/(parsed.tempo*48),
                  finalNoteSeconds:Math.max(...parsed.notes.map(n=>(n.start+n.duration)*60/(parsed.tempo*48))),
                  uploadCalls:__qa.starts.length,finishes:__qa.finishes.length,
                  suffix:Array.from(bytes.slice(0,4)),
                  events:parsed.notes.map(n=>({pitch:n.pitch,start:n.start*60/(parsed.tempo*48),
                    end:(n.start+n.duration)*60/(parsed.tempo*48)})).sort((a,b)=>a.start-b.start)};
        }''')
        assert result['suffix']==[83,83,69,81],result
        assert result['bytes']<=65536 and result['notes']>=75,result
        assert 295<result['finalNoteSeconds']<=301,result
        assert result['uploadCalls']==1 and result['finishes']==1,result
        events=result.pop('events')
        expected=[{'pitch':[60,62,64,67,69][i%5], 'start':i*2+.06, 'end':i*2+1.73} for i in range(150)]
        assert len(events)==len(expected),(len(events),len(expected))
        errors_by_event=[(abs(e['start']-ref['start']),abs(e['end']-ref['end']))
                         for e,ref in zip(events,expected)]
        assert all(e['pitch']==ref['pitch'] for e,ref in zip(events,expected)),'Five-minute pitches changed'
        assert all(a<=.09 and b<=.11 for a,b in errors_by_event),'Five-minute note timing drift exceeded tolerance'
        result['max_onset_error_ms']=round(max(a for a,b in errors_by_event)*1000,1)
        result['max_offset_error_ms']=round(max(b for a,b in errors_by_event)*1000,1)
        result['note_mismatches']=0
        assert not errors,errors
        print('PASS five-minute real file picker, editor and SSEQ upload',source.suffix,json.dumps(result),flush=True)
        return result
    finally:
        await page.evaluate('''()=>URL.revokeObjectURL(window.__longWorkerUrl)''')
        await page.close()


async def main():
    if not shutil.which('ffmpeg'):
        raise RuntimeError('FFmpeg required for real five-minute MP3 fixture')
    with tempfile.TemporaryDirectory(prefix='sigma-five-minute-') as d:
        print('Generating 300-second WAV and MP3 sources',flush=True)
        files=create_fixture(Path(d))
        print('Sources ready',[(str(x),x.stat().st_size) for x in files],flush=True)
        # The two real 300-second imports each have to pass independently in CI.
        # An empty selection preserves the original both-formats local test.
        requested=os.environ.get('SIGMA_FIVE_MINUTE_CODEC','').strip().lower()
        if requested not in ('','wav','mp3'):
            raise ValueError('SIGMA_FIVE_MINUTE_CODEC must be wav, mp3, or empty')
        selected=[f for f in files if not requested or f.suffix=='.'+requested]
        assert len(selected)==(1 if requested else 2),(requested,selected)
        print('Five-minute format selection:',requested or 'wav+mp3',flush=True)
        async with async_playwright() as p:
            browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,
                                            args=['--no-sandbox'])
            try:
                for source in selected:await run_file(browser,source)
            finally:
                await browser.close()

if __name__=='__main__':asyncio.run(main())
