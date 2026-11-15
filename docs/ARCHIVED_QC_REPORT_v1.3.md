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

## QA issue statistics — generated

The authoritative data is `KNOWN_ISSUES.md`; this machine-checked summary must match it.

<!-- ISSUE_STATS {"total":59,"counts":{"OPEN":{"P0":0,"P1":5,"P2":11,"P3":0},"IN PROGRESS":{"P0":0,"P1":0,"P2":0,"P3":0},"FIXED – NOT VERIFIED":{"P0":0,"P1":5,"P2":0,"P3":0},"VERIFIED":{"P0":2,"P1":14,"P2":10,"P3":2},"BLOCKED":{"P0":2,"P1":6,"P2":2,"P3":0},"WONTFIX":{"P0":0,"P1":0,"P2":0,"P3":0}}} -->
