# sigma-themes v1.7.5 — five-minute WAV/MP3 integration (local release candidate)

Date: 2026-11-17. Base: full `sigma-themes-v1.7.4-arranger-full.zip` source artifact, **not** a verified merge of GitHub `main`.

## Implemented in this revision

1. Fixed an O(n²) overlap-search loop in `sigma_arranger.js` using an active-interval min heap, and amortized program compatibility checks by unique pitch for repeated notes. The result does not change any previously accepted-note or SSEQ export schema.
2. Long songs open in a bounded 15-second interval in `sigma_arranger_ui.js`, with previous/next controls and explicit interval inputs. Max 240 rendered interactive note buttons per part; all notes outside the visible interval stay in the arranged full-song SSEQ. Short tracks retain their earlier editor presentation.
3. Added reproducible full-length WAV and MP3 tests using browser file picker, actual deployed transcription Worker code, arranger review and mocked final-SSEQ-only upload; the source fixtures are generated and removed during the test.
4. New Node regression guards for an 8,000-event arrangement stress input and precise boundary overlap behavior. CI now installs/verifies MP3 codec in browser job and runs the long integration test alongside prior tests.

## Measurements reproduced locally

- `npm run verify` **PASS**, Node unit tests **164/164 PASS**, lint, full timing and synthetic benchmarks, issue ledger, release layout and example SSEQ package.
- 300-second WAV, 44.1 kHz stereo PCM16, 52,920,078 bytes: 150/150 exact known notes, maximum 18.3 ms note-on error, 20.0 ms note-off error, last note ending 299.75 s, one accepted 1,091-byte SSEQ in mocked upload.
- 300-second MP3, 44.1 kHz stereo 192kbps, 7,201,688 bytes: same independent 150/150 result and exactly one upload completion in the mock.
- Synthetic arrangement of 8,000 events completes in ~15 ms locally, rather than quadratic cross-comparison.
- Browser suite results: see `TEST_RESULTS.md` (and the actual script in `tests/run_browser_tests.py`).
- Independent in-repository Python Nitro-SSEQ parser **PASS**; separate test confirms subprocess timeout cleanup **PASS**. A real hardware decoder/native Sigma Dex compatibility check is **not** established.

## Outstanding release blockers (not disguised as completed)

- Real, dense, polyphonic five-minute tracks may be inaccurate, too large for 65,536-byte SSEQ, exceed the 128 MiB source limit or overrun mobile memory. Test with diverse user-provided recordings and a physical iPhone.
- Browser upload tests replace server endpoints with mocks. **No** production Vercel, Turnstile, Supabase permission/quota workflow, staging schema migration, native Sigma Dex import, real HeartGold hardware/emulator, or deployed website was tested here.
- The current public GitHub `main` was not fully fetched/merged due outbound DNS limits. Do **not** force-overwrite unknown remote changes. Compare on a feature branch and deploy to an isolated Preview/staging stack first.
- Live track rows, storage files, song IDs, folders, playlists and other user data were never touched. A separate pending deletion/tombstone migration must pass staging before any production application.

## Installation and tests

The attached ZIP contains the **complete source tree**, including `.github` CI, `package.json`/lockfile, existing catalogue/player code and assets, instrument-bank metadata, SQL, tests, editor and SSEQ exporters. Unzip into a branch, run `npm ci`, `npm run verify` and `python tests/run_browser_tests.py` with FFmpeg, Playwright and Chromium available. Review `DEPLOYMENT.md` and `KNOWN_ISSUES.md` before any deployment. The user need only supply a WAV/MP3 and accept Auto in the normal upload flow; MIDI is optional.
