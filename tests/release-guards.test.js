import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const file=relative=>readFileSync(fileURLToPath(new URL(relative,import.meta.url)),'utf8');
test('Canonical Vercel redirect matches only alias host and preserves destination path',()=>{
 const v=JSON.parse(file('../vercel.json'));
 const entry=v.redirects.find(r=>r.destination==='https://sthemes.vercel.app/:path*');
 assert.ok(entry);assert.equal(entry.source,'/:path*');assert.equal(entry.permanent,true);
 assert.deepEqual(entry.has,[{type:'host',value:'s-themes.vercel.app'}]);
});
test('One-click SSEQ publication migration retains claim fencing, limits and storage hash lookup',()=>{
 const sql=file('../docs/legacy_migrations/20261116_inline_sseq_publication.sql');
 for(const expr of [/v_count>=30/,/v_count>=100/,/v_count>=500/,/CREATE INDEX IF NOT EXISTS theme_tracks_hash_lookup/i, /DROP CONSTRAINT IF EXISTS theme_tracks_sha256_key/i, /validation_claim_id=pg_catalog\.gen_random_uuid\(\)/i, /GRANT EXECUTE ON FUNCTION public\.claim_theme_validation_for_upload\(uuid,text\) TO service_role/i, /REVOKE ALL ON FUNCTION public\.claim_theme_validation_for_upload\(uuid,text\) FROM PUBLIC,anon,authenticated/i]) assert.match(sql,expr);
 const finish=file('../api/upload-finish.js');assert.match(finish,/await checkObject\(row,slot\)/);assert.match(finish,/claim_theme_validation_for_upload/);assert.match(finish,/publish_theme_upload/);
});
