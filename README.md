# sigma-themes — SSEQ-only preview (v1.4.2)

A multi-file **GitHub → Vercel** app with an account-free shared Supabase catalog, personal playlists/favorites/folders, actual SSEQ playback with Web Audio and a single **Export to Sigma Dex** ZIP workflow. This is **not** the standalone Paperwave/3-song HTML demo.

## Production qualification — READ THIS FIRST

**This release is an experimental SSEQ-only integration, NOT production-validated.** Browser audio transcription uses a small untrained spectral multivoice estimator. Simple synthetic WAV/MP3 melodies become recognisable SSEQ notes; a synthetic three-note backing chord is partially recovered, but spurious notes remain and dense mixed/polyphonic songs are **not** reliably converted and no original HeartGold ROM/emulator playback has been demonstrated. Do not promise friends that every recording will become a musically faithful track. Staging Supabase, RLS and Cloudflare tests must be run before enabling public uploads. See `KNOWN_ISSUES.md` and `TEST_RESULTS.md`.

## Important deployment note

The GitHub repository may still be on the earlier **v1.3 WAV-export build** until these root files and subfolders are committed there; creating a ZIP here does not update Vercel. Unzip the archive before uploading code. GitHub browser upload has a 100-files-per-commit limit; this source archive has more than 100 files, so upload in at least two passes, preserving the directory structure. Never upload private HeartGold `.sbnk` / `.swar` assets or server secrets. See `DEPLOY_BROWSER_ONLY.md` for the exact browser workflow.

The instrument dropdown is a **preference** for the lead voice. If the preferred program cannot sound every transcribed pitch but another program in the same target SBNK can, the converter now automatically selects that compatible program and says so. An absent alternative still causes a validation failure.

## How the product currently works

1. Open the public Vercel site (no account); choose **Target game music slot** and an instrument from the **metadata-only HeartGold US bank profile**. A slot maps to the original SDAT SBNK/SWAR resources.
2. Choose a supported source in the ordinary **Upload music** button: `.sseq`, `.mid` / `.midi`, or browser-decodable `.wav`, `.mp3`, `.flac`, `.ogg`, `.opus`, `.m4a`, `.aac`. The supported decode formats actually depend on the browser.
3. `.sseq` goes through a strict supported-command subset parser and is preserved byte-for-byte if accepted. MIDI is parsed and arranged to bank-valid note programs. Finished recordings are decoded **only in the user's browser**, transcribed approximately by FFT in a Worker (up to four detected candidate voices; not source separation) and converted to a real binary Nitro SSEQ. No user MIDI is required for the latter path. Some arrangements will be rejected if the result is empty, incompatible with chosen bank, or over 64 KiB.
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
