## v1.7.5 remaining release blockers

- **LOCAL VERIFIED:** 300-second WAV/MP3 can pass real browser conversion, song-local editor and SSEQ-only mocked submission; long-song edit model no longer has O(n²) overlap checks. See `FIVE_MINUTE_QC.md`.
- **OPEN:** Dense or full-band 5-minute music still cannot be guaranteed musically accurate or within the **65,536-byte SSEQ** cap. Source audio must be ≤128 MiB and browser decoder memory is device-dependent. Do not silently discard notes to satisfy a size limit.
- **NOT TESTED:** physical Safari/iPhone, native HeartGold US, native Sigma Dex import, actual deployed production publication, isolated Supabase staging/Turnstile, deletion migrations. The earlier v1.7.4 risks remain.

---

## v1.7.4 status / remaining blockers

- **OPEN:** Performance and accuracy on arbitrary polyphonic recordings, especially genuine multitrack music, with verified human note truth. Three blind synthetic cases score 88.9%, not 100%. Private Cute melody automatically keeps fewer notes and MIDI44 near 7.36s is uncertain; use per-song candidate review, not an auto guarantee.
- **NOT TESTED:** real Vercel Preview+Cloudflare Turnstile with isolated Supabase, public song lifecycle/deletion, signed 60-second URL expiry, staging migrations; external `ndspy`; actual Sigma Dex importer; lawful HeartGold US; physical iPhone Safari; current GitHub main.
- **PENDING SQL:** two migrations not applied; old production index and RPC reject independent same-byte uploads, deletion columns absent. Historic SQL retained separately.
- Existing `KNOWN_ISSUES.md` is canonical numbered ledger, not automatically resolved by local Node/browser successes.

---

# v1.7.3 active issue ledger summary

**Canonical complete ledger:** `KNOWN_ISSUES.md`. 68 recorded cases: **18 OPEN, 13 BLOCKED, 7 FIXED – NOT VERIFIED, 30 VERIFIED**. Entries from prior versions are not removed. For latest: ST-065 staging-unverified duplicate uploads; ST-066 observed polyphonic timing/extra note failures; ST-067 unavailable remote GitHub/HeartGold/Sigma Dex/iPhone/third-party reader; ST-068 no isolated Vercel Preview + Supabase staging. SSEQ chord octave loss is repaired for **the explicit synthetic simultaneous chord cases only**, not for arbitrary audio.

**NOT TESTED** due missing external resources: actual Vercel Preview+Turnstile and staging Supabase migration/upload/deletion/old links; current GitHub HEAD; third-party ndspy; actual Sigma Dex application and lawfully sourced HeartGold US runtime/emulator; physical iPhone Safari. **NOT MUSICAL PASS** for post-silence melody and staggered multi-instrument onset timings. See `POLYPHONY_QC.md` for exact failures.

---

# OPEN_ISSUES — sigma-themes v1.7.2

The canonical, item-by-item, historically preserved issue ledger is **`KNOWN_ISSUES.md`**. Each entry has severity, status, reproduction/impact, root cause, change, evidence and remaining limitations. `npm run issues:sync` maintains the summary; `node scripts/check-known-issues.mjs` checks consistency.

## Current ledger status (2026-11-16)

| Status | Count |
|---|---:|
| OPEN | 17 |
| BLOCKED | 11 |
| FIXED – NOT VERIFIED | 6 |
| VERIFIED | 30 |
| **Total** | **64** |

This summary is not permission to ignore old cases. The 61 historical entries are preserved; three new entries were appended as ST-062 through ST-064. No previously blocked matter was automatically promoted to verified just because tests pass locally.

## Release-critical still open or blocked

1. **Mixed-recording polyphonic transcription (ST-063, OPEN):** Complete six-tone harmonic-overlap and multi-instrument separation remains incomplete, with false negatives; no validated human transcript for Cute melody. Improvement on 20 additive fixtures is useful, but not proof of broad musical accuracy.
2. **HeartGold runtime and Sigma Dex (BLOCKED):** Native importer, sound mixing, PSG/noise, ADSR and in-game SSEQ replacement have not been exercised with a legally available HeartGold US ROM/DS test setup. Independent in-project Python parsing is not third-party Nitro compatibility.
3. **Production Supabase schema (ST-064, BLOCKED):** Connected S-themes instance was inspected read-only; existing `theme_tracks` lacked deletion tombstone columns and no applied deletion migration was listed. Needs backed-up staging and actual verified rollout; no real songs were touched.
4. **Production upload/recovery and Turnstile (BLOCKED):** API mocking plus Chromium tests do not prove Vercel/Supabase/RLS/Turnstile real network lifecycle or load behavior. Test staging with anonymous upload, publish, recovery, rate limits and delete.
5. **Safari and physical iPhone (BLOCKED/NOT TESTED):** Browser suites used Chromium only; confirm first play, audio context resume, cancellation, sample loading, memory and mobile UI on a physical iPhone.
6. **Authentic instrument render (OPEN/NOT VERIFIED):** PCM uses decoded original waves locally with approximate browser ADSR, while PSG/noise and exact Nintendo DS mixer differences remain unmodeled. Bank-local preview and SSEQ player now share PCM scheduling, but cannot promise bit-exact sound.
7. **Model replacement assessment (NOT TESTED):** Spotify Basic Pitch, librosa/pYIN, Essentia, aubio and MT3 were not integrated or A/B-benchmarked in mobile browser. Evaluate license, model size, latency and quality before selecting one.

## Important status distinctions

- **VERIFIED LOCAL** means the described local test actually passed, not a deployment approval.
- **FIXED – NOT VERIFIED** means code changed without enough realistic evidence.
- **BLOCKED** identifies explicit unavailable infrastructure, reference data or a required human decision.
- **NOT TESTED** is never equivalent to PASS.

For complete issue IDs, actual verification evidence and remaining restrictions, see `KNOWN_ISSUES.md`, `QC_REPORT.md`, `AUDIO_BENCHMARK.md`, and `HEARTGOLD_COMPATIBILITY.md`.
