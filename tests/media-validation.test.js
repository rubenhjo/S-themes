import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateAudioFile,validateProbe} from '../lib/media-validation.js';
const dir=await mkdtemp(join(tmpdir(),'qc7-media-'));
function hash(b){return createHash('sha256').update(b).digest('hex')}
function generate(path,codec){execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=1',...(codec==='mp3'?['-c:a','libmp3lame','-b:a','128k']:['-c:a','pcm_s16le']),'-y',path],{timeout:15000})}
try{generate(join(dir,'valid.mp3'),'mp3');generate(join(dir,'valid.wav'),'wav')}catch(e){throw Error('FFmpeg fixtures cannot run: '+e.message)}
const validate=async(name,extension=name.split('.').at(-1))=>{
 const path=join(dir,name),bytes=await readFile(path);
 return validateAudioFile(path,{extension,expectedHash:hash(bytes),expectedBytes:bytes.length});
};
test('ST-034 valid decoded MP3, PCM WAV with bounded duration/channel/rate',async()=>{
 for(const name of ['valid.mp3','valid.wav']){
  const info=await validate(name);assert.ok(info.duration>.8&&info.duration<1.2);
  assert.equal(info.channels,1);assert.equal(info.sampleRate,44100);
 }
});
test('ST-034 ID3 header followed by garbage is rejected after full decode',async()=>{
 await writeFile(join(dir,'id3.mp3'),Buffer.concat([Buffer.from('ID3\u0004\u0000\u0000\u0000\u0000\u0000\u0000'),Buffer.alloc(1024,0xaa)]));
 await assert.rejects(validate('id3.mp3'),e=>e.status===400);
});
test('ST-034 truncated WAV with its own matching checksum fails full decode',async()=>{
 const original=await readFile(join(dir,'valid.wav'));
 await writeFile(join(dir,'damaged.wav'),original.subarray(0,Math.floor(original.length/2)));
 await assert.rejects(validate('damaged.wav'),e=>e.status===400);
});
test('ST-034 fake extension and manipulated header are rejected',async()=>{
 const wav=await readFile(join(dir,'valid.wav'));
 await writeFile(join(dir,'fake.mp3'),wav);
 await assert.rejects(validate('fake.mp3'),e=>e.status===400);
 const mp3=await readFile(join(dir,'valid.mp3'));
 await writeFile(join(dir,'fake.wav'),mp3);
 await assert.rejects(validate('fake.wav'),e=>e.status===400);
});
test('ST-034 empty, truncated and incorrect hash files are rejected',async()=>{
 await writeFile(join(dir,'empty.mp3'),Buffer.alloc(0));await assert.rejects(validate('empty.mp3'),e=>e.status===400);
 const src=await readFile(join(dir,'valid.mp3'));
 await writeFile(join(dir,'truncated.mp3'),src.subarray(0,Math.floor(src.length/2)));
 // Truncated MP3 may still decode its early frames, but must not be published as a complete original hash.
 await assert.rejects(validateAudioFile(join(dir,'truncated.mp3'),{extension:'mp3',expectedHash:hash(src),expectedBytes:src.length}),e=>e.status===400);
 await assert.rejects(validateAudioFile(join(dir,'valid.mp3'),{extension:'mp3',expectedHash:'0'.repeat(64),expectedBytes:src.length}),e=>e.status===400);
});
test('ST-034 unacceptable samplerate, channels and duration rejected',()=>{
 const base={format:{format_name:'mp3',duration:'30'},streams:[{codec_type:'audio',codec_name:'mp3',sample_rate:'44100',channels:2}]};
 for(const [key,bad] of [['sample_rate','999999'],['channels',19]])assert.throws(()=>validateProbe({...base,streams:[{...base.streams[0],[key]:bad}]},'mp3'),e=>e.status===400);
 assert.throws(()=>validateProbe({...base,format:{format_name:'mp3',duration:'9000'}},'mp3'),e=>e.status===400);
 assert.throws(()=>validateProbe({...base,format:{format_name:'wav',duration:'30'}},'mp3'),e=>e.status===400);
});
after(async()=>{await rm(dir,{force:true,recursive:true});});
