# Arranger sangen — v1.7.4 local release QA

## What was implemented

- WAV/MP3/M4A (only where browser decoding is supported) open the **Arranger sangen** review in the existing anonymous upload flow. Auto is the default and one-tap acceptance submits only valid SSEQ bytes; original audio stays in browser memory.
- Auto, Kun melodi, Melodi med akkompagnement. At most **five editable parts**; no five-note or five-voice limit. Pure eight-tone chord keeps eight simultaneous notes.
- Song-local include/mute, preview solo, bank-compatible instrument selection and velocity/volume scaling for each part. Per-part support filter can opt in to low-confidence candidates; candidate labels are NOT calibrated probabilities.
- Unique per-onset note IDs, exclude and undo; repeated MIDI pitch instances remain independent. Original/SSEQ A-B region playback and listen-loop are preview-only; game-loop is separately controlled.
- “Spill hele sangen” previews the same immutable SSEQ Uint8Array accepted for upload; audio/SSEQ selection does not require a MIDI upload or GitHub Action.
- FFT 2048/Hann frame look-ahead and short-window complex demodulation were combined to reduce early onsets, premature chord exits, split tails and harmonic ghosts. A short note now loses at most a quarter of its duration to look-ahead correction.
- Late melody overlay is separated from held harmony by onset spread rather than being mistaken for a simultaneous block chord.

## Strict MIDI-ground-truth test results

Strict definition: exact pitch; onset ±50 ms; offset within max(50 ms, 20% of reference length), greedy one-to-one pairing. Both WAV and MP3 come from the same independently authored note events.

| Test | Format | Frozen v1.7.3 correct/extra/missing | v1.7.4 correct/extra/missing |
|---|---|---|---|
| four-note chord | WAV | 4/0/0 | 4/0/0 |
| four-note chord | MP3 | 4/0/0 | 4/0/0 |
| six-note chord | WAV | 6/0/0 | 6/0/0 |
| six-note chord | MP3 | 6/0/0 | 6/0/0 |
| strong harmonics | WAV | 1/0/0 | 1/0/0 |
| strong harmonics | MP3 | 1/0/0 | 1/0/0 |
| eight-note chord | WAV | 8/0/0 | 8/0/0 |
| eight-note chord | MP3 | 8/0/0 | 8/0/0 |
| four C4 repeats | WAV | 4/0/0 | 4/0/0 |
| four C4 repeats | MP3 | 4/0/0 | 4/0/0 |
| E2-G2-A2-E2 bass | WAV | 4/0/0 | 4/0/0 |
| E2-G2-A2-E2 bass | MP3 | 4/0/0 | 4/0/0 |
| melody after 350ms silence | WAV | 1/8/5 | 6/0/0 |
| melody after 350ms silence | MP3 | 1/8/5 | 6/0/0 |
| heldout staggered six instruments | WAV | 1/6/5 | 6/0/0 |
| heldout staggered six instruments | MP3 | 1/6/5 | 6/0/0 |

**Aggregate:** 18 known WAV/MP3 files: 70/28/20 -> 90/0/0; F1 74.47% -> 100% strict. Three separately authored uninfluenced reference scores: 11/8/6 -> 16/3/1; F1 **61.11% -> 88.89%**. These are very small synthetic benchmarks; broad music fidelity is not certified.

### Three-stage debug trace

The baseline had wrong timing/overtones in stage A (spectral event estimation) **before** voice allocation and SSEQ generation. Both original SSEQ allocation and serializer preserved the notes they received. The new results are from production `S.build()` followed by `S.parse()`; the full stage arrays and per-note timings are in `ARRANGER_TIMING_RESULTS.json`.

| Example | Pitch | Reference start/duration (s) | Old start/duration (s) | New start/duration (s) |
|---|---:|---|---|---|
| melody after 350ms silence | 67 | 0.350 / 0.410 | 0.344 / 0.323 | 0.344 / 0.417 |
| melody after 350ms silence | 48 | 0.350 / 1.300 | 0.344 / 1.250 | 0.354 / 1.302 |
| melody after 350ms silence | 52 | 0.350 / 1.300 | 0.344 / 1.021 | 0.354 / 1.302 |
| melody after 350ms silence | 55 | 0.350 / 1.300 | 0.344 / 1.021 | 0.354 / 1.302 |
| melody after 350ms silence | 69 | 0.900 / 0.410 | 0.792 / 0.469 | 0.896 / 0.417 |
| melody after 350ms silence | 72 | 1.450 / 0.360 | 1.375 / 0.438 | 1.448 / 0.365 |
| heldout staggered six instruments | 45 | 0.110 / 1.329 | 0.094 / 1.281 | 0.104 / 1.344 |
| heldout staggered six instruments | 52 | 0.190 / 0.941 | 0.094 / 0.979 | 0.177 / 0.958 |
| heldout staggered six instruments | 57 | 0.370 / 0.841 | 0.135 / 1.042 | 0.354 / 0.844 |
| heldout staggered six instruments | 61 | 0.510 / 0.900 | 0.417 / 0.927 | 0.510 / 0.896 |
| heldout staggered six instruments | 66 | 0.680 / 0.740 | 0.604 / 0.740 | 0.677 / 0.740 |
| heldout staggered six instruments | 73 | 0.840 / 0.660 | 0.792 / 0.469 | 0.833 / 0.667 |

WAV and MP3 event times in `ARRANGER_TIMING_RESULTS.json` are identical for these two synthetic cases to displayed precision. `tests/timing-acceptance.mjs` creates comparisons from the exact same fixtures and checks the stated 6/0/0 targets.

## Browser and code verification

- `tests/browser_song_arranger.py`: real file chooser WAV/MP3, Auto accepts eight-tone chord, published bytes valid SSEQ.
- `tests/browser_arranger_controls.py`: real WAV/MP3 editor, instrument override on melody, 65% velocity scale, bass-only support slider, remove one melody attack, exclude chord part, original/game loop distinction, byte identity of full SSEQ preview and submitted bytes; separately remove one of four repeated C4 strikes.
- `tests/browser_polyphonic_filepicker.py`: all synthetic WAV/MP3 cases through new review and mocked submission, especially four/six/eight voices.
- `tests/song-arranger.test.js`: immutable export vs temporary solo/listen loop, unique note IDs, undo, compatible instrument bank range, volume and timing parse, separate melody over held harmony.
- No actual Vercel / Turnstile / Supabase staging / hardware tests in this offline checkout.

## Private Cute melody control

Original 7.744s M4A SHA-256 `84cb65fa0f50e19e1d82629c0aa100e1aec5c9de9a48d03809b62bf16cde53dc` was used **privately only**. A private local analysis of the frozen v1.7.3 spectral notes returned 22 candidates; the new conservative automatically refined track returned 14 before optional candidates. **This is not verified as an improvement** on the real recording and a risk of missing genuine notes. The raw candidate layer now preserves short possibly genuine notes for opt-in inspection. Pitch 44 (~7.38s raw, ~0.12s) was observed in the original spectral layer and remains accessible by enabling the `Ta med flere mulige toner` slider; it is NOT claimed true. The arranger can loop 5.75–7.74s in original versus SSEQ and toggle its unique candidate note ID without changing the reference audio. The private recording and Nintendo bank files are excluded from source release.

## Risks / uncovered

Production staging, hash-identical independent submissions and deletions, 60s signed-link expiry, real HeartGold US, physical iPhone Safari, external ndspy and native Sigma Dex importer are **NOT TESTED**. The existing documented pending migrations MUST be applied first on a cloned database after backup. Remote GitHub current main was unavailable; do not overwrite an unknown newer main without a reviewed diff.
