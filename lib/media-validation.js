/** Server-side audio validation. The UI's metadata and MIME are never trusted.
 * Runs on a trusted worker (GitHub Actions or private server), not the browser.
 * Requires installed ffmpeg and ffprobe; fails closed if absent.
 */
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {stat} from 'node:fs/promises';
import {err} from './common.js';
// Private legacy source validation: NEVER used to publish a public music object.
const MAX_LEGACY_SOURCE_BYTES=45*1024*1024;
function sniffLegacy(b,e){return (e==='wav'&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WAVE') ||
 (e==='mp3'&&(b.toString('ascii',0,3)==='ID3'||b[0]===0xff&&(b[1]&0xe0)===0xe0)) ||
 (e==='flac'&&b.toString('ascii',0,4)==='fLaC') ||
 (['ogg','opus'].includes(e)&&b.toString('ascii',0,4)==='OggS') ||
 (e==='m4a'&&b.toString('ascii',4,8)==='ftyp') ||
 (e==='aac'&&b[0]===0xff&&(b[1]&0xf0)===0xf0);}

export const AUDIO_LIMITS=Object.freeze({minDuration:0.1,maxDuration:7200,minRate:8000,maxRate:192000,maxChannels:8});
function execute(binary,args,timeoutMs=60000){
 return new Promise((resolve,reject)=>{
  const p=spawn(binary,args,{stdio:['ignore','pipe','pipe']});let out='',errors='',settled=false;
  const finish=(e,result)=>{if(settled)return;settled=true;clearTimeout(timer);e?reject(e):resolve(result)};
  const timer=setTimeout(()=>{p.kill('SIGKILL');finish(err(503,'Audio analysis exceeded the safe time limit'))},timeoutMs);
  p.stdout.on('data',d=>{if(out.length<2_000_000)out+=d.toString()});
  p.stderr.on('data',d=>{if(errors.length<200_000)errors+=d.toString()});
  p.on('error',()=>finish(err(503,'Audio validation tools unavailable')));
  p.on('close',code=>{if(code===0)finish(null,{out,errors});else finish(err(400,'Audio file cannot be decoded'))});
 });
}
export function validateProbe(probe,extension){
 const f=String(probe?.format?.format_name||'').split(',');
 const aliases={mp3:['mp3'],wav:['wav'],flac:['flac'],ogg:['ogg'],opus:['ogg'],m4a:['mov','mp4','m4a'],aac:['aac']};
 if(!aliases[extension]?.some(x=>f.includes(x)))throw err(400,'Audio format does not match file extension');
 const streams=(probe.streams||[]).filter(s=>s.codec_type==='audio');
 if(streams.length!==1)throw err(400,'Audio must contain exactly one audio stream');
 const a=streams[0];
 const codecs={mp3:['mp3'],wav:['pcm_s16le','pcm_s24le','pcm_s32le','pcm_f32le','pcm_u8','adpcm_ima_wav'],flac:['flac'],ogg:['vorbis','opus'],opus:['opus'],m4a:['aac','alac'],aac:['aac']};
 if(!codecs[extension]?.includes(a.codec_name))throw err(400,'Unsupported or conflicting audio codec');
 const sampleRate=Number(a.sample_rate),channels=Number(a.channels);
 let duration=Number(probe.format?.duration);if(!Number.isFinite(duration)||duration<=0)duration=Number(a.duration);
 if(!Number.isFinite(duration)||duration<AUDIO_LIMITS.minDuration||duration>AUDIO_LIMITS.maxDuration)throw err(400,'Invalid audio duration');
 if(!Number.isInteger(channels)||channels<1||channels>AUDIO_LIMITS.maxChannels)throw err(400,'Invalid audio channel count');
 if(!Number.isInteger(sampleRate)||sampleRate<AUDIO_LIMITS.minRate||sampleRate>AUDIO_LIMITS.maxRate)throw err(400,'Invalid audio sample rate');
 return {codec:a.codec_name,container:f[0],sampleRate,channels,duration};
}
export async function validateAudioFile(path,{extension,expectedHash,expectedBytes,probePath=process.env.FFPROBE_PATH||'ffprobe',ffmpegPath=process.env.FFMPEG_PATH||'ffmpeg'}={}){
 const s=await stat(path);
 if(s.size<64||s.size>MAX_LEGACY_SOURCE_BYTES||s.size!==expectedBytes)throw err(400,'Audio size does not match upload');
 const hash=createHash('sha256');let first=Buffer.alloc(0);
 for await(const d of createReadStream(path)){
  if(first.length<64)first=Buffer.concat([first,d.subarray(0,64-first.length)]);
  hash.update(d);
 }
 if(hash.digest('hex')!==expectedHash)throw err(400,'Audio SHA-256 mismatch');
 if(!sniffLegacy(first,extension))throw err(400,'Audio signature does not match extension');
 const probed=await execute(probePath,['-v','error','-show_format','-show_streams','-of','json',path],25000);
 let json;try{json=JSON.parse(probed.out)}catch{throw err(400,'Invalid audio probe response')}
 const info=validateProbe(json,extension);
 const decoded=await execute(ffmpegPath,['-nostdin','-v','error','-xerror','-err_detect','explode','-i',path,'-map','0:a:0','-vn','-sn','-dn','-f','null','-progress','pipe:1','-'],Math.min(150000,15000+Math.ceil(info.duration*30)));
 const matched=[...decoded.out.matchAll(/out_time_us=(\d+)/g)];
 if(matched.length){const decodedSeconds=Number(matched.at(-1)[1])/1e6;
  if(Math.abs(decodedSeconds-info.duration)>Math.max(2,info.duration*.08))throw err(400,'Audio data ends before declared duration');
 }
 return info;
}
