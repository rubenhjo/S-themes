/* Three-stage diagnostics using original MIDI ground truth, independently parsed SSEQ,
 * two real codec inputs (WAV/MP3), and two onset/offset criteria. Never edit
 * ground-truth MIDI to match transcription output. Source fixtures are synthetic.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {join} from 'node:path';
import '../sseq_transcribe.js';
import '../sseq_codec.js';
const candidate=globalThis.SigmaTranscribe, S=globalThis.SigmaSSEQ;
await import('./baseline-v172-transcribe.js');const before=globalThis.SigmaTranscribe;
globalThis.window={SigmaSSEQ:S};
const profiles=JSON.parse(readFileSync(new URL('../heartgold_bank_profiles.json',import.meta.url)));
const dir=new URL('./fixtures/polyphony/',import.meta.url).pathname;
const manifest=JSON.parse(readFileSync(join(dir,'manifest.json')));
function decode(name){const proc=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i',join(dir,name),'-ac','1','-ar','11025','-f','f32le','pipe:1'],{maxBuffer:10*1024*1024});if(proc.status!==0)throw Error(proc.stderr.toString());return Float32Array.from(new Float32Array(proc.stdout.buffer,proc.stdout.byteOffset,proc.stdout.length/4));}
function compare(ref,pred,strict=false){let tp=0,used=new Set(),errors=[],lost=[];
 for(const t of ref){let ix=-1,best=Infinity;for(let j=0;j<pred.length;j++){if(used.has(j))continue;const n=pred[j],ds=Math.abs(t.start-n.start),de=Math.abs(t.start+t.duration-n.start-n.duration),tol=strict?Math.max(.05,t.duration*.20):.20;
  if(t.pitch!==n.pitch||ds>(strict?.05:.20)||de>tol)continue;const err=ds+de;if(err<best){best=err;ix=j;}}
  if(ix>=0){tp++;used.add(ix);errors.push(best);}else lost.push(t.pitch);
 }
 const fp=pred.filter((_,i)=>!used.has(i)).map(x=>x.pitch),p=tp/(tp+fp.length||1),r=tp/(ref.length||1);
 return {tp,fp:fp.length,fn:lost.length,f1:+(2*p*r/(p+r||1)).toFixed(4),falsePitches:fp,missedPitches:lost};}
function pitchList(notes){return [...new Set(notes.map(n=>n.pitch))].sort((a,b)=>a-b)}
function evaluate(api,samples){const started=performance.now();const data=api.spectralFrames(samples,11025);const detected=api.smooth(data.frames,data.hopSeconds);const quantized=detected.filter(n=>n.duration>.11&&n.pitch>=35&&n.pitch<=92).map(n=>({...n,start:Math.round(n.start*96),duration:Math.max(1,Math.round(n.duration*96))}));
 const voices=[];for(let ch=0;ch<data.frames[0].length;ch++){const notes=quantized.filter(n=>n.channel===ch).map(n=>({start:n.start,duration:n.duration,pitch:n.pitch,velocity:n.velocity}));if(notes.length)voices.push(notes);}
 let exported=[],error=null,bytes=0;
 try{const context=S.profileSlot(profiles,1028),plan=api.packTracks(voices,context,{preferred:0}),blob=S.build({tracks:plan.tracks,slot:1028,profiles,loop:false});bytes=blob.length;exported=S.parse(blob,{profiles,slot:1028}).notes.map(n=>({...n,start:n.start/96,duration:n.duration/96}));}
 catch(e){error=e.message}
 return {elapsedMs:+(performance.now()-started).toFixed(2),residentMiB:+(process.memoryUsage().rss/1048576).toFixed(1),detected,voices:voices.flat().map(n=>({...n,start:n.start/96,duration:n.duration/96})),exported,error,bytes};}
const rows=[];
for(const row of manifest){for(const ext of ['wav','mp3']){const samples=decode(row[ext]);const prev=evaluate(before,samples),next=evaluate(candidate,samples);const truth=row.truth;
 const report=fn=>({elapsedMs:fn.elapsedMs,residentMiB:fn.residentMiB,analysis:pitchList(fn.detected),voices:pitchList(fn.voices),sseq:pitchList(fn.exported),notes:fn.exported.length,bytes:fn.bytes,error:fn.error,
  lenient:compare(truth,fn.exported),strict:compare(truth,fn.exported,true)});
 rows.push({case:row.name,codec:ext,heldout:row.heldout,truth:pitchList(truth),old:report(prev),new:report(next)});
 console.log(row.name,ext,'truth:',pitchList(truth).join(','),'old:',pitchList(prev.exported).join(','),'new:',pitchList(next.exported).join(','),'strict F1',report(next).strict.f1);
}}
function summary(items,field,quality){const sums={tp:0,fp:0,fn:0};for(const row of items){const v=row[field][quality];for(const k of ['tp','fp','fn'])sums[k]+=v[k]};const p=sums.tp/(sums.tp+sums.fp||1),r=sums.tp/(sums.tp+sums.fn||1);return {...sums,precision:p,recall:r,f1:2*p*r/(p+r||1)};}
const aggregate={};for(const quality of ['lenient','strict'])for(const section of ['all','heldout','training']){const items=rows.filter(r=>section==='all'||r.heldout===(section==='heldout'));aggregate[section+'_'+quality]={before:summary(items,'old',quality),after:summary(items,'new',quality)};}
const output={rules:{lenient:'correct pitch, onset+offset within ±200ms',strict:'correct pitch, onset<=50ms, offset<=max(50ms,20% note duration)'},aggregate,rows};
writeFileSync(new URL('../POLYPHONIC_BENCHMARK_RESULTS.json',import.meta.url),JSON.stringify(output,null,2));console.log(JSON.stringify(aggregate,null,2));
