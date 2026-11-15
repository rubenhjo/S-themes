# sigma-themes v1.3.0 — technical QC report (2026-11-15)

**Implementation:** Updated the existing GitHub/Vercel project, not the standalone 3-song demo. Main product requirements retained: unauthenticated public music catalog/upload behind server functions, Supabase, personal playlists/favorites, Realtime, normalisation, and original DS audio exporter. New Sigma Dex export is an additional feature. No edits were made to Sigma Dex, Origin HeartGold, or hg-engine.

## New implementation audited

- **ST-045 VERIFIED (local):** New browser export produces one ZIP in the documented `sigma-themes/sigma-dex-music-pack` v1 format, including recursive folders, complete manifest/tracks/folders, checksums, IMA-ADPCM WAVs and CRC validation. The independent CLI validator and synthetic example work. The receiver is not yet implemented.
- **ST-046 VERIFIED (local):** Browser UI creates folders/subfolders and allows song placement, editing title/artist/event ID, and selecting multiple folders for exact export. Folder state and export metadata are stored locally and included in personal backup; this deliberately **does not** give anonymous write rights to Supabase.
- **ST-047 VERIFIED (local):** DS encoder supports custom loop points and writes adjusted sample indices to `smpl`; the manifest reports actual encoded sample positions. Sample audio was checked with FFmpeg/FFprobe.
- **ST-048 VERIFIED (local):** Removed screenshot-derived images from the production repo and linked to 17 genuine Sigma Dex sprite resources in 24 background positions. Source image URLs checked externally; Chromium placement test uses synthetic pixels. UI remains accessible, animated and responsive.
- **ST-049 OPEN:** ZIP32 single-file limit (<4 GiB), decoder resource usage, very large libraries and physical device performance remain limitations; one complete file is used rather than falsely treating split archives as one package.
- **ST-050 OPEN:** Shared cross-device folders are not supported. Personal folders are persistent in one browser and exported intact; a moderated shared-folder write API would require separate secure server changes.

**Test results:** 71/71 Node tests, 8/8 Chromium suites, 3/3 FFprobe/FFmpeg synthetic WAVs and example ZIP validator PASS in local environment. Details and caveats in `TEST_RESULTS.md`. Source code, SQL migrations, serverless API routes, public upload security, GitHub Actions and prior issues are preserved. No production deployment or real Sigma Dex ingestion has been tested.

---

## Archived QC7 v1.2.1 report (historical, not current release status)

Date: 2026-11-14. Base: prior v1.1.0 `sigma-themes-vercel.zip` with 36/36 Node tests. Original QC7 candidate: **v1.2.0**; current independent recheck candidate: **v1.2.1**. This report describes changes tested locally, **not a production certification**.

## Principal findings and actual fixes

| Issue | Root cause | Files changed | Evidence | Status |
|---|---|---|---|---|
| ST-030 | `/api/catalog` requested 2000 rows once despite PostgREST default 1000 response cap | `api/catalog.js` | keyset pagination mocked with server 1000 cap for 0,1,999,1000,1001,1500, new insertion, duplicate | VERIFIED (local) |
| ST-034 | `sniff()` accepted ID3 magic even if remaining file was junk | `api/upload-finish.js`, `scripts/validate-pending.mjs`, `lib/media-validation.js`, migration, worker workflow | valid MP3/WAV and corrupt/mislabeled ID3/media rejected in FFmpeg/FFprobe tests; full staging publish NOT TESTED | FIXED – NOT VERIFIED |
| ST-035 | Reserving by number rather than shared bytes | New SQL migration, `admin-import.mjs` | atomic locking & accounting examined by static Node test; DB parallel transaction NOT TESTED | FIXED – NOT VERIFIED |
| ST-036 | Unexpected `JSON.parse` failure became 502 | `lib/common.js`, `api/upload-start.js`, `api/upload-status.js` | four POST endpoints return 400 for malformed JSON in Node tests | VERIFIED (local) |
| ST-037 | Local upload receipt reused without server-status verification | `app.js`, `api/upload-status.js` | actual browser flow: old failed receipt ignored, new reservation used | VERIFIED (local) |
| ST-038 | Manually copied issue totals in documents | `issue-stats.mjs`, `check-known-issues.mjs`, README/ledger | `npm run verify` validates all IDs, entries, statuses and synchronized QC marker | VERIFIED (local) |
| ST-039 | Owner CLI bypassed public byte budget | `scripts/admin-import.mjs`, migration | syntax / static validation; real admin import NOT TESTED | FIXED – NOT VERIFIED |
| ST-040 | GitHub scheduled validator can be delayed | `.github/workflows/audio-validator.yml` | no live worker deployment available | OPEN |
| ST-041 | Other Storage buckets excluded from app byte accounting | Migration/readme | conservative default; actual external storage usage NOT TESTED | OPEN |

## Additional independent review

- In `api/upload-finish.js` uploaded files now become **pending** (HTTP 202) until trusted, full FFmpeg decode. Source bytes remain private and unpublished. Browser polls a scoped `/api/upload-status` receipt; success is never asserted at upload-finish.
- `scripts/validate-pending.mjs` runs in GitHub Actions with secret credentials and FFmpeg/FFprobe. It atomically claims work, validates, then calls a restricted SQL publish RPC; invalid files are marked failed and their objects removed. Failed and expired reservations are cleaned with reserved bytes released only after object deletion.
- `admin-import.mjs` now follows the same byte quota and trusted publication process; the service key is never embedded in browser code.
- `api/catalog.js` pages at 500 rows using `created_at DESC, id DESC`, with stable cursor and duplicate detection. A concurrent newer insert is seen on the next refresh rather than causing an offset shift.
- `api/upload-cancel.js` now supports queued/processing cancellation; a canceled upload cannot be republished because the worker RPC requires `processing` under a row lock.
- No changes were made to the UI's Sigma palette or pixel sprites; the existing responsive layout and local playlists remain.

## Blocking conditions before public production approval

1. **Database migration, RLS, quota and concurrent writes against live Supabase** have not been executed. Validate SQL/Storage permissions on staging with multiple concurrent users.
2. **Real GitHub Actions validator** has not run with repository secrets. Scheduled validation can be delayed or skipped (ST-040). Launch is not recommended until a working trusted worker is observed.
3. **Live Turnstile and TUS** flows need staging and unstable-network tests.
4. **Memory and large archive exports** require realistic multi-gigabyte/mobile tests.
5. **Actual Origin HeartGold streaming hook and sound mapping** are absent from the available Sigma source. This ZIP remains a DS audio asset export, not a playable mod/patch (ST-010).
6. **Signed audio URL expiry during long playback** not reproduced against actual Supabase.

## Test environment and limitations

Local Node and FFmpeg/FFprobe; Chromium via Playwright at 390/768/1440/1920 where individual tests cover those viewports. Browser API/data mocks **do not** certify Supabase/Vercel. Tests and their exact commands are in `TEST_RESULTS.md`; the all-in-one browser suite was run repeatedly, but an intermittent prior hang remains documented until CI confirms stability (ST-033).

## QA issue statistics — generated

The authoritative data is `KNOWN_ISSUES.md`; this machine-checked summary must match it.

<!-- ISSUE_STATS {"total":50,"counts":{"OPEN":{"P0":0,"P1":3,"P2":6,"P3":0},"IN PROGRESS":{"P0":0,"P1":0,"P2":0,"P3":0},"FIXED – NOT VERIFIED":{"P0":0,"P1":5,"P2":0,"P3":0},"VERIFIED":{"P0":2,"P1":14,"P2":10,"P3":2},"BLOCKED":{"P0":2,"P1":4,"P2":2,"P3":0},"WONTFIX":{"P0":0,"P1":0,"P2":0,"P3":0}}} -->
