# sigma-themes — SSEQ-only preview (1.4.0)

This repository is the **existing** [sigma-themes](https://sthemes.vercel.app) GitHub/Vercel application, changed for a SSEQ-only shared catalog and Sigma Dex export. It is **not** the single-file Paperwave demo. Only this project was changed; Sigma Dex and HeartGold were **not** modified.

## Current status — important

**Locally implemented and tested:** public/no-login UI, private Supabase bucket and server-side reservation, client-side WAV/MP3 → genuine Nitro SSEQ for simple melodies without MIDI, MIDI → SSEQ, existing valid supported-subset SSEQ pass-through, matching actual HeartGold US SBNK program/pitch ranges, browsing/previewing stored SSEQ with a Web Audio oscillator synth, SSEQ-only individual download and SSEQ-only selected-folder ZIP pack with SHA-256 verification. The complete upload-to-Supabase sequence requires staging credentials and is **not** tested in production.

**NOT proven:** reconstruction of multi-instrument final mixes, authentic HeartGold SBNK/SWAR timbres in the web player, full compatibility with all possible existing SSEQ opcodes, real-game playback in melonDS, correct soundbank arrangement by timbre, production Supabase/Vercel worker/RLS integration, original HeartGold ROM size changes. **Do not describe this as a verified production replacement meeting every acceptance criterion.** Current spectral extraction recovers simple monophonic melodies; it may omit chords. See `KNOWN_ISSUES.md`.

## GitHub and Vercel deployment

1. Extract the ZIP and commit its **contents** (not the ZIP itself) to the root of your intended `rubenhjo/S-themes` repository. Review changes before replacing production. Do not overwrite any private credentials or your existing Supabase database with test data.
2. Create/maintain a separate sigma-themes Supabase project. In **SQL Editor**, run in this order, and verify each completes before continuing:
   - `supabase/migrations/20261114_public_release.sql`
   - `supabase/migrations/20261114_qc7_validation_quota.sql`
   - `supabase/migrations/20261115_validation_claim_lease.sql`
   - `supabase/migrations/20261115_sseq_only.sql`
3. The final migration restricts **new** audio reservations and bucket objects to `.sseq` (max 65,536 bytes), adds validation slot mapping, and leaves older WAV/MP3 rows private for future migration. This migration has **not** been tested against a live database or upgrade transaction. Take a database backup before running it.
4. In Vercel import the repo (Framework `Other`, root `/`, no build command) and set these environment variables **in Vercel only**, never in GitHub: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAME`, `UPLOAD_HMAC_SECRET`, `CRON_SECRET`. Use `.env.example` for descriptions. Cloudflare Turnstile must recognize the actual Vercel hostname. `UPLOAD_HMAC_SECRET` should be at least 32 random bytes.
5. Configure GitHub Actions secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the trusted **Validate submitted audio** workflow, which publishes only correctly parsed SSEQ (no MP3/WAV). Confirm the workflow is actually running before opening uploads. A pending upload is **not** published music.
6. Deploy to a **Vercel Preview** environment first; test `/api/config`, `/api/catalog`, Turnstile, SSEQ upload, trusted worker, preview playback, signed Storage access and two-client sync using an isolated staging database. Only promote it after these tests pass. No account is needed for ordinary listeners or contributors.

### Data and privacy

- Source MP3/WAV/FLAC/etc. is decoded transiently in the contributor's browser. The upload API only accepts `.sseq` and a 64 KiB limit; a valid SSEQ must pass whole-file parsing, selected instrument program and note-pitch checks before publishing.
- `heartgold_bank_profiles.json` and `.js` are **metadata only** generated locally from the user-provided *private* HeartGold US `bankkart.json`/SBNK/SWAR bundle. The public repository and exports do **not** contain original SBNK/SWAR or ROM bytes. Build your own metadata profile with `python scripts/build_bank_profiles.py /path/to/HeartGold_instrumentfiler_US.zip heartgold_bank_profiles.json` if required; regenerate the matching browser JS if the profile changes.
- `sseq_id` in the library is the **target sequence slot**, which determines its existing bank and wave-archive references in the provided US profile. The SSEQ itself contains instrument commands, not the external bank mapping.
- The browser player synthesizes notes parsed from the stored SSEQ. Sound is approximate, not HeartGold's recorded SWAR instrument timbre. The “Normalize” controls from earlier releases currently have no effect on that synthesizer (logged).
- Personal playlists, favorites and folder organization remain in the visitor's localStorage and are not shared automatically. The public library and track bytes reside in Supabase; login is not required.
- **Legacy songs:** previous MP3/WAV catalog entries are hidden from public playback, but not deleted or automatically converted. A safe migration preserving old IDs and playlists remains to be built (see issues).

## Input and outputs

| Selected in upload | Current behavior | Permanent music asset |
|---|---|---|
| `.sseq` | Parse supported events and validate selected HeartGold slot/programs | Original validated SSEQ bytes |
| `.mid`, `.midi` | Parse musical notes, timings/tempo; map to programs in selected bank | Generated `.sseq` |
| `.wav`, `.mp3` | Browser decoding, experimental FFT-based note transcription, bank mapping | Generated `.sseq` |
| `.flac`, `.ogg`, `.opus`, `.m4a`, `.aac` | Same experimental path **if the browser can decode the codec** | Generated `.sseq` |

The converter currently handles up to **360 seconds** of recorded audio, using a Web Worker for spectrum analysis where available. The maximum SSEQ size is **65,536 bytes**; a source may be accepted for decoding yet rejected for an oversized or musically invalid result. It is not a commercial multitrack transcription service. The browser player uses stored SSEQ bytes only, not hidden audio-preview files.

The **Export to Sigma Dex** button produces a ZIP with `music/**/*.sseq`, `manifest.json`, `tracks.json`, `folders.json` and `checksums.sha256`; the future Sigma Dex receiver must implement the documented **v2** import contract. No "HeartGold pack" or WAV game-export option is offered. One-song download returns `.sseq` directly. The export format is not a ROM/SDAT patch.

## Local testing

Requires Node.js >=20, Python 3, Chromium/Playwright (`pip install playwright pillow`, `python -m playwright install chromium`). FFmpeg/FFprobe are useful to generate source fixtures but **not** required for playback/exports.

```sh
npm ci
npm run verify                 # JavaScript checks, Node tests and permanent issue ledger
npm run test:sseq              # Bank program/pitch, binary SSEQ and ZIP integrity
npm run test:browser           # Six isolated Chromium suites (mocked server)
python tests/browser_sseq_conversion.py  # Real WAV/MP3/MIDI/SSEQ browser conversion
npm run test:example
node scripts/validate-sigma-dex-pack.mjs examples/sigma-dex-example-music.zip
```

Synthetic test input files are stored under `tests/fixtures` and do not ship to the music catalog. The example ZIP has three synthetic SSEQ tracks. All recorded playback and upload backend claims require a real staging environment to be considered production PASS.

Some old tests in `tests/` that assumed WAV/IMA-ADPCM exporting are deliberately retired from the active browser runner. They remain in the repository as historical tests, not falsely counted as passing current SSEQ paths. The former NWAV encoder remains as a historical helper for backwards analysis; it is not called by current Sigma Dex exporting.

## Key documents

- `SIGMA_DEX_EXPORT_SPEC.md`: exact v2 SSEQ ZIP contract.
- `HEARTGOLD_INTEGRATION.md`: instrument profile derivation and what *isn't* verified on an original ROM.
- `KNOWN_ISSUES.md`: permanent defect register (historical IDs preserved).
- `TEST_RESULTS.md`, `QC_REPORT.md`, `CHANGELOG.md`: measured results, remaining release blockers and changes.

## Rights

Only upload original or otherwise authorized music. Do **not** commit original Nintendo soundbanks, extracted game samples or a ROM. The public generated bank profiles contain index/range metadata only.
