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
