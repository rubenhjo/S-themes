/* Optional short-recording microtiming refinement from original PCM.
 * Harmonic-spectrum frames have ~185 ms windows; new notes under an existing
 * chord can appear early and sustained chord tones can vanish prematurely.
 * Short-window complex demodulation cross-checks independent onset and release.
 * This is a heuristic local audio method, not a neural music transcription model.
 */
(function(root,factory){root.SigmaNoteRefine=factory()})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const hz=p=>440*Math.pow(2,(p-69)/12);
function envelope(samples,rate,pitch,{hopSeconds=.01,windowSeconds=.06}={}){
 const length=Math.max(64,Math.round(rate*windowSeconds)),step=Math.max(1,Math.round(rate*hopSeconds));
 const frames=Math.floor((samples.length-length)/step)+1;
 if(frames<6)return null;
 const real=new Float64Array(length),imag=new Float64Array(length),f=hz(pitch);
 for(let i=0;i<length;i++){const a=2*Math.PI*f*i/rate,w=.5-.5*Math.cos(2*Math.PI*i/(length-1));real[i]=Math.cos(a)*w;imag[i]=Math.sin(a)*w;}
 const a=new Float32Array(frames);let max=0;
 for(let i=0;i<frames;i++){
  let x=0,y=0;const offset=i*step;
  for(let j=0;j<length;j++){const v=samples[offset+j];x+=v*real[j];y+=v*imag[j];}
  const amp=Math.hypot(x,y);a[i]=amp;if(amp>max)max=amp;
 }
 if(max<1e-5)return null;
 for(let i=0;i<frames;i++)a[i]/=max;
 const d=new Float32Array(frames-1);for(let i=0;i<d.length;i++)d[i]=a[i+1]-a[i];
 return {a,d,dt:step/rate,window:length/rate};
}
function peaks(v,sign=1){const out=[];for(let i=2;i<v.length-2;i++){
 const x=v[i]*sign;if(x<=.025||x<v[i-1]*sign||x<v[i+1]*sign)continue;
 // A real onset should dominate the local oscillatory fluctuations.
 const pre=v.slice(Math.max(0,i-3),i),post=v.slice(i+1,Math.min(v.length,i+4));
 if(x<Math.max(.035,...[...pre,...post].map(a=>a*sign))*.55)continue;
 out.push({index:i,strength:x});
 }return out;}
function pick(options,expected,dt,low,high,scale=.14){
 let result=null,quality=-Infinity;
 for(const p of options){const time=p.index*dt;
  if(time<low||time>high)continue;
  const score=p.strength*Math.exp(-Math.abs(time-expected)/scale);
  if(score>quality){quality=score;result={...p,time,score}}
 }return result;
}
function overlap(a,b){return Math.max(0,Math.min(a.start+a.duration,b.start+b.duration)-Math.max(a.start,b.start));}
function refineNotes(samples,sampleRate,source,{maxSeconds=15,maxPitches=20}={}){
 if(!Array.isArray(source)||!source.length)return source||[];
 if(samples.length>sampleRate*maxSeconds||new Set(source.map(n=>n.pitch)).size>maxPitches)return source;
 const tracks=new Map();
 for(const n of source){const arr=tracks.get(n.pitch)||[];arr.push({...n});tracks.set(n.pitch,arr)}
 // Fragmented tails from one sample/voice are joined only with a small gap.
 const joined=[];
 for(const notes of tracks.values()){
  notes.sort((a,b)=>a.start-b.start);
  let prev=null;
  for(const n of notes){
   if(prev&&n.start-(prev.start+prev.duration)<.10&&n.start>=prev.start){
    prev.duration=Math.max(prev.duration,n.start+n.duration-prev.start);prev.confidence=Math.max(prev.confidence??.5,n.confidence??.5);
   }else{prev={...n};joined.push(prev)}
  }
 }
 const totalTime=samples.length/sampleRate;
 const traces=new Map();for(const n of joined)if(!traces.has(n.pitch))traces.set(n.pitch,envelope(samples,sampleRate,n.pitch));
 const refined=[];
 for(const n of joined){
  const track=traces.get(n.pitch);if(!track){refined.push(n);continue;}
  const ons=peaks(track.d,1),offs=peaks(track.d,-1);
  const estimateOn=n.start,estimateOff=n.start+n.duration;
  const start=pick(ons,estimateOn-.015,track.dt,Math.max(0,estimateOn-.105),Math.min(totalTime,estimateOn+.28),.17);
  const earlierHarmonic=joined.some(low=>low!==n&&[12,19,24,28].includes(n.pitch-low.pitch)&&low.start<n.start+.02&&low.start+low.duration>estimateOff+.08);
  const end=pick(offs,estimateOff-.05,track.dt,Math.max(0,estimateOff-.17),Math.min(totalTime,estimateOff+(earlierHarmonic?.13:.34)),earlierHarmonic?.15:.27);
  // For a harmonic of an existing lower note, a second independent onset
  // may arrive later than the lower instrument's first partial. If the
  // later increase is strong, use it; an octave played simultaneously will
  // not have that later strong increase.
  let chosen=start;
  const sub=joined.find(low=>low!==n && n.pitch>low.pitch && [12,19,24,28].includes(n.pitch-low.pitch)&&
    low.start<n.start+.02 && low.start+low.duration>n.start+.15);
  if(sub){const late=ons.filter(p=>p.index*track.dt>=n.start+.06&&p.index*track.dt<=n.start+.35&&p.strength>=.075)
    .sort((a,b)=>b.strength-a.strength)[0];
   if(late&&(!chosen||late.strength>=chosen.strength*.35))chosen={...late,time:late.index*track.dt};
  }
  let begin=chosen?chosen.time+track.window*.33:n.start;
  let finish=end?end.time+track.window*.83:estimateOff;
  begin=Math.max(0,Math.min(totalTime-.015,begin));
  finish=Math.min(totalTime,Math.max(begin+.07,finish));
  const independentOnset=!!chosen&&chosen.strength>=.065;
  // Reject low-confidence short-lived octave ghosts whose lower fundamental
  // is already sounding, and semitone shifts replacing a persistent chord.
  const overlapped=joined.some(low=>low!==n&&low.start<n.start+.04&&low.start+low.duration>=n.start-.14&&
   (Math.abs(n.pitch-low.pitch)<=2 || [12,19,24,28].includes(n.pitch-low.pitch)));
  const short=n.duration<.31;
  const spectralGhost=short&&overlapped&&(!independentOnset||
    (n.pitch<60&&joined.some(low=>low!==n&&Math.abs(n.pitch-low.pitch)<=2&&low.start<n.start-.08)));
  if(spectralGhost)continue;
  refined.push({...n,start:begin,duration:finish-begin,refined:true,refinementEvidence:{onsetPeak:chosen?.strength??null,offsetPeak:end?.strength??null}});
 }
 return refined.sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
}
return {envelope,refineNotes};
});
