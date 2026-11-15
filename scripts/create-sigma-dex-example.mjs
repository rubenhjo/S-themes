/** Reproducible SSEQ-only sample pack. All melodies are original synthetic test material. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ctx={Blob,TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView,Float32Array,crypto:webcrypto,console,Math,Date,Promise,Map,Set,Error,Number,String,Object,Array};
ctx.globalThis=ctx;
for(const file of ['ds_audio.js','sseq_codec.js','sigma_dex_export.js'])runInNewContext(readFileSync(resolve(root,file),'utf8'),ctx);
ctx.SigmaBankProfiles=JSON.parse(readFileSync(resolve(root,'heartgold_bank_profiles.json')));
const {SigmaSSEQ:S,SigmaDexExport:E}=ctx;
const folders=[{id:'battle',name:'Battle',parent_id:'root'},{id:'wild',name:'Wild',parent_id:'battle'},{id:'overworld',name:'Overworld',parent_id:'root'},{id:'routes',name:'Routes',parent_id:'overworld'}];
const melodies=[
 ['test-wild','Wild Encounter',1028,'wild',[60,62,65,67,72,67,65,62],true],
 ['test-route','Route Dawn',1029,'routes',[64,67,69,71,72,71,69,67],true],
 ['test-menu','Menu Echo',1028,'root',[72,69,67,64,60,64,67,72],false],
];
const tracks=[],assignments={},metadata={},encoded=new Map();
for(const [id,title,slot,folder,pitches,loop] of melodies){
 const bank=S.profileSlot(ctx.SigmaBankProfiles,slot);
 const candidate=bank.bank.programs.find(p=>pitches.every(pitch=>{try{S.validProgram(bank,p.index,pitch);return true;}catch{return false}}));
 if(!candidate)throw Error('No valid HeartGold instrument');
 const notes=pitches.map((pitch,i)=>({start:i*24,duration:20,pitch,velocity:90}));
 const data=S.build({slot,profiles:ctx.SigmaBankProfiles,tempo:120,loop,tracks:[{program:candidate.index,notes}]});
 const blob=new Blob([data],{type:'application/octet-stream'}),digest=await E.sha256(blob);
 tracks.push({id,title,artist:'Sigma Synthetic Test',original_filename:id+'.sseq',mime_type:'application/octet-stream',sseq_id:slot,size_bytes:blob.size,sha256:digest,duration_s:188*60/(48*120)});
 assignments[id]=folder;metadata[id]={loop_enabled:loop,loop_start_sec:0,loop_end_sec:188*60/(48*120)};encoded.set(id,blob);
}
const plan=E.selectedTrackPlan({tracks,folders,assignments,metadata,scope:'all'});
const pack=await E.packageFiles(plan,encoded,{id:'sigma-sseq-example-v2',createdAt:'2026-11-15T00:00:00.000Z'});
const destination=resolve(root,process.argv[2]||'examples/sigma-dex-example-music.zip');
mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,Buffer.from(await pack.blob.arrayBuffer()));
console.log(JSON.stringify({file:destination,bytes:pack.blob.size,tracks:pack.tracks.length,folders:pack.folders.length,music_format:'SSEQ'},null,2));
