# v1.7.5 — five-minute integration checks (local, 2026-11-17)

- PASS: `npm run verify` (164/164 Node tests, syntax, known and held-out synthetic benchmarks, ledger, layout, example package), executed on this v1.7.5 tree.
- PASS: `python tests/run_browser_tests.py` (25/25 Chromium suites, including 300-second WAV and MP3 with real file picker/Worker/arranger; upload endpoints mocked).
- PASS: `python tests/independent_sseq_reader.py` and `python tests/test_runner_timeout.py` (in-project independent reader and runner process cleanup).
- PASS: `node --test tests/five-minute-arranger.test.js` (2/2) — 8,000 note model construction without O(n²) UI freeze, exact-adjacent overlap check.
- PASS: `python tests/browser_five_minute_import.py` (WAV and MP3) — real 300 s, 44.1 kHz stereo file picker and actual Worker, 150/150 exact known pitches, max 18.3 ms onset error/20.0 ms offset error, final SSEQ 1,091 bytes, one mocked publish finish each. Temporary recordings deleted.
- NOT TESTED: production Vercel, database, Turnstile, physical iPhone, native HeartGold and Sigma Dex. No live music/IDs were changed.
- See `FIVE_MINUTE_QC.md` for exact source dimensions, time ranges, proof and limits. Earlier v1.7.4 and v1.7.3 results below are historical.

---

# v1.7.4 — tests actually run on the local working source (2026-11-16)

| Test / process | Result | Scope |
|---|---|---|
| `npm test` | **162/162 PASS** | Node logic, safety, arrangement, separate notes, migrations and original functionality |
| `npm run verify` | **PASS** (as run before the last appended two small Node regressions; the full 162 were separately tested) | lint, Node, old + new MIDI-timed synthetic benchmarks, release layout, issue ledger, Sigma Dex example |
| `python tests/run_browser_tests.py` | **24/24 PASS** | Chromium browser suites including WAV/MP3 editor, 18 polyphonic file uploads, classic features, music player, five MIDI, deletion and recovery |
| `python tests/browser_arranger_controls.py` | **PASS** | WAV+MP3 song-local changes, preview/upload exact byte equality and repeated C4 one-strike exclusion, mocked network |
| `python tests/browser_polyphonic_filepicker.py` | **18/18 PASS** | 9 MIDI-ground-truth examples each WAV+MP3 through the new browser file picker; mocked network |
| `npm run test:sseq` | **18/18 PASS** | SSEQ unit regression |
| `python tests/independent_sseq_reader.py` | **PASS** | Independent in-project Python reader, not `ndspy` |
| `node scripts/validate-sigma-dex-pack.mjs examples/sigma-dex-example-music.zip` | **PASS** | Synthetic example ZIP, not real Sigma Dex application import |
| `python tests/test_runner_timeout.py` | **PASS** | Browser process-group timeout cleanup |
| SHA-256 release source manifest | PENDING final packaging verification | Recorded after docs are finalized |
| Vercel Preview + isolated Supabase staging + Turnstile | **NOT TESTED** | Only connected Supabase project is the existing production instance; no staging Preview or auth keys |
| Current GitHub `main` merge | **NOT VERIFIED** | Repository could not be reached from this environment |
| External `ndspy` SSEQ reader | **NOT TESTED** | Python package unavailable in offline environment |
| Native Sigma Dex importer + legal HeartGold US | **NOT TESTED** | No private game test runtime or native importer available |
| Physical iPhone / Safari | **NOT TESTED** | No attached Apple test hardware |

**Timing benchmark (known 18 source WAV/MP3 files):** strict 50 ms onset / max(50 ms, 20% duration) offset F1 74.47% -> 100%. **Three additional untuned synthetic cases:** 61.11% -> 88.89%. Neither proves real-world musical accuracy.

**Protected private test:** Cute melody 7.744 s SHA-256 independently checked, original v1.7.3 spectral events 22, conservative new auto events 14 (uncertainty), potential MIDI 44 close to 7.36 s preserved as an optional editable candidate. No true-note labels available, so audio fidelity **NOT VERIFIED**. Private file not in public source ZIP.

**Live database:** read-only inspection of current connected S-themes Supabase; the old unique `(sha256,sseq_id)` index and hash rejection RPC are still present, deletion tombstones not migrated. No existing song, ID, playlist, or Storage object was changed.

**Interpretation:** Browser API fetches used mocks. Mocked 24/24 PASS does not establish production publishing latency, SSEQ in-game behavior or signed-link expiry.

---

# v1.7.3 — observed tests and explicitly untested external verification

Historical v1.7.2 results below belong to that **different** version. Current source: `1.7.3-polyphony-qc-rc1`. Evidence for new benchmark and real file chooser in `POLYPHONY_QC.md` and generated `tests/fixtures/polyphony/browser_report.json`.

- `npm ci --offline --no-audit --no-fund` — PASS (cached lockfile dependencies; no network download)
- `npm run lint` — PASS
- `npm test` — PASS **154/154**
- `npm run verify` — PASS (154 tests, legacy audio benchmark, new matched-polyphony bench, issue ledger, layout, example pack)
- `npm run test:sseq` — PASS
- `python tests/independent_sseq_reader.py` — PASS (independent-in-repo Python parser; **not** ndspy)
- `node scripts/validate-sigma-dex-pack.mjs examples/sigma-dex-example-music.zip` — PASS (pack integrity, **not** Sigma Dex application import)
- `python tests/browser_polyphonic_filepicker.py` — PASS, 18/18 WAV/MP3 using actual browser file chooser and production review SSEQ conversion; simulated site, no server write
- `python tests/alternative_librosa_yin.py` — PASS as comparator execution; its polyphonic F1 was poorer and it was not selected
- External `ndspy`, Vercel Preview, isolated Supabase staging, true Turnstile uploads, native Sigma Dex application, physical iPhone, private HeartGold US ROM — **NOT TESTED** (unavailable)

See the appended final clean-ZIP checks later in this file for the distribution validation record.

---

# TEST_RESULTS — v1.7.2 candidate (2026-11-16)

Only tests witnessed in this working container are marked PASS. Backend and authentication mocks **do not** constitute production verification. Older reports below are historical and may contain superseded counts and versions.

| Test | Result | Evidence / qualification |
|---|---|---|
| `npm ci --offline` | **PASS** | Package lock and installed dependency tree in isolated environment |
| `npm run lint` | **PASS** | JavaScript source syntax checks |
| `npm test` | **PASS 147/147** | Node unit, SSEQ, security, original sample schedule and audio-link expiry tests |
| `npm run verify` | **PASS** | Full test suite, synthetic before/after benchmark, ledger counts, layout, Sigma Dex synthetic pack |
| `node scripts/check-release-layout.mjs` | **PASS** | Lockfile matches `package.json`; required files all present |
| `npm run test:sseq` | **PASS** | Restricted Nitro SSEQ generated subset; site-specific 16 tracks and ≤65,536 bytes checks |
| `python tests/independent_sseq_reader.py` | **PASS** | Independently implemented Python parser checked WAV, MP3, synthetic chord-output SSEQ; **not** ndspy or DS |
| `python tests/test_runner_timeout.py` | **PASS** | Browser process isolation and timeouts |
| `npm run test:audio:benchmark` | **PASS** | 20 deterministic cases, frozen v1.7.1 TP43 FP8 FN13 F1=0.8037; new TP47 FP1 FN9 F1=0.9038 |
| `tests/run_browser_tests.py` suites | **PASS 21/21** | Real Chromium UI/playback/Worker/SSEQ conversion, mocked server and Turnstile, no network acceptance |
| `python tests/browser_original_sources_local.py PRIVATE_ZIP` | **PASS** | Real private SBNK/SWAR SHA-256, original PCM triggered from both instrument preview and SSEQ player; original files excluded |
| 78 original SBNK/SWAR files | **PASS 78/78** | Private local SHA-256 imports, 39 SBNK + 39 SWAR, 506 PCM region lookups, 365 loop-capable |
| `python tests/browser_user_audio_local_only.py PRIVATE_M4A` | **PASS technical / musical NOT VERIFIED** | 20 notes / 136-byte SSEQ; correct notes, onset and audible fidelity have no independent human truth |
| GitHub Actions at current `main` | **NOT TESTED** | No authenticated repo/Actions results |
| ndspy / independent third-party Nitro parser | **NOT TESTED** | Installation unavailable inside isolated environment |
| HeartGold US via emulator or physical DS | **NOT TESTED** | No game ROM, game-patch injector or emulator integration provided |
| Sigma Dex deployed importer | **NOT TESTED** | In-project example pack validates; external import not exercised |
| Live Vercel, Turnstile, Supabase write/delete/publish | **NOT TESTED** | Connected project was only inspected read-only; missing song deletion migration |
| Physical iPhone / real Safari WebKit | **NOT TESTED** | No WebKit or physical iOS device available in environment |

The 21 browser suites: sprite_visibility, public, sseq_upload_pipeline, upload_recovery, catalog_integrity, sigma_export, sseq_conversion, sseq_player, upload_dialog, midi_five, all_instruments, hg39_catalog, multi_midi, exports, qc5, qc7, upload_cancel, song_deletion, transcription_worker, progress_health, status. These were run individually, with the temporarily failing chord suite fixed and rerun PASS.

`browser_original_sources_local.py` uses a **test-only real-Python-hash shim** for `crypto.subtle.digest` because the execution sandbox disallows browser loopback navigation; hashes are computed with `hashlib.sha256` on the original bytes and compared with expected source fingerprints. This is not deployed code and is not a secure-origin browser integration test.

---

## Historical snapshots (preserved)

# sigma-themes v1.4.2 SSEQ-only — test results

Testing date: 2026-11-15. Only runs witnessed in the current workspace are marked PASS. No Supabase/Vercel credentials or lawful playable original HeartGold ROM were supplied. Browser API fixtures are mocks, not an infrastructure acceptance test.

| Test | Status | Command / measured result | Qualification |
|---|---|---|---|
| Node JS syntax and tests | **PASS** | `npm run verify`: 88 of 88 Node tests PASS after SSEQ continuation; `npm run lint` syntax checked client/API/worker | Unit/stubbed backend; rerun in release |
| Real WAV without MIDI to SSEQ | **PASS** | `python tests/browser_sseq_conversion.py`: `melody.wav` → 59-byte `SSEQ`, notes C4 D4 E4 G4 | Synthetic monophonic ~2 sec |
| Real MP3 without MIDI to SSEQ | **PASS** | Same test: distinct `melody_b.mp3` → 59-byte SSEQ, G4 F4 D4 C4 | Synthetic monophonic ~2 sec |
| MIDI and existing SSEQ inputs | **PASS** | MIDI note events parsed; SSEQ passthrough hash/bytes unchanged in Chromium | Only supported event subset |
| Browser SSEQ audio synth | **PASS** | Real SSEQ fetched from a blob, playback advanced and pause succeeded; `browser_sseq_player.py` additionally verifies delayed fetch cancellation and gain controls | WebAudio oscillators, not original bank samples or measured LUFS |
| Corrupt MP3 input | **PASS** | Chromium `convertFile` rejected invalid 4-byte input | Not a fuzzing campaign |
| Harmony-preservation test | **PARTIAL / FAIL QUALITY** | Synthetic chord mix now contains C3 E3 G3 plus G4 F4 D4 C4, but adds spurious 47/53 | Not representative of real full-mix fidelity |
| Bank-profile generator | **PASS (local)** | `python scripts/build_bank_profiles.py PRIVATE_ZIP heartgold_bank_profiles.json`: 39 SBNK, 39 SWAR, 362 slots; note/sample references enumerated | Native game playback NOT TESTED |
| Automatic playable SBNK program fallback | **PASS** | `tests/sseq-auto-bank.test.js`: selected program 39 cannot sound note 20; conversion selects valid program in the same bank; preferred playable program is preserved | Synthetic MIDI, no game playback |
| SSEQ example Sigma Dex ZIP | **PASS** | `node scripts/create-sigma-dex-example.mjs` then `node scripts/validate-sigma-dex-pack.mjs examples/sigma-dex-example-music.zip`: 3 SSEQ files | Future Sigma Dex importer NOT TESTED |
| SSEQ-only download/backup path | **PASS (unit)** | `tests/sseq-core.test.js`: safe `.sseq` path and binary SSEQ validity | Full end-to-end backup with live Storage NOT TESTED |
| Direct anonymous RLS restriction | **PASS (static)** | SQL migration source contains SSEQ-only anon SELECT filter/revoked writes | Live PostgreSQL/Supabase NOT TESTED |
| Browser WAV/MP3 file-input → simulated signed PUT → simulated publication | **PASS (MOCKED UI)** | `tests/browser_sseq_upload_pipeline.py`: both distinct synthetic WAV/MP3 converted at upload selection, transferred only 59-byte SSEQ, matched 4 expected notes, playlist/catalog refreshed | API, Turnstile and Web Crypto are stubbed in this sandbox; authentic localhost secure origin blocked, NOT a real Supabase test |
| Updated combined browser suite | **PASS 7/7 (fixtures/mocks)** | `npm run test:browser`: sprite placement, public responsive UI, SSEQ upload UI mock, catalog integrity, Sigma export UI and real WAV/MP3/MIDI/SSEQ conversion and SSEQ player race/level test | Historical large-MP3/TUS cancel suite removed from ACTIVE runner; new SSEQ cancel test still required |
| Secure-origin Web Crypto UI test | **BLOCKED** | `SIGMA_BROWSER_USE_REAL_CRYPTO=1 python tests/browser_sseq_upload_pipeline.py`: Chromium `ERR_BLOCKED_BY_ADMINISTRATOR` navigating 127.0.0.1 | Mocked browser PUT flow independently PASS; not live upload validation |
| Large source pre-decode guard | **PASS** | Synthetic file descriptor >128 MiB rejected without reading bytes | Real long mobile recording NOT TESTED |
| Independent multitrack SSEQ reader | **PASS** | `python tests/independent_sseq_reader.py`: three SSEQ fixtures, multitrack pointer parsing, loop event | Not ndspy or emulator |
| Original HeartGold playback / melonDS / measured SDAT delta | **BLOCKED** | No authorised test ROM or game build | Structural validity alone does NOT qualify |
| GitHub Actions + real Vercel/public upload | **NOT TESTED** | Need configured project and secrets | Do not claim site already replaced |

Run `npm run verify`, `npm run test:example`, `npm run validate:pack -- examples/sigma-dex-example-music.zip`, and `python tests/browser_sseq_conversion.py`. The separate `tests/browser_sseq_upload_pipeline.py` uses mocked WebCrypto when `SIGMA_BROWSER_USE_REAL_CRYPTO` is unset, and requires real localhost secure context when it is `1` (used by GitHub CI). Real staging must be tested separately.

**Do not reuse v1.3 reports that refer to WAV/IMA-ADPCM exports as present-day SSEQ evidence.** That material is archived in `docs/ARCHIVED_TEST_RESULTS_v1.3.md`.

### v1.4.3 – hidden HeartGold developer panel

- Automated Node validation: 88/88 passing.
- Chromium Playwright: `python tests/browser_upload_dialog.py` PASS; page has no visible developer program/slot controls, upload dialog selects the target slot and loop, and the native file chooser opens.
- GitHub Actions failures shown in the user screenshot have **not** been diagnosed without the remote failing step logs; a local `127.0.0.1` navigation can be blocked by this sandbox.


### v1.4.4 — CI fixture / status repair (2026-11-15)

- **PASS locally:** `npm ci`, `npm run verify` (88/88), `npm run test:sseq` (18/18), `npm run test:example`, package ZIP validation, `python tests/test_runner_timeout.py`.
- **PASS locally (real Chromium background Worker via Blob):** `python tests/browser_transcription_worker.py` converted the distinct synthetic WAV and MP3 melodies into binary 59-byte SSEQ with correct note sequences. This verifies the real Worker script logic, without requiring a restricted local network origin.
- **PASS locally (all 10 browser suites):** `python tests/run_browser_tests.py` completed all ten isolated Chromium suites (mocked backend).
- **PASS locally (UI):** `python tests/browser_status.py`: catalog failure shows actionable error, and successful retry restores connected status.
- **Fixed fixture code, GitHub rerun required:** In `SIGMA_BROWSER_USE_REAL_CRYPTO=1`, test HTTP handler serves real transcription worker JavaScript instead of generic HTML. The local sandbox cannot navigate 127.0.0.1, so **the GitHub secure-origin suite is not claimed PASS yet**.
- **GitHub static-and-audio status:** Source archive passes all reproduced local steps. The exact GitHub failure remains unverified without a failing step log or authenticated GitHub repo snapshot. New CI steps report each independent failure clearly. Do not mark GitHub green until a new Actions run confirms it.
- **Production limitations:** Actual Supabase storage, public catalog connection, Turnstile, validator schedule, native HeartGold playback and faithful multi-instrument transcription remain not independently validated.

## v1.7.3 final browser and example hash verification

- `python tests/run_browser_tests.py` — PASS **21/21** Chromium suites in the release worktree (mocked server; not Vercel).
- `python tests/browser_polyphonic_filepicker.py` — PASS **18/18** ordinary file chooser/review flow over 9 WAV + 9 MP3 synthetic sources.
- `python tests/verify_example_zip_hashes.py` — PASS **3/3** synthetic SSEQ tracks; each archive `music/*.sseq` SHA-256 equals `tracks.json` SHA-256 and source_SHA256, with exact sizes. These are synthetic examples, **not** an active Supabase catalog snapshot.
- `python tests/external_ndspy_optional.py` — **NOT TESTED**, the `ndspy` package is unavailable offline and its standalone command reports the absence; project's Python parser is different code and has passed.
