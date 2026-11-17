import test from 'node:test';
import assert from 'node:assert/strict';
import '../sseq_transcribe.js';
const T=globalThis.SigmaTranscribe;
const SR=11025;
function synth(events,duration){
 const x=new Float32Array(Math.round(SR*duration));
 for(const e of events){const hz=440*Math.pow(2,(e.pitch-69)/12),offset=Math.round(e.start*SR),length=Math.round(e.duration*SR);
  for(let i=0;i<length;i++){const at=offset+i;if(at>=x.length)break;const time=i/SR;
   for(let h=1;h<=e.amplitudes.length;h++)x[at]+=e.amplitudes[h-1]*Math.sin(2*Math.PI*hz*time*h)*Math.min(1,time/.01)*Math.min(1,(e.duration-time)/.01);
  }
 }
 return x;
}
function detect(events,duration){const input=synth(events,duration);const info=T.spectralFrames(input,SR);return T.smooth(info.frames,info.hopSeconds)}
test('solo with loud second harmonic gives exactly four real notes rather than 16 overtones',()=>{
 const a=[57,59,62,64].map((pitch,index)=>({pitch,start:index*1,duration:.95,amplitudes:[.32,.65,.36,.19]}));
 const notes=detect(a,4);assert.deepEqual(notes.map(n=>n.pitch),[57,59,62,64]);
 assert.equal(notes.length,4);
});
test('four repeated identical middle-C notes are not dropped as one note',()=>{
 const seq=Array.from({length:4},(_,i)=>({pitch:60,start:i*.455,duration:.38,amplitudes:[.3]}));
 const notes=detect(seq,1.82);
 assert.deepEqual(notes.map(n=>n.pitch),[60,60,60,60]);
 assert.ok(notes[3].start>notes[0].start+1.1);
});
test('bass notes E2 G2 A2 E2 retain fundamentals (extra transients tracked separately)',()=>{
 const seq=[40,43,45,40].map((pitch,i)=>({pitch,start:i*.6,duration:.53,amplitudes:[.3,.15]}));
 const notes=detect(seq,2.4);
 assert.deepEqual(notes.filter(n=>n.channel===0).map(n=>n.pitch),[40,43,45,40]);
});
