import {CASES,sound,sr} from './audio-benchmark.mjs';
import '../sseq_transcribe.js';const {fft}=globalThis.SigmaTranscribe;
const N=2048,hop=256; const midiToHz=n=>440*Math.pow(2,(n-69)/12);
for (const [name,events] of CASES.filter(x=>['four-note chord','six-note chord','strong harmonics','genuine octave','three-note chord','melody and chords'].includes(x[0]))) {
 const sig=sound(events),r=new Float32Array(N),im=new Float32Array(N);for(let j=0;j<N;j++){const x=sig[Math.round(.43*sr)+j];r[j]=(x||0)*(.5-.5*Math.cos(2*Math.PI*j/(N-1)));}
 fft(r,im);const m=Array.from({length:N/2},(_,i)=>Math.hypot(r[i],im[i]));const max=Math.max(...m);const p=(f)=>{const bin=Math.round(f*N/sr);return Math.max(m[Math.max(1,bin-1)],m[bin],m[Math.min(N/2-1,bin+1)])/max;};
 console.log('\n'+name,'max',Math.round(max));
 for(const n of [43,48,52,55,57,60,64,67,69,72]){const h=midiToHz(n);console.log(n, Array.from({length:6},(_,j)=>p(h*(j+1)).toFixed(2)).join(' '));}
}
