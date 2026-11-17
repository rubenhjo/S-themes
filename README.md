# sigma-themes v1.7.5 — five-minute recording QA (local candidate)

- **Verified locally:** real browser import of **300-second 44.1 kHz stereo WAV (~52.9 MB)** and **300-second 44.1 kHz stereo MP3 (~7.2 MB)**, each with 150 independent known-pitch events and max measured 18.3 ms onset / 20.0 ms offset errors. Both result in one **1,091-byte validated SSEQ**, one mocked reservation/finish, no original WAV/MP3 upload. See `FIVE_MINUTE_QC.md`.
- **Long-song editor:** use 15-second editable/listening windows (`Forrige/Neste 15 s`, editable From/To); all notes across the 300-second source remain in the final SSEQ. Non-destructive preview options are unchanged. An 8,000-note synthetic edit model prepares in ~15 ms on the test machine after removal of an O(n²) overlap count.
- **Important limits:** 128 MiB source size, browser decoding and offline memory availability, 360-second duration cap, 65,536-byte final SSEQ cap, 8 candidate spectral voices, approximate transcription on complex music. This is **not** a guarantee that any arbitrary five-minute recording will fit or sound faithful. Five-minute import on a **physical iPhone**, production Vercel/Supabase/Turnstile, Sigma Dex importer, and actual HeartGold game are **NOT TESTED**. Nothing has been deployed and production songs/IDs/playlists are untouched.

---

# sigma-themes v1.7.4 — “Arranger sangen” release candidate (local only)

**Source basis:** v1.7.3 complete archive; current `rubenhjo/S-themes` main could not be fetched through the available network. No upstream branch, live Supabase data, existing songs/IDs/playlists/folders or Vercel deployment was modified. **Before deploying, compare this full source tree with an authenticated/current checkout.**

**New:** One-file Auto WAV/MP3/M4A review with up to five editable *parts* (not five simultaneous notes), per-part instrument/volume/support/mute/preview solo, per-onset note removal and undo, original-versus-SSEQ region A/B and separate listening/game loops. All submitted music files remain **validated ≤65,536-byte SSEQ only**. Existing five-MIDI arranger, 39 bank metadata, public player, playlists and song deletion code remain in the tree.

**Measured local synthetic timing:** known WAV/MP3 strict F1 74.5% → 100%; three additional uninfluenced synthetic references 61.1% → 88.9%; not verified on arbitrary recorded music. See [`ARRANGER_QC.md`](ARRANGER_QC.md) and [`ARRANGER_TIMING_RESULTS.json`](ARRANGER_TIMING_RESULTS.json).

**Do not deploy the two pending SQL migrations directly to production**. Historic SQL snapshots are retained in `docs/legacy_migrations/`; active staged migration versions are `20261116220000_song_deletion.sql` then `20261116221000_distinct_sseq_submissions.sql`. Install **only on an isolated clone with real tests first**, preserve already deployed migration history. See `DEPLOYMENT.md`. No source ZIP contains private M4A or Nintendo audio.

# sigma-themes 1.7.3 — chord-preservation / polyphonic QA candidate

**Source basis:** exact provided `sigma-themes-v1.7.2-audio-qc-complete.zip`. GitHub `rubenhjo/S-themes` HEAD could not be reached (DNS/network unavailable), so **no merge against remote HEAD is claimed**. The ZIP is a complete replacement source tree, not a small patch; compare with a current clone before deploying, and preserve your live Supabase rows, storage, IDs, playlists and sprites. This archive has **not** been deployed.

**New in 1.7.3:** Detect independent upper partials before classifying octave-related notes as harmonics, fixing reproduced 4-, 6- and 8-pitch chord losses; add reproducible Standard MIDI truth + WAV/MP3 source fixtures, strict onset/offset scoring, real file-picker Chromium conversion checks, independent stage-by-stage diagnostics, and a held-out benchmark. Run `npm run test:audio:polyphony` and see [`POLYPHONY_QC.md`](POLYPHONY_QC.md). WAV/MP3 remain inputs only; the public/export file is validated SSEQ only.

**Scope and outstanding issues:** Hard polyphony with staggered onsets / independent instruments is *not* reliable yet. Also contains a **staging-first, UNAPPLIED** migration for same-hash same-slot independent uploads. No Vercel Preview / separate staging DB, Turnstile end-to-end, actual HeartGold ROM, Sigma Dex application importer, physical iPhone, nor third-party ndspy parser were verified in this environment. No private Cute melody or Nintendo sources included. Read [`DEPLOYMENT.md`](DEPLOYMENT.md), [`OPEN_ISSUES.md`](OPEN_ISSUES.md), [`TEST_RESULTS.md`](TEST_RESULTS.md) and [`HEARTGOLD_COMPATIBILITY.md`](HEARTGOLD_COMPATIBILITY.md) before deployment.

---

# sigma-themes v1.7.2 — local audio quality / compatibility QC candidate

**Status: locally tested release candidate, not a certified production/HeartGold release.** This revision builds on v1.7.1 song deletion, preserves the 39 HeartGold instrument banks / 2,593 metadata program entries and five-MIDI arranger, and adds a measured, conservative spectral transcription refinement and shared original-PCM sample scheduling for instrument previews and finished SSEQ playback.

Start with **[QC_REPORT.md](QC_REPORT.md)**, **[AUDIO_BENCHMARK.md](AUDIO_BENCHMARK.md)**, **[HEARTGOLD_COMPATIBILITY.md](HEARTGOLD_COMPATIBILITY.md)**, **[OPEN_ISSUES.md](OPEN_ISSUES.md)**, **[TEST_RESULTS.md](TEST_RESULTS.md)** and **[DEPLOYMENT.md](DEPLOYMENT.md)** before using this as a public release.

Local tests show synthetic F1 80.37% → 90.38% (20 deterministic reference cases), **147/147 Node tests**, 21/21 Chromium suites, original local SBNK/SWAR import and shared PCM scheduling. Real-world musical accuracy, actual HeartGold DS playback, staging/production deletion and iPhone Safari **remain unverified**. No original Nintendo ROM/samples or private source music is distributed in this repository.

---

# sigma-themes v1.7.0-regression-repair — lokal QA-kandidat

**Kildekode er slått sammen og testet lokalt, men ikke deployet.** Start med [release-QC](RELEASE_QC_2026-11-16.md), [reell lydsammenligning](REAL_AUDIO_COMPARISON_2026-11-16.md) og [stagingplan](DEPLOY_V1_7.md). Alle 39 HeartGold-banker og 2 593 programoppføringer er bevart. Originale Nintendo SBNK/SWAR-filer leveres ikke med. MIDI-arrangøren støtter inntil fem separate filer og én SSEQ.

---

## v1.6.0 — Browse all 39 HeartGold banks

The instrument explorer is accessible on the main page via **“Browse 39 banks”**, and directly during MIDI upload. Each instrument has a short play button, factual sound-type label, editable personal nickname, and inspectable settings. With only the bundled metadata the audio is a synthesized preview; optionally import your matching **SBNK** and **SWAR** files locally (verified by SHA-256) for real PCM sample playback and original per-program envelope values. **No original game samples are included.** See [HEARTGOLD_39_BANK_CATALOG.md](HEARTGOLD_39_BANK_CATALOG.md).

> **NEW v1.5.1 (Nov 16, 2026):** Combine up to **five MIDI files** into one SSEQ. Every program in the selected HeartGold US instrument bank is visible as a choice for each file (68 choices in bank 702, plus Auto), including range-limited programs with clear validation warnings. You can optionally override instrument per track/channel. Real tempo maps and PPQ are preserved in time; up to 16 Nitro tracks; the browser timbre remains approximate. Full technical QC and outstanding production checks: [`RELEASE_QC_2026-11-16.md`](RELEASE_QC_2026-11-16.md).

> **Progress/health update from the uploaded S-themes-main source (2026-11-15):** animated decoding activity, measured note/upload percent, elapsed time, stall warnings and diagnostics. A bounded decoder wait and cooperative sample preparation improve cancellation responsiveness. See `PROGRESS_HEALTH_RELEASE.md`.

> **v1.4.4 CI update:** Browser-upload testing previously served HTML at the Worker JavaScript URL, making a secure-origin Chromium transcription fail spuriously. The test server now serves both actual Worker files; a separate offline Chromium Worker regression verifies the scripts independently. The release also distinguishes `Catalog unavailable` from `Connecting`. These changes do **not** configure Supabase or deploy the service for you. If the live page reports `Catalog unavailable`, inspect the Vercel logs for `/api/catalog`, verify the required environment variables and apply/test the SQL migrations in staging. A GitHub `Ready` deployment is not proof of a working database. See `TEST_RESULTS.md`.

# sigma-themes — SSEQ-only project (historical v1.4.4 description below)

A multi-file **GitHub → Vercel** app with an account-free shared Supabase catalog, personal playlists/favorites/folders, actual SSEQ playback with Web Audio and a single **Export to Sigma Dex** ZIP workflow. This is **not** the standalone Paperwave/3-song HTML demo.

## Production qualification — READ THIS FIRST

**This release is an experimental SSEQ-only integration, NOT production-validated.** Browser audio transcription uses a small untrained spectral multivoice estimator. Simple synthetic WAV/MP3 melodies become recognisable SSEQ notes; a synthetic three-note backing chord is partially recovered, but spurious notes remain and dense mixed/polyphonic songs are **not** reliably converted and no original HeartGold ROM/emulator playback has been demonstrated. Do not promise friends that every recording will become a musically faithful track. Staging Supabase, RLS and Cloudflare tests must be run before enabling public uploads. See `KNOWN_ISSUES.md` and `TEST_RESULTS.md`.

## Important deployment note

The GitHub repository may still be on the earlier **v1.3 WAV-export build** until these root files and subfolders are committed there; creating a ZIP here does not update Vercel. Unzip the archive before uploading code. GitHub browser upload has a 100-files-per-commit limit; this source archive has more than 100 files, so upload in at least two passes, preserving the directory structure. Never upload private HeartGold `.sbnk` / `.swar` assets or server secrets. See `DEPLOY_BROWSER_ONLY.md` for the exact browser workflow.

For **combined MIDI uploads**, every genuine instrument program in the selected bank appears in the instrument menu, not only programs compatible with every MIDI note. Non-compatible choices show a range warning and cannot be exported unchanged; users can select another program, edit their notes, or choose another slot/bank. Programs from a different bank cannot be referenced solely by an SSEQ that uses the current slot bank. For **single-audio-file transcription** the instrument dropdown is a **preference** for the lead voice. If the preferred program cannot sound every transcribed pitch but another program in the same target SBNK can, the converter now automatically selects that compatible program and says so. An absent alternative still causes a validation failure.

## How the product currently works

1. Open the public Vercel site (no account); choose **Target game music slot** and an instrument from the **metadata-only HeartGold US bank profile**. A slot maps to the original SDAT SBNK/SWAR resources.
2. Choose a supported source in the ordinary **Upload music** button: `.sseq`, `.mid` / `.midi`, or browser-decodable `.wav`, `.mp3`, `.flac`, `.ogg`, `.opus`, `.m4a`, `.aac`. The supported decode formats actually depend on the browser.
3. `.sseq` goes through a strict supported-command subset parser and is preserved byte-for-byte if accepted. MIDI is parsed and arranged to bank-valid note programs. Finished recordings are decoded **only in the user's browser**, transcribed approximately by FFT in a Worker (up to eight detected candidate voices in v1.7.5; not source separation) and converted to a real binary Nitro SSEQ. No user MIDI is required for the latter path. Some arrangements will be rejected if the result is empty, incompatible with chosen bank, or over 64 KiB.
4. Only **the generated/validated SSEQ bytes** are sent to private Supabase Storage, with an opaque scoped upload receipt, Turnstile and quota/rate limits. Serverless API validates size/SHA/header/SSEQ commands and queues publication. A trusted GitHub Actions validator verifies the full SSEQ and its HeartGold slot before it becomes public. Pending ≠ published.
5. Library audio API streams **the saved SSEQ bytes**, and the website uses `sseq_player.js` to synthesize their notes with Web Audio. The demo timbres are generic oscillator approximations; preview level OFF/QUIET/NORMAL/LOUD changes actual gain with a Web Audio compressor but is not LUFS-calibrated; the original proprietary Nintendo sample sounds are **not bundled**.
6. Organise personal folders/subfolders and playlists. Export selected songs/folders or all music using **Export to Sigma Dex**. Every `music/` file in the v2 ZIP is `.sseq`; the package includes bank/slot metadata and SHA-256 hashes. Individual `Download SSEQ` fetches the same stored bytes. No HeartGold WAV-pack UI exists.

**Browser resource limits:** SSEQ must be ≤64 KiB, MIDI ≤4 MiB, and source recordings ≤128 MiB and ≤360 s. Long recordings require a working Web Worker; source decoding failures show an explicit error instead of hanging the UI.

**Limitations:** Existing complex HeartGold SSEQ scripts may use commands outside the implemented strict subset. Web Audio's oscillator timbres are not an audition of actual SBNK/SWAR samples. The target game's US revision, bank index arrangement and actual audible fit must be tested in an authorised original HeartGold copy. The Sigma Dex receiver is future work outside this repository; do not claim the v2 pack can currently be imported there.

## Repository contents

- `index.html`, `app.js`, `client_core.js`, `metadata.js`, `sigma_dex_sprites.js` / `.css`: existing responsive UI, playlists, personal folders, sprites and controlled public flow.
- `sseq_codec.js`, `sseq_transcribe.js`, `sseq_transcribe_worker.js`, `sseq_player.js`: strict Nitro SSEQ writer/reader, approximate audio note estimator and Web Audio SSEQ playback.
- `heartgold_bank_profiles.json` / `.js`: **derived metadata only** for 362 US HeartGold music slots, 39 instrument banks; the original SBNK/SWAR bytes are not included.
- `scripts/build_bank_profiles.py`: regenerate profile **locally** with the privately provided HeartGold instrument ZIP (do not commit that ZIP or ROM files).
- `api/`, `lib/`, `supabase/migrations/`: Vercel API, Supabase private Storage/RLS, signed upload reservations and SSEQ publication worker.
- `scripts/admin-import.mjs`: private owner CLI for **already validated SSEQ only**; it does not yet transcribe owner WAV/MP3 inputs.
- `sigma_dex_export.js`, `scripts/create-sigma-dex-example.mjs`, `scripts/validate-sigma-dex-pack.mjs`, `examples/`: versioned SSEQ-only ZIP exporter, validator and synthetic three-song reference pack.
- `tests/`, `.github/workflows/`: repeatable code, browser, CI, and trusted background validation.

## GitHub and Vercel installation

1. Unzip `sigma-themes-vercel.zip` into the **root** of `rubenhjo/S-themes` (or a new test branch). Keep `.github/`, `api/`, `lib/`, `supabase/`, `scripts/`, tests and root files. Do not replace it with a standalone HTML file.
2. Run `npm ci && npm run verify`. Node.js 20+ required. There is no npm build step; Vercel deploys static files + `api/*.js` functions as `Framework: Other`.
3. Create a **separate Supabase project** for sigma-themes. On a staging project first, apply SQL in chronological order:
   - `supabase/migrations/20261114_public_release.sql`
   - `supabase/migrations/20261114_qc7_validation_quota.sql`
   - `supabase/migrations/20261115_validation_claim_lease.sql`
   - `supabase/migrations/20261115_sseq_only.sql` (**SSEQ-only reservation/worker/Storage cap + direct-anon RLS filter**).
   - `supabase/migrations/20261115_upload_pipeline_permissions.sql` (**explicit service_role permissions, no anonymous uploads**).
   Verify with `supabase/VERIFY_PRODUCTION.sql`.
   Do not apply old migrations *after* this one. Migration effects on existing projects must be backed up and tested. Legacy MP3/WAV rows remain privately stored for a future resumable migration; migration is **not** implemented.
4. Set Vercel production/preview environment variables according to `.env.example`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAME`, `UPLOAD_HMAC_SECRET`, `CRON_SECRET`. Only public keys may reach the frontend. Create the Turnstile widget for the exact live domain. Use a strong, distinct secret for each server-only value.
5. Configure GitHub Actions repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Enable `.github/workflows/audio-validator.yml`. Publication occurs after this worker runs, not immediately when a browser finishes uploading. There is no guaranteed low-latency queue: scheduled Actions may be delayed or skipped.
6. Connect the GitHub repository to Vercel. Check `/api/config`, `/api/catalog`, public RLS and the private Storage bucket; upload a small **SSEQ** and verify the status transitions from pending to published after trusted validation. Re-download bytes, hash-compare, play them, and export a pack. Test an anonymous second browser and cancellation/rate limits before public launch.

**Storage:** New anonymous music upload is **SSEQ-only with 64 KiB maximum**. User-supplied WAV/MP3 may be much larger, but are converted before being sent over the public upload API; their originals are **not** persisted as library audio. TUS is retained in source for historical uploads but never used for new ≤64 KiB SSEQ songs. The Supabase bucket remains private. Quota and concurrency controls need live Supabase testing.

## Owner music batch import

For already produced `.sseq` files (not MP3/WAV):

```bash
export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_SECRET
node scripts/admin-import.mjs ./my-sseq-files --dry-run --csv=metadata.csv
node scripts/admin-import.mjs ./my-sseq-files --retry=3 --csv=metadata.csv
```

The CSV supports a `slot` field. The owner tool uses the same trusted publication validation and avoids destroying uploads after an uncertain network response. No administrator secret belongs in GitHub source or browser JS.

## Reproducible tests

```bash
npm ci
npm run lint
npm test
npm run issues:sync && npm run verify
npm run test:example
node scripts/validate-sigma-dex-pack.mjs examples/sigma-dex-example-music.zip
python tests/browser_sseq_conversion.py
python tests/browser_sseq_player.py
python tests/independent_sseq_reader.py
npm run test:browser
```

For Playwright tests, install `playwright` and Chromium locally. `tests/browser_sseq_upload_pipeline.py` additionally requires a browser able to navigate to a local HTTP origin (Web Crypto secure context); this execution environment blocks localhost navigation and therefore **cannot certify the complete browser PUT/status pipeline**. See `TEST_RESULTS.md` for actual runs and CI caveats.

## Instrument data and rights

The uploaded HeartGold US archive is **private calibration input**, not a file to publish. Derive metadata using `python scripts/build_bank_profiles.py /path/to/HeartGold_instrumentfiler_US.zip heartgold_bank_profiles.json`; sync the generated JS metadata profile as instructed by the generator. **Do not commit** SBNK/SWAR/SDAT/ROM bytes or Nintendo sample banks. Only users' self-produced compositions should be uploaded. This repository makes **no modifications** to Sigma Dex, Origin HeartGold, hg-engine, or the game's ROM.

## v1.4.3 upload UI correction

The previously exposed HeartGold music-slot/instrument panel is no longer on the main page. The **Upload music** dialog now asks only for a target game music slot and optional loop setting. Instrument programs are selected automatically using validated bank metadata. The internal HeartGold SBNK bank validation and SSEQ-only export remain unchanged.


## Delete a shared song (v1.7.1)

Choose a song's **•••** menu → **Delete song from shared library**. The uploader can delete songs uploaded from their browser using the saved private upload receipt; the site administrator can delete older or other tracks with a separately configured `SONG_DELETE_ADMIN_TOKEN`. This is different from deleting a local playlist. The server hides the song with a database tombstone, removes its SSEQ using the Storage API, and retries failed Storage cleanup via the protected cron. **The SQL migration and the admin environment variable are required before this feature will work in production.** See [`SONG_DELETION.md`](SONG_DELETION.md) and [`RELEASE_QC_V1_7_1.md`](RELEASE_QC_V1_7_1.md).
