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
