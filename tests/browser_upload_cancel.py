"""Real Chromium tests of frontend cancel during PUT / TUS PATCH with simulated network.
Not an actual Supabase test. Uses real UI event handlers and fake browser XHR transport.
"""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright
from browser_public import fixture, ROOT

INIT = r'''
const values=new Map();
const storage={getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
Object.defineProperty(window,'localStorage',{value:storage,configurable:true});
Object.defineProperty(window,'sessionStorage',{value:storage,configurable:true});
Object.defineProperty(window,'crypto',{value:{subtle:{digest:async()=>new Uint8Array(32).fill(7).buffer},randomUUID:()=>String(Math.random())},configurable:true});
window.Worker=undefined;
window.Audio=class FakeAudio{constructor(){this.duration=1;this.onloadedmetadata=null;this.onerror=null}set src(x){queueMicrotask(()=>this.onloadedmetadata?.())}};
window.__calls={start:0,finish:0,cancel:0,abort:0,request:[],methods:[]};
window.turnstile={render(_e,options){queueMicrotask(()=>options.callback('t'.repeat(32)));return 'w1'},remove(){},reset(){}};
const receipt={uploadId:'e7ebec2c-f475-499e-8447-0c46d9ab1c67',receipt:'f'.repeat(64),signedUrl:'https://test.local/upload',tusEndpoint:'https://test.local/tus',token:'TOKEN',storagePath:'uploads/test.sseq',bucket:'sigma-theme-audio',extension:'sseq'};
window.fetch=async(url,options)=>{
 url=String(url);
 if(url.includes('/api/config'))return Response.json({ready:true,maxUploadBytes:65536,turnstileSiteKey:'SITE'});
 if(url.includes('/api/catalog'))return Response.json({tracks:[]});
 if(url.includes('/api/upload-start')){__calls.start++;return Response.json(receipt)}
 if(url.includes('/api/upload-finish')){__calls.finish++;return Response.json({track:{id:'published'}},{status:201})}
 if(url.includes('/api/upload-cancel')){__calls.cancel++;return Response.json({canceled:true})}
 throw Error('Unexpected fetch '+url);
};
window.XMLHttpRequest=class FakeXHR{
 constructor(){this.upload={};this.headers={};this.status=200;this.timeout=0;this.aborted=false;this._h={'Location':'https://test.local/tus/session','Upload-Offset':'0'}}
 open(method,url){this.method=method;this.url=url}
 setRequestHeader(k,v){this.headers[k]=v}
 getResponseHeader(k){return this._h[k]??null}
 send(body){__calls.request.push({method:this.method,url:this.url});__calls.methods.push(this.method);
  if(['POST','HEAD'].includes(this.method))setTimeout(()=>!this.aborted&&this.onload?.(),10);
  if(['PUT','PATCH'].includes(this.method)){this.timer=setTimeout(()=>this.upload.onprogress?.({lengthComputable:true,loaded:25,total:100}),15);}
 }
 abort(){this.aborted=true;clearTimeout(this.timer);__calls.abort++;this.onabort?.()}
};
'''

async def main():
    results={}
    async with async_playwright() as w:
        b=await w.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') else None,args=['--no-sandbox'])
        for mode,size in [('PUT',1024)]:
            p=await b.new_page()
            await p.evaluate('() => {' + INIT + '}')
            errs=[]
            p.on('pageerror', lambda e:errs.append(str(e)))
            await p.set_content(fixture(),wait_until='domcontentloaded')
            await p.wait_for_function('window.SigmaDebug?.state.ready===true')
            await p.evaluate('''size=>{const data=SigmaSSEQ.build({slot:1028,profiles:SigmaBankProfiles,tracks:[{program:0,notes:[{start:0,duration:48,pitch:60,velocity:96},{start:48,duration:48,pitch:62,velocity:96}]}]});const file=new File([data],'test-song.sseq',{type:'application/octet-stream'});void SigmaDebug.uploadFiles([file])}''',size)
            expected='PUT' if mode=='PUT' else 'PATCH'
            await p.wait_for_function('(m)=>window.__calls.methods.includes(m)',arg=expected,timeout=30000)
            await p.locator('#cancelUpload').click()
            await p.wait_for_timeout(1600)
            calls=await p.evaluate('window.__calls')
            active=await p.evaluate('SigmaDebug.state.busy')
            assert calls['finish']==0,(mode,calls)
            assert calls['abort']>=1,(mode,calls)
            assert calls['methods'].count(expected)==1,(mode,calls)
            assert calls['cancel']>=1,(mode,calls)
            assert not active,(mode,active)
            assert not errs,(mode,errs)
            results[mode]={'cancel_aborted_xhr':calls['abort'],'finish_calls':calls['finish'],'server_cancel_calls':calls['cancel'],'transfer_attempts':calls['methods'].count(expected),'status':'PASS'}
            await p.close()
        print(json.dumps(results,indent=2))
        await b.close()

if __name__=='__main__':asyncio.run(main())
