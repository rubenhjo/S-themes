# POLYPHONY QC — sigma-themes 1.7.3 (local release candidate)

## Root cause and exact three-stage trace

The v1.7.2 harmonic-ghost predicate rejected real pitches whenever their frequencies were near an integer multiple of a stronger lower note. On the original deterministic C3/E3/G3/C4 and C3/E3/G3/C4/E4/G4 synthetic recordings the missing pitches were **already absent from the spectral frame output**; the lane allocator and SSEQ writer preserved the pitches they received. The fix now requires more than one independent upper spectral partial before keeping a supported overtone-aligned note. It does **not** simply increase the voice cap.

| Fixture | MIDI truth | v1.7.2: analysis / lanes / SSEQ | 1.7.3: analysis / lanes / SSEQ |
|---|---|---|---|
| four-note chord | 48,52,55,60 | 48,52,55 / 48,52,55 / 48,52,55 | 48,52,55,60 / 48,52,55,60 / 48,52,55,60 |
| six-note chord | 48,52,55,60,64,67 | 48,52,55 / 48,52,55 / 48,52,55 | 48,52,55,60,64,67 / 48,52,55,60,64,67 / 48,52,55,60,64,67 |
| eight-note chord | 48,52,55,60,64,67,71,74 | 48,52,55,86 / 48,52,55,86 / 48,52,55,86 | 48,52,55,60,64,67,71,74 / 48,52,55,60,64,67,71,74 / 48,52,55,60,64,67,71,74 |

## Independent MIDI reference and two tolerances

Each fixture has a Standard MIDI File generated from a deterministic event score; its parsed note-on/note-off pairs are the authoritative reference. WAV is PCM 16 bit at 11,025 Hz, MP3 is encoded with FFmpeg libmp3lame 192 kb/s. The exact same note events are tested as both codecs. The first scoring rule requires exact pitch and **both onset and offset within ±200 ms**. The stricter rule requires exact pitch, onset within **50 ms** and offset within **max(50 ms, 20% of reference note length)**. Matching is one-to-one. None of the truth annotations were changed to fit output. The bench compares the frozen v1.7.2 implementation and the current code, both through the same spectral, voice-packing, encoder and local parser stages.

- All 18 WAV/MP3 trials, ±200 ms: 72.3% -> 87.2% (TP 60->82; FP 16->16; FN 30->8)
- All 18 WAV/MP3 trials, strict: 57.8% -> 74.5% (TP 48->70; FP 28->28; FN 42->20)
- Four held-out WAV/MP3 trials, strict: 43.5% -> 56.0% (TP 10->14; FP 12->12; FN 14->10)
- Four held-out WAV/MP3 trials, ±200 ms: 78.3% -> 80.0% (TP 18->20; FP 4->6; FN 6->4)

These are small, deterministic artificial signals with limited timbres, not representative of arbitrary recordings, and exact score F1 must not be used to infer product-wide reliability.

## Per-file note outcomes

| Test | Format | Correct / extras / missing (strict) | F1 strict | Actual distinct pitch classes | Max concurrent notes tested in UI |
|---|---|---:|---:|---|---:|
| four-note chord | WAV | 4/0/0 | 100.0% | 48, 52, 55, 60 | 4 |
| four-note chord | MP3 | 4/0/0 | 100.0% | 48, 52, 55, 60 | 4 |
| six-note chord | WAV | 6/0/0 | 100.0% | 48, 52, 55, 60, 64, 67 | 6 |
| six-note chord | MP3 | 6/0/0 | 100.0% | 48, 52, 55, 60, 64, 67 | 6 |
| strong harmonics | WAV | 1/0/0 | 100.0% | 57 | 1 |
| strong harmonics | MP3 | 1/0/0 | 100.0% | 57 | 1 |
| eight-note chord | WAV | 8/0/0 | 100.0% | 48, 52, 55, 60, 64, 67, 71, 74 | 8 |
| eight-note chord | MP3 | 8/0/0 | 100.0% | 48, 52, 55, 60, 64, 67, 71, 74 | 8 |
| four C4 repeats | WAV | 4/0/0 | 100.0% | 60 | 1 |
| four C4 repeats | MP3 | 4/0/0 | 100.0% | 60 | 1 |
| E2-G2-A2-E2 bass | WAV | 4/0/0 | 100.0% | 40, 43, 45 | 1 |
| E2-G2-A2-E2 bass | MP3 | 4/0/0 | 100.0% | 40, 43, 45 | 1 |
| melody after 350ms silence | WAV | 1/8/5 | 13.3% | 48, 52, 53, 55, 60, 64, 67, 69, 72 | 5 |
| melody after 350ms silence | MP3 | 1/8/5 | 13.3% | 48, 52, 53, 55, 60, 64, 67, 69, 72 | 5 |
| heldout staggered six instruments (holdout) | WAV | 1/6/5 | 15.4% | 45, 52, 57, 61, 66, 73 | 6 |
| heldout staggered six instruments (holdout) | MP3 | 1/6/5 | 15.4% | 45, 52, 57, 61, 66, 73 | 6 |
| heldout dense chord (holdout) | WAV | 6/0/0 | 100.0% | 50, 54, 57, 62, 66, 69 | 6 |
| heldout dense chord (holdout) | MP3 | 6/0/0 | 100.0% | 50, 54, 57, 62, 66, 69 | 6 |

The 18 Chromium tests above used the standard `#fileInput` file control and waited for the actual review modal. They captured the actual SSEQ built by the production codec, not a parallel hand-coded substitute; no real server was contacted in these particular tests. Browser WAV/MP3 upload with mocked server is covered separately by `tests/browser_sseq_upload_pipeline.py`. Turnstile and Vercel staging are NOT TESTED.

## Runtime and third-party comparison

The local core spectral/encode pipeline, excluding audio file decoding, took 242.9 ms for frozen v1.7.2 versus 261.2 ms for 1.7.3 across all 18 tests. This is an unthrottled development machine measurement, not iPhone performance or a fair memory-peak test; Node resident process memory fluctuated from roughly 36 to 63 MiB.

As a separately tested open-source candidate, **librosa 0.11.0 YIN** with RMS silence gate was run on **the same 18 files**. It is inherently monophonic and obtained F1 26.5% (±200 ms) and 5.9% (strict). Inference on warmed-up local Python totaled 76.4 ms; the loaded Python interpreter reached approximately 368 MiB RSS, not an isolated inference-memory delta. This alternative is **not suitable to replace polyphonic transcription**. Spotify Basic Pitch and ndspy could not be installed in this no-network environment; they are NOT TESTED and are not advertised as benchmarked.

## Remaining limitations

The six-note staggered multi-instrument holdout has substantial onset/offset errors despite recovering every intended pitch class, and the example beginning with 350 ms silence produces three spurious pitch classes. A synthetic eight-note chord passed, but this is **not** evidence of arbitrary eight-instrument separation, nor a test against HeartGold hardware. Browser PCM previews approximate DS ADSR. Private user recordings and Nintendo sample files are not in the source ZIP.

For exact note arrays and full before/after case metrics, inspect `POLYPHONIC_BENCHMARK_RESULTS.json` and `LIBROSA_YIN_RESULTS.json`.
