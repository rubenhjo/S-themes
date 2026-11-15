# QC continuation — v1.4.2 SSEQ preview (2026-11-15)

- **Automatic instrument compatibility fix:** `sseq_transcribe.js` no longer unconditionally assigns an out-of-range selected program to voice 1. It falls back to a playable program in the *same genuine HeartGold bank* and retains all note events. The user sees the substitution; songs with no compatible program still fail closed.
- Added `tests/sseq-auto-bank.test.js` for a real Route 29 SBNK range conflict (program 39 vs pitches 20/24), including a no-unnecessary-fallback negative control.
- Restored a tested downloadable ZIP from the latest Library snapshot. Added GitHub browser-only deployment instructions, because the existing web repository still needs a separate commit and Supabase/Turnstile staging validation.
- Remaining blockers are unchanged: dense multi-instrument mix transcription is approximate; no live authenticated Supabase, Origin HeartGold playback or Sigma Dex importer run was available.

---

# QC continuation — v1.4.1 SSEQ preview (2026-11-15)

- **ST-060** (`sseq_player.js`): add a monotonically increasing playback generation. Pause, source replacement, and dispose invalidate delayed `fetch()` / `AudioContext.resume()` results. Play cannot begin after a cancellation. Web Audio nodes/timers are cleaned up as before. Regression: `tests/browser_sseq_player.py` PASS in Chromium using delayed fetch responses.
- **ST-059** (`sseq_player.js`, `app.js`, `index.html`): the existing sound-mode controls now affect the SSEQ synth's real Web Audio gain, and a DynamicsCompressorNode limits combined oscillator peaks. The UI explicitly says this is NOT measured Spotify/EBU LUFS normalization. Regression: gain-value, zero-volume, mute and play/pause checks PASS. Leave accurate loudness normalization OPEN.
- **ST-051** (`sseq_transcribe.js`): conservatively detect up to four candidate spectral voices rather than forcing a single dominant melody. The synthetic melody+triad fixture contains the intended C3/E3/G3 and all four main notes, but also spurious notes. This is partial improvement, NOT validated polyphonic transcription; issue stays OPEN.
- **ST-061** (`sseq_transcribe.js`): reject recordings over 128 MiB before decoding, avoid a duplicate ArrayBuffer allocation, and refuse long foreground FFT work when Web Workers are unavailable. Browser regression PASS for the pre-decode size check; large-device performance remains NOT TESTED.
- **Tests and delivery:** extend `browser_sseq_conversion.py` for the mixed-track test; add `browser_sseq_player.py` to the browser runner and GitHub Actions; expand `independent_sseq_reader.py` to verify multitrack pointers and events independently of JS. No changes to Sigma Dex, ROM, hg-engine or stored instrument samples.

---

# Release history

## v1.4.0-sseq-preview — 2026-11-15

- **ST-051 / ST-053:** Added WAV/MP3 (without MIDI), MIDI and SSEQ input paths to existing upload button. WAV/MP3 uses a browser FFT Worker, **not** a pretrained multi-instrument transcription network; synthetic melody success is local, full mixed music still not solved.
- **ST-060:** Fixed Nitro mono/poly command encoding from `0xC7 01` to `0xC7 00` and corrected parser timing. Added multi-track/note-range regression tests.
- **ST-061:** Generated metadata-only instrument slot/program/pitch ranges from the private 39 SBNK/39 SWAR bundle; no original sample bytes in public repo.
- **ST-063:** Fixed verified SSEQ library backup filenames to always end in `.sseq` and validated SSEQ payload before ZIP packaging.
- **ST-066:** Updated the anonymous `theme_tracks` RLS SELECT policy to expose only valid SSEQ metadata, not legacy WAV/MP3 rows. This requires **staging deployment** before VERIFIED.
- Converted public upload API, private bucket limit, queued validator and Web Audio library player to **SSEQ-only**; a saved sequence is replayed directly, not a hidden MP3 preview.
- Changed Sigma Dex export to v2 `sigma-themes/sigma-dex-sseq-pack` with `.sseq` entries, folder hierarchy, SHA-256 checksums, target bank/slot metadata, and independent ZIP validator.
- Updated GitHub/Vercel docs, sample SSEQ pack, active QA results and permanent issue journal; old v1.3 WAV docs archived.
- **Still open:** polyphonic mastered-mix transcription, full Nitro command compatibility, actual HG ROM sound bank/game validation, exact loop editor rewrite, legacy catalog migration and live Supabase/Vercel tests.

---

# 2026-11-15 — v1.4.0 SSEQ-only experimental release

- **`scripts/build_bank_profiles.py`, `heartgold_bank_profiles.json/js`:** Derived verified structural bank/program/pitch-range and slot metadata from the user's private HeartGold US bundle. Original 39 SBNK/39 SWAR binary contents remain private; 362 target music slots mapped. Correct sample/timbre rendering in game remains unverified.
- **`sseq_codec.js`, `lib/sseq-server.js`:** Added Nitro SSEQ v1.0 writer, strict supported-opcode reader, bank/slot/instrument/pitch checks and byte budgets. No WAV/MP3 disguised as SSEQ.
- **`sseq_transcribe.js`, `sseq_transcribe_worker.js`:** Added source audio decoding and experimental FFT note extraction, worker offloading, MIDI reading and SSEQ passthrough; limitation to simple motifs and missing chords documented (ST-051). The browser uses no separate uploaded MIDI to process WAV/MP3.
- **`sseq_player.js`, `app.js`, `index.html`:** Switched audio playback to verified binary SSEQ note synthesis, slot/program selectors, source-format auto-conversion on upload, SSEQ-only downloads, no HeartGold/WAV export button, Sigma Dex SSEQ-only ZIP export. SSEQ is the only published music format; web timbres are approximate, not genuine SWAR samples.
- **`lib/common.js`, `api/*.js`, `scripts/validate-pending.mjs`, `scripts/admin-import.mjs`:** Restrict new uploads, worker validation and admin submissions to `.sseq`; preserve auth-free Turnstile and private Supabase Storage; reject RAW source files at server boundary; legacy source tracks hidden pending a safe migration.
- **`supabase/migrations/20261115_sseq_only.sql`:** New DB/RPC/storage constraints, validated target slot and private pending-publication flow. Migration is not yet staging verified.
- **`sigma_dex_export.js`, `scripts/create-sigma-dex-example.mjs`, `scripts/validate-sigma-dex-pack.mjs`, `SIGMA_DEX_EXPORT_SPEC.md`:** Versioned v2 SSEQ-only import contract, deterministic filenames, bank/event mapping, hash/ZIP checks and a synthetic three-track example; no Nintendo assets.
- **`tests/sseq-core.test.js`, `tests/sseq-banks.test.js`, `tests/browser_sseq_conversion.py`:** Added genuine Chromium WAV/MP3/MIDI/SSEQ tests, SSEQ Web Audio playback check, corruption and re-export checks; SSEQ export/slot tests. Legacy browser WAV-export suites removed from active runner, but historical files preserved.
- **`README.md`, `TEST_RESULTS.md`, `QC_REPORT.md`, `HEARTGOLD_INTEGRATION.md`, `KNOWN_ISSUES.md`:** Updated documentation and open-blocker ledger; SSEQ-preview is not declared production-ready.

---

## v1.3.0 — Sigma Dex music export and background assets (2026-11-15)

- Added `sigma_dex_export.js`, a versioned, deterministic, validated single-ZIP Sigma Dex export format with folder selection, manifest and per-file SHA-256 checksums (ST-045).
- Added personal nested folders, song-to-folder placement, editor for export title/artist/event-ID, and backup persistence of the new metadata (ST-046).
- Extended `ds_audio.js` to encode user-selected, ADPCM-block-aligned `smpl` loop points, including worker path, with manifest sample/second values and validator (ST-047).
- Replaced screenshot-derived sprite assets with **24 animated placements using 17 real Sigma-dex repository species**, now separated into `sigma_dex_sprites.js` and `sigma_dex_sprites.css` and layered behind the UI (ST-048). Upstream URLs were checked individually. External network loading is still a deployment dependency.
- Added `SIGMA_DEX_EXPORT_SPEC.md`, synthetic example generator, reference ZIP validator and Node/Chromium regression tests. `test:browser` is now eight suites; examples remain original synthetic notes.
- Maintained the existing public Supabase upload and Realtime pipeline, playlist/favorites engine, legacy HeartGold asset export, GitHub Actions and SQL migrations. No Sigma Dex or game code changed.
- OPEN: large-browser-export ZIP32 and RAM ceiling (ST-049), potential future need for shared folder editing (ST-050). The new format is a contract for future Sigma Dex import, not a ROM patch.


## v1.2.1 — QC7 independent recheck (2026-11-15)

- **ST-042 (FIXED – NOT VERIFIED):** Added `supabase/migrations/20261115_validation_claim_lease.sql` and worker claim fencing. Old SQL publish/reject signatures are revoked and replaced; stale workers can no longer change a newer claim once migration is deployed. Concurrency testing against live PostgreSQL remains outstanding.
- **ST-043 (VERIFIED locally):** Added `lib/stream-limit.js`; validator downloads now enforce `MAX_UPLOAD_BYTES` as data is streamed, even without trustworthy Content-Length.
- **ST-044 (FIXED – NOT VERIFIED):** Admin import now checks the reservation state after an ambiguous response and preserves files already queued/processing/published; deletion is preceded by an atomic state transition.
- Hardened `tests/run_browser_tests.py` with POSIX process-group cleanup on suite completion/timeout and added `tests/test_runner_timeout.py`, run in GitHub Actions. ST-033 remains OPEN because root cause is not proven.
- Added `tests/qc7-independent.test.js` containing four focused regression tests, without changing browser UI or existing audio/DS export functions.
- Re-ran the original 57 Node tests, browser suites, and FFmpeg/FFprobe.

# QC7 — sigma-themes v1.2.0 (2026-11-14)

- **ST-030:** Replaced one 2,000-row catalog read with stable 500-row keyset pagination and duplicate detection (`api/catalog.js`).
- **ST-034:** Public upload finish now returns `202 pending`; new trusted FFprobe/full-FFmpeg validation worker and private validation queue. Only the worker can publish audio after successful decoding (`api/upload-finish.js`, `lib/media-validation.js`, `scripts/validate-pending.mjs`, GitHub Actions workflow, SQL migration).
- **ST-035:** Added DB serialized byte quota with conservative default 850MB, including published, reserved and orphaned objects (`supabase/migrations/20261114_qc7_validation_quota.sql`). Needs live concurrency test.
- **ST-036:** Invalid JSON consistently produces HTTP 400 rather than 502; errors contain machine-readable code (`lib/common.js`, API handlers).
- **ST-037:** Expired/rejected upload receipts are checked with `/api/upload-status` before reuse; UI polls pending validation without pretending queued files are published (`app.js`, `api/upload-status.js`).
- **ST-038:** Single journal-driven statistics generator verifies summary and QC report against `KNOWN_ISSUES.md` (`scripts/issue-stats.mjs`, `scripts/check-known-issues.mjs`).
- **ST-039:** Privileged admin batch import now uses the same byte quota, locally validates audio and queues trusted verification instead of directly inserting `theme_tracks` (`scripts/admin-import.mjs`, SQL).
- **ST-040/ST-041:** Documented remaining risks of scheduled validator latency and quotas affected by other Supabase Storage buckets.
- Added `tests/qc7.test.js`, `tests/media-validation.test.js`, `tests/browser_qc7.py`; extended GitHub CI browser matrix and trusted audio validator workflow.
- Existing playlists, sprites, DS audio encoding, browser exports, offline personal state and UI theme kept intact. **Direct HeartGold gameplay integration remains BLOCKED (ST-010).**

---

## QC5 sluttkontroll – ST-033 (2026-11-14)

- Registrert intermitterende aggregert Chromium-testheng i `KNOWN_ISSUES.md` som OPEN i stedet for å erklære komplett testløp PASS.
- `.github/workflows/ci.yml` kjører hver av de seks suiter i en separat, tidsbegrenset matrix-jobb; Node og FFmpeg kontrolleres separat.
- `tests/run_browser_tests.py` er fremdeles et lokalt samleskript, men kan henge i denne containeren; se `TEST_RESULTS.md`.

# QC5 – sigma-themes v1.1.0 (2026-11-14)

Denne versjonen bygger på GitHub/Vercel ZIP-en på 641 323 byte fra QC4. Prosjektets opprinnelige arkitektur og historiske changelog er beholdt.

## Verifiserte kodeendringer

- **ST-020:** `client_core.js::reorderVisibleSlots` og `app.js::reorder` bytter synlige spor-ID-er i opprinnelige synlige slot-posisjoner. Skjulte sanger forblir på plass. `tests/qc5.test.js` har gammel negativ kontroll og Mellow/Bolt/Yellow-test; `tests/browser_qc5.py` klikker i UI.
- **ST-021:** `index.html` inkluderer `client_core.js` bare én gang. `tests/qc5.test.js` feiler ved dupliserte script-URL-er eller feil avhengighetsrekkefølge.
- **ST-022:** `app.js::exportDS` lager hvert ZIP-delarkiv med **egen** `manifest.json`, `sequence-map.csv`, `READ_FIRST.txt`, `export-overview.json`. Hver WAV har `output_sha256`; før lenkene tilbys valideres ZIP CRC, forventede filer, størrelse og SHA-256. `client_core.js::partitionDS/dsPartManifest`; Node og Chromium multi-part test.
- **ST-023:** `app.js` har én lifecycle-styrt Realtime-tilkobling med `stopRealtime`, `pageshow`/BFCache-rekobling, polling uten dupliserte intervaller og `lifecycleEpoch` mot stale resultater. `tests/browser_qc5.py` simulerer tre navigasjonssykluser.
- **ST-024:** `loadConfig`, `refreshService` og Refresh-knappen lar lesekatalogen fungere når upload-config er nede og gjenoppretter upload-tilgang med tidsstyrt retry når config kommer tilbake. HTTP 503 og flere feilklasser er testet.
- **ST-018:** `lib/csv.js` erstatter admin-skriptets linjebaserte parser. Multiline, quoted comma, escaped quote, BOM, CRLF og korrupte CSV-filer testes i `tests/csv.test.js`.
- **ST-025:** `client_core.js::validateTusURL` blokkerer fremmed HTTP(S)-domene og feil TUS-sti før opplastings-HEAD/PATCH.
- **ST-026:** `client_core.js::tusSessionKey` binder resume-lagring til både lyd-SHA og ny uploadId; en ny reservasjon arver ikke gammel TUS-session.
- **ST-027:** Innledende config/katalog-hentinger kan ikke åpne gamle WebSockets etter `pagehide`; in-flight lifecycle-test i Chromium.
- **ST-028:** `normalizePersonalState`, `sessionGet/sessionSet/sessionRemove` filtrerer korrupt lokaltilstand og tåler blokkert sessionStorage uten krasj.
- **ST-029:** Eksisterende spritefelt og hero-sprites testes med skjermbildedifferanser ved 390/768/1440/1920, faktisk 7–9 synlige distinkte motiv i testmiljøet.
- **ST-032:** `loadCatalog` har 12 s timeout, abort på `pagehide` og tar ikke imot gamle katalogsvar etter ny lifecycle; Chromium-regresjon.
- **ST-030/ST-031:** Ytterligere åpne saker funnet i gjennomgangen – katalogens grense på 2000 spor og signerte lyd-URL-er som kan utløpe under langvarig avspilling. Ingen falske VERIFIED-status.

## Kontrollstatus

- 36/36 Node-tester PASS; seks Chromium-skripter PASS (mockede nettverksendepunkter); FFprobe + FFmpeg ADPCM-dekoding PASS.
- Hver issue finnes permanent i `KNOWN_ISSUES.md`: 32 totalt, 19 VERIFIED, 5 OPEN og 8 BLOCKED.
- **Ikke produksjonsverifisert:** Ingen autentisk Supabase/Vercel-/Turnstile-tilkobling, fysisk Safari/DS-test eller Origin HeartGold-hook/build var tilgjengelig. `ST-010` er fremdeles BLOCKED.

---

# 2026-11-14 — Production hardening (second QC)

- **Abort/retries:** `app.js` og ny `client_core.js` deler AbortController på tvers av opplastingssteg. PUT/TUS kan avbrytes uten senere retry, og TUS henter offset før resending. `api/upload-cancel.js` gir kvitteringsbeskyttet statusendring før storage cleanup; dupliserte oppryddingskall ble rettet.
- **Turnstile:** Timeout, abort, ett reset-forsøk og widget cleanup. Ingen åpen bypass ved feil.
- **Personlige data:** `cleanQueue` fjerner ikke lenger favoritter/spillelisteelementer/kø på ufullstendige katalogsvar. Utilgjengelige spor bevares. Spor-ID-bundet avspillingsposisjon og sikrere neste/forrige.
- **Eksport:** Brukeren kan velge enkeltspor, flere spor, spilleliste eller hele biblioteket. Batch ZIP32 (100 MiB per del), CRC32-verifisering i `ds_audio.js`, og nytt grensesnitt med nedlastingslenke per del.
- **Masseimport:** `scripts/admin-import.mjs` er et separat eierverktøy uten frontend-nøkler med filsignatur, duplikatkontroll, metadata, retry og best-effort rollback.
- **Testing:** 24 Node-tester, Chromium regressjoner for PUT/TUS-avbrudd, eksportmanifest og tom/delvis katalog. GitHub Actions kjører testene. `tests/staging_smoke.py` støtter ekte staging når URL er tilgjengelig.
- **Feiljournal:** `KNOWN_ISSUES.md` med faste ID-er, status, testbevis og automatisk summering (`scripts/check-known-issues.mjs`). Verifiserte feil beholdes i historikken.

**Ikke ferdigverifisert:** Supabase/Vercel-staging, faktisk Turnstile, reell TUS-recovery, svært store ZIP-er på fysisk mobil, emulator/Origin HeartGold-integrasjon. Se kjent-feil-journalen.

---

# Changelog – sigma-themes public release (2026-11-14)

- `app.js`: Fjernet login/membership og auth-avhengighet. Offentlig katalog, kontoløs lytter og verifisert opplasting via `/api`.
- `app.js`: Lagt til lokale, uavhengige favoritter/spillelister/kø/volum/repeat/shuffle; responsiv mobilnavigasjon; WebSocket Realtime med reconnect og polling-fallback.
- `app.js`: Sjekk av backup-objekt før ferdig eksport, kontroll av hash ved ZIP-import; manglende eksporterte filer gir **feil**, ikke falsk suksess.
- `app.js` + `loudness_worker.js`: Async måling av korte spor, tunge/failende spor hoppes over. Positiv gain hindres for å unngå forsterkning basert på anonymt, uverifisert metadatasett.
- `api/*.js` + `lib/common.js`: Server-side Turnstile, quota via DB-reservasjon, signerte private opplastings-/avspillings-URL-er, SHA-256 + size + format-signatur, forsøk på opprydding av ufullstendige filer via sikker cron.
- `supabase/migrations/20261114_public_release.sql`: Ny kontoløs RLS med offentlig SELECT, ingen anonyme endringer/slettinger; private Storage, DB-transaksjoner og atomic duplikatkontroll. Det gamle medlemsskjemaet er fjernet fra distribusjonspakken.
- `index.html`, `sprites2/`: Sigma-dex-fargepalett og 20 sprites-instansar basert på ni ulike, lokale Sigma-mon-bilder; ingen eksterne sprite-URL-er.
- `metadata.js`: Ny offline leser for MP3 ID3v2.3/v2.4 og FLAC Vorbis tags (tittel, artist, album); andre formater faller tilbake til filnavn.
- `ds_audio.js` + `ds_encode_worker.js`: Flyttet ADPCM/PCM-eksporten til Web Worker slik at store konverteringer ikke blokkerer hovedtråden. Beholder eksisterende IMA-ADPCM 32728Hz/ZIP-konverterer, merke som **WAV-asset-pakke** framfor ferdig HeartGold-patch.
- `.github/workflows/ci.yml`, `tests/`: Node-baserte tester, responsiv Playwright smoke test, GitHub Actions.
- `README.md`, `QC_REPORT.md`, `TEST_RESULTS.md`, `HEARTGOLD_INTEGRATION.md`: Reproduserbart oppsett, verifisering og uavklarte risikoer.
