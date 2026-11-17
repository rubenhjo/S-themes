import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const ROOT=new URL('../',import.meta.url);
const profiles=JSON.parse(readFileSync(new URL('../heartgold_bank_profiles.json',import.meta.url)));
const context={Uint8Array,ArrayBuffer,DataView,Float32Array,Math,Number,Object,Map,Set,Error,Promise,String,Array, console};context.globalThis=context;
for(const file of ['heartgold_source_audio.js','heartgold_instruments.js'])runInNewContext(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),context);
const lib=context.SigmaInstrumentLibrary,src=context.SigmaHeartGoldSources;
const makeSBNK=()=>{
 const b=new Uint8Array(74),v=new DataView(b.buffer);b.set(Buffer.from('SBNK'),0);b.set(Buffer.from('DATA'),0x10);
 v.setUint32(0x38,1,true);b[0x3c]=1;v.setUint16(0x3d,0x40,true);
 v.setUint16(0x40,0,true);v.setUint16(0x42,0,true);b.set([60,44,53,64,80,64],0x44);return b;
};
const makeSWAR=()=>{
 const b=new Uint8Array(0x40+12+8),v=new DataView(b.buffer);b.set(Buffer.from('SWAR'),0);b.set(Buffer.from('DATA'),0x10);
 v.setUint32(0x38,1,true);v.setUint32(0x3c,0x40,true);b[0x40]=0;v.setUint16(0x42,16000,true);v.setUint32(0x48,2,true);
 b.set([0,32,64,96,128,160,192,224],0x4c);return b;
};
test('All 39 HeartGold banks are catalogued with descriptive families and real program counts',()=>{
 const list=lib.catalog(profiles);assert.equal(list.length,39);assert.equal(new Set(list.map(b=>b.id)).size,39);
 assert.equal(list.find(b=>b.id===701).programCount,128);assert.equal(list.find(b=>b.id===702).programCount,68);
 assert.match(lib.bankName(720,profiles.banks['720']),/Battle/i);
 for(const b of list){assert.ok(b.title);assert.ok(b.slots>0);}
});
test('All bank programs have truthful descriptive type, compatibility, and tone labels',()=>{
 assert.match(lib.programName(702,profiles.banks['702'].programs[0]),/Instrument 001/);
 assert.equal(lib.programType(17),'Multisample / key split');
 assert.equal(lib.programType(16),'Drum / key-range kit');
 assert.equal(lib.programType(2),'8-bit square wave');
 assert.equal(lib.compatible({pitch_ranges:[[40,60]]},[{pitch:61}]),false);
 assert.equal(lib.compatible({pitch_ranges:[[40,60]]},[{pitch:60}]),true);
 assert.match(lib.rangeLabel([[60,72]]),/C4/);
});
test('SBNK parser reads original sample number, ADSR, base pitch and pan correctly',()=>{
 const data=src.parseSBNK(makeSBNK());assert.equal(data.programs.length,1);
 assert.equal(data.programs[0].regions[0].baseNote,60);
 assert.equal(data.programs[0].regions[0].attack,44);
 assert.equal(data.programs[0].regions[0].release,80);
 assert.equal(data.programs[0].regions[0].pan,64);
 assert.equal(data.programs[0].regions[0].waveId,0);
});
test('SWAR parser decodes original PCM8 waveform and validates malformed archives',()=>{
 const archive=src.parseSWAR(makeSWAR());assert.equal(archive.offsets.length,1);
 const wave=src.getWave(archive,0);assert.equal(wave.rate,16000);assert.equal(wave.samples.length,8);
 assert.equal(wave.samples[0],0);assert.equal(wave.samples[1],.25);assert.equal(wave.samples[4],-1);
 const broken=makeSWAR();new DataView(broken.buffer).setUint32(0x3c,2,true);
 assert.throws(()=>src.parseSWAR(broken),/Invalid SWAR wave offsets/);
});
test('ADPCM decoder does not overrun and produces bounded samples',()=>{
 const b=new Uint8Array(12+4+8),view=new DataView(b.buffer);b[0]=2;view.setUint16(2,22050,true);view.setUint32(8,3,true);
 const w=src.decodeWave(b,0,b.length);assert.equal(w.samples.length,17);
 assert.ok([...w.samples].every(s=>s<=1&&s>=-1));
});

test('Sound-first catalogue groups instruments without inventing General MIDI names',()=>{
 const groups=lib.SOUND_FAMILIES;
 for(const family of ['keys','guitar','bass','strings','brass','winds','voice','synth','drums','fx','other'])assert.ok(groups.some(f=>f.id===family),family);
 const synth=groups.find(f=>f.id==='synth');assert.ok(synth.sub.length>=8);
 for(const section of ['synth-lead','synth-soft','synth-pad','synth-dark','synth-pluck','synth-retro','synth-digital','synth-bass'])assert.ok(synth.sub.some(s=>s[0]===section));
 assert.equal(lib.soundTagFor(701,profiles.banks['701'].programs[0]).id,'synth-retro');
 assert.equal(lib.soundTagFor(702,profiles.banks['702'].programs[0]).id,'other-unknown');
 assert.equal(lib.nameBasedSoundTag('Warm Synth Lead'),'synth-soft');
 assert.equal(lib.nameBasedSoundTag('Electric Piano 2'),'keys-electric');
 assert.equal(lib.nameBasedSoundTag('Distortion Guitar'),'guitar-drive');
 assert.equal(lib.nameBasedSoundTag('Silver City Battle Bank'),null);
});
test('Explicit personal instrument category overrides inferred tags and is persistent',()=>{
 const saved=new Map();context.localStorage={getItem:(k)=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
 lib.storeSoundTag(702,0,'keys-piano');
 assert.equal(lib.soundTagFor(702,profiles.banks['702'].programs[0]).id,'keys-piano');
 assert.equal(lib.soundTagFor(702,profiles.banks['702'].programs[0]).source,'custom');
 assert.equal(lib.readSoundTags()['702:0'],'keys-piano');
 lib.storeSoundTag(702,0,'');
 assert.equal(lib.soundTagFor(702,profiles.banks['702'].programs[0]).id,'other-unknown');
});
