import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {readFileSync} from 'node:fs';
import {boundedBytes} from '../lib/stream-limit.js';

const root=new URL('../',import.meta.url);
test('ST-043 trusted worker enforces byte cap even without Content-Length',async()=>{
 let bytes=0;
 const sink=new Writable({write(part,encoding,cb){bytes+=part.length;cb();}});
 await assert.rejects(
  pipeline(Readable.from([Buffer.alloc(10),Buffer.alloc(10),Buffer.alloc(1)]),boundedBytes(20),sink),
  e=>e.code==='AUDIO_OBJECT_TOO_LARGE'
 );
 assert.equal(bytes,20);
 const worker=readFileSync(new URL('scripts/validate-pending.mjs',root),'utf8');
 assert.match(worker,/pipeline\(Readable\.fromWeb\(r\.body\),boundedBytes\(MAX_UPLOAD_BYTES\),createWriteStream\(filename\)\)/);
});
test('ST-043 exact cap succeeds, so valid uploads are not rejected',async()=>{
 let bytes=0;
 await pipeline(Readable.from([Buffer.alloc(10),Buffer.alloc(10)]),boundedBytes(20),new Writable({write(chunk,enc,cb){bytes+=chunk.length;cb()}}));
 assert.equal(bytes,20);
});
test('ST-042 PostgreSQL claim fencing protects both publish and reject',()=>{
 const sql=readFileSync(new URL('docs/legacy_migrations/20261115_validation_claim_lease.sql',root),'utf8');
 const worker=readFileSync(new URL('scripts/validate-pending.mjs',root),'utf8');
 assert.match(sql,/validation_claim_id=pg_catalog\.gen_random_uuid\(\)/);
 assert.match(sql,/r\.validation_claim_id IS DISTINCT FROM p_claim_id/);
 assert.match(sql,/status='processing' AND validation_claim_id=p_claim_id/);
 assert.match(sql,/DROP FUNCTION public\.reject_theme_validation\(uuid,text\)/);
 assert.match(sql,/DROP FUNCTION public\.publish_theme_upload\(uuid,text,text,text,text,numeric,text,numeric,numeric\)/);
 assert.match(worker,/current\?\.\[0\]\?\.validation_claim_id!==row\.validation_claim_id/);
 assert.equal(worker.match(/p_claim_id:row\.validation_claim_id/g)?.length,2);
});

import {adminUploadOutcome} from '../lib/admin-recovery.js';
test('ST-044 uncertain or queued admin import never authorizes destructive cleanup',()=>{
 const hash='d'.repeat(64);
 assert.equal(adminUploadOutcome(null,hash),'unknown');
 assert.equal(adminUploadOutcome({status:'pending',sha256:'a'.repeat(64)},hash),'unknown');
 for(const status of ['validating','processing'])
  assert.equal(adminUploadOutcome({status,sha256:hash},hash),'queued');
 assert.equal(adminUploadOutcome({status:'published',sha256:hash},hash),'published');
 assert.equal(adminUploadOutcome({status:'pending',sha256:hash},hash),'fail-first');
 assert.equal(adminUploadOutcome({status:'failed',sha256:hash},hash),'delete');
 const script=readFileSync(new URL('scripts/admin-import.mjs',root),'utf8');
 assert.ok(script.indexOf("if(outcome==='queued')")<script.indexOf('await storageDelete(objectPath)'));
 assert.match(script,/Atomically transition out of pending BEFORE deleting bytes/);
});
