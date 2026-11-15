import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={TextDecoder,Uint8Array,console};context.window=context;
vm.runInNewContext(readFileSync(new URL('../metadata.js',import.meta.url),'utf8'),context);
function frame(id,value){const b=Buffer.from('\u0003'+value);const header=Buffer.alloc(10);header.write(id,0);header.writeUInt32BE(b.length,4);return Buffer.concat([header,b])}
test('ID3v2.3 tags preserve title, artist and album',()=>{const frames=Buffer.concat([frame('TIT2','Sigma Theme'),frame('TPE1','Original Composer'),frame('TALB','Origin HeartGold')]);const header=Buffer.alloc(10);header.write('ID3');header[3]=3;let n=frames.length;for(let i=9;i>=6;i--){header[i]=n&0x7f;n>>=7;}const meta=context.SigmaMetadata.parseID3(Buffer.concat([header,frames]));assert.equal(meta.title,'Sigma Theme');assert.equal(meta.artist,'Original Composer');assert.equal(meta.album,'Origin HeartGold')});
test('no embedded metadata falls back gracefully',()=>{assert.equal(Object.keys(context.SigmaMetadata.parseID3(Buffer.from('not id3'))).length,0);assert.equal(Object.keys(context.SigmaMetadata.parseFLAC(Buffer.from('not flac'))).length,0)});
