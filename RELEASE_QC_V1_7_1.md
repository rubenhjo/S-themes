# sigma-themes v1.7.1 — song deletion QC

## Changes from v1.7.0

| File | Change | Reason |
| --- | --- | --- |
| `app.js` | Add Delete song action to track menu, explicit confirmation, uploader receipt storage, optional admin key form and local-reference cleanup | Delete published songs securely without login; keep personal playlist deletion distinct |
| `api/song-delete.js` | Server-only authenticated tombstone + Storage removal endpoint | Prevent anonymous deletion of arbitrary catalog rows |
| `lib/song-deletion.js` | Constant-time admin token check, strict object-path validation, retryable Storage delete and DB confirmation | Reject invalid credentials and prevent accidentally deleting unrelated objects |
| `api/cleanup.js` | Retry tombstoned song objects during existing secret-protected cron | Storage failures must not re-publish removed songs |
| `api/catalog.js`, `api/audio.js` | Filter `deleted_at IS NULL` | Removed songs cannot be browsed or downloaded by ID |
| `supabase/migrations/20261116_song_deletion.sql` | Columns, RLS policy, service-role-only RPCs, conservative storage accounting | Atomic visibility removal, least privilege, idempotent cleanup |
| `.env.example`, `SONG_DELETION.md` | Administrator key setup and deletion workflow | Explicit operator configuration and safe rollout |
| `tests/song-deletion.test.js`, `tests/browser_song_deletion.py` | API, security, cleanup and UI regression tests | Prevent accidental anonymous deletion and collateral hash-based deletion |
| `package.json`, `package-lock.json`, CI, release checker | Version update, JS syntax checks, new browser suite | Reproducible CI and release structure |

## Local results

- `npm ci`: PASS.
- `npm run verify` (includes lint, complete Node tests, release file check and Sigma Dex example validation): PASS, **143/143 Node tests**.
- `tests/browser_song_deletion.py`: PASS both owner and admin UI flows in mocked Chromium; identical-hash second track preserved.
- `tests/browser_midi_five.py`: PASS (five MIDI files, five program choices, one SSEQ).
- `tests/browser_hg39_catalog.py`: PASS (all 39 banks).
- `tests/browser_sseq_player.py`: PASS.
- `tests/browser_upload_recovery.py`: PASS.
- `tests/independent_sseq_reader.py`: Not run for this change; SSEQ generation unchanged from v1.7.0.

## Not tested

- **Real Supabase SQL migration**, RLS, storage and automatic cron execution: **NOT TESTED** without project owner approval and configured credentials.
- **Live Vercel deployment** and administrator token provisioning: **NOT TESTED**.
- iOS/Safari delete UI: **NOT TESTED** on physical devices.
- Full browser regression matrix: **NOT TESTED** in this release turn; the five listed targeted suites passed.

No published songs, production database rows, Storage objects or real secrets were changed during this local build. Original Nintendo samples, private audio and credentials are not included in this release package.
