/* Deterministic, freely generated reference audio and Standard MIDI Files.
 * Run manually: node tests/create-polyphony-fixtures.mjs
 * The MIDI files (not transcription output) are the score ground truth.
 */
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {CASES,sound,sr} from './audio-benchmark.mjs';
import '../sseq_transcribe.js';
const target=new URL('./fixtures/polyphony/',import.meta.url);mkdirSync(target,{recursive:true});
const E=(pitch,start,duration,partials=[.42,.13,.05],velocity=90)=>({pitch,start,duration,partials,velocity});
const extra=[
 ['eight-note chord',[48,52,55,60,64,67,71,74].map(n=>E(n,.16,.91))],
 ['four C4 repeats',[.12,.62,1.12,1.62].map(t=>E(60,t,.29))],
 ['E2-G2-A2-E2 bass',[40,43,45,40].map((n,i)=>E(n,.17+i*.68,.51,[.51,.09,.03]))],
 ['melody after 350ms silence',[E(48,.35,1.30),E(52,.35,1.30),E(55,.35,1.30),E(67,.35,.41),E(69,.90,.41),E(72,1.45,.36)]],
 ['heldout staggered six instruments',[E(45,.11,1.33,[.18,.49,.28]),E(52,.19,.94,[.51,.07]),E(57,.37,.84,[.34,.22,.1]),E(61,.51,.9,[.39,.21]),E(66,.68,.74,[.21,.19,.08]),E(73,.84,.66,[.54,.06])]],
 ['heldout dense chord',[50,54,57,62,66,69].map(n=>E(n,.24,.82,[.25,.33,.13,.02]))]
];
const cases=[...CASES.filter(x=>['four-note chord','six-note chord','strong harmonics'].includes(x[0])),...extra];
const vlq=n=>{const b=[n&127];while((n>>=7))b.unshift((n&127)|128);return b};
function midi(events){let prior=0,track=[];const entries=events.flatMap(e=>[
 {tick:Math.round(e.start*960),kind:1,n:e.pitch,v:e.velocity},{tick:Math.round((e.start+e.duration)*960),kind:0,n:e.pitch,v:0}]);entries.sort((a,b)=>a.tick-b.tick||a.kind-b.kind||a.n-b.n);
 for(const e of entries){track.push(...vlq(e.tick-prior),e.kind?0x90:0x80,e.n,e.v);prior=e.tick;}
 track.push(0,0xff,0x2f,0);const header=Buffer.alloc(14);header.write('MThd',0);header.writeUInt32BE(6,4);header.writeUInt16BE(0,8);header.writeUInt16BE(1,10);header.writeUInt16BE(480,12);const chunk=Buffer.alloc(8);chunk.write('MTrk',0);chunk.writeUInt32BE(track.length,4);return Buffer.concat([header,chunk,Buffer.from(track)]);}
const manifest=[];
for(const [name,score] of cases){const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'_'),raw=sound(score),mx=Math.max(...raw.map(Math.abs)),scale=.90/Math.max(.90,mx),pcm=Buffer.alloc(raw.length*2);for(let i=0;i<raw.length;i++)pcm.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(raw[i]*scale*32767))),i*2);
 const wav=Buffer.alloc(44);wav.write('RIFF',0);wav.writeUInt32LE(36+pcm.length,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);
 const mpath=join(target.pathname,slug+'.mid'),wpath=join(target.pathname,slug+'.wav'),mpath2=join(target.pathname,slug+'.mp3');writeFileSync(wpath,Buffer.concat([wav,pcm]));writeFileSync(mpath,midi(score));execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',wpath,'-codec:a','libmp3lame','-b:a','192k',mpath2]);
 // The authoritative note truth comes from parsing the generated MIDI bytes.
 const parsed=globalThis.SigmaTranscribe.readMidi(new Uint8Array(readFileSync(mpath)));
 manifest.push({name,slug,midi:slug+'.mid',wav:slug+'.wav',mp3:slug+'.mp3',heldout:name.startsWith('heldout'),truth:parsed.allNotes.map(n=>({pitch:n.pitch,start:n.startSeconds,duration:n.endSeconds-n.startSeconds}))});}
writeFileSync(join(target.pathname,'manifest.json'),JSON.stringify(manifest,null,2));
console.log('Generated',manifest.length,'MIDI->WAV+MP3 pairs in',target.pathname);
