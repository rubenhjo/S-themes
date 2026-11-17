import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=rel=>readFileSync(new URL(rel,import.meta.url),'utf8');
test('Staging migration allows distinct SHA+slot identities while retaining quota and authorization guards (STATIC only)',()=>{
 const sql=source('../supabase/migrations/20261116221000_distinct_sseq_submissions.sql');
 assert.match(sql,/DROP INDEX IF EXISTS public\.theme_tracks_sha_slot/i);
 assert.match(sql,/CREATE INDEX IF NOT EXISTS theme_tracks_hash_slot_lookup\s+ON public\.theme_tracks\(sha256,sseq_id\)/i);
 assert.doesNotMatch(sql,/CREATE UNIQUE INDEX[^;]*\(sha256,sseq_id\)/i);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.reserve_theme_upload_for_slot/i);
 assert.doesNotMatch(sql,/Duplicate audio checksum|WHERE sha256\s*=\s*p_sha256/i);
 assert.match(sql,/INSERT INTO public\.theme_uploads\(id,secret_hash,sha256/i);
 for(const threshold of [30,100,500]) assert.match(sql,new RegExp('>='+threshold+'\\s+THEN','i'));
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.reserve_theme_upload_for_slot[^;]*FROM PUBLIC,anon,authenticated/i);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.reserve_theme_upload_for_slot[^;]*TO service_role/i);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;/);
});
