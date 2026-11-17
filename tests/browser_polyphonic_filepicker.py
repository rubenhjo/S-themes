"""Chromium standard file input -> Arranger -> confirmed SSEQ-only PUT.
Synthetic MIDI is authoritative truth. Network endpoints are mocks; NOT staging.
"""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
from browser_public import fixture,ROOT
from browser_sseq_upload_pipeline import MOCK

async def main():
 cases=json.loads((ROOT/'tests/fixtures/polyphony/manifest.json').read_text())
 rows=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox','--disable-gpu'])
  # GitHub Actions runs three independent shards to avoid a large Chromium
  # process accumulating resources across 18 unrelated conversions.
  # A local run with no POLY_SHARD still exercises all 18 cases.
  shard = os.getenv('POLY_SHARD', '').strip()
  if shard:
   try:
    number, total = map(int, shard.split('/'))
    assert 1 <= number <= total <= 9
   except (ValueError, AssertionError):
    raise ValueError('POLY_SHARD must have the form 1/3, 2/3, or 3/3')
  else:
   number, total = 1, 1
  for case_index, case in enumerate(cases):
   if case_index % total != number - 1:continue
   if os.getenv('POLY_CASE') and os.getenv('POLY_CASE') != case['name']:continue
   for ext in ('wav','mp3'):
    if os.getenv('POLY_EXT') and os.getenv('POLY_EXT') != ext:continue
    page=await browser.new_page()
    errors=[]; page.on('pageerror', lambda e: errors.append(str(e)))
    console=[]
    page.on('console', lambda msg: console.append(f'{msg.type}: {msg.text}') if msg.type in ('error','warning') else None)
    print('POLY_START', json.dumps({'case': case['name'], 'codec': ext}), flush=True)
    await page.set_content(fixture(),wait_until='domcontentloaded',timeout=15000)
    await page.evaluate('''()=>{Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=>('00000000-0000-4000-8000-'+Math.random().toString().slice(2,14).padEnd(12,'0')),subtle:{digest:async()=>new Uint8Array(32).buffer}}})}''')
    await page.evaluate('()=>{window.__originalFetch=window.fetch;'+MOCK+'}')
    await page.evaluate('SigmaDebug.state.ready=true')
    # Spy on actual SSEQ builds. Submission is intercepted by mock API: no real network.
    await page.evaluate('''()=>{const original=SigmaSSEQ.build;window.__uiBuilds=[];SigmaSSEQ.build=function(o){const result=original(o);window.__uiBuilds.push(result);return result}}''')
    await page.locator('#fileInput').set_input_files(str(ROOT/'tests/fixtures/polyphony'/case[ext]))
    await page.locator('#arrangeAccept').wait_for(timeout=30000)
    assert await page.evaluate('window.__qa.starts.length')==0
    await page.locator('#arrangeAccept').click()
    try:
     await page.wait_for_function('__qa.finishes.length===1', timeout=30000)
    except Exception as exc:
     # Do not classify an unfinished upload as success; capture the first
     # meaningful failure instead of publishing an unhelpful timeout alone.
     try:
      diagnostic=await page.evaluate('''()=>({
        ready:SigmaDebug?.state?.ready,
        busy:SigmaDebug?.state?.busy,
        starts:window.__qa?.starts?.length ?? -1,
        uploads:window.__qa?.uploads?.length ?? -1,
        finishes:window.__qa?.finishes?.length ?? -1,
        builds:window.__uiBuilds?.length ?? -1,
        toast:document.querySelector('#toastRoot')?.textContent?.slice(0,1200),
        modal:document.querySelector('#modalRoot')?.textContent?.slice(0,1200),
        progress:document.querySelector('#uploadProgressText')?.textContent,
        acceptPresent:!!document.querySelector('#arrangeAccept'),
      })''')
     except Exception as read_exc:
      diagnostic={'snapshot_error':str(read_exc)}
     print('POLY_FAILURE',json.dumps({
        'case':case['name'],'codec':ext,'reason':str(exc),
        'diagnostic':diagnostic,'pageErrors':errors,'console':console[-15:]
     },ensure_ascii=False),flush=True)
     raise

    await page.wait_for_function('SigmaDebug.state.busy===false',timeout=12000)
    result=await page.evaluate('''()=>{
     const built=window.__uiBuilds.map(b=>({bytes:b,parsed:SigmaSSEQ.parse(b,{slot:1028,profiles:SigmaBankProfiles})})).sort((a,b)=>b.parsed.notes.length-a.parsed.notes.length);
     if(!built.length)throw Error('The file chooser never produced SSEQ');const p=built[0].parsed,b=built[0].bytes;
     return {pitches:[...new Set(p.notes.map(n=>n.pitch))].sort((a,b)=>a-b),notes:p.notes.length,bytes:b.length,slot:1028,
       maxConcurrent:Math.max(...p.notes.map(n=>p.notes.filter(m=>m.start<=n.start && m.start+m.duration>n.start).length))};}''')
    row={'case':case['name'],'codec':ext,'truth':sorted({n['pitch'] for n in case['truth']}),**result}
    if case['name'] in ('four-note chord','six-note chord','eight-note chord'):
     assert set(row['truth'])==set(row['pitches']),row
     assert row['maxConcurrent']==len(row['truth']),row
    if case['name']=='strong harmonics': assert row['pitches']==[57] and row['notes']==1,row
    if case['name']=='four C4 repeats':assert row['notes']==4,row
    if case['name']=='E2-G2-A2-E2 bass':assert row['notes']==4 and row['pitches']==[40,43,45],row
    assert not errors,(row,errors)
    assert result['notes']==len(case['truth']) if case['name'] in ('four-note chord','six-note chord','eight-note chord','strong harmonics','four C4 repeats','E2-G2-A2-E2 bass') else True
    print('FILEPICKER',json.dumps(row,ensure_ascii=False),flush=True)
    rows.append(row)
    await page.close()
  await browser.close()
 if not shard:
  (ROOT/'tests/fixtures/polyphony/browser_report.json').write_text(json.dumps(rows,indent=2))
 print('PASS standard browser file input + Arranger SSEQ mock publish:',len(rows),'cases',f'(shard {shard})' if shard else '')
if __name__=='__main__':asyncio.run(main())
