# sigma-themes v1.3.0 — actual local QA results (2026-11-15)

| Area | Status | Verification | Limits |
|---|---|---|---|
| JavaScript syntax + issue statistics | **PASS** | `npm run verify` | Not a deployed build |
| All Node tests | **PASS 71/71** | `npm test` includes folder planning, nested selection, duplicate titles, loop rounding, exact ZIP manifest, SHA verification, damaged ZIP and cancellation, plus all earlier 61 cases | Synthetic/mocked backend |
| Chromium regressions | **PASS 8/8** | `npm run test:browser` completed with exit 0, including new `browser_sigma_export.py` for real UI creation of folder/subfolder, editing a song and folder selection | Browser network/API/sprites fixture-mocked; no live Supabase |
| Responsive sprite placement | **PASS (mocked sprite pixels)** | `browser_sprite_visibility.py` screenshot differences confirm ≥6 distinct placement groups at 390/768/1440/1920; no sideways scroll | Real Sigma-dex URLs were checked separately via public web retrieval, not Chromium image network |
| Real Sigma-dex sprite source URLs | **PASS (17 URL lookups)** | Each referenced `front.png` was opened from `arvindfroi/sigma-dex` during development; 17 distinct images returned | No production deploy/CDN availability guarantee |
| Sample Sigma Dex ZIP | **PASS** | `npm run test:example` generated `examples/sigma-dex-example-music.zip`; standalone CLI validator checked format, all entries, CRC, hashes, hierarchy and `smpl` | Does not demonstrate import into Sigma Dex |
| Synthetic example WAVs | **PASS 3/3** | FFprobe reported `adpcm_ima_wav`, 32728 Hz, stereo for each extracted example, and FFmpeg decoded all without error | No melonDS/in-game playback |
| ZIP64 / many long tracks / constrained mobile RAM | **NOT TESTED** | One ZIP32 package capped by format and browser RAM; 200 planned / 10 packed track regression covers nontrivial subsets | ST-049 OPEN |
| Persistance of folder tree on two physical devices | **NOT TESTED** | Local browser state and backup fields implemented; Playwright UI uses isolated local storage | ST-050 OPEN for shared sync |
| Real Vercel / Supabase / Realtime / TUS / Turnstile | **NOT TESTED** | No live credentials or staging service | Must run dedicated staging suite before production certification |
| Future Sigma Dex import | **NOT TESTED** | Export contract documented and validated locally | Receiver is explicitly out of this repo's scope |

## Reproduce

```bash
npm ci
npm run verify
npm run test:ffmpeg
npm run test:browser
node scripts/validate-sigma-dex-pack.mjs examples/sigma-dex-example-music.zip
```

The browser tests substitute synthetic sprite PNGs **only for layout testing**, not for production assets. Actual URLs in `sigma_dex_sprites.js` point to official Sigma-dex assets. Import into Sigma Dex, actual Supabase quota enforcement, and authentication-free public upload require independent staging tests and are not labeled PASS.

---

## Historical QC7 results (retained for traceability)

# QC7 — Actual test results (2026-11-14)

| Area | Result | Commands / actual coverage | Limits |
|---|---|---|---|
| JavaScript syntax | **PASS** | `npm run lint` checks application, API, trusted worker and helper modules | No typechecking or production bundle |
| Node unit/regression suite | **PASS 57/57** | `npm test` covers old tests plus QC7 pagination, JSON status, quota invariants, status reuse and media decode | Supabase calls mocked where applicable |
| Issue journal / QC counts | **PASS** | `node scripts/check-known-issues.mjs` checks unique ST IDs, required fields, status evidence and identical machine statistics in QC_REPORT | Status descriptions still depend on human verification |
| Chromium user interaction | **PASS 7/7** | `npm run test:browser` uses seven isolated Chromium scripts; old six pass plus new ST-037 stale reservation browser test | Browser network API mocked, not live service |
| Aggregate Chromium runner | **PASS twice in this turn** | `npm run test:browser` completed with deterministic exit code 0 in two separate local runs | Historical intermittent hang ST-033 remains OPEN until CI evidence |
| 390/768/1440/1920 sprite layout | **PASS (local)** | `browser_sprite_visibility.py`, pixel difference and six distinct visible Sigma motifs | Safari/physical device NOT TESTED |
| Full media validation | **PASS 5/5** | `node --test tests/media-validation.test.js`; valid MP3/WAV, invalid ID3, fake extensions, empty/truncated, SHA mismatch, codec/rate/channel/duration bounds | Worker running against real Supabase NOT TESTED |
| Nintendo DS file codec | **PASS** | `npm run test:ffmpeg` / FFprobe identifies `adpcm_ima_wav` 32728Hz stereo, `smpl` present | In-game playback NOT TESTED |
| SQL quota / row-lock serialization | **NOT TESTED** | SQL inspected and structural test passed | PostgreSQL/Supabase staging unavailable |
| Live upload (PUT/TUS/Turnstile) | **NOT TESTED** | Chromium mocks tested cancel/retry; real Supabase not connected | Requires staging and Turnstile credentials |
| GitHub validator job | **NOT TESTED** | Workflow YAML, worker and local media decoder present | Requires real GitHub Actions secrets/workflow dispatch |
| Two-client Realtime | **NOT TESTED** | Previous mocked reconnect/browser suite passed | No live Supabase instance |
| Multigigabyte ZIP and mobile memory | **NOT TESTED** | Unit ZIP integrity and multipart tests pass | Physical mobile / large dataset missing |
| Actual HeartGold integration | **BLOCKED** | Audio encoding/ID mapping only, no source/hook for this game's separate fork | Need mod source/build + melonDS test |

## Re-run

```sh
npm ci
npm run verify
npm run test:ffmpeg
python -m pip install playwright pillow
python -m playwright install chromium
npm run test:browser
```

The new trusted worker must be verified independently on a staging Supabase project; a local mock cannot validate PostgreSQL transactional behavior, Storage, Turnstile or GitHub scheduler reliability. See `README.md` and `KNOWN_ISSUES.md` for the exact remaining gates.

## Recheck tests — 2026-11-15 (v1.2.1)

- **PASS** baseline `npm run verify` on original v1.2.0 ZIP: 57/57 Node tests, syntax, issue ledger.
- **PASS** `npm run verify` after fixes: 61/61 Node tests (four new regressions) and syntax checks.
- **PASS** `npm run test:browser`: 7/7 isolated Chromium suites before the release recheck and 7/7 after process-group cleanup; mocks used for API.
- **FAIL / TIMEOUT** one intervening combined Chromium run hung at `browser_qc7.py`. The suite later passed separately, but this does not negate the failed run. A process-group cleanup fix was then added; ST-033 remains OPEN pending CI evidence.
- **PASS** `python tests/test_runner_timeout.py`: deliberately hanging parent and child processes were terminated after timeout.
- **PASS** `npm run test:ffmpeg`: source WAV -> Nintendo DS IMA-ADPCM WAV, FFprobe codec/rate/channels and `smpl`.
- **PASS** stream size limiter: real Node streams at and above the permitted cap.
- **NOT TESTED** SQL migration execution and concurrent validation workers: no live PostgreSQL/Supabase connection supplied.
- **NOT TESTED** admin recovery after an actual lost HTTP response on Supabase: code decision invariants tested only.
- **BLOCKED** Origin HeartGold in-game playback: no separate mod build or integration source in the delivered ZIP.
