import {CASES,sound,sr,compare} from './audio-benchmark.mjs';
import '../sseq_transcribe.js';
import '../sseq_codec.js';
import {readFileSync} from 'node:fs';
const profiles=JSON.parse(readFileSync(new URL('../heartgold_bank_profiles.json',import.meta.url)));
const S=globalThis.SigmaSSEQ; globalThis.window={SigmaSSEQ:S};
const api=globalThis.SigmaTranscribe;
function notesOf(model){return model.flatMap(v=>v.map(n=>({pitch:n.pitch,start:n.start??n.startTick/96,duration:n.duration??n.durationTick/96})));}
function pitchSets(notes){return [...new Set(notes.map(x=>x.pitch))].sort((a,b)=>a-b)}
for(const [caseName,events] of CASES.filter(x=>/four-note chord|six-note chord|three-note chord|strong harmonics|melody and chords/.test(x[0]))){
 const analysis=api.spectralFrames(sound(events),sr), notes=api.smooth(analysis.frames,analysis.hopSeconds);
 const voices=[];
 for(let c=0;c<(analysis.frames[0]?.length||0);c++){
  const seq=notes.filter(n=>n.channel===c).map(n=>({pitch:n.pitch,start:Math.round(n.start*96),duration:Math.max(1,Math.round(n.duration*96)),velocity:n.velocity}));
  if(seq.length)voices.push(seq);
 }
 const ctx=S.profileSlot(profiles,1028),plan=api.packTracks(voices,ctx,{preferred:0});
 let out=[],error=null;
 try{const built=S.build({tracks:plan.tracks,profiles,slot:1028,loop:false});out=S.parse(built,{slot:1028,profiles}).notes;}catch(e){error=e.message}
 console.log(caseName,JSON.stringify({truth:pitchSets(events),analysis:pitchSets(notes),voice:pitchSets(notesOf(voices.map(v=>v.map(n=>({pitch:n.pitch,start:n.start/96,duration:n.duration/96}))))),exported:pitchSets(out),analysisN:notes.length,exportedN:out.length,error,analysisNotes:notes.map(n=>`${n.pitch}@${n.start.toFixed(2)}+${n.duration.toFixed(2)}`)}));
}
