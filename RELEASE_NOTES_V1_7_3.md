# sigma-themes v1.7.3 — source-only polyphony regression release candidate

Release classification: **LOCAL TEST PASS; STAGING / NATIVE HEARTGOLD / IPHONE NOT TESTED**. Built from the complete previous v1.7.2 ZIP. Live `rubenhjo/S-themes` main could not be downloaded/compared; do not deploy by blind overwrite.

## New code and tests

- `sseq_transcribe.js`: improved detection of real upper pitches inside chords without admitting strong solo harmonics.
- `tests/fixtures/polyphony/` and `tests/create-polyphony-fixtures.mjs`: independent MIDI ground truth, 9 scenarios rendered both WAV/MP3; includes reserved held-out cases.
- `tests/polyphonic-benchmark.mjs`, `tests/chord-stage-diagnostics.mjs`, `POLYPHONY_QC.md`, `POLYPHONIC_BENCHMARK_RESULTS.json`: 3-stage traces and quantitative strict/lenient metrics.
- `tests/browser_polyphonic_filepicker.py`: actual local web interface file selector and SSEQ review, 18/18 case validation.
- `tests/alternative_librosa_yin.py`, `LIBROSA_YIN_RESULTS.json`: measured open-source monophonic comparator, *not* adopted.
- `supabase/migrations/20261116_distinct_sseq_submissions.sql`: unexecuted staging-first fix for independent uploads of same SSEQ/slot; preserves quota and per-ID identity.
- `tests/verify_example_zip_hashes.py`: synthetic ZIP song hashes match catalog metadata; not live Supabase.
- `.github/workflows/ci.yml` adds fixture requirements and independent polyphonic browser suite.
- All other v1.7.2 source, deletion, MIDI/SSEQ input, catalog/playlist and instrument features retained; no existing production songs/storage changed.

## Results and deployment boundaries

`npm test`: 154/154; `npm run verify`: PASS; `tests/run_browser_tests.py`: 21/21 Chromium; `tests/browser_polyphonic_filepicker.py`: 18/18 WAV/MP3.
Strict polyphonic note F1 before/after: **57.8% / 74.5%** on deterministic 18-case synthetic set. The delayed-after-silence melody and staggered six-instrument holdout still FAIL strict note-level scoring; do not claim universally faithful music conversion.

**NOT TESTED**: ndspy third-party parser, a real Sigma Dex importer, private legally obtained HeartGold US ROM/emulator playback, physical iPhone, current GitHub main, Vercel Preview staging and true Supabase upload/delete/signed-url workflows. See `DEPLOYMENT.md` for exact next steps.

**Privacy:** This public source ZIP contains only generated test WAV/MP3/MIDI signals, never the user's private Cute melody, original Nintendo SWAR/SBNK, private tokens or live database snapshots. Separate private listening files must not be committed to GitHub.
