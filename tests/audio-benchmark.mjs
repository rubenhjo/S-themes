/* Deterministic music-transcription benchmark. The independent note truth is in CASES;
 * no truth is inferred from the transcriber under test. Public fixtures are generated in memory. */
import '../sseq_transcribe.js';
const sr=11025;
const E=(p,s,d,a=[.42,.13,.05],v=90)=>({pitch:p,start:s,duration:d,partials:a,velocity:v});
const CASES=[
 ['single note',[E(60,.12,.72)]],
 ['four-note melody',[E(57,.1,.46),E(59,.66,.46),E(62,1.22,.46),E(64,1.78,.46)]],
 ['repeated notes',[E(60,.10,.36),E(60,.53,.36),E(60,.97,.36)]],
 ['two voices',[E(57,.10,.85),E(64,.10,.85)]],
 ['three-note chord',[E(48,.12,.86),E(52,.12,.86),E(55,.12,.86)]],
 ['four-note chord',[E(48,.12,.90),E(52,.12,.90),E(55,.12,.90),E(60,.12,.90)]],
 ['six-note chord',[E(48,.12,.90),E(52,.12,.90),E(55,.12,.90),E(60,.12,.90),E(64,.12,.90),E(67,.12,.90)]],
 ['melody and bass',[E(43,.1,1.16,[.55,.12]),E(67,.14,.42),E(69,.69,.42)]],
 ['melody and chords',[E(48,.12,1.18),E(52,.12,1.18),E(55,.12,1.18),E(67,.12,.44),E(69,.71,.44)]],
 ['strong harmonics',[E(57,.10,.89,[.18,.68,.4,.23])]],
 ['weak fundamental',[E(52,.10,.9,[.09,.5,.25,.12])]],
 ['genuine octave',[E(57,.10,.86,[.40,.09]),E(69,.10,.86,[.40,.09])]],
 ['low bass',[E(40,.1,.9,[.35,.12]),E(43,1.06,.9,[.35,.12])]],
 ['short notes',[E(64,.1,.16),E(65,.38,.16),E(67,.67,.16)]],
 ['long note',[E(60,.1,1.9)]],
 ['overlap stagger',[E(52,.1,.95),E(60,.5,.9),E(67,.85,.8)]],
 ['silence with gaps',[E(60,.45,.58),E(64,1.55,.58)]],
 ['variable tempo style',[E(57,.1,.3),E(59,.52,.32),E(60,.99,.38),E(62,1.64,.32),E(64,2.15,.46)]],
 ['square PSG timbre',[E(60,.1,.88,[.4,0,.26,0,.17,0,.13])]],
 ['multiple instruments',[E(43,.1,1.1,[.4,.2]),E(57,.1,1.1,[.15,.4,.2]),E(67,.12,.46,[.4,.08]),E(69,.69,.46,[.4,.08])]],
];
function sound(events){const dur=Math.max(1,Math.max(...events.map(e=>e.start+e.duration))+.19),a=new Float32Array(Math.ceil(dur*sr));for(const e of events){const start=Math.round(e.start*sr),len=Math.round(e.duration*sr),f=440*Math.pow(2,(e.pitch-69)/12);for(let i=0;i<len&&i+start<a.length;i++){let x=0;for(let j=0;j<e.partials.length;j++)x+=e.partials[j]*Math.sin(2*Math.PI*(j+1)*f*i/sr);const attack=Math.min(1,i/(sr*.016)),release=Math.min(1,(len-i)/(sr*.025));a[i+start]+=x*attack*release;}}return a;}
function compare(reference,estimated,{onsetTol=.20,offsetTol=.20}={}){
 let matches=0,octaves=0,used=new Set(),onsetErrors=[],offsetErrors=[];
 for(const target of reference){let best=-1,cost=Infinity;for(let j=0;j<estimated.length;j++){if(used.has(j))continue;const n=estimated[j];if(target.pitch!==n.pitch)continue;const dt=Math.abs(target.start-n.start),off=Math.abs(target.start+target.duration-(n.start+n.duration));if(dt<=onsetTol&&off<=offsetTol&&dt+off<cost){cost=dt+off;best=j;}}if(best>=0){matches++;used.add(best);onsetErrors.push(Math.abs(target.start-estimated[best].start));offsetErrors.push(Math.abs(target.start+target.duration-estimated[best].start-estimated[best].duration));}}
 for(const t of reference)if(estimated.some(e=>Math.abs(t.start-e.start)<=.2&&Math.abs(t.pitch-e.pitch)===12))octaves++;
 const precision=estimated.length?matches/estimated.length:0,recall=reference.length?matches/reference.length:1;
 return {tp:matches,fp:estimated.length-matches,fn:reference.length-matches,octaves,precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0,onsetMean:onsetErrors.length?onsetErrors.reduce((a,b)=>a+b,0)/onsetErrors.length:null,offsetMean:offsetErrors.length?offsetErrors.reduce((a,b)=>a+b,0)/offsetErrors.length:null};
}
export {CASES,sound,compare,sr};
export function benchmark(api=globalThis.SigmaTranscribe){const rows=[];for(const [name,events] of CASES){const rendered=sound(events),analysis=api.spectralFrames(rendered,sr),notes=api.smooth(analysis.frames,analysis.hopSeconds);rows.push({name,truth:events.length,detected:notes.length,...compare(events,notes),notes:notes.map(n=>`${n.pitch}@${n.start.toFixed(2)}`)});}const sum=rows.reduce((a,r)=>({tp:a.tp+r.tp,fp:a.fp+r.fp,fn:a.fn+r.fn,octaves:a.octaves+r.octaves}),{tp:0,fp:0,fn:0,octaves:0});const p=sum.tp/(sum.tp+sum.fp||1),r=sum.tp/(sum.tp+sum.fn||1);return {rows,summary:{...sum,precision:p,recall:r,f1:2*p*r/(p+r||1)}};}
if(import.meta.url===`file://${process.argv[1]}`){const result=benchmark();console.log(JSON.stringify(result,null,2));}
