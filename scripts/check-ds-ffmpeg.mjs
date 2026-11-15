/* Deterministic independent FFmpeg decode check. Requires ffmpeg & ffprobe on PATH. */
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const ctx={Blob,TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView,Map,ArrayBuffer,console};ctx.window=ctx;
vm.runInNewContext(readFileSync(new URL('../ds_audio.js',import.meta.url),'utf8'),ctx);
const n=32728,pcm=new Float32Array(n);
for(let i=0;i<n;i++)pcm[i]=.32*Math.sin(2*Math.PI*440*i/n);
const blob=ctx.SigmaDS.encodeImaWav([pcm,pcm],n,true);
const dir=mkdtempSync(join(tmpdir(),'sigma-ffmpeg-'));
try{
 const path=join(dir,'test.wav');writeFileSync(path,Buffer.from(await blob.arrayBuffer()));
 const data=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,sample_rate,channels','-of','json',path],{encoding:'utf8'}));
 const stream=data.streams?.[0];
 if(stream?.codec_name!=='adpcm_ima_wav'||Number(stream.sample_rate)!==32728||stream.channels!==2)throw Error('FFprobe format mismatch '+JSON.stringify(stream));
 if(!readFileSync(path).includes(Buffer.from('smpl')))throw Error('Loop smpl chunk missing');
 execFileSync('ffmpeg',['-v','error','-i',path,'-f','null','-'],{stdio:'pipe'});
 console.log('FFprobe/FFmpeg PASS:',stream,'smpl loop chunk present');
}finally{rmSync(dir,{recursive:true,force:true})}
