import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';

const base = new URL('../supabase/migrations/', import.meta.url);
const archived = new URL('../docs/legacy_migrations/', import.meta.url);

// These existing migrations may remain active to match an existing Supabase
// schema_migrations history. Never delete/rename them just to satisfy CI.
const historical = [
  '20261114_public_release.sql',
  '20261114_qc7_validation_quota.sql',
  '20261115_lock_down_internal_rls_event_trigger.sql',
  '20261115_sseq_only.sql',
  '20261115_upload_pipeline_permissions.sql',
  '20261115_validation_claim_lease.sql',
];
const latest = [
  '20261116220000_song_deletion.sql',
  '20261116221000_distinct_sseq_submissions.sql',
];

test('New migrations have sortable 14-digit versions; historical SQL stays intact', () => {
  const files = readdirSync(base).filter(x => x.endsWith('.sql')).sort();
  const newFiles = files.filter(x => !historical.includes(x));
  assert.deepEqual(newFiles, latest, 'Unexpected new migration or missing new migration');
  const versions = newFiles.map(x => x.slice(0, 14));
  assert.ok(versions.every(v => /^\d{14}$/.test(v)));
  assert.equal(new Set(versions).size, newFiles.length);

  const legacy = readdirSync(archived).filter(x => x.endsWith('.sql'));
  assert.ok(legacy.includes('20261116_inline_sseq_publication.sql'));
  assert.ok(legacy.includes('20261115_validation_claim_lease.sql'));
  for (const name of historical) {
    assert.ok(legacy.includes(name), `Historical migration not archived: ${name}`);
    // If still part of an active migration history, ensure it has not drifted.
    if (files.includes(name)) {
      assert.deepEqual(
        readFileSync(new URL(name, base)),
        readFileSync(new URL(name, archived)),
        `Historical migration differs from archived copy: ${name}`
      );
    }
  }

  const deletion = readFileSync(new URL(latest[0], base), 'utf8');
  const distinct = readFileSync(new URL(latest[1], base), 'utf8');
  assert.match(deletion, /ADD COLUMN IF NOT EXISTS deleted_at/);
  assert.match(distinct, /DROP INDEX IF EXISTS public\.theme_tracks_sha_slot/);
  assert.match(distinct, /Hourly upload limit reached \(30 per IP\)/);
  assert.match(distinct, /Daily upload limit reached \(100 per IP\)/);
  assert.match(distinct, /Global daily upload capacity reached \(500\)/);
});
