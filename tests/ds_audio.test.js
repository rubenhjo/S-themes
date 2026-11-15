import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../ds_audio.js',import.meta.url),'utf8');
const ctx={Blob,TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView,Map,ArrayBuffer,console};ctx.window=ctx;vm.runInNewContext(src,ctx);
const ds=ctx.SigmaDS;
test('DS exporter produces IMA-ADPCM RIFF WAVE at 32728 Hz with loops',async()=>{
 const n=32728,signal=new Float32Array(n);for(let i=0;i<n;i++)signal[i]=.3*Math.sin(i*2*Math.PI*220/n);
 const wav=ds.encodeImaWav([signal,signal],32728,true);
 const h=Buffer.from(await wav.slice(0,140).arrayBuffer());
 assert.equal(h.toString('ascii',0,4),'RIFF');assert.equal(h.toString('ascii',8,12),'WAVE');assert.equal(h.readUInt16LE(20),17);assert.equal(h.readUInt16LE(22),2);assert.equal(h.readUInt32LE(24),32728);assert.ok(h.includes(Buffer.from('smpl')));
 const files=[{name:'music/one.wav',blob:wav},{name:'manifest.json',blob:new Blob(['{}'])}],archive=await ds.zip(files);
 const decoded=await ds.unzip(archive);assert.equal(decoded.size,2);assert.equal(decoded.get('music/one.wav').size,wav.size);
});
test('reject unsafe ZIP traversal',async()=>{const zip=await ds.zip([{name:'one.wav',blob:new Blob(['123456789'])}]);let bytes=new Uint8Array(await zip.arrayBuffer());const text=new TextEncoder().encode('../a.wav');const n=bytes.indexOf(111); // patch central directory filename using a fixed 7-byte file name
 let at=-1;for(let i=0;i<bytes.length-4;i++)if(bytes[i]===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===1&&bytes[i+3]===2){at=i+46;break}
 assert.ok(at>0);bytes.set(text.slice(0,7),at);await assert.rejects(ds.unzip(new Blob([bytes])));
});
test('ZIP verification catches corrupted audio content and validates complete archives',async()=>{
 const source=new Blob([new Uint8Array(200_000).map((_,i)=>(i*17)&255)]);
 const archive=await ds.zip([{name:'audio/sample.wav',blob:source},{name:'manifest.json',blob:new Blob(['{"ok":true}'])}]);
 const verified=await ds.verifyZip(archive);
 assert.equal(verified.files,2);
 const corrupted=new Uint8Array(await archive.arrayBuffer());
 // ZIP local header: 30 bytes + UTF-8 file name, followed by the stored payload.
 corrupted[30+'audio/sample.wav'.length+30]^=0x40;
 await assert.rejects(ds.verifyZip(new Blob([corrupted])),/checksum mismatch/i);
});
