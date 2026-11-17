# v1.7.5 QC addendum — local, not deployed

A 300-second 44.1 kHz stereo WAV and MP3 have independently passed the actual browser conversion/editor and mocked SSEQ-only submission. A known 150-note score was recovered for each (0 pitch errors, max 18.3 ms onset and 20.0 ms offset error, final note ending at 299.75 s, 1,091-byte SSEQ). An 8,000-note event arranger now initializes in ~15 ms after removing quadratic overlap counting and full-song note button rendering. See `FIVE_MINUTE_QC.md` and ST-072 in `KNOWN_ISSUES.md`. **This does not validate arbitrary long recordings or production upload, genuine game playback, native Sigma Dex import, real iOS Safari, or staging migrations.**

# v1.7.4 release QC summary — local, not deployed

- The new `Arranger sangen` feature is implemented in the ordinary WAV/MP3 audio-file chooser, supporting Auto approval, optional melody-only/melody+accompaniment, up to five user-editable parts, native 8-note polyphony, per-part instrument/volume/filter/include/solo, per-strike note omission and undo, and a separate original/SSEQ listen-loop versus game-loop.
- Local strict WAV/MP3 timing acceptance restores six correct notes and no extras/misses in both known problem cases; 3 unseen authored synthetic examples score 88.9%, not a general music quality certification. Synthetic tests cannot replace human reference for Cute melody; original private audio showed that conservative refinement can omit possible authentic notes.
- Node 162/162, full 24/24 Chromium browser suite, independent Python reader, SSEQ example validator and release layout passed in local source. See `TEST_RESULTS.md` and `ARRANGER_QC.md`.
- **No live database modifications, no new Vercel deployment, no current GitHub-main merge.** Two pending migrations are isolated and versioned, and need an authorized, backed-up staging clone for testing. Production upload/delete and physical/ROM tests are unverified.

---

# QC release addendum — sigma-themes 1.7.3 chord/timing work

The authoritative quantitative details and per-stage note arrays are in `POLYPHONY_QC.md` and `POLYPHONIC_BENCHMARK_RESULTS.json`. New conservative overtone test restores original four-, six- and eight-tone synthetic chords without turning the strong-harmonics solo into an artificial chord. Strict note F1 rises 57.8% -> 74.5% on 18 matched WAV/MP3 files; 43.5% -> 56.0% on reserved held-out fixtures. **Known fail:** 350ms-delayed melody (8 extras / 5 missing) and staggered six-instrument example (6 extras / 5 missing) per codec. These are not considered solved.

Actual Supabase production schema was read only: 8 tracks, 8 upload rows, quota RPC contains 30/100/500; `theme_tracks_sha_slot` unique and `reserve_theme_upload_for_slot` hash rejection were independently confirmed. `20261116_distinct_sseq_submissions.sql` is added but neither staging nor production applied/tested. `20261116_song_deletion.sql` was also absent from installed production schema (no deleted_at/storage_deleted_at). NO production writes performed.

Frozen v1.7.2 ZIP used. `rubenhjo/S-themes` HEAD unreachable due DNS/internet restriction: **NOT VERIFIED** source merge. Browser synthetic WAV/MP3 review tests do not constitute real Vercel/Turnstile upload. Original private Cute melody compared under one bank-702 program with genuine local PCM previews; no ground truth, no final quality approval. See `DEPLOYMENT.md`, `HEARTGOLD_COMPATIBILITY.md`, `OPEN_ISSUES.md`.

---

# Quality control — sigma-themes v1.7.2 release candidate (2026-11-16)

## Implemented in this pass (code + tests)

| Area | Verified change | Proof / limitations |
|---|---|---|
| Spectral transcriber | Conservative harmonic independence, stronger low-frequency peak test, protect independently supported octaves | Deterministic 20-case test: F1 0.8037 → 0.9038, FP 8 → 1, TP 43 → 47; dense six-note chords still miss notes; real-world quality unverified |
| SBNK/SWAR decoder | Accept legal 60-byte empty SWAR, prevent illegal out-of-range key-split fallback | 78 SHA-256-verified original source files privately imported; 506 PCM key regions and 365 loops enumerated; 3 Node sample tests |
| PCM preview + player | Shared `schedulePcm` with root pitch, decoded PCM sample, loop, pan and distinct attack/decay/sustain/release stages | Chromium imported private SBNK 702 + SWAR 700/702; bank 702 program 21 preview and SSEQ both called shared sample path; not bit-accurate DS envelope |
| Deleted-song access | Audio API returns signed URLs with 60-s expiry, down from 900-s | New Node API mock test; revocation of already issued URL before expiry not guaranteed |
| All previous user features | Five MIDI files, per-file bank/program, offset, velocity, mute/solo, SSEQ-only upload/download/export, 39 banks/2,593 programs, public playlists/favorites, deletion | 21 Chromium suites; backend mocked and no live Supabase changes |
| Package | Version/lock aligned, release file layout and `npm run verify` include benchmark, CI matrix preserved | 147 Node tests, independent in-project Python SSEQ parser, Sigma Dex fixture-pack validator; GitHub CI live run not checked |

## Audio fidelity — not approved

The spectral transcriber is **not** a source-separation/polyphonic neural model. Its true-positive rule uses ±200 ms note onset/offset tolerance and synthesized additive waveforms with predefined MIDI note events, not a measured sample of complex music. The source recording `Cute melody(1).m4a` yielded 23 → 20 notes (147 → 136 SSEQ bytes) and no longer emitted suspect MIDI 35 near 6.52 s, but a reliable human-ground-truth note sheet does not exist. This cannot be graded as a confirmed musical improvement for that recording. See `AUDIO_BENCHMARK.md`.

## Instrument authenticity — bounded claim

Original SBNK/SWAR bytes were used **locally** for decoding and preview testing, and were excluded from the distribution. PCM note playback, pitch and loop are implemented as Web Audio. ADSR values are interpreted with a simplified, bounded envelope; PSG/noise/DS mixer are not emulated exactly. A finished SSEQ references a selected game bank and cannot carry imported Nintendo sound data. No genuine HeartGold US game/emulator test was performed. See `HEARTGOLD_COMPATIBILITY.md`.

## Supabase and web hosting — actual read-only observation

The connected Supabase project `S-themes` was reviewed **read only**. At inspection, `public.theme_tracks`, `public.theme_uploads` and `public.theme_storage_settings` had RLS enabled; the five visible migration-history entries covered upload security, rate limits and publication/recovery. The required v1.7.1 song-deletion migration was **not applied** and the visible track table had no deletion/tombstone columns. No production SQL, storage deletes, staging deployments or live uploads were performed. Live deletion is **NOT TESTED** and cannot be assumed working. The security advisor reported only two informational RLS-with-no-policy findings on internal tables; do not grant anonymous writes to fix that informational notice. `DEPLOYMENT.md` specifies a backed-up staging path.

## Issue ledger and release decision

Every previous issue is retained in `KNOWN_ISSUES.md`; 64 entries, currently OPEN 17, BLOCKED 11, FIXED – NOT VERIFIED 6, VERIFIED 30 (machine-checked). ST-062 original empty SWAR: locally verified. ST-063 dense harmony: still open. ST-064 deployment of delete migration: blocked. For full individual reproduction, evidence and status see the ledger, not only this executive QC table.

**DECISION: PASS for local source/fixture verification; NOT APPROVED as fully musically faithful, DS-compatible or production-validated.** The target-site repo `main` was not synchronized through authenticated GitHub in this session. Files in the ZIP derive from latest accessible v1.7.1 archive plus current changes; live site is not changed by creating the ZIP.

---

## Historical QC / issue tally (retained for traceability)

# Technical QC — SSEQ-only preview 1.4.0

## Scope

Modified the existing GitHub/Vercel sigma-themes source tree. No account or commercial ROM/sample files are included. No changes were made to Sigma Dex, Origin HeartGold or hg-engine. The SSEQ-only data path is implemented in frontend, REST upload control, trusted validation worker, private Supabase migration and ZIP export; SSEQ Web Audio preview is available with generic synthesized timbres.

## Verified fixes

- Audio file uploads are decoded locally and converted to binary Nitro SSEQ **before** upload; server restricts `.sseq` and verifies full events, bank slot and instrument/pitch ranges. The existing authorized SSEQ bytes are reused on repeated export.
- Two different, standalone source melodies (WAV and MP3, **no MIDI supplied**) generated correct four-note sequences in Chromium. Valid MIDI and existing SSEQ input accepted; corrupt MP3 rejected.
- Individual song download `.sseq`, Sigma Dex SSEQ-only ZIP `manifest.json`/`tracks.json`/`folders.json`/`checksums.sha256` validated for complete selection, exact hash and damaged archive.
- Authentic user-supplied HeartGold US instrument-bundle **metadata** fingerprint and structural program/pitch validation; no Nintendo bank or wave data distributed.
- Web Audio reads real generated SSEQ notes (not a hidden PCM file) and triggers note events; tested in Chromium. The background uses Sigma Dex sprite URLs, not user-supplied image cutouts.
- Previously existing Turnstile, public Supabase catalog, RLS design, playlists/favorites, and GitHub/Vercel architecture remain in the source.

## Critical release blockers / restrictions

1. **Mixed stereo music reconstruction is not sufficiently faithful.** The current untrained FFT transcription is suited for simple melodies and drops much chord accompaniment. A high-quality trained model, instrumental source separation and arrangement validation are needed. This is a substantive product blocker, not a minor tuning issue.
2. **Actual original HeartGold playback is not verified.** Program/pitch references are checked structurally against supplied SBNK/SWAR metadata; audible instrument output in melonDS and real SDAT delta remain unknown. A ZIP is not a ROM patch.
3. **Actual Vercel/Supabase lifecycle is not verified.** Applying SQL, private signed URL access, Turnstile, trusted worker and two-client real-time update require staging tests. The upload worker must be configured or songs remain queued.
4. Legacy WAV/MP3 Storage records are hidden from the public SSEQ catalog but not yet migrated with stable IDs; the original files are retained privately, not silently destroyed.
5. Current browser SSEQ parser supports a subset of commands, playback uses generic synthesized oscillators rather than actual Nintendo sample timbres, and a seconds-based loop editor is not yet applied to the stored binary.
6. Normalization formerly intended for recording playback is not calibrated for the new SSEQ oscillator engine. Large-file/long-song Worker resource budgets and browser-specific codecs still require real-device testing.

**Production gate:** Not approved as a verified full replacement for a site expected to transcribe arbitrary finished stereo mixes. Deployment to a private Vercel Preview branch is reasonable after reviewing the open blockers; production replacement would misrepresent current fidelity and could require backward-compatible migration.

## Reproducible checks

`npm run verify`, `npm run test:browser`, `npm run test:example`, `node scripts/validate-sigma-dex-pack.mjs examples/sigma-dex-example-music.zip`. See `TEST_RESULTS.md` and the permanent `KNOWN_ISSUES.md` ledger; generated counts below are authoritative.

## QC continuation v1.4.1 — directly verified work

- Fixed delayed SSEQ autoplay after pause/source replacement (ST-060). Chromium regression injects a deliberately delayed SSEQ HTTP response and verifies no oscillator context was created after cancellation.
- Added actual SSEQ synth listening-level changes for quiet/normal/loud and confirmed mute/volume=0 (ST-059 remains OPEN for unimplemented BS.1770-based LUFS calibration).
- Extended the untrained spectral transcriber to preserve a synthetic three-note accompaniment while keeping the lead melody; glitches remain, so ST-051 is OPEN and dense mixed audio is NOT verified.
- Bounded browser source file size to 128 MiB, removed duplicate decoder buffer allocation and prevented long FFT fallback on the main thread (ST-061 not performance-verified on a real phone).
- The full upload UI test with mocked cloud/Turnstile validates converted SSEQ-only bytes. Secure-origin Web Crypto test on local server was BLOCKED by sandbox network policy; live Supabase/RLS/Turnstile and original HeartGold playback were NOT TESTED.

## QA issue statistics — generated

The authoritative data is `KNOWN_ISSUES.md`; this machine-checked summary must match it.

<!-- ISSUE_STATS {"total":72,"counts":{"OPEN":{"P0":0,"P1":8,"P2":11,"P3":0},"IN PROGRESS":{"P0":0,"P1":0,"P2":0,"P3":0},"FIXED – NOT VERIFIED":{"P0":1,"P1":6,"P2":1,"P3":0},"VERIFIED":{"P0":2,"P1":18,"P2":10,"P3":2},"BLOCKED":{"P0":2,"P1":9,"P2":2,"P3":0},"WONTFIX":{"P0":0,"P1":0,"P2":0,"P3":0}}} -->
