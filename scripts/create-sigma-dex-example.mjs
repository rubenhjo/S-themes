/** Reproducible synthetic Sigma Dex example pack; no third-party music or game assets. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const ctx={Blob,TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView,Float32Array,crypto:webcrypto,console,Math,Date,Promise,Map,Set,Error,Number,String,Object,Array};
ctx.globalThis=ctx;
for(const file of ['ds_audio.js','sigma_dex_export.js'])runInNewContext(readFileSync(resolve(root,file),'utf8'),ctx);
const {SigmaDS:DS,SigmaDexExport:E}=ctx;
const folders=[{id:'battle',name:'Battle',parent_id:'root'},{id:'wild',name:'Wild',parent_id:'battle'},{id:'overworld',name:'Overworld',parent_id:'root'},{id:'routes',name:'Routes',parent_id:'overworld'}];
const notes=[['test-wild','Wild Encounter',440,'wild',true],['test-route','Route Dawn',330,'routes',true],['test-menu','Menu Echo',523.25,'root',false]];
const tracks=[],assignments={},metadata={},encoded=new Map();
for(const [id,title,hz,folder,loop] of notes){
 const duration=2.1,samples=Math.floor(32728*duration);
 const left=new Float32Array(samples),right=new Float32Array(samples);
 for(let i=0;i<samples;i++){
  const sec=i/32728,env=Math.min(1,sec*12,Math.max(0,(duration-sec)*8));
  left[i]=Math.sin(sec*2*Math.PI*hz)*env*.17;right[i]=Math.sin(sec*2*Math.PI*(hz*1.002))*env*.17;
 }
 const src=DS.encodePcmWav([left,right],32728,false),srcHash=await E.sha256(src);
 tracks.push({id,title,artist:'Sigma Synthetic Test',original_filename:id+'.wav',size_bytes:src.size,sha256:srcHash,duration_s:duration});
 assignments[id]=folder;metadata[id]={loop_enabled:loop,loop_start_sec:0,loop_end_sec:duration};
 encoded.set(id,DS.encodeImaWav([left,right],32728,loop));
}
const plan=E.selectedTrackPlan({tracks,folders,assignments,metadata,scope:'all'});
const pack=await E.packageFiles(plan,encoded,{id:'sigma-example-v1',createdAt:'2026-11-15T00:00:00.000Z'});
const destination=resolve(root,process.argv[2]||'examples/sigma-dex-example-music.zip');
mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,Buffer.from(await pack.blob.arrayBuffer()));
console.log(JSON.stringify({file:destination,bytes:pack.blob.size,tracks:pack.tracks.length,folders:pack.folders.length},null,2));
