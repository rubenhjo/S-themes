import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
const base=new URL('../supabase/migrations/',import.meta.url);
const archived=new URL('../docs/legacy_migrations/',import.meta.url);
test('New database migrations have distinct sortable 14-digit versions and preserve historical SQL',()=>{
 const files=readdirSync(base).filter(x=>x.endsWith('.sql')).sort();
 assert.deepEqual(files,[
  '20261116220000_song_deletion.sql',
  '20261116221000_distinct_sseq_submissions.sql'
 ]);
 const versions=files.map(x=>x.slice(0,14));
 assert.ok(versions.every(v=>/^\d{14}$/.test(v)));
 assert.equal(new Set(versions).size,files.length);
 const legacy=readdirSync(archived).filter(x=>x.endsWith('.sql'));
 assert.ok(legacy.includes('20261116_inline_sseq_publication.sql'));
 assert.ok(legacy.includes('20261115_validation_claim_lease.sql'));
 const deletion=readFileSync(new URL(files[0],base),'utf8');
 const distinct=readFileSync(new URL(files[1],base),'utf8');
 assert.match(deletion,/ADD COLUMN IF NOT EXISTS deleted_at/);
 assert.match(distinct,/DROP INDEX IF EXISTS public\.theme_tracks_sha_slot/);
 assert.match(distinct,/Hourly upload limit reached \(30 per IP\)/);
 assert.match(distinct,/Daily upload limit reached \(100 per IP\)/);
 assert.match(distinct,/Global daily upload capacity reached \(500\)/);
});
