"""OPTIONAL PRIVATE ONLY; requires user's original Cute melody and authorized SBNK/SWAR ZIP.
Never distribute original recordings or Nintendo sample bytes with public sources.
Outputs private, equally instrumented, approximate SSEQ PCM WebAudio renders.
"""
import asyncio,base64,hashlib,json,struct,zipfile,sys,threading,http.server,tempfile
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
SHA='84cb65fa0f50e19e1d82629c0aa100e1aec5c9de9a48d03809b62bf16cde53dc'
class Server(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  body=b'<html><body>private audio comparison</body></html>'
  self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass
async def main(path,archive,dest):
 assert hashlib.sha256(path.read_bytes()).hexdigest()==SHA,'Cute melody SHA mismatch'
 dest.mkdir(parents=True,exist_ok=True)
 srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),Server);thread=threading.Thread(target=srv.serve_forever,daemon=True);thread.start()
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
   page=await browser.new_page();await page.set_content('<html><body>Private recording comparison</body></html>')
   await page.add_script_tag(path=str(ROOT/'heartgold_bank_profiles.js'))
   await page.add_script_tag(path=str(ROOT/'sseq_codec.js'))
   await page.add_script_tag(path=str(ROOT/'heartgold_source_audio.js'))
   await page.add_script_tag(path=str(ROOT/'tests/baseline-v172-transcribe.js'))
   await page.evaluate('''()=>{let inp=document.createElement('input');inp.type='file';inp.id='c';document.body.appendChild(inp)}''')
   await page.locator('#c').set_input_files(str(path))
   outputs={}
   for label in ['v172','candidate']:
    if label=='candidate':await page.add_script_tag(path=str(ROOT/'sseq_transcribe.js'))
    info=await page.evaluate('''async ()=>{
      const out=await SigmaTranscribe.convertFile(document.querySelector('#c').files[0],{profiles:SigmaBankProfiles,slot:1028,program:0,loop:false});
      const enc=btoa(String.fromCharCode(...out.bytes));const ns=out.parsed.notes.map(n=>({pitch:n.pitch,start:+(n.start/96).toFixed(3),duration:+(n.duration/96).toFixed(3)}));
      return {binary:enc,notes:ns,bytes:out.bytes.length};
    }''')
    (dest/f'{label}.sseq').write_bytes(base64.b64decode(info.pop('binary')))
    outputs[label]=info
   # Source files are private local imports. Render both resulting SSEQ events
   # through the identical program 0 and the SAME imported source waves.
   with zipfile.ZipFile(archive) as z:
    names=z.namelist()
    bnames=[next(n for n in names if n.startswith('SBNK/702_')),next(n for n in names if n.startswith('SWAR/700_')),next(n for n in names if n.startswith('SWAR/702_'))]
    blobs=[{'name':n.split('/')[-1],'b64':base64.b64encode(z.read(n)).decode()} for n in bnames]
   # The about:blank test origin lacks WebCrypto. External Python verifies the
   # real input SHA-256, then a tiny deterministic test shim returns those
   # preverified digests to the browser importer's existing hash comparison.
   blobs=[{**b,'digest':hashlib.sha256(base64.b64decode(b['b64'])).hexdigest()} for b in blobs]
   imported=await page.evaluate('''async files=>{const bylen=Object.fromEntries(files.map(o=>[atob(o.b64).length,o.digest]));
     Object.defineProperty(window,'crypto',{configurable:true,value:{subtle:{digest:async(a,b)=>{let key=String(b.byteLength);let hex=bylen[key];if(!hex)throw Error('No preverified digest');return Uint8Array.from(hex.match(/../g).map(x=>parseInt(x,16))).buffer}}}});
     const inp=files.map(o=>new File([Uint8Array.from(atob(o.b64),c=>c.charCodeAt(0))],o.name));return await SigmaHeartGoldSources.importFiles(inp,SigmaBankProfiles)}''',blobs)
   assert imported['successful']==3,imported
   # Select ONE valid sampled HeartGold program for both renditions. Program 0
   # happens to fall back to an oscillator for these notes in bank 702.
   previous={key:base64.b64encode((dest/f'{key}.sseq').read_bytes()).decode() for key in ('v172','candidate')}
   shared=await page.evaluate('''(scores)=>{
     const notes=Object.values(scores).flatMap(s=>SigmaSSEQ.parse(Uint8Array.from(atob(s),c=>c.charCodeAt(0)),{profiles:SigmaBankProfiles,slot:1028}).notes);
     const ctx=SigmaSSEQ.profileSlot(SigmaBankProfiles,1028);
     return ctx.bank.programs.map(p=>({program:p.index,total:notes.length,
      supported:notes.filter(n=>{try{SigmaSSEQ.validProgram(ctx,p.index,n.pitch);return true}catch{return false}}).length,
      pcm:notes.filter(n=>!!SigmaHeartGoldSources.originalWave(702,p.index,n.pitch,SigmaBankProfiles)).length
     })).filter(p=>p.supported===p.total).sort((a,b)=>b.pcm-a.pcm)[0];
   }''',previous)
   assert shared and shared['pcm']>0,'No original PCM note available for the chosen bank'
   for label in ('v172','candidate'):
    remapped=await page.evaluate('''({source,program})=>{
     const parsed=SigmaSSEQ.parse(Uint8Array.from(atob(source),c=>c.charCodeAt(0)),{profiles:SigmaBankProfiles,slot:1028});
     const bytes=SigmaSSEQ.build({tracks:[{program,notes:parsed.notes.map(n=>({start:n.start,duration:n.duration,pitch:n.pitch,velocity:n.velocity}))}],slot:1028,profiles:SigmaBankProfiles,loop:false});
     return btoa(String.fromCharCode(...bytes));
    }''',{'source':previous[label],'program':shared['program']})
    (dest/f'{label}.sseq').write_bytes(base64.b64decode(remapped))
   for label in ['v172','candidate']:
    out=await page.evaluate('''async b64=>{
      const b=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const model=SigmaSSEQ.parse(b,{profiles:SigmaBankProfiles,slot:1028});
      const rate=22050,sec=Math.max(8.2,model.durationTicks/96+.4),context=new OfflineAudioContext(1,Math.ceil(rate*sec),rate);
      let real=0,fallback=0;
      for(const note of model.notes){const original=SigmaHeartGoldSources.originalWave(702,note.program,note.pitch,SigmaBankProfiles);
        let start=Math.max(.01,note.start/96),end=Math.min(sec-.1,(note.start+note.duration)/96);
        if(original){SigmaHeartGoldSources.schedulePcm(context,context.destination,original,{note:note.pitch,start,end,velocity:note.velocity});real++}
        else {const osc=context.createOscillator(),gain=context.createGain();osc.frequency.value=440*Math.pow(2,(note.pitch-69)/12);
          osc.connect(gain).connect(context.destination);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.17,start+.012);gain.gain.setValueAtTime(.17,Math.max(start+.013,end-.05));gain.gain.linearRampToValueAtTime(0,end);osc.start(start);osc.stop(end);fallback++}
      }
      const rendered=await context.startRendering(),a=rendered.getChannelData(0),wav=new Uint8Array(44+a.length*2),dv=new DataView(wav.buffer);const s=(o,t)=>{for(let i=0;i<t.length;i++)wav[o+i]=t.charCodeAt(i)};
      s(0,'RIFF');dv.setUint32(4,wav.length-8,true);s(8,'WAVEfmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,rate,true);dv.setUint32(28,rate*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);s(36,'data');dv.setUint32(40,a.length*2,true);
      for(let i=0;i<a.length;i++)dv.setInt16(44+i*2,Math.max(-32768,Math.min(32767,Math.round(a[i]*32767))),true);
      let text='';for(let i=0;i<wav.length;i+=8192)text+=String.fromCharCode(...wav.subarray(i,i+8192));return {wav:btoa(text),real,fallback};
    }''',base64.b64encode((dest/f'{label}.sseq').read_bytes()).decode())
    (dest/f'{label}_heartgold_pcm_preview.wav').write_bytes(base64.b64decode(out['wav']));outputs[label]['originalPcmNotes']=out['real'];outputs[label]['fallbackNotes']=out['fallback']
   for label,info in outputs.items():
    info['spot']={str(t):[n for n in info['notes'] if n['start']-.04<=t<=n['start']+n['duration']+.04] for t in [3.18,6.52,7.36]}
   (dest/'private_analysis.json').write_text(json.dumps({'imported':imported,'sharedProgram':shared,'results':outputs},indent=2))
   print(json.dumps({'imported':imported,'sharedProgram':shared,'results':outputs},indent=2))
   await browser.close()
 finally:srv.shutdown();srv.server_close()
if __name__=='__main__':asyncio.run(main(Path(sys.argv[1]),Path(sys.argv[2]),Path(sys.argv[3])))
