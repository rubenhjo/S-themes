import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,parseMetadataCSV} from '../lib/csv.js';
test('ST-018 RFC CSV metadata tolerates BOM, quoted commas, escaped quotes, multiline UTF-8',()=>{
 const map=parseMetadataCSV('\uFEFFfilename,title,artist,album\r\n"my,song.wav","Hello,\nworld","Ar""tist","Élan"\r\nregular.mp3,Song,Me,Demo\r\n');
 assert.equal(map.get('my,song.wav').title,'Hello,\nworld');
 assert.equal(map.get('my,song.wav').artist,'Ar"tist');
 assert.equal(map.get('my,song.wav').album,'Élan');
 assert.equal(map.get('regular.mp3').title,'Song');
});
test('ST-018 invalid quotes/rows, duplicate names, missing headers fail closed',()=>{
 assert.throws(()=>parseCSV('a,b\n"unterminated,hello'),/Unterminated/);
 assert.throws(()=>parseCSV('a,b\nvalue'),/mismatch/);
 assert.throws(()=>parseMetadataCSV('title,artist\nOne,Me'),/filename/);
 assert.throws(()=>parseMetadataCSV('filename,title\na,1\na,2'),/Duplicate filename/);
 assert.throws(()=>parseCSV('name,title\na"b,abc'),/Unexpected quote/);
});
