# sigma-themes v1.5.0 QC upgrade — 16 November 2026

## Release scope and provenance

This is a **complete source replacement ZIP**, not a patch and not a production deployment. It was built from the latest locally accessible complete archive `sigma-themes-ios-audio-full.zip` (15 November). The current GitHub main commit / actual Vercel deployment was **not** checked out into the build environment; do not interpret the package version as a Git commit or as already live.

Preserved: anonymous player/catalog, local playlists/folders, sprites, upload authentication/Turnstile, 64 KiB-only-SSEQ storage, Sigma Dex SSEQ-only ZIP pack, iOS AudioContext activation on the first tap, and `.github/workflows`.

## Improvements implemented

1. **Audio → SSEQ**: configurable *Melody only* or *Melody + audible chords*; raised candidate ceiling beyond four; improved harmonic rejection, repeated identical note onsets, and low-register bass tracking; a server-validated SSEQ review step offers **Final / Melody / Accompaniment** playback before any upload. Web Audio timbres remain approximations.
2. **Multiple MIDI files → one SSEQ**: select *Combine MIDI into one song*, choose a HeartGold instrument for each file, optionally override each MIDI track/channel, offset, scale velocity, mute or solo, and enter one title. Source tempo, time-signature-neutral elapsed time, leading pauses, and PPQ resolutions (480 and 960 tested) are converted to a shared 96-tick/s timeline. Simultaneous notes and distinct programs survive; a merged arrangement requires one reservation, PUT and publication. Multiple file uploads can still create separate songs.
3. **SSEQ format**: 16-track writer instead of 8; compatible source voices with one program can be packed polyphonically on one track, with no automatic `.slice(0,8)` voice dropping; global loop end is aligned for all tracks; 65,536-byte limit remains. Explicit incompatible locked instruments fail with source lane, offending pitch and allowed bank programs. An Auto fallback is returned as metadata, not a disguised General MIDI program.
4. **Publication**: `api/upload-finish` independently downloads the reserved, private Storage object, verifies SHA-256/byte size/slot/SSEQ and then **tries to publish during the same request** through a fenced Supabase claim. If interrupted or a server publication call fails, status stays pending and the scheduled validator can resume. Friends do not have to manually click a GitHub Action **after the migration is applied**. Client session recovery keys now include title and slot to support distinct songs whose SSEQ bytes match.
5. **Supabase quota and duplicate behavior**: migration `supabase/migrations/20261116_inline_sseq_publication.sql` changes public reservation limits to **30/hour/IP, 100/day/IP and 500/day globally**, removes globally unique `sha256` so two distinct songs can share bytes, retains a non-unique lookup index, and restricts the new publish-claim RPC to the `service_role` role. Existing rows are preserved. This migration is **NOT** automatically applied to your live Supabase project.
6. **Canonical host**: `vercel.json` conditionally issues an HTTP 308 redirect from `s-themes.vercel.app` to `sthemes.vercel.app` while keeping the same path/query, if both domains point at the Vercel project. Turnstile hostname must be the canonical host.

## Tests and evidence

| Test | Observed outcome | Scope |
| --- | --- | --- |
| Node `npm run verify` | 110/110 passed (final local release suite) | Local code, no live Supabase |
| Synthetic overtone melody, MIDI 57,59,62,64 | All four intended notes; zero additional harmonic pitches | Synthetic fixture, not original recording |
| Four repeated C4 | Four note-on events at expected pitches | Synthetic fixture |
| Low bass E2–G2–A2–E2 | Preserved | Synthetic fixture |
| Three-note chord after 350ms | Three simultaneous chord notes preserved | Synthetic fixture |
| Six simultaneous nonharmonic pitches | Six notes found | Synthetic fixture |
| Two MIDI files / 480+960 PPQ, two programs 0+1 | Distinct programs, overlapping notes | Node + independent Python SSEQ reader |
| 120/60 BPM, 1 beat at each tempo | 1.50 s elapsed | Node fixture |
| 9 tracks, 16 programs, global two-round loop | Passed Node tests | SSEQ writer/parser |
| Chromium combined-MIDI → preview → one SSEQ upload | 1 reservation / 1 PUT / 1 finish; correct programs | Mocked server/Supabase, not Vercel |
| Chromium WAV+MP3, worker and existing SSEQ | Passed separate browser tests | Synthetic files / mocked API |
| Sigma Dex example pack / independent SSEQ decode | Passed ZIP manifest and binary tests | Local test fixture |

**Not verified:** `Cute melody.m4a` and the cited 308-byte hosted file were not available as inspectable original bytes in this work environment, so no honest before/after note table, exact 3.18s/6.52s/7.36s A/B result or source-audio regression is reported. No physical iPhone/Safari test, live staging/production DB call, emulator/hardware HeartGold US playback, or actual Sigma Dex receiver import was run. The synthesized browser output **does not reproduce genuine SBNK/SWAR samples**: those private wave bytes were not accessible in this work and are intentionally not published. Complex vocals, percussion, overlapping harmonics and dense mixes may still generate incorrect notes. This release is a significant improvement, not a guarantee of transcription fidelity. Basic Pitch/pYIN and authentic private local bank-sample preview remain unimplemented.

## Install or update without corrupting the catalog

1. **Keep a copy of the existing GitHub repository and take a Supabase backup**, ideally work in a Vercel preview branch with a separate staging database. Do **not** delete the existing Supabase library or storage bucket.
2. Unzip this release ZIP, keeping root-level `index.html`, `app.js`, `.github/workflows`, `api/`, `lib/`, `scripts/`, `supabase/migrations/`, and `tests/`. A GitHub browser upload may cap files per commit: upload in batches of fewer than 100, preserving directory structure. `git add -A && git commit && git push` is easier when you have a Git client. Do not upload the ZIP itself as the deployed website.
3. In **staging Supabase SQL Editor**, first check whether the prior migrations through `20261115_upload_pipeline_permissions.sql` were applied. If not, apply earlier migration scripts *in ascending name/dependency order*, including `20261115_validation_claim_lease.sql` before the permission migration. Then apply **`supabase/migrations/20261116_inline_sseq_publication.sql`** once and confirm with the verification queries below. Do **not** blindly reapply historical migrations to production; older scripts can replace functions and re-enable old quotas.
4. In Vercel project settings check `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAME=sthemes.vercel.app`, `UPLOAD_HMAC_SECRET`, `CRON_SECRET`. Keep service keys and secrets server-side. The Cloudflare Turnstile site widget must authorize `sthemes.vercel.app`. Attach both Vercel domains to this same project for the alias redirect.
5. Deploy code and SQL as an orchestrated staging change, then upload a small binary SSEQ from an anonymous second browser. It should publish immediately (200) or report pending (202) and publish automatically via the fallback worker. Poll `/api/upload-status` with the upload receipt. Test public catalog visibility, download byte-for-byte equality, two different songs with the same SHA-256 in slot 1028, quota 429 behavior, slot mapping, playback, and exports. Only then promote to production.
6. Current `.github/workflows/audio-validator.yml` remains as **fallback**, not a manual prerequisite. Set its GitHub repo secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` if retaining the fallback. Never place ROMs, private `.sbnk`/`.swar`, recordings, or secret `.env` values in the public repo.

**Read-only SQL verification after the migration:**

```sql
SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc
WHERE pronamespace='public'::regnamespace
  AND proname IN ('reserve_theme_upload','claim_theme_validation_for_upload','publish_theme_upload');
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='theme_tracks';
SELECT COUNT(*) FROM public.theme_tracks;
```

### Commands

```sh
npm ci
npm run verify
python tests/browser_multi_midi.py
npm run test:browser
python tests/independent_sseq_reader.py tests/fixtures/combined_480_960.sseq
node scripts/create-sigma-dex-example.mjs
node scripts/validate-sigma-dex-pack.mjs examples/sigma-dex-example-music.zip
```

### Remaining release gates

1. Run the private `Cute melody.m4a` test and compare pitches/onsets to a **human-verified score**, not just to the old SSEQ. Record an explicit before/after table at 3.18, 6.52 and 7.36 seconds.
2. On a physical iPhone, test the very first Play, silent mode, pause mid-load, interruption recovery, skip and repeat. Browser Chromium with synthetic AudioContext mocks is not Safari hardware qualification.
3. In a lawful local HeartGold US copy and melonDS, inject SSEQ in slot 1028/bank702, retain wave archives 700/702, verify full two-loop playback, transitions and correct actual instrument timbre.
4. Run the **external** Sigma Dex importer on the generated v2 ZIP. Our ZIP validator is not proof that the current Sigma Dex repository accepts that format.
