## v1.7.4 stricter audio benchmark

Known 18 WAV/MP3 MIDI-ground-truth trials: strict F1 **74.47% → 100%** (TP 70→90, FP 28→0, FN 20→0). Three separate uninfluenced synthetic scores: **61.11% → 88.89%** (TP 11→16, FP 8→3, FN 6→1). See `ARRANGER_QC.md` and `ARRANGER_TIMING_RESULTS.json` for every note and both old/new times. This does not establish real-world audio transcription quality. Private Cute melody refinement reduces automatically selected notes (22 → 14 observed in isolated spectral analysis) and is **not musically verified**; possible pitches remain accessible via review.

---

# v1.7.3 — 18 matched WAV/MP3 tests against frozen v1.7.2

This is a **new separate 18-case benchmark**, not the historical v1.7.2 20-case score below. Each sample is sourced from independently specified Standard MIDI truth, rendered into WAV and MP3, and measured with exactly the same settings for old/new. A held-out set was not used to adjust the algorithm. See `POLYPHONY_QC.md`, `POLYPHONIC_BENCHMARK_RESULTS.json`, `LIBROSA_YIN_RESULTS.json` and the `.mid` source fixtures.

| Scope | v1.7.2 F1 | 1.7.3 F1 | Threshold |
|---|---:|---:|---|
| 18 WAV/MP3 files | 72.3% | 87.2% | exact pitch; start/end within 200ms |
| 18 WAV/MP3 files | 57.8% | 74.5% | exact pitch; start within 50ms; end within max(50ms, 20% of true duration) |
| Four held-out cases (WAV+MP3) | 43.5% | 56.0% | strict |

WAV and MP3 versions of solo with strong overtones, four C4 repeats, E2–G2–A2–E2 bass and synchronous 4-, 6-, 8-note chords scored exactly all expected notes with zero extras in strict testing. **Failed quality cases:** melody after 350ms silence (1 correct, 8 extra, 5 missing) and held-out six staggered instruments (1 correct, 6 extra, 5 missing), each per WAV or MP3. This result is insufficient to certify real-world polyphonic conversion.

**Open-source baseline:** librosa 0.11.0 YIN on all 18 inputs scored 26.5% lenient and 5.9% strict F1 because it is monophonic. Model not adopted. Basic Pitch **NOT TESTED** due unavailable package/network. Original private Cute melody preview comparison has 20/136B vs 22/144B notes/SSEQ; exact three inspection points unchanged and no human-controlled truth available. Its WAV previews are delivered privately, not inside source ZIP.

---

# AUDIO_BENCHMARK — sigma-themes v1.7.2 audio QC candidate

## Scope and ground truth

This is a deterministic **synthetic audio** before/after test, not a real-music transcription quality claim. The 20 scenarios are specified independently as note events in `tests/audio-benchmark.mjs`. A small, additive signal synthesizer renders those events at 11,025 Hz. Baseline transcriber is a frozen copy of v1.7.1 at `tests/baseline-v171-transcribe.js`; updated code comes from `sseq_transcribe.js`. Both receive the **same audio, sample rate, and default analysis options**. Truth is not inferred from either output.

A true positive is a unique estimated note with exactly correct MIDI pitch and both onset **and offset** within ±0.20 seconds. Match is one-to-one, choosing the lowest total time error; other estimates are false positives and unmatched truth are false negatives. The broad ±200 ms tolerance should not be mistaken for precise transient timing. Octave-confusion count is diagnostic, not a separately matched TP.

## Quantitative results

| Measure | Frozen v1.7.1 | v1.7.2 candidate |
|---|---:|---:|
| True positives | 43 | 47 |
| False positives | 8 | 1 |
| False negatives | 13 | 9 |
| Note precision | 84.31% | 97.92% |
| Note recall | 76.79% | 83.93% |
| Note F1-score | **80.37%** | **90.38%** |
| Octave-confusion indicators | 9 | 8 |
| Scenarios | 20 | 20 |

The candidate improves **+10.01 percentage points F1** on this fixture set. It does not perfectly recover six-voice dense chords or musically overlapping harmonic octaves. The benchmark reports exact case-level before/after results; rerun `npm run test:audio:benchmark`.

### What changed, and why

- **Higher harmonics:** A candidate is removed as a harmonic only when the lower note has convincing independent spectral evidence, rather than merely because a neat integer frequency ratio exists. An initially more aggressive heuristic removed real chord melody notes; it was rejected after Chromium regression and replaced by a conservative test.
- **Weak fundamental/bass:** The analysis now checks spectral peak locality when accepting a low-frequency candidate, reducing broad noise lobes and subharmonic leakage. Low notes are still uncertain in dense mixtures.
- **Octave voices:** A separate harmonic support check allows independently supported upper notes to survive some fundamental-overlap cases, while guarding against converting every overtone into a musical event.
- **Temporal aggregation:** Existing smoothing, onset separation and note duration logic are retained and tested; this release is **not** a pretrained multipitch instrument separator.

These are small, reproducible, bounded changes to the existing client algorithm, not a complete reconstruction architecture. The browser uses a Worker where available; no server inference or third-party licensed model bytes were added.

### Concrete case limitations

Run the benchmark to see per-case TP/FP/FN. At least one note remains missing in the four-note chord and more in the six-note chord; independently voiced instruments can also overlap. Do not use this result to promise accurate extraction of arbitrary mixed pop songs. Synthetic additive tones do not span live drums, reverberation, room noise, compressed masters, vibrato, changing timbre, or actual microphone recordings.

## Original private recording: Cute melody(1).m4a

- Reference SHA-256: `84cb65fa0f50e19e1d82629c0aa100e1aec5c9de9a48d03809b62bf16cde53dc`
- Runtime: approximately 7.744 seconds.
- Frozen v1.7.1 produced **23 note events / 147-byte SSEQ**.
- Updated v1.7.2 local Chromium run produced **20 note events / 136-byte SSEQ** (approximately 7.5 seconds, one generated track).
- At approximately **3.18 s** updated candidate pitch 65; **6.52 s** pitch 59; **7.36 s** pitch 44. The earlier suspicious low pitch 35 near 6.52 s is now absent, but its absence alone is **not** proof that it was spurious.
- The resulting SSEQ parses locally and can be previewed. It has **NOT** been compared against a complete human-annotated note transcription, so note-level precision/recall and audible musical equivalence are **NOT VERIFIED** for this recording.

The private recording itself and original Nintendo soundbank files are never included in this public-source ZIP. To rerun locally, supply your own authorized copy to `python tests/browser_user_audio_local_only.py '/path/Cute melody(1).m4a'`.

## Optional engines investigated; not integrated

Basic Pitch has a browser-friendly polyphonic transcription implementation but brings model weights and resource requirements; dedicated measurements on our fixture set and target iPhone hardware were not carried out. YIN/pYIN primarily address monophonic pitch, not a drop-in fix for six overlapping voices. Librosa and aubio are useful for desktop prototyping but require separate browser/WASM infrastructure. Essentia and model weights may have distinct copyleft/noncommercial licensing constraints; do not bundle them without an explicit license review. MT3 and other transformer models have larger runtime demands and lack a verified low-cost Vercel+mobile deployment here. **All are untested alternatives, not benchmark winners.**

## Run

```bash
npm ci
npm run test:audio:benchmark
npm run test:browser
python tests/browser_user_audio_local_only.py '/private/path/Cute melody(1).m4a'
```

Criterion for musical release approval: externally annotated real recordings, instrument-level precision/recall, onset/offset tolerances tighter than 200 ms, a listening comparison, and actual HeartGold playback. **NOT MET.**
