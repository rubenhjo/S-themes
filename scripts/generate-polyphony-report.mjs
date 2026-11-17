import {readFileSync,writeFileSync} from 'node:fs';
const b=JSON.parse(readFileSync(new URL('../POLYPHONIC_BENCHMARK_RESULTS.json',import.meta.url)));
const a=JSON.parse(readFileSync(new URL('../LIBROSA_YIN_RESULTS.json',import.meta.url)));
const f=x=>(x*100).toFixed(1)+'%';
const m=(name,section)=>{const v=b.aggregate[section];return `${name}: ${f(v.before.f1)} -> ${f(v.after.f1)} (TP ${v.before.tp}->${v.after.tp}; FP ${v.before.fp}->${v.after.fp}; FN ${v.before.fn}->${v.after.fn})`};
let report=`# POLYPHONY QC — sigma-themes 1.7.3 (local release candidate)

## Root cause and exact three-stage trace

The v1.7.2 harmonic-ghost predicate rejected real pitches whenever their frequencies were near an integer multiple of a stronger lower note. On the original deterministic C3/E3/G3/C4 and C3/E3/G3/C4/E4/G4 synthetic recordings the missing pitches were **already absent from the spectral frame output**; the lane allocator and SSEQ writer preserved the pitches they received. The fix now requires more than one independent upper spectral partial before keeping a supported overtone-aligned note. It does **not** simply increase the voice cap.

| Fixture | MIDI truth | v1.7.2: analysis / lanes / SSEQ | 1.7.3: analysis / lanes / SSEQ |
|---|---|---|---|
`;
for(const name of ['four-note chord','six-note chord','eight-note chord']){
 const r=b.rows.find(x=>x.case===name&&x.codec==='wav');const old=[r.old.analysis,r.old.voices,r.old.sseq].map(x=>x.join(',')).join(' / ');const now=[r.new.analysis,r.new.voices,r.new.sseq].map(x=>x.join(',')).join(' / ');
 report+=`| ${name} | ${r.truth.join(',')} | ${old} | ${now} |\n`;
}
report+=`
## Independent MIDI reference and two tolerances

Each fixture has a Standard MIDI File generated from a deterministic event score; its parsed note-on/note-off pairs are the authoritative reference. WAV is PCM 16 bit at 11,025 Hz, MP3 is encoded with FFmpeg libmp3lame 192 kb/s. The exact same note events are tested as both codecs. The first scoring rule requires exact pitch and **both onset and offset within ±200 ms**. The stricter rule requires exact pitch, onset within **50 ms** and offset within **max(50 ms, 20% of reference note length)**. Matching is one-to-one. None of the truth annotations were changed to fit output. The bench compares the frozen v1.7.2 implementation and the current code, both through the same spectral, voice-packing, encoder and local parser stages.

- ${m('All 18 WAV/MP3 trials, ±200 ms','all_lenient')}
- ${m('All 18 WAV/MP3 trials, strict','all_strict')}
- ${m('Four held-out WAV/MP3 trials, strict','heldout_strict')}
- ${m('Four held-out WAV/MP3 trials, ±200 ms','heldout_lenient')}

These are small, deterministic artificial signals with limited timbres, not representative of arbitrary recordings, and exact score F1 must not be used to infer product-wide reliability.

## Per-file note outcomes

| Test | Format | Correct / extras / missing (strict) | F1 strict | Actual distinct pitch classes | Max concurrent notes tested in UI |
|---|---|---:|---:|---|---:|
`;
const ui=JSON.parse(readFileSync(new URL('../tests/fixtures/polyphony/browser_report.json',import.meta.url)));
for(const r of b.rows){const x=ui.find(y=>y.case===r.case&&y.codec===r.codec);
 report+=`| ${r.case}${r.heldout?' (holdout)':''} | ${r.codec.toUpperCase()} | ${r.new.strict.tp}/${r.new.strict.fp}/${r.new.strict.fn} | ${f(r.new.strict.f1)} | ${r.new.sseq.join(', ')} | ${x?.maxConcurrent??'NOT TESTED'} |\n`;}
report+=`
The 18 Chromium tests above used the standard \`#fileInput\` file control and waited for the actual review modal. They captured the actual SSEQ built by the production codec, not a parallel hand-coded substitute; no real server was contacted in these particular tests. Browser WAV/MP3 upload with mocked server is covered separately by \`tests/browser_sseq_upload_pipeline.py\`. Turnstile and Vercel staging are NOT TESTED.

## Runtime and third-party comparison

The local core spectral/encode pipeline, excluding audio file decoding, took ${b.rows.reduce((s,r)=>s+r.old.elapsedMs,0).toFixed(1)} ms for frozen v1.7.2 versus ${b.rows.reduce((s,r)=>s+r.new.elapsedMs,0).toFixed(1)} ms for 1.7.3 across all 18 tests. This is an unthrottled development machine measurement, not iPhone performance or a fair memory-peak test; Node resident process memory fluctuated from roughly 36 to 63 MiB.

As a separately tested open-source candidate, **librosa ${a.library.split(' ').at(-1)} YIN** with RMS silence gate was run on **the same 18 files**. It is inherently monophonic and obtained F1 ${f(a.summary.lenient.f1)} (±200 ms) and ${f(a.summary.strict.f1)} (strict). Inference on warmed-up local Python totaled ${a.summary.processing_ms_total.toFixed(1)} ms; the loaded Python interpreter reached approximately ${(a.summary.rss_kib_peak/1024).toFixed(0)} MiB RSS, not an isolated inference-memory delta. This alternative is **not suitable to replace polyphonic transcription**. Spotify Basic Pitch and ndspy could not be installed in this no-network environment; they are NOT TESTED and are not advertised as benchmarked.

## Remaining limitations

The six-note staggered multi-instrument holdout has substantial onset/offset errors despite recovering every intended pitch class, and the example beginning with 350 ms silence produces three spurious pitch classes. A synthetic eight-note chord passed, but this is **not** evidence of arbitrary eight-instrument separation, nor a test against HeartGold hardware. Browser PCM previews approximate DS ADSR. Private user recordings and Nintendo sample files are not in the source ZIP.

For exact note arrays and full before/after case metrics, inspect \`POLYPHONIC_BENCHMARK_RESULTS.json\` and \`LIBROSA_YIN_RESULTS.json\`.
`;
report=report.replaceAll('\`','`');
writeFileSync(new URL('../POLYPHONY_QC.md',import.meta.url),report);
