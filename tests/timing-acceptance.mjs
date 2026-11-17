/* Deterministic blind/known timing quality evaluation (no Nintendo files).
 * Ground truth comes from independently authored MIDI events.
 * Never mutate score truth to match the engine's predictions.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import '../tests/baseline-v173-transcribe.js';
import '../sigma_note_refine.js';
import '../sseq_transcribe.js';
import '../sseq_codec.js';
import {sound,sr} from './audio-benchmark.mjs';
const old=globalThis.SigmaTranscribeV173,now=globalThis.SigmaTranscribe,S=globalThis.SigmaSSEQ;
globalThis.window={SigmaSSEQ:S};
const profiles=JSON.parse(readFileSync(new URL('../heartgold_bank_profiles.json',import.meta.url)));
const fixtures=new URL('./fixtures/polyphony/',import.meta.url);
const cases=JSON.parse(readFileSync(new URL('manifest.json',fixtures)));
function decode(file){const p=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i',new URL(file,fixtures).pathname,'-ac','1','-ar','11025','-f','f32le','pipe:1'],{maxBuffer:10000000});if(p.status!==0)throw Error(p.stderr.toString());return Float32Array.from(new Float32Array(p.stdout.buffer,p.stdout.byteOffset,p.stdout.byteLength/4));}
function score(truth,out,strict){const taken=new Set();let tp=0;for(const t of truth){const i=out.findIndex((n,j)=>!taken.has(j)&&n.pitch===t.pitch&&Math.abs(n.start-t.start)<=(strict?.05:.2)&&Math.abs(n.start+n.duration-t.start-t.duration)<=(strict?Math.max(.05,.2*t.duration):.2));if(i>=0){taken.add(i);tp++}}return {correct:tp,extra:out.length-tp,missing:truth.length-tp};}
function output(api,mono,refined){const t0=performance.now();const data=refined?api.analyzeSpectrum(mono,11025):api.spectralFrames(mono,11025);const analyzed=refined?data.refinedNotes:api.smooth(data.frames,data.hopSeconds);const ns=analyzed.filter(n=>n.pitch>=35&&n.pitch<=92&&n.duration>.11).map(n=>({...n,start:Math.max(0,Math.round(n.start*96)),duration:Math.max(1,Math.round(n.duration*96))}));const voices=Array.from({length:data.frames[0]?.length||1},(_,i)=>ns.filter(n=>n.channel===i)).filter(x=>x.length);if(!voices.length)return {output:[],ms:performance.now()-t0,stages:{analysis:[],parts:[],export:[]}};
 const plan=api.packTracks(voices,S.profileSlot(profiles,1028),{preferred:0});
 const bytes=S.build({tracks:plan.tracks,slot:1028,profiles,loop:false,limit:65536});
 const notes=S.parse(bytes,{profiles,slot:1028}).notes.map(n=>({pitch:n.pitch,start:n.start/96,duration:n.duration/96}));
 return {output:notes,ms:performance.now()-t0,stages:{analysis:analyzed.map(x=>x.pitch).sort((a,b)=>a-b),parts:plan.tracks.flatMap(x=>x.notes.map(n=>n.pitch)).sort((a,b)=>a-b),export:notes.map(x=>x.pitch).sort((a,b)=>a-b)}};
}
const results=[];
for(const c of cases){for(const codec of ['wav','mp3']){
 const pcm=decode(c[codec]),base=output(old,pcm,false),candidate=output(now,pcm,true);
 results.push({case:c.name,codec,truth:c.truth,baseline:{strict:score(c.truth,base.output,true),lenient:score(c.truth,base.output,false),ms:+base.ms.toFixed(2),notes:base.output},candidate:{strict:score(c.truth,candidate.output,true),lenient:score(c.truth,candidate.output,false),ms:+candidate.ms.toFixed(2),notes:candidate.output},stages:candidate.stages});
 console.log('TIMING',c.name,codec,'before',base.output.length,'after',candidate.output.length,'strict',candidate&&score(c.truth,candidate.output,true));
}}
// These are newly authored scores, not reused when tuning the note-refiner.
// Their note truth is fixed independently before processing the synthesized waveform.
const holdout=[
 ['unseen syncopated bass and melody',[[40,.22,.75],[67,.24,.34],[43,1.06,.67],[69,1.11,.36],[45,1.94,.67],[71,2.0,.35]]],
 ['unseen dense octave chord',[[48,.17,.86],[52,.17,.86],[55,.17,.86],[60,.17,.86],[64,.17,.86],[72,.17,.86]]],
 ['unseen displaced lead over harmony',[[50,.44,1.28],[54,.44,1.28],[57,.44,1.28],[74,.71,.36],[72,1.22,.34]]]
];
for(const [name,raw] of holdout){const truth=raw.map(([pitch,start,duration])=>({pitch,start,duration}));const pcm=sound(raw.map(([pitch,start,duration])=>({pitch,start,duration,partials:[.38,.17,.04]})));const base=output(old,pcm,false),candidate=output(now,pcm,true);results.push({case:name,codec:'synth WAV-equivalent',heldout:true,truth,baseline:{strict:score(truth,base.output,true),lenient:score(truth,base.output,false),ms:+base.ms.toFixed(2),notes:base.output},candidate:{strict:score(truth,candidate.output,true),lenient:score(truth,candidate.output,false),ms:+candidate.ms.toFixed(2),notes:candidate.output},stages:candidate.stages});console.log('UNSEEN',name,score(truth,candidate.output,true));}
function summary(field,items){const stats={correct:0,extra:0,missing:0};for(const row of items)for(const key of Object.keys(stats))stats[key]+=row[field].strict[key];const p=stats.correct/(stats.correct+stats.extra||1),r=stats.correct/(stats.correct+stats.missing||1);return {...stats,precision:p,recall:r,f1:2*p*r/(p+r||1)}}
const trained=results.filter(x=>!x.heldout);const unseen=results.filter(x=>x.heldout);const report={description:'Original v1.7.3 vs v1.7.4 measured against authored MIDI / additional withheld scores',rules:'pitch exact, onset<=50ms, offset<=max(50ms,20% duration); no test truth adjusted',known:{before:summary('baseline',trained),after:summary('candidate',trained)},unseen:{before:summary('baseline',unseen),after:summary('candidate',unseen)},rows:results};
writeFileSync(new URL('../ARRANGER_TIMING_RESULTS.json',import.meta.url),JSON.stringify(report,null,2));
for(const required of ['melody after 350ms silence','heldout staggered six instruments'])for(const c of results.filter(x=>x.case===required))if(c.candidate.strict.correct!==6||c.candidate.strict.extra||c.candidate.strict.missing)throw Error('Regressed targeted strict timing: '+required+' '+c.codec);
console.log('Timing aggregate:',JSON.stringify({known:report.known,unseen:report.unseen}));
