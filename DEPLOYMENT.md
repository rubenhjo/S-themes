# v1.7.5 addendum — 17 November 2026

The five-minute QA is a **local-only** change, derived from the complete v1.7.4 source. On 2026-11-17, the public `rubenhjo/S-themes/main/package.json` still exposed version **1.3.0** from web reading, so this release is **not merged/deployed**. Full `git clone` or SHA comparison was blocked in this runtime by DNS. Before uploading, compare against current `main`; use a feature branch/PR rather than overwriting unknown updates. No existing music, IDs, playlists, folders, and Supabase records were modified. Keep the existing full staging-first migration and Vercel/Turnstile plan below, and do not apply production SQL without a verified backup and staging pass.

The browser runs a 300-second 44.1 kHz stereo WAV and MP3 through the actual local transcriber Worker and arranger. Browser-based test uploads use **mocked backend**, not public Turnstile/Supabase. Tests must be repeated on a real iPhone before claiming mobile compatibility. The final validated SSEQ remains capped at 65,536 bytes even for long, dense audio. See `FIVE_MINUTE_QC.md` and `TEST_RESULTS.md`.

---

## v1.7.4 — safe deployment delta (no live changes performed)

1. Fetch the actual HEAD of `rubenhjo/S-themes` in an authorized network-enabled GitHub checkout and diff every changed file against this complete source ZIP; do not blindly overwrite new upstream files. Include `.github/workflows`, `tests/`, `supabase/` and `docs/` in the merge.
2. Local: `npm ci && npm run verify && npm run test:sseq && python tests/independent_sseq_reader.py && python tests/run_browser_tests.py`. The source ZIP contains no original ROM, SBNK/SWAR, private M4A, administrator secrets, or real `.env`.
3. Back up the existing Supabase database and private Storage **before** any migration. Current connected prod is the only available Supabase project, so it has intentionally NOT been touched. Create an isolated clone with representative, non-sensitive tracks/objects and the latest **deployed** schema. Preserve the already recorded Supabase migration history; do not automatically replay `docs/legacy_migrations/` as fresh migrations. Archived scripts are retained as historical source/reference and unit-test fixtures.
4. Active staged pending migrations with distinct 14-digit sortable versions: **`supabase/migrations/20261116220000_song_deletion.sql`**, **`supabase/migrations/20261116221000_distinct_sseq_submissions.sql`**. Apply in that order to the isolated clone, verify permissions, RLS, `deleted_at`, `storage_deleted_at`, unique `id` and non-unique `(sha256,sseq_id)`, and confirm quotas 30/h/IP, 100/day/IP, 500/day/global. Critically, test old records still visible/playable before proceeding. These files are NOT a baseline for creating a new blank Supabase instance.
5. Deploy a Vercel Preview pointed exclusively at the isolated Supabase clone, with Cloudflare Turnstile staging keys and server-only Supabase/admin secrets; ensure `NEXT_PUBLIC_*` exposes no privileged key. Retain the automated `verify-queued-sseq`/`sigma-verify-queued-songs` fallback, not a manual GitHub Action.
6. Test in two browser sessions: separate WAV/MP3 anonymous submissions, confirmation+automatic publish, measured visibility latency, interruption after PUT/retry with one ID, separate same-hash same-slot IDs and receipts, invalid owner token, correct tombstone and Storage deletion, old signed URL after 60 sec, recovery after temporary storage failure, rate limit HTTP 429, playlist effects. Only after a documented staging PASS may an authorized owner schedule a backed-up production migration and deploy.
7. On physical Safari iPhone, test first Play, pause during load, resume, next song. In a lawfully available private HeartGold US setup, import the SSEQ for slot 1028 bank 702 with waves 700/702, hear at least two loop rounds and six simultaneous notes. Test Sigma Dex native importer separately. All of these are NOT TESTED here.

---

## v1.7.3 rollout — staging required; NO LIVE CHANGES MADE

1. Before touching production, clone current GitHub HEAD in a network-enabled environment; compare it with **all files in this extracted 1.7.3 ZIP**. The project HEAD was unavailable from this runtime, so do not overwrite unknown upstream changes. Keep existing song IDs, Supabase tables and storage, public media, playlists/folders and sprites. Make a reviewed feature branch/PR.
2. `npm ci && npm run verify && python tests/independent_sseq_reader.py && python tests/browser_polyphonic_filepicker.py` on the extracted source. Test external ndspy after `pip install ndspy==4.2.0` with internet; if it fails, leave external parser unverified.
3. Back up the **live database** and make a truly isolated Supabase staging project, with a schema equivalent to live (including `theme_tracks`, `theme_uploads`, RPCs, storage). Seed non-sensitive demo records. Preview must point exclusively at staging. **Do not run migrations on live before this test passes.**
4. Apply outstanding earlier migrations in dependency order, including `supabase/migrations/20261116_song_deletion.sql` and `supabase/migrations/20261116_distinct_sseq_submissions.sql`. Read both diffs and actual installed schema before applying. The migration removes the unique `(sha256,sseq_id)` index and old global hash duplicate gate while keeping ID-based reservation protection and quotas 30/100/500. In staging assert `deleted_at` and `storage_deleted_at` exist and only the intended RPC roles can call privileged helpers.
5. Set Vercel server-only Supabase/Turnstile secrets and administrator token on isolated Preview, configure Cloudflare test site keys, then run `python tests/staging_smoke.py` against it. Through true two-browser workflows test WAV/MP3 uploads, server validation, automatic queue recovery without manual GitHub Action, 30/100/500 limits, cancellation/retries, two independent same-byte and same-slot IDs, different slots, owner/admin deletion, bad receipt rejection, 60s signed-link expiry, blob GC and idempotent retry. Measure actual submitted-to-published wall time. No live stage exists in this runtime, so these are **NOT TESTED**.
6. Only after passing staging, back up current production again, plan migration downtime/rollback, deploy reviewed code, run non-destructive smoke tests, and report commit SHA/production version. No deploy or live DB mutation has occurred in this deliverable.

**API security**: Never put service role token or deletion admin key in client code or release ZIP. Do not disable RLS or bypass Turnstile. A previously issued signed storage URL can remain valid until its actual expiry even when catalogue tombstone is immediate; test that exact expiry after 60 seconds in staging rather than promising instant revocation of signed links.

---

# DEPLOYMENT — sigma-themes v1.7.2 audio QC release candidate

This ZIP is a **complete codebase**, not an already deployed update. No secret credentials, Nintendo samples, private recordings or live database snapshots are included.

## Recommended deployment sequence

1. Back up the current GitHub main and create a PR/feature branch for these exact ZIP files. Preserve current songs, IDs, storage objects, sprites, playlists and metadata. Do not overwrite the live site as a troubleshooting shortcut.
2. `npm ci && npm run verify && python tests/independent_sseq_reader.py && npm run test:browser`. Review `AUDIO_BENCHMARK.md` and `OPEN_ISSUES.md`; synthetic improvements do not imply finished music-quality approval.
3. Clone the **current** Supabase project into an isolated staging project, including schema, seed values and representative synthetic SSEQ objects. Create a database backup BEFORE applying a migration, and store backups outside this repo. Validate the staging copy has no real user-sensitive/private objects.
4. Apply **only missing** migrations in order and review SQL diffs. Live project inspection on 2026-11-16 found five tracked migrations (upload-privilege repair, internal RLS lockdown, 30/100/500 quota change, verified publication and queued-song recovery). It did **NOT** contain `20261116_song_deletion.sql` and `public.theme_tracks` lacked `deleted_at` and `storage_deleted_at`. Do not assume deletion works on production until these are installed and independently tested.
5. In staging verify private Storage buckets and proper RLS/data API grants. Ensure anonymous clients can never invoke admin delete, internal publication or storage-management operations. Do not publish service-role secrets in any `NEXT_PUBLIC_`/front-end field. Check Turnstile server verification is enabled and configured with correct domain.
6. Configure Vercel Preview to point to staging using server-only keys, a distinct public Supabase key, private storage and optional `SONG_DELETE_ADMIN_TOKEN`. The admin token belongs **only** in Vercel server environment. Never paste it into repo history. Install a scheduled cleanup/validation fallback and test that a queued song cannot remain indefinitely without a readable state.
7. Run real end-to-end tests in staging: anonymous SSEQ upload, verified publication, second anonymous browser, download and delete. Specifically test owner proof, incorrect proof, admin proof, duplicate content with distinct song IDs, canceled/retried uploads, rate limits 30/hour/IP, 100/day/IP, 500/day global, storage tombstones and cleanup retry. Validate old audio links are inaccessible after deletion and allow cache expiry. API signed URL expiry for audio has been shortened to 60 seconds but already-issued storage links may remain accessible until expiry; set appropriate response cache headers.
8. Run a real legal HeartGold and Sigma Dex compatibility test with sample/game data kept private, and complete human-verified music transcription benchmarks before claiming full user-facing music accuracy.
9. Only after all gates pass, merge the PR and publish Vercel production. Verify canonical `sthemes.vercel.app` and redirect alias `s-themes.vercel.app`, public catalog and private storage download, uploads, deletion and iOS Safari.

## Environment, safety, migrations

Use `.env.example` for variable names; copy as **environment variable definitions only**, not their values. Required secrets depend on your private Vercel/Supabase deployment; never store them in the repository. The upload flow uses authenticated server-side SSEQ validation, Turnstile and private Storage; preserve that trust boundary. The public SSEQ cap is 65,536 bytes. Review `supabase/migrations/` and existing schema before deployment; a migration file in the ZIP is not a deployed database change.

Read-only Supabase review found RLS enabled on all three current `public.theme_*` tables. Security advisor reported informational `rls_enabled_no_policy` findings on two server-internal tables, not proof of a vulnerability. Recheck advisor findings after migration. **No SQL writes, data deletion or staging deployments were performed in preparing this ZIP.**

## Gate status

- **PASS LOCAL**: source layout, syntax, unit tests, deterministic audio benchmark, browser regression, private bank import and sample playback route.
- **NOT TESTED**: live Vercel/Turnstile/Supabase lifecycle, physical iOS device, lawful HeartGold ROM/emulator, live Sigma Dex integration, audio equivalence to DS.
- **BLOCKING**: production lacks song-deletion migration; complex music transcription remains unreliable without validated, annotated real-music benchmark.
