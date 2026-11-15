# KNOWN_ISSUES.md — sigma-themes permanent feiljournal

Alle tidligere poster beholdes ved nye releaser. Et problem markeres **VERIFIED** bare etter dokumentert bestått test av rettelsen; lokal PASS er ikke produksjonsverifikasjon. Ikke-verifiserte eksterne avhengigheter merkes **BLOCKED**. Alvorlighetsgrad: P0 kritisk, P1 høy, P2 medium, P3 lav.

Status kan være OPEN, IN PROGRESS, FIXED – NOT VERIFIED, VERIFIED, BLOCKED eller WONTFIX (krever begrunnelse). `Evidence` beskriver faktisk testmiljø.

## Historiske og nye saker

### ST-001 — Brukeravbrudd kunne trigge nye PUT/TUS-forsøk

- **Severity:** P0
- **Status:** VERIFIED
- **Discovered:** 2026-11-14
- **Reproduction:** Start en opplasting, avbryt under PUT eller PATCH; tidligere kode forsøkte ny overføring.
- **Root cause:** Avbrudd ble behandlet som en ordinær transient nettverksfeil, og TUS-loop hadde ikke en delt cancel-tilstand.
- **Affected files:** `app.js, client_core.js`
- **Change:** Felles AbortController per batch, abortbar XHR/fetch, cancel-sjekk før retry og HTTP-finish; fjern session markers ved avbrudd.
- **Evidence:** PASS – tests/browser_upload_cancel.py (PUT og TUS: 1 forsøk, 1 avbrutt XHR, 0 finish) + tests/hardening.test.js.
- **Impact:** Avbrutte opplastinger kunne forbruke kvoter eller bli publisert ved en senere retry.
- **Regression test:** tests/browser_upload_cancel.py
- **Remaining limitations:** Ingen kjente lokale regresjoner; eksterne avhengigheter krever separate stagingtester.


### ST-002 — Turnstile kunne vente ubegrenset

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-14
- **Reproduction:** La bot-widgeten aldri svare eller sende expired/timeout-callback.
- **Root cause:** getTurnstileToken() hadde ikke tidsgrense, widget cleanup eller kontrollert retry.
- **Affected files:** `app.js, client_core.js`
- **Change:** 45 sekunder timeout, AbortSignal, ett reset-forsøk, token-kontroll, fjerning av widget og samtidighetssperre.
- **Evidence:** PASS – hardening.test.js timeout, expiry/reset, abort/late token.
- **Impact:** UI kunne fryse i opplastingsverifisering uten tydelig feil.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Ingen kjente lokale regresjoner; eksterne avhengigheter krever separate stagingtester.


### ST-003 — Kansellering sendte opprydding to ganger

- **Severity:** P2
- **Status:** VERIFIED
- **Discovered:** 2026-11-14
- **Reproduction:** Avbryt en PUT/PATCH med aktiv reservasjon; tidligere ny kode kalte cleanup både direkte og fra catch.
- **Root cause:** Samma op.reservation ble beholdt etter cancelRemote-sending.
- **Affected files:** `app.js`
- **Change:** Ta eierskap til reservasjonen ved første cancelRemote-kall og sett op.reservation=null.
- **Evidence:** PASS – browser_upload_cancel.py (server_cancel_calls=1 for PUT og TUS).
- **Impact:** Dobbel opprydding gir unødige serverkall og race conditions.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Ingen kjente lokale regresjoner; eksterne avhengigheter krever separate stagingtester.


### ST-004 — Ufullstendig katalog slettet favoritter/spillelister

- **Severity:** P0
- **Status:** VERIFIED
- **Discovered:** 2026-11-14
- **Reproduction:** Returner []/delvis katalog, nettverksfeil eller annen rekkefølge fra catalog og oppdater.
- **Root cause:** cleanQueue() filtrerte vekk alle ID-er som ikke var i siste katalogrespons.
- **Affected files:** `app.js`
- **Change:** Behold lokale referanser og køen, og vis manglende spor som Unavailable. Kun eksplisitt sikker sletting kan rydde referanser.
- **Evidence:** PASS – browser_catalog_integrity.py: empty, half, out_of_order, network_error, confirmed_missing.
- **Impact:** Lokale spillelister og favoritter kunne mistes etter midlertidige katalogfeil.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Ingen kjente lokale regresjoner; eksterne avhengigheter krever separate stagingtester.


### ST-005 — Gjenopptatt posisjon var ikke sikkert knyttet til spor

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-14
- **Reproduction:** Lagre posisjon for spor A, velg B, så last metadata; risiko for at A-posisjonen brukes på B.
- **Root cause:** Lokal state lagret lastTime alene og loadedmetadata brukte state.resumeAt uten sporverifikasjon.
- **Affected files:** `app.js, client_core.js`
- **Change:** Lagre trackId/seconds/savedAt/context/queue; gjenopprett kun dersom ID og currentSrc stemmer, etter metadata, uten autoplay.
- **Evidence:** PASS – hardening.test.js validResume korrekt spor / avviser feil spor; integrasjon i ekte iOS fortsatt NOT TESTED.
- **Impact:** Feil avspillingsposisjon kunne brukes på en annen sang.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Ingen kjente lokale regresjoner; eksterne avhengigheter krever separate stagingtester.


### ST-006 — HeartGold-export eksporterte bare hele biblioteket

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-14
- **Reproduction:** Trykk HeartGold pack fra en spilleliste, eller velg kun én sang.
- **Root cause:** exportDS() brukte alltid state.tracks.slice().
- **Affected files:** `app.js, client_core.js`
- **Change:** Valgdialog for hele biblioteket, gjeldende visning og flere individuelle spor; sjekk dupliserte ID-er.
- **Evidence:** PASS – browser_exports.py for single, playlist; tests/hardening.test.js chooseTracks og dupliserte SSEQ-ID-er.
- **Impact:** Brukeren kunne ikke eksportere enkeltspor eller kuraterte spillelister.
- **Regression test:** tests/hardening.test.js
- **Remaining limitations:** Ingen kjente lokale regresjoner; eksterne avhengigheter krever separate stagingtester.


### ST-007 — ZIP-eksport manglet etterkontroll av innhold

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-14
- **Reproduction:** Endre bytes inne i generert ZIP; tidligere uttrekk validerte ikke CRC32.
- **Root cause:** unzip() kontrollerte struktur, men ikke faktisk CRC mot innhold.
- **Affected files:** `ds_audio.js, app.js, tests/ds_audio.test.js`
- **Change:** Implementert verifyZip med per-fil chunket CRC32 og kontroll før arkiv tilbys; også ved import.
- **Evidence:** PASS – ds_audio.test.js ZIP-corruption avvises; browser_exports.py ZIP og manifest.
- **Impact:** Korrupte ZIP-pakker kunne fremstå som gyldige sikkerhetskopier.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Ingen kjente lokale regresjoner; eksterne avhengigheter krever separate stagingtester.


### ST-008 — Store ZIP32-arkiver kan ikke garanteres for alle biblioteker

- **Severity:** P1
- **Status:** OPEN
- **Discovered:** 2026-11-14
- **Reproduction:** Eksporter flere gigabyte med mange spor fra en minnebegrenset mobilnettleser.
- **Root cause:** ZIP32 er maksimalt 4 GiB per arkiv og frontend holder ferdige Blob-er mens lenkene er tilgjengelige.
- **Affected files:** `app.js, ds_audio.js`
- **Change:** Deler nå data ved 100 MiB (ZIP32 fallback) og frigir ObjectURL ved modal close. Full-scale minne/ytelsestest og ZIP64 ikke gjennomført.
- **Evidence:** NOT TESTED – ingen stor produksjonskatalog eller mobilminneprofilering tilgjengelig.
- **Impact:** Store eksportoperasjoner kan feile med høy minnebruk eller ZIP32-grenser.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Se Evidence og nødvendig ekstern verifikasjon; status holdes åpen/blokkert.


### ST-009 — Eier kunne ikke importere mange filer pga. offentlig kvote

- **Severity:** P2
- **Status:** BLOCKED
- **Discovered:** 2026-11-14
- **Reproduction:** Importer mer enn fire filer på én time som bibliotekseier.
- **Root cause:** Offentlig SQL RPC begrenser alle anonyme IP-er uten adminløype.
- **Affected files:** `scripts/admin-import.mjs, README.md`
- **Change:** Lokal owner-only CLI med service role i prosessmiljø, streaming upload, SHA-256, metadata/CSV, duplikatkontroll og rollback.
- **Evidence:** PASS – syntakskontroll; NOT TESTED – ekte Supabase masseimport og rollback krever privat instans.
- **Impact:** Bibliotekseier må bruke owner-only CLI; ekte tjenesteintegrasjon er ikke kjørt.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Se Evidence og nødvendig ekstern verifikasjon; status holdes åpen/blokkert.


### ST-010 — HeartGold streaming-hook/ROM-integrasjon er ikke verifisert

- **Severity:** P0
- **Status:** BLOCKED
- **Discovered:** 2026-11-14
- **Reproduction:** Legg WAV ZIP direkte inn i en vanlig HGSS SDAT og prøv å spille den som SSEQ.
- **Root cause:** Vanlige SSEQ og streamed RIFF-WAV er ulike lydsystemer. Origin HeartGold-kildetreet/builden er ikke i repoet.
- **Affected files:** `HEARTGOLD_INTEGRATION.md, ds_audio.js`
- **Change:** Beholder korrekt assetpack og manifest; ingen falsk game patch. Må legge inn/teste streaming hook + mapping i faktisk hg-engine build.
- **Evidence:** NOT TESTED – ingen lovlig testbar Origin HeartGold-build eller melonDS-test tilgjengelig.
- **Impact:** Lydpakken kan ikke garanteres spillbar i brukerens konkrete HeartGold-mod.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Se Evidence og nødvendig ekstern verifikasjon; status holdes åpen/blokkert.


### ST-011 — Reell Supabase/Vercel/RLS-integrasjon er ikke produksjonstestet

- **Severity:** P0
- **Status:** BLOCKED
- **Discovered:** 2026-11-14
- **Reproduction:** Publiser prosjektet mot privat Supabase, test RLS, Storage, Realtime fra to klienter.
- **Root cause:** Ingen prosjekt-URL/secrets gitt; lokale tester bruker isolerte svar/mocks.
- **Affected files:** `supabase/migrations, api/, tests/staging_smoke.py`
- **Change:** Lagt til staging-smoketest som henter ekte API-data i to sesjoner; trenger miljøvariabler og oppsatt staging.
- **Evidence:** NOT TESTED – Vercel/Supabase-staging er ikke koblet opp.
- **Impact:** API, databaseregler, Storage og Realtime kan ikke bekreftes i produksjon.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Se Evidence og nødvendig ekstern verifikasjon; status holdes åpen/blokkert.


### ST-012 — TUS-resume ved ekte nettverksavbrudd kan fremdeles feile

- **Severity:** P1
- **Status:** BLOCKED
- **Discovered:** 2026-11-14
- **Reproduction:** Start >6 MiB opplasting, slå av nettverket, gjenoppta etter oppkobling.
- **Root cause:** TUS implementert manuelt med HEAD-offset og signert URL, men ingen reell storage-integrasjonstest er utført.
- **Affected files:** `app.js, tests/browser_upload_cancel.py`
- **Change:** HEAD før hver PATCH og etter transient feil, tidsstyrt retry med maksantall; reell TUS-resume må verifiseres mot Supabase.
- **Evidence:** PASS – PUT/PATCH cancel i Chromium; NOT TESTED – reell TUS resume.
- **Impact:** Opplastinger kan feile etter lange avbrudd på ekte TUS-infrastruktur.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Se Evidence og nødvendig ekstern verifikasjon; status holdes åpen/blokkert.


### ST-013 — Turnstile i ekte drift er ikke testet

- **Severity:** P1
- **Status:** BLOCKED
- **Discovered:** 2026-11-14
- **Reproduction:** Åpne staging, gjennomfør/avbryt/utløp Cloudflare-widget, sjekk server-siteverify.
- **Root cause:** Krever Turnstile-domene, site-key og secret som ikke er tilgjengelige lokalt.
- **Affected files:** `app.js, client_core.js, lib/common.js`
- **Change:** Timeout/retry/cancel og hostname/action-validering er implementert.
- **Evidence:** PASS – mocket widget i Node; NOT TESTED – ekte Turnstile-staging.
- **Impact:** Bot-beskyttelse kan oppføre seg annerledes på et ekte konfigurert domene.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Se Evidence og nødvendig ekstern verifikasjon; status holdes åpen/blokkert.


### ST-014 — Store biblioteker kan gi høyt nettleserminnebruk

- **Severity:** P1
- **Status:** OPEN
- **Discovered:** 2026-11-14
- **Reproduction:** Eksporter mange hundre sanger mens profilerer RAM på iOS og desktop.
- **Root cause:** WebAudio/dekode og Blob-deler er begrenset enkeltvis, men arkivlenker holder alle ferdige deler frem til dialogen lukkes.
- **Affected files:** `app.js, ds_audio.js`
- **Change:** 100 MiB ZIP-partisjonering og chunked CRC; fremtidig disk-streaming/eksport via lokal CLI bør vurderes.
- **Evidence:** NOT TESTED – fullskala mobilprofilering mangler.
- **Impact:** Store kataloger/eksporter kan bruke for mye nettleserminne.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Se Evidence og nødvendig ekstern verifikasjon; status holdes åpen/blokkert.


### ST-015 — Fysisk touch og iOS-lydavspilling er ikke testet

- **Severity:** P2
- **Status:** BLOCKED
- **Discovered:** 2026-11-14
- **Reproduction:** Bruk iPhone Safari for drag, volume, queue, avspilling/seek og sprites.
- **Root cause:** Automatiserte Chromium-tester er ikke det samme som fysisk iOS-enhet.
- **Affected files:** `index.html, app.js, tests/browser_public.py`
- **Change:** Responsive smoke tests bevarer layout og minst 6 forskjellige sprites; faktisk fysisk touch mangler.
- **Evidence:** PASS – Chromium 390/768/1440; NOT TESTED – fysisk iOS.
- **Impact:** Touch og iOS-lyd er ikke verifisert på fysisk Apple-enhet.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Se Evidence og nødvendig ekstern verifikasjon; status holdes åpen/blokkert.


### ST-016 — Avbrudd kan ikke oppheve serverpublisering som allerede er committed

- **Severity:** P1
- **Status:** BLOCKED
- **Discovered:** 2026-11-14
- **Reproduction:** Trykk Avbryt akkurat idet /api/upload-finish committer publisering.
- **Root cause:** Race mellom nettleserens AbortController og database-commit er prinsipielt mulig.
- **Affected files:** `api/upload-cancel.js, api/upload-finish.js, README.md`
- **Change:** Server-cancel markerer pending som failed før Storage delete; svarer 409 dersom allerede publisert. Krever ekte konkurransetest.
- **Evidence:** PASS – unit med forged/published/pending; NOT TESTED – ekte commit-race.
- **Impact:** Publisering kan rekke å committe samtidig som bruker trykker Avbryt.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Se Evidence og nødvendig ekstern verifikasjon; status holdes åpen/blokkert.


### ST-017 — Sikkerhetskopi ved manglende lydobjekt trenger ekte feiltest

- **Severity:** P1
- **Status:** BLOCKED
- **Discovered:** 2026-11-14
- **Reproduction:** Eksporter valgt spor som finnes i katalogen, men er borte fra Storage.
- **Root cause:** Frontend feiler på HTTP/size/hash, men er ikke bekreftet mot faktisk Supabase object deletion.
- **Affected files:** `app.js, ds_audio.js, tests/browser_exports.py`
- **Change:** fetchTrack verifiserer HTTP, størrelse og SHA; ingen suksess-dialog etter feil.
- **Evidence:** PASS – ZIP checksum på lokale testobjekter; NOT TESTED – ekte manglende Storage-objekt.
- **Impact:** Storage-feil kan gi ufullstendig backup uten ekte staging-verifikasjon.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Se Evidence og nødvendig ekstern verifikasjon; status holdes åpen/blokkert.


### ST-018 — Metadata-CSV for administrativ import har enkel parser

- **Severity:** P3
- **Status:** VERIFIED
- **Discovered:** 2026-11-14
- **Reproduction:** Legg inn multi-line-quoted CSV-felt eller store UTF-8 linjeskift i metadatakolonner.
- **Root cause:** Lokal CLI har enkel CSV-linjeleser, ikke full RFC 4180 støtte for innebygde linjeskift.
- **Affected files:** `scripts/admin-import.mjs`
- **Change:** Erstattet linjedelt parser i `scripts/admin-import.mjs` med `lib/csv.js::parseMetadataCSV` (UTF-8, RFC 4180, CRLF, multiline).
- **Evidence:** PASS (local) – `tests/csv.test.js` utfører multiline/quoted/escaped/CRLF og korrupt CSV.
- **Impact:** CSV-metadata med linjeskift og siterte felt ble tidligere feilparset.
- **Regression test:** tests/csv.test.js
- **Remaining limitations:** Ingen kjente lokale regresjoner; eksterne avhengigheter krever separate stagingtester.


### ST-019 — Lydnormalisering er basert på anonyme klientmålinger

- **Severity:** P2
- **Status:** OPEN
- **Discovered:** 2026-11-14
- **Reproduction:** Last opp lyd hvor innsendt LUFS-måling er feil eller mangler.
- **Root cause:** Ingen server-transcoding/LUFS-kø; måling kan være klientrapportert og mangler for store filer.
- **Affected files:** `app.js, loudness_worker.js, api/upload-finish.js`
- **Change:** Klemmer avspillingsgain til maks 0 dB for å beskytte mot forsterkning; senere serververifisering anbefales.
- **Evidence:** PASS – kodegjennomgang; NOT TESTED – virkelig mastering-paritet mot Spotify.
- **Impact:** Anonymt oppgitte lydmål kan være unøyaktige eller manipulerte.
- **Regression test:** NOT TESTED – krever særskilt integrasjonstest
- **Remaining limitations:** Se Evidence og nødvendig ekstern verifikasjon; status holdes åpen/blokkert.


### ST-020 — Filtrert rekkefølge kunne ikke flyttes korrekt

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5
- **Reproduction:** Reprodusert Mellow/Bolt/Yellow + filter «low»: eldre comparator bruker rank=undefined for Bolt og etterlater ugyldig sortering.
- **Impact:** Brukeren ser ingen riktig flytting, og skjulte spor kan endre posisjon.
- **Affected files:** `app.js::reorder`, `client_core.js::reorderVisibleSlots`
- **Root cause:** Sorterte hele spillelisten med rank bare for filtrerte ID-er.
- **Change:** Synlige spor bytter plass i sine opprinnelige slots; skjulte spor beholder nøyaktig posisjon, ID-basert rangering persisteres.
- **Regression test:** `tests/qc5.test.js`, `tests/browser_qc5.py`
- **Evidence:** PASS (local): gammel comparator feiler eksempelet; ny test bekrefter [Yellow,Bolt,Mellow], deretter retur og persistering.
- **Remaining limitations:** Ikke testet på fysisk touch-enhet.


### ST-021 — client_core.js ble lastet to ganger

- **Severity:** P2
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5
- **Reproduction:** HTML inneholdt to identiske `<script src="client_core.js">`-elementer.
- **Impact:** Dobbel initialisering kan overskrive globale hjelpere og skape uforutsigbar drift.
- **Affected files:** `index.html`
- **Root cause:** Feil fra sammensetting av skript-tagger.
- **Change:** Fjernet duplikat og la til test for unike skript og avhengighetsrekkefølge.
- **Regression test:** `tests/qc5.test.js`, `tests/browser_qc5.py`
- **Evidence:** PASS (local): kun én lokal skriptforekomst og tidligere 24 tester uten regresjon.
- **Remaining limitations:** Ingen identifiserte lokale begrensninger.


### ST-022 — HeartGold splitte-ZIP manglet delmanifest

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5
- **Reproduction:** Metadata ble lagt bakerst i global filliste, slik at kun siste ZIP kunne inneholde manifest.
- **Impact:** Ufullstendige arkiver kan ikke brukes eller verifiseres separat.
- **Affected files:** `app.js::exportDS`, `ds_audio.js::packageHeartGoldParts`, `tools/verify_heartgold_pack.py`
- **Root cause:** ZIP-partisjonering skjedde etter at globale metadata var lagt til én gang.
- **Change:** Laget per-part `manifest.json`, `sequence-map.csv`, `READ_FIRST.txt`, `export-overview.json`, SHA-256 per WAV, duplikatkontroll.
- **Regression test:** `tests/qc5.test.js`, `tests/verify_ds_pack.py`, `tests/create_heartgold_fixture.mjs`
- **Evidence:** PASS (local): 1, 2, 4 deler; CRC/SHA-256, mapping, komplette oversikter, FFprobe/ADPCM og avvisning ved manglende ZIP-del.
- **Remaining limitations:** Ingen emulatorverifikasjon; ST-010 er separat og BLOCKED. Store virkelige biblioteker ST-008/014 er ikke belastningstestet.


### ST-023 — Pagehide/pageshow gjenopprettet ikke sanntid

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5
- **Reproduction:** Etter pagehide stoppet tidligere kode polling og WebSocket uten pageshow-handler.
- **Impact:** Brukerens app kunne stå offline etter BFCache-retur.
- **Affected files:** `app.js::startRealtime`, `stopServices`, `resumeServices`
- **Root cause:** Lifecycle behandlet sidehide som terminal, uten restart/epoke-kontroll.
- **Change:** Idempotent stopp/start for polling og WebSocket; generation-check for gamle responser; audio forblir pauset.
- **Regression test:** `tests/browser_qc5.py`
- **Evidence:** PASS (local Chromium): 3 pagehide/pageshow-sykluser, nøyaktig 1 aktiv WebSocket, katalog oppdatert.
- **Remaining limitations:** Reell Safari BFCache er fortsatt NOT TESTED under ST-015.


### ST-024 — Midlertidig config-feil blokkerte opplasting permanent

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5
- **Reproduction:** /api/config=503 ved oppstart, deretter Refresh; ready ble værende false.
- **Impact:** Musikk kunne leses, men bruker fikk aldri opplasting tilbake uten sideinnlasting.
- **Affected files:** `app.js::loadConfig`, `refreshAll`, `getJSON`
- **Root cause:** Refresh oppdaterte bare katalogen og det fantes ingen gjenhenting av config.
- **Change:** Skilte lesing og opplastingskonfigurasjon, 3 forsøk med exponential backoff, manuell Refresh oppdaterer begge.
- **Regression test:** `tests/browser_qc5.py`, `tests/qc5.test.js`
- **Evidence:** PASS (local): 503×3, katalog tilgjengelig, Refresh gjenopprettet ready og én WebSocket; 500/502/503/504 retry i Node.
- **Remaining limitations:** Ekte Vercel config-staging er ikke testet (ST-011).


### ST-025 — TUS resume-URL kunne være vilkårlig domene

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5
- **Reproduction:** Resume-adresse fra sessionStorage ble brukt som absolutt URL uten verts-/sti-validering.
- **Impact:** Signert opplastingstoken kunne sendes til uautorisert domene ved manipulert lagring.
- **Affected files:** `app.js::tusTransfer`, `client_core.js::validateTusURL`
- **Root cause:** Ingen allowlist for lagret resumable endpoint.
- **Change:** Krever HTTPS, samme origin og forventet TUS-sti før HEAD/PATCH og på serverens Location-svar.
- **Regression test:** `tests/qc5.test.js`
- **Evidence:** PASS (local): gyldig location aksepteres; fremmed origin, HTTP og feil path avvises.
- **Remaining limitations:** Ekte Supabase TUS-protokoll må testes (ST-012).


### ST-026 — Foreldet TUS-offset ble beholdt ved ny reservasjon

- **Severity:** P2
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5
- **Reproduction:** Ny TUS-reservasjon for samme SHA-256 kunne gjenbruke gammel sessionStorage-markør fra en annen tillatelse.
- **Impact:** HEAD/PATCH kunne kontakte en utløpt opplastingsøkt eller feile ved feil offset.
- **Affected files:** `client_core.js::tusSessionKey`, `app.js::tusTransfer`
- **Root cause:** Opplastingsmarkøren brukte bare filens hash og var ikke bundet til opplastingsreservasjonen.
- **Change:** Bruker nøkkel med både SHA-256 og unik uploadId; gamle hash-only-nøkler ignoreres. Lagrede TUS-URL-er valideres i tillegg mot riktig endpoint.
- **Regression test:** `tests/qc5.test.js`
- **Evidence:** PASS (local Node): identisk sanghash med ulike opplastings-ID-er gir ulike markører; ugyldige ID-er avvises. Supabase TUS-resume er fortsatt NOT TESTED i staging.
- **Remaining limitations:** Reell TUS-recovery etter nettverksavbrudd forblir BLOCKED under ST-012.


### ST-027 — Initial app-start kunne gjenåpne WebSocket etter pagehide

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5
- **Reproduction:** pagehide under et tregt /api/config-kall; etter respons kunne init fortsatt kalle startRealtime.
- **Impact:** Gamle faner kunne gjenoppta nettverksarbeid etter navigasjon.
- **Affected files:** `app.js::init`, `startRealtime`, `pagehide/pageshow`
- **Root cause:** Mangler aktiv lifecycle-guard etter awaited init.
- **Change:** `pageActive`-guard og controller/epoke-invalidering hindrer reconnect når siden er lukket.
- **Regression test:** `tests/browser_qc5.py`
- **Evidence:** PASS (local Chromium): forsinket første config, pagehide, senere respons -> null sockets; pageshow -> én socket.
- **Remaining limitations:** Fysisk Safari lifecycle fortsatt NOT TESTED.


### ST-028 — Korrupt lokaltilstand eller blokkert sessionStorage kunne krasje

- **Severity:** P2
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5
- **Reproduction:** Personlig JSON kunne ha null/ugyldige elementer; sessionStorage kunne kaste SecurityError.
- **Impact:** Spillelister, favoritter, opplasting eller visning kunne mislykkes.
- **Affected files:** `client_core.js::normalizePersonalState`, `app.js::loadPersonal`, `sessionStore`
- **Root cause:** Ingen typet/avgrenset lokal datamigrering og direkte bruk av sessionStorage.
- **Change:** Validerer strukturer og bevarer referanser; lagrer korrupt rådata separat; bruker fallback-map ved Storage-feil.
- **Regression test:** `tests/qc5.test.js`, `tests/browser_upload_cancel.py`
- **Evidence:** PASS (local): korrupt tilstand og 0-volum, og faktisk PUT-avbrudd når sessionStorage kaster SecurityError.
- **Remaining limitations:** Safari Private Browsing og lagringskvoter ikke verifisert på enhet.


### ST-029 — Bare fem forskjellige sprites var synlige ved 768 px

- **Severity:** P2
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5
- **Reproduction:** Visuelle differanseskjermbilder avdekket at tre motiv ikke påvirket skjermbildet ved 768 px.
- **Impact:** Designkravet om minst seks tydelig synlige figurer var ikke oppfylt.
- **Affected files:** `index.html` (spritefield og hero-art), `tests/browser_sprite_visibility.py`
- **Root cause:** Opaque panels occluded several background sprite types.
- **Change:** Beholdt spritefield og lagt tre forskjellige motiv inn i eksisterende dekorfelt på bredere skjermer.
- **Regression test:** `tests/browser_sprite_visibility.py`
- **Evidence:** PASS (local): faktisk pikselforskjell ved 390/768/1440/1920; minst seks unike motiver per viewport.
- **Remaining limitations:** Fysisk Safari/kontrast under alle farger er ikke testet.

### ST-030 — Katalog-API kan avkorte biblioteker over 2000 spor

- **Severity:** P2
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5 uavhengig gjennomgang
- **Reproduction:** Opprett over 2000 publiserte spor og kall `/api/catalog`; koden har `limit=2000` uten paginering.
- **Impact:** Låter utenfor grensen vises ikke; klienten kan ikke skille stor katalog fra komplett katalog.
- **Affected files:** `api/catalog.js`, `app.js::loadCatalog`
- **Root cause:** Fast servergrense uten `next`-cursor eller page-token.
- **Change:** `api/catalog.js::readCatalog` bruker keyset-paginering med 500 rader, stabil `created_at DESC, id DESC`, duplikatkontroll og fail-closed ved feil side. Nye rader under paginering tas ved neste refresh.
- **Regression test:** `tests/qc7.test.js` – 0,1,999,1000,1001,1500; injisert ny rad og duplikate ID-er under sidehenting.
- **Evidence:** PASS (lokal Node 2026-11-14): pagineringsimplementasjon med 1000-radsgrense i mock-backend; ikke testet mot ekte Supabase.
- **Remaining limitations:** Stagingtest med ekte Supabase, samtidige endringer og mange titusen rader gjenstår; generelt ST-011 dekker produksjonsverifikasjon.


### ST-031 — Signert lydadresse kan utløpe under langvarig avspilling

- **Severity:** P2
- **Status:** OPEN
- **Discovered:** 2026-11-14, QC5 uavhengig gjennomgang
- **Reproduction:** La HTMLAudioElement beholde en Supabase-signert media-URL forbi 900 sekunder og søk til en ikke-bufret del.
- **Impact:** Ny range-forespørsel kan bli avvist med 403; lyd kan stoppe eller seek mislykkes.
- **Affected files:** `api/audio.js`, `app.js::playAt`, `audio.onerror`
- **Root cause:** `api/audio.js` signerer en URL for 900 sekunder, men avspilleren håndterer ikke eksplisitt fornying ved utløp.
- **Change:** Ingen påstått rettelse; koden markerer utilgjengelig lyd og lar brukeren velge spor på nytt.
- **Regression test:** NOT TESTED – trenger tid- og range-kontroll mot riktig Storage-backend.
- **Evidence:** PASS (statisk inspeksjon viser 900 sekunders TTL). Faktisk feilscenario NOT TESTED.
- **Remaining limitations:** Reell signed-URL-fornying og pauseløs avspilling må designes/testes før VERIFIED.


### ST-032 — Hengende katalogforespørsel kunne fortsette etter navigasjon

- **Severity:** P2
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC5 uavhengig gjennomgang
- **Reproduction:** La `/api/catalog` svare aldri, send `pagehide`, deretter `pageshow`.
- **Impact:** Gamle nettverkskall kunne forbli aktive og forsinke ny innlasting.
- **Affected files:** `app.js::loadCatalog`, `pagehide/pageshow`
- **Root cause:** Manglende timeout/AbortController på kataloghentingen.
- **Change:** Separat AbortController med 12 s tidsgrense og umiddelbar abort på pagehide. Lifecycle-epoke hindrer gamle svar fra å endre ny tilstand.
- **Regression test:** `tests/browser_qc5.py::cancel_stale_catalog`
- **Evidence:** PASS (local Chromium): uavsluttet forespørsel ble avbrutt én gang, etter pageshow lastes nytt spor og ingen JavaScript-feil.
- **Remaining limitations:** Produsert Supabase timeout-scenario er ikke testet; dette er en lokal nettleserregresjon.



### ST-033 — Aggregert Chromium-testkjøring kan låse seg etter flere suiter

- **Severity:** P2
- **Status:** OPEN
- **Discovered:** 2026-11-14, QC5 sluttkontroll
- **Reproduction:** Kjør `npm run test:browser` i denne containeren. Alle seks suiter består isolert, men den aggregerte kjøreren har flere ganger hengt etter fem fullførte suiter.
- **Impact:** Lokal `npm run test:browser` er ikke en pålitelig ett-kommando-gate; samlede resultater kan ikke merkes PASS selv om de isolerte suiter består.
- **Affected files:** `tests/run_browser_tests.py`, `tests/browser_qc5.py`, `.github/workflows/ci.yml`
- **Root cause:** En intermitterende Chromium/Playwright-runtime-heng på tvers av flere subprocesser i testcontaineren; eksakt underliggende feil er ikke bekreftet.
- **Change:** GitHub Actions kjører hver Chromium-suite i isolert matrix-jobb. Lokal runner oppretter separat POSIX-prosessgruppe for hver suite, rydder opp etter både suksess og timeout, rapporterer ikke bestått ved heng og har 75 sekunders frist per suite.
- **Regression test:** `python tests/test_runner_timeout.py` simulerer en prosess som også starter et hengende barn; `npm run test:browser` kjører alle syv suiter; ekte CI-matrix må observeres.
- **Evidence:** PASS – prosessgruppe-timeout test; PASS – siste aggregerte 7/7-suiter (bounded runner). **FAIL** – én tidligere aggregert kjøring 2026-11-15 hang ved siste suite før prosessgruppereparasjonen. Ingen reell GitHub Actions-verifikasjon.
- **Remaining limitations:** Underliggende intermitterende Chromium-heng er ikke rotårsaksbekreftet; behold OPEN til gjentatte CI-kjøringer er stabile. Timeout gir nå kontrollert FAIL fremfor å henge ubegrenset.


### ST-034 — Ugyldige signerte lydfiler ble publisert uten full dekoding

- **Severity:** P1
- **Status:** FIXED – NOT VERIFIED
- **Discovered:** 2026-11-14, QC7
- **Reproduction:** ID3 etterfulgt av tilfeldige byte ble godkjent av `sniff()` og kunne få en publisert katalograd.
- **Impact:** Korrupte eller manipulerte spor kunne distribueres til alle.
- **Affected files:** `api/upload-finish.js`, `scripts/validate-pending.mjs`, `lib/media-validation.js`, SQL-migrasjon
- **Root cause:** Bare signatur, størrelse og SHA-256 ble kontrollert ved publisering.
- **Change:** Nye opplastinger legges i valideringskø (202). Betrodd GitHub Actions-jobb laster ned originalen, verifiserer SHA, format, kanal/samplerate/varighet og dekoder *hele* filen med FFmpeg før atomisk publisering. Feilaktige filer blir avvist og fjernet.
- **Regression test:** `tests/media-validation.test.js`, `tests/qc7.test.js`
- **Evidence:** PASS lokal FFmpeg (gyldig MP3/WAV, ID3-søppel, falsk filendelse, tom/avkortet fil, SHA-feil, ugyldig probe). Faktisk GitHub-runner + Supabase publisering: NOT TESTED.
- **Remaining limitations:** Krever aktiv GitHub Actions-runner med secrets og reell Supabase. Ved uteblitt jobb blir filen stående upublisert.

### ST-035 — Global bytebasert lagringskvote manglet

- **Severity:** P1
- **Status:** FIXED – NOT VERIFIED
- **Discovered:** 2026-11-14, QC7
- **Reproduction:** Samtidige besøkende kunne reservere mange filer til lagringen ble full.
- **Impact:** Gratis lagring kunne overbrukes; opplastinger kunne feile uten tydelig kapasitetssignal.
- **Affected files:** `supabase/migrations/20261114_qc7_validation_quota.sql`, `lib/common.js`, `scripts/admin-import.mjs`
- **Root cause:** Kun antall sanger/opplastinger, ikke bytes for publiserte, reserverte og foreldreløse filer.
- **Change:** Konfigurerbar kvote (standard 850 MB) med global Postgres advisory-lock og summering av publiserte bytes, alle ikke-publiserte reservasjoner og uregistrerte Storage-objekter. Admin-import bruker samme kvote.
- **Regression test:** `tests/qc7.test.js` (statisk SQL-invariant), nødvendig ekte samtidighetstest i staging
- **Evidence:** PASS lokal strukturell test; SQL og Storage race test mot faktisk Supabase: NOT TESTED.
- **Remaining limitations:** Andre Storage-buckets på Supabase-prosjektet er ikke automatisk talt; 150 MB sikkerhetsmargin kan justeres av admin. Ingen reell DB-test.

### ST-036 — Feil HTTP-status ved ugyldig JSON

- **Severity:** P2
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC7
- **Reproduction:** Ugyldig JSON i POST-endepunkt kunne bli omklassifisert til 502.
- **Impact:** Klienter kunne forsøke feil retry eller få misvisende feilmelding.
- **Affected files:** `lib/common.js::jsonBody/safeError`, `api/upload-start.js`
- **Root cause:** JSON.parse kastet SyntaxError uten status; miljøkonfig ble lest før JSON i upload-start.
- **Change:** Felles body-parser returnerer HTTP 400; standardiserte maskinlesbare feilkoder, 409/413/429 håndtert.
- **Regression test:** `tests/qc7.test.js` for upload-start/finish/cancel/status
- **Evidence:** PASS lokal Node: ugyldig JSON ga 400 i alle fire endepunkter uten upstream-kall.
- **Remaining limitations:** Det er ikke kjørt ekte HTTP-integrasjon på Vercel.

### ST-037 — Utløpte opplastingsreservasjoner kunne bli gjenbrukt

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC7
- **Reproduction:** En lagret reservasjon ble gjenbrukt basert på klokkestempel uten serverstatus.
- **Impact:** Filer kunne forsøkes sendt mot ugyldig signert URL, med unødvendig kvotebruk.
- **Affected files:** `app.js`, `api/upload-status.js`, `supabase/migrations/20261114_qc7_validation_quota.sql`
- **Root cause:** Manglende servervalidering av persisted session og upload-status.
- **Change:** Klienten validerer uploadId/receipt og kontrollerer serverstatus. Bare `pending` kan gjenopptas; failed/expired/published forkastes. Nettverksfeil fører ikke til destruktiv gjettning.
- **Regression test:** `tests/browser_qc7.py`, `tests/qc7.test.js`
- **Evidence:** PASS Chromium med gammel reservasjon -> status failed -> ny opplasting. PASS Node statisk sikkerhetsinvariant.
- **Remaining limitations:** TUS-fortsettelse mot ekte Supabase krever staging (ST-012).

### ST-038 — Manuelt duplisert feilantall i QC-rapporter

- **Severity:** P3
- **Status:** VERIFIED
- **Discovered:** 2026-11-14, QC7
- **Reproduction:** QC_REPORT kunne vise annet antall enn journalen.
- **Impact:** Status på åpne feil kunne rapporteres feil til videre utviklere.
- **Affected files:** `scripts/check-known-issues.mjs`, `scripts/issue-stats.mjs`, `KNOWN_ISSUES.md`, `QC_REPORT.md`
- **Root cause:** Statussummer ble skrevet manuelt i flere dokumenter.
- **Change:** Maskinlesbar COUNTS-markør og QC_REPORT-markør genereres fra én journal; CI kontrollerer at statistikken er identisk og alle historiske ID-er finnes.
- **Regression test:** `npm run issues:sync`, `node scripts/check-known-issues.mjs`, `npm run verify`
- **Evidence:** PASS lokal kontroll av unik ID, statuser, totalsummer og kryssreferanse med QC_REPORT.
- **Remaining limitations:** Testverktøyet hindrer feil i statussummer, ikke uriktige manuelle beskrivelser.

### ST-039 — Eiers masseimport kunne omgå lagringskvoten

- **Severity:** P1
- **Status:** FIXED – NOT VERIFIED
- **Discovered:** 2026-11-14, QC7
- **Reproduction:** Tidligere admin CLI lastet opp direkte til Storage og satte inn i theme_tracks.
- **Impact:** Store admin-batcher kunne fortrenge offentlig lagringskvote.
- **Affected files:** `scripts/admin-import.mjs`, SQL-migrasjon `reserve_admin_theme_upload`
- **Root cause:** Egen importpipeline brukte ikke global RPC-reservasjon.
- **Change:** CLI kjører lokal FFmpeg-validering, reserverer bytes i samme globale lås, laster opp, og køer sporet for betrodd serververifikasjon. Ingen service-key i nettleseren.
- **Regression test:** Node syntakskontroll og `tests/qc7.test.js` på lagringsinvarianter
- **Evidence:** PASS statisk kontroll og Node-syntaks; faktisk masseimport med kvotegrense: NOT TESTED.
- **Remaining limitations:** Requires Supabase staging, worker-secrets og ekte administrative lydfiler.

### ST-040 — Betrodd lydvalidering er avhengig av GitHub Actions-planlegging

- **Severity:** P1
- **Status:** OPEN
- **Discovered:** 2026-11-14, QC7
- **Reproduction:** GitHub Actions cron kan bli forsinket eller utebli.
- **Impact:** Opplastede filer kan stå `validating` uten å vises i katalogen.
- **Affected files:** `.github/workflows/audio-validator.yml`, `scripts/validate-pending.mjs`, `api/upload-finish.js`
- **Root cause:** En gratis, ekstern betrodd worker brukes fordi Vercel-integrert FFmpeg ikke er bygget og lasttestet.
- **Change:** Sporet er fail-closed; ingen automatisk publisering uten worker. Stuck processing kan gjenerobres etter 15 minutter; utløpte reservasjoner ryddes.
- **Regression test:** Staging workflow dispatch, måling av kølatens og cron-leveranse
- **Evidence:** NOT TESTED: faktisk GitHub Actions-kjøring og kølatens krever eierens repo/secrets.
- **Remaining limitations:** For produksjon med lav ventetid anbefales dedikert worker eller Vercel Fluid Compute med ffmpeg-static testet i staging.

### ST-041 — Kvotebudsjettet kan avvike fra total bruk i andre Storage-buckets

- **Severity:** P2
- **Status:** OPEN
- **Discovered:** 2026-11-14, QC7
- **Reproduction:** SQL kvote tar med alle objekter i sigma-theme-audio, men ikke fremmede buckets.
- **Impact:** Et Supabase-prosjekt med store andre buckets kan nå plattformkvoten tidligere enn antatt.
- **Affected files:** `supabase/migrations/20261114_qc7_validation_quota.sql`, `README.md`
- **Root cause:** Applikasjonen har ikke myndighet til å endre plattformens globale plan-kvote.
- **Change:** 850MB som konfigurerbar konservativ standard; README forklarer å senke den ved øvrig prosjektlagring.
- **Regression test:** Staging: avles total prosjektlagring og test ved variasjon i andre buckets
- **Evidence:** NOT TESTED: ingen live Supabase storage usage-data tilgjengelig.
- **Remaining limitations:** Krever manuell konfigurering av kvoten som passer faktisk Supabase Free-bruk.

### ST-042 — Foreldet lydvalidator kan publisere eller avvise en ny valideringsjobb

- **Severity:** P1
- **Status:** FIXED – NOT VERIFIED
- **Discovered:** 2026-11-15, selvstendig QC7-kodegjennomgang
- **Reproduction:** La worker A ta en jobb; la den bli eldre enn 15 minutter; worker B kan hente samme rad på nytt. Uten token er ikke `publish_theme_upload` og `reject_theme_validation` bundet til riktig worker.
- **Impact:** En gammel worker kan endre en jobb som en nyere worker eier, eller feilaktig avvise filen og utløse sletting.
- **Affected files:** `supabase/migrations/20261115_validation_claim_lease.sql`, `scripts/validate-pending.mjs`.
- **Root cause:** `validation_started_at` ble brukt til gjenhenting, men en ny claim fikk ingen unik identitet som skulle verifiseres ved publisering eller avvisning.
- **Change:** Ny `validation_claim_id` genereres ved hver claim. Publisering og avvisning krever gjeldende token. Gamle SQL-RPC-signaturer fjernes, og worker kontrollerer token før publisering og ved rejection. PostgREST schema-cache reloades.
- **Regression test:** `tests/qc7-independent.test.js` validerer begge betingelsene og worker-kallene.
- **Evidence:** PASS — statiske kontrakttester i Node. **NOT TESTED** — ekte samtidige PostgreSQL-transaksjoner, migrasjon i Supabase og dobbelt worker-kjøring.
- **Remaining limitations:** Må valideres på ekte staging-Supabase før VERIFIED. Migrasjonen må anvendes etter QC7-migrasjonen.

### ST-043 — Betrodd validator kunne laste ned mer enn tillatt uten Content-Length

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-15, selvstendig QC7-kodegjennomgang
- **Reproduction:** Returner en mediestrøm med utelatt/feil `Content-Length`, og lever flere bytes enn `MAX_UPLOAD_BYTES` til filskriving.
- **Impact:** Et feilkonfigurert/malisiøst Storage-objekt kunne bruke mer disk og nettverksressurser enn forventet i validation-worker.
- **Affected files:** `scripts/validate-pending.mjs`, `lib/stream-limit.js`.
- **Root cause:** Kun headerstørrelse ble kontrollert før `pipeline`, mens faktisk stream ble skrevet uten øvre bytegrense.
- **Change:** `boundedBytes(MAX_UPLOAD_BYTES)` er koblet inn i den faktiske worker-pipelinen før filskriving.
- **Regression test:** `tests/qc7-independent.test.js` strømmer over og nøyaktig ved bytegrensen gjennom Node-pipeline og kontrollerer worker-tilkoblingen.
- **Evidence:** PASS — reell lokal Node-streaming avviser byte 21 ved grense 20 og godtar nøyaktig 20; integrasjonskall er kontrollert statisk. Ingen ekte Storage-nettverksjobb er kjørt.
- **Remaining limitations:** Worker mot Supabase er ikke produksjonstestet; denne VERIFIED-statusen gjelder lokal bytegrense, ikke hele opplastingspipeline.

### ST-044 — Administrative importer kunne slette allerede kølagt musikk etter tapt HTTP-svar

- **Severity:** P1
- **Status:** FIXED – NOT VERIFIED
- **Discovered:** 2026-11-15, selvstendig QC7-kodegjennomgang
- **Reproduction:** La `queue_theme_upload` kommitte i databasen og mist HTTP-svaret til admin-CLI. Den gamle feilhåndteringen så bare etter publisert `theme_tracks`-rad og slettet Storage når den fortsatt stod i `theme_uploads.validating`.
- **Impact:** Gyldig musikk ble fjernet fra Storage før validatoren kunne behandle den.
- **Affected files:** `scripts/admin-import.mjs`, `lib/admin-recovery.js`.
- **Root cause:** En usikker antakelse om at manglende `theme_tracks`-rad betyr at opplastingen mislyktes.
- **Change:** Verifiser status og hash i `theme_uploads` før opprydding. Bevar filer med `validating/processing/published`, og bevar filen hvis status er ukjent. Ved `pending` endres status atomisk til `failed` før objektet slettes.
- **Regression test:** `tests/qc7-independent.test.js` tester alle utfall og sikrer at beslutningen kommer før destruktiv sletting.
- **Evidence:** PASS — lokale beslutnings-/kodeinvariant-tester. **NOT TESTED** — faktisk tapt HTTP-svar mellom Supabase og admin-CLI; ingen staging-nøkler tilgjengelige.
- **Remaining limitations:** Krever ekte Supabase staging med simulert svar-tap før VERIFIED.

### ST-045 — Sigma Dex-export manglet fullstendig, versjonert én-ZIP-kontrakt

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-15, Sigma Dex-exportarbeid
- **Reproduction:** Forrige `exportDS()` leverte HeartGold-orienterte ZIP-deler, men ikke ett validert arkiv med komplette folder-/track-metadata og integritet for en fremtidig Sigma Dex-importer.
- **Impact:** Eksporten kunne ikke importeres som én entydig strukturert musikkpakke.
- **Affected files:** `sigma_dex_export.js`, `app.js`, `index.html`, `scripts/validate-sigma-dex-pack.mjs`, `SIGMA_DEX_EXPORT_SPEC.md`.
- **Root cause:** Ingen definert, versjonert Sigma Dex-eksportkontrakt eller selvstendig validator.
- **Change:** Implementert planlegging av nøyaktig utvalg, WAV-omkoding, versjonert manifest, folder-/track-manifester, SHA-256-inventar, én ZIP32 og full CRC/integritetsvalidering før suksess tilbys.
- **Regression test:** `tests/sigma-dex-export.test.js`, `tests/browser_sigma_export.py`, `npm run test:example`.
- **Evidence:** PASS — lokale Node-testtilfeller for valg, mapper, innhold, metadata, SHA, korrupte filer og kansellering; syntetisk referanse-ZIP ble validert med selvstendig CLI.
- **Remaining limitations:** Mottak i Sigma Dex er utenfor dette repoet; én ZIP32 er begrenset til 4 GiB. Dette er VERIFIED for pakken i sigma-themes, ikke for mottak i et annet prosjekt.

### ST-046 — Ingen mappestruktur eller undermapper for musikkorganisering

- **Severity:** P2
- **Status:** VERIFIED
- **Discovered:** 2026-11-15, Sigma Dex-eksportarbeid
- **Reproduction:** V1.2.1 hadde kun lokale spillelister og ingen separate mapper, underkategorier eller sporplassering for eksport.
- **Impact:** Bruker måtte manuelt organisere filer etter eksport.
- **Affected files:** `app.js`, `index.html`, `sigma_dex_export.js`.
- **Root cause:** Eksisterende personlig tilstand modellerte kun spillelister/favoritter og DS-koblinger.
- **Change:** Egne lokale mapper og undermapper, navneendring/flytting/sletting, sangflytting og inkludering av folder-/track-mapping i personlig backup.
- **Regression test:** `tests/sigma-dex-export.test.js` og `tests/browser_sigma_export.py` på 390/1440 px.
- **Evidence:** PASS — reelle Chromium-UI-handlinger opprettet mappe og undermappe, flyttet en sang, redigerte metadata og valgte mappen til eksport; Node tester sykluser, duplikate navn og utvalg.
- **Remaining limitations:** Mapper persisteres i nettleserens lokale storage; synkronisering på tvers av enheter er ikke implementert. Backend-/prod-rehydrering av lokal storage er ikke testet.

### ST-047 — Loop-eksport støttet kun start ved null og slutt ved sangslutt

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-15, Sigma Dex-eksportarbeid
- **Reproduction:** Gamle `encodeImaWav(...,loop=true)` skrev `smpl` for [0, frames-1] uansett ønskede loop-punkter.
- **Impact:** Melodier med intro eller bestemt outro kunne ikke få korrekt loop.
- **Affected files:** `ds_audio.js`, `ds_encode_worker.js`, `app.js`, `sigma_dex_export.js`.
- **Root cause:** `loop` var en boolsk parameter uten start-/sluttsekunder.
- **Change:** Validerte sekunder til sample-indekser, avrunding til ADPCM-blokkgrenser, `smpl` og manifestets faktiske sampleverdier, samt forhåndsvisning i sporredigering.
- **Regression test:** `tests/sigma-dex-export.test.js`, `scripts/create-sigma-dex-example.mjs`, FFprobe-kontroll.
- **Evidence:** PASS — Node leser `smpl` fra generert WAV, kontrollerer blokk-alignment, ingen loop-chunk når disabled; FFprobe leser tre faktisk kodede spor.
- **Remaining limitations:** Ingen reell in-game NWAV-/STRM-spiller eller sammenligning av loop-oppførsel i emulator er tilgjengelig.

### ST-048 — Hovedversjonen brukte gamle spriteutklipp i stedet for Sigma Dex-assets

- **Severity:** P2
- **Status:** VERIFIED
- **Discovered:** 2026-11-15, brukerrettelse
- **Reproduction:** V1.2.1 lastet `sprites2/` fra skjermbildeutklipp, selv om den senere demoen hadde direkte stier til Sigma Dex sine godkjente DS-sprites.
- **Impact:** Få og uoriginale dekorfigurer, forskjell mellom testutgave og Vercel-versjon.
- **Affected files:** `index.html`, `sigma_dex_sprites.js`, `sigma_dex_sprites.css`, `tests/browser_sprite_visibility.py`.
- **Root cause:** Produksjonskode ble ikke oppdatert da demoen byttet til opprinnelige GitHub-spritefiler.
- **Change:** Gamle utklipp fjernet; 24 plasseringer/17 forskjellige Sigma-mon-kilder, responsive posisjoner og rolig bevegelse på bakgrunnslaget; UI forblir interaktivt.
- **Regression test:** `tests/browser_sprite_visibility.py`, `tests/browser_public.py`; manuell kontroll av 17 eksakte bildestier gjennom webverktøy.
- **Evidence:** PASS — 17 sprite-URL-er returnerte faktiske bilder i ekstern kontroll; Chromium-test med syntetiske bildemocks bekrefter seks forskjellige synlig påvirkende plasseringer ved 390, 768, 1440, 1920 px uten horisontal scrolling.
- **Remaining limitations:** Ekstern lasting i en ekte deploy er NOT TESTED i Chromium; den lokale nettlesertesten bruker testbilder, ikke de ekte eksterne pikseldataene. Sprites krever at GitHub Raw eller GitHub Pages er tilgjengelige.

### ST-049 — Én stor Sigma Dex ZIP kan overskride ZIP32 eller nettleserminne

- **Severity:** P2
- **Status:** OPEN
- **Discovered:** 2026-11-15, Sigma Dex-eksportarbeid
- **Reproduction:** En pakke over 4 GiB kan ikke representeres i nåværende ZIP32-writer; mange lange spor må dekodes og kodede WAVs beholdes frem til ZIP-verifisering.
- **Impact:** En svært stor samling vil ikke kunne eksporteres i én operasjon på begrensede klienter.
- **Affected files:** `ds_audio.js`, `sigma_dex_export.js`, `app.js`.
- **Root cause:** Browser ZIP32 uten ZIP64/disk-streaming og WebAudio fullfil-dekoding.
- **Change:** Eksport stanser før vellykket nedlasting med en eksplisitt feil, ingen falsk «komplett» pakkestatus.
- **Regression test:** `tests/sigma-dex-export.test.js` (200 planlagte spor / 10 reelt pakkede syntetiske), separat load-/memory-test kreves.
- **Evidence:** NOT TESTED — ZIP64, over 4 GiB og mobilt minne ved hundrevis av lange spor krever videre utvikling og belastningstest.
- **Remaining limitations:** Mindre utvalg kan eksporteres; ingen delarkiv påstås å være én importpakke. Større eksport krever ZIP64 eller en separat eksport-worker med streaming.

### ST-050 — Mappestrukturen synkroniseres ikke mellom brukere og enheter

- **Severity:** P2
- **Status:** OPEN
- **Discovered:** 2026-11-15, Sigma Dex-eksportarbeid
- **Reproduction:** Lag en mappe i én nettleser; en annen anonym besøkende har ikke den lokale mappen.
- **Impact:** Det finnes ikke en felles redigérbar mappehierarki for alle bidragsytere.
- **Affected files:** `app.js` (lokale folderTree/trackFolders), Supabase API (ingen delte folder-RPC-er).
- **Root cause:** Anonyme besøkende må ikke ha frie globale skrive-/sletterettigheter; eksportmapper er derfor bevisst personlige, slik spillelister er.
- **Change:** Personlige mapper, stabil lokal persistering og eksport-/backuptools er implementert uten å endre offentlige skrivepolicyer.
- **Regression test:** Lokal UI-persistens av mappetilstand; staging-migrasjon med moderert felles mapperedigerer er ennå ikke laget.
- **Evidence:** NOT TESTED — delt mappesynk krever design av autorisert API og ekte Supabase-tester.
- **Remaining limitations:** Brukere kan dele egne strukturer med eksport- og backuppakker, men det er ikke en global mapperedigerer.

### ST-051 — WAV/MP3 stereo-miks mister akkorder ved transkripsjon

- **Severity:** P1
- **Status:** OPEN
- **Discovered:** 2026-11-15, SSEQ-only transkripsjonsrunde
- **Reproduction:** En test med melodi og tre akkordtoner genererte bare melodinotene, selv om WAV- og MP3-enkelmelodier ble riktige.
- **Impact:** Brukerens viktige flerstemte arrangement forsvinner i SSEQ.
- **Affected files:** `sseq_transcribe.js`
- **Root cause:** Utrent spektral topp-deteksjon kan ikke separere flere instrumentstemmer.
- **Change:** v1.4.1: spektraltranskripsjon utvidet til opptil fire kandidatstemmer. Syntetisk akkordfixture gir C3, E3 og G3 i SSEQ sammen med hovedmelodien, men også falske fragmenter. Ingen trent flerstemmemodell eller produksjonskvalitet er på plass.
- **Regression test:** tests/browser_sseq_conversion.py
- **Evidence:** PASS syntetisk delvis akkorddekning (C3/E3/G3), FAIL kvalitetsport for ren/gjenkjennelig komplett flerstemmetranskripsjon; ekstra falske toner
- **Remaining limitations:** Trent multitrack-modell og arrangementsevaluering mangler.

### ST-052 — SSEQ fra opptak er ikke testet i original HeartGold

- **Severity:** P1
- **Status:** BLOCKED
- **Discovered:** 2026-11-15, SSEQ-only transkripsjonsrunde
- **Reproduction:** Ingen lovlig original HeartGold-kopi eller melonDS-romtest var tilgjengelig; del av ST-010 med nytt akseptansekriterium.
- **Impact:** Spillbarhet og reell SDAT-størrelse er ukjent.
- **Affected files:** `sseq_codec.js, HEARTGOLD_INTEGRATION.md`
- **Root cause:** Strukturell og syntaktisk SSEQ-validering er ikke en emulator-/ROM-test.
- **Change:** Leverer SSEQ, private bankreferansekart og konkrete lokale teststeg, ingen falsk spillpatch.
- **Regression test:** tests/sseq-core.test.js (kun lokalt format)
- **Evidence:** BLOCKED – ingen spilltest utført
- **Remaining limitations:** Mangler testrom/build og original slotbank-avspilling; ST-010 beholdt.

### ST-053 — Gammelt WAV/MP3-bibliotek er ikke migrert med uendrede ID-er

- **Severity:** P1
- **Status:** OPEN
- **Discovered:** 2026-11-15, SSEQ-only transkripsjonsrunde
- **Reproduction:** Tidligere publiserte lydfiler skjules av SSEQ-only katalogen, men automatisk migrering er ikke skrevet.
- **Impact:** Eldre låter er ikke tilgjengelige som SSEQ før sikker migrering.
- **Affected files:** `api/catalog.js, supabase/migrations/20261115_sseq_only.sql`
- **Root cause:** Konvertering av eldre objekt krever sikret kø, transkripsjon, revision/hash og atomisk referansebevaring.
- **Change:** Gamle private objekter bevares uendret for senere migrering.
- **Regression test:** NOT TESTED – migrasjonsarbeider finnes ikke
- **Evidence:** OPEN – faktisk migrering og rollback må utvikles og testes
- **Remaining limitations:** Ikke slett tidligere Storage før ny SSEQ og spor-ID-er er validert.

### ST-054 — Webavspiller har ikke autentiske HeartGold-klanger

- **Severity:** P2
- **Status:** OPEN
- **Discovered:** 2026-11-15, SSEQ-only transkripsjonsrunde
- **Reproduction:** Spilleren parser SSEQ-noter, men benytter generiske Web Audio-oscillatorer.
- **Impact:** Hørbar forhåndslytting kan avvike fra det originale spillet.
- **Affected files:** `sseq_player.js, heartgold_bank_profiles.json`
- **Root cause:** Originale SWAR-samples distribueres ikke og ingen fullverdig lisensiert bank-synth finnes.
- **Change:** Ekte SSEQ-noter, tempo, program og varighet spilles med generisk synth.
- **Regression test:** tests/browser_sseq_conversion.py
- **Evidence:** PASS syntetiske noter/play/pause; NOT TESTED faktisk HeartGold-klang
- **Remaining limitations:** Korrekt instrumenttimbre krever godkjente samples og emulatortest.

### ST-055 — SSEQ-parser støtter bare avgrenset opcode-subsett

- **Severity:** P2
- **Status:** OPEN
- **Discovered:** 2026-11-15, SSEQ-only transkripsjonsrunde
- **Reproduction:** Gyldige eldre SSEQ-filer med avanserte betingede/variabelhendelser blir avvist selv om Nitro bruker disse.
- **Impact:** Enkelte ekte SSEQ-innlastinger avvises fremfor godkjenning.
- **Affected files:** `sseq_codec.js`
- **Root cause:** Fail-closed parser implementerer ikke hele Nitro-sekvensinstruksjonssettet.
- **Change:** Uklar/ikke-støttet kommando avvises eksplisitt, ingen utrygg aksept.
- **Regression test:** tests/sseq-core.test.js
- **Evidence:** PASS avvisning og støttede kommandoer; NOT TESTED full SSEQ-korpus
- **Remaining limitations:** Krever bredere opcode-implementasjon og uavhengige SSEQ-fixtures.

### ST-056 — Loop-editor skriver ikke endringer inn i SSEQ-byte

- **Severity:** P2
- **Status:** OPEN
- **Discovered:** 2026-11-15, SSEQ-only transkripsjonsrunde
- **Reproduction:** Eksportdialogens sekunder- og loopinnstillinger er lokale metadata, ikke binære SSEQ-endringer.
- **Impact:** En bruker kan tro at en valgt loop er endret mens opprinnelig loop brukes ved avspilling.
- **Affected files:** `app.js, sigma_dex_export.js`
- **Root cause:** Eksport bruker den originale, lagrede SSEQ-filen for integritet og konverterer ikke loopinnstillinger.
- **Change:** Pakkemanifest bruker den faktisk parsede SSEQ-loop-statusen, ikke uverifiserte UI-verdier.
- **Regression test:** tests/sseq-core.test.js
- **Evidence:** PASS faktisk loopflagg i manifest; FAIL ønsket spesifikk loopsekund-redigering
- **Remaining limitations:** Må implementere binær note-/event-edit og ny versjon ved loopendring.

### ST-057 — Noen lydkodeker og lange spor ikke verifisert i nettleser

- **Severity:** P2
- **Status:** OPEN
- **Discovered:** 2026-11-15, SSEQ-only transkripsjonsrunde
- **Reproduction:** FLAC/M4A/Opus/AAC avhenger av decodeAudioData-støtte; varer over 360 s avvises, og ytelse på mobil er ukjent.
- **Impact:** En del egenproduserte lange/komprimerte opptak kan ikke konverteres.
- **Affected files:** `sseq_transcribe.js, sseq_transcribe_worker.js`
- **Root cause:** Native nettleserkodeker og kostbar FFT med 360 sekunders tak.
- **Change:** Egen Web Worker med abort/timeout og konkret feilmelding, men ikke universell dekoder.
- **Regression test:** tests/browser_sseq_conversion.py
- **Evidence:** PASS 2 sek WAV/MP3, NOT TESTED 360 sek/M4A/FLAC på enheter
- **Remaining limitations:** Flere format-/belastningstester og kvalitetssikret fallback trengs.

### ST-058 — Ny SSEQ-only SQL og ekte offentlig lagringsflyt mangler stagingverifikasjon

- **Severity:** P1
- **Status:** BLOCKED
- **Discovered:** 2026-11-15, SSEQ-only transkripsjonsrunde
- **Reproduction:** Nye RP C-er for slot og SSEQ-only reservasjoner/publisering er ikke kjørt mot virkelig Supabase og Turnstile.
- **Impact:** Produksjonsopplasting eller låtavspilling kan feile etter deploy selv om lokale mocktester består.
- **Affected files:** `supabase/migrations/20261115_sseq_only.sql, api/, scripts/validate-pending.mjs`
- **Root cause:** Ingen tilgjengelig stagingdatabase/secret for ekte systemtest i arbeidsmiljøet.
- **Change:** Sikker restriksjon i kode, privat bucket, serverparse og staged-godkjenningsflyt implementert.
- **Regression test:** tests/security.test.js, tests/sseq-banks.test.js
- **Evidence:** PASS isolerte enhetstester; BLOCKED reell Supabase/Turnstile/Vercel
- **Remaining limitations:** Krever forhåndsvisningsdeploy, migrasjoner, live webhook og samtidige klienter.

### ST-059 — Spotify-inspirert normalisering kalibrert for PCM og er deaktivert for SSEQ-synth

- **Severity:** P2
- **Status:** OPEN
- **Discovered:** 2026-11-15, SSEQ-only transkripsjonsrunde
- **Reproduction:** Tidligere avspillingsgain og loudnessmålinger gjelder innspillingsaudio; ny SSEQ-motor bruker egne oscillatorer.
- **Impact:** Tidligere hadde sound-mode-bryteren ingen effekt på SSEQ; nå gir den relativt gain-nivå, men ikke dokumentert LUFS-normalisering.
- **Affected files:** `app.js, sseq_player.js`
- **Root cause:** enableAudio og applyGain returnerer tidlig for isSigmaSseq; ingen SSEQ loudnessanalyse.
- **Change:** v1.4.1: OFF/QUIET/NORMAL/LOUD gir nå faktisk Web Audio-gain med kompressor og myke overganger; tydelig ikke-LUFS-merket UI. Eksakt Spotify-/EBU-normalisering er fremdeles ikke implementert.
- **Regression test:** tests/browser_sseq_player.py
- **Evidence:** PASS funksjonelle gains/mute/volum 0 i Chromium; NOT TESTED kalibrert LUFS mot lydmåler
- **Remaining limitations:** Implementer offline syntesemåling og true-peak/BS.1770-kalibrering for reelle LUFS-løfter; modellen er ikke en autentisk HeartGold-sampler.

### ST-060 — Forsinket SSEQ-lasting kunne starte lyd etter Pause

- **Severity:** P1
- **Status:** VERIFIED
- **Discovered:** 2026-11-15, SSEQ-webavspillingsregresjon
- **Reproduction:** Kall play() mens fetch holdes åpen, klikk Pause, løs deretter fetch; tidligere fortsatte play() med AudioContext og kunne starte etter brukeravbrudd.
- **Impact:** Utilsiktet avspilling etter pause, kildeskifte eller navigasjon.
- **Affected files:** `sseq_player.js`
- **Root cause:** Asynkron play() sammenlignet ikke sin generasjon med siste brukerhandling etter await.
- **Change:** Bruk _generation som invalideres av pause(), src-setter og dispose(). Kontroller både etter _ensure() og AudioContext.resume().
- **Regression test:** `tests/browser_sseq_player.py`
- **Evidence:** PASS faktisk Chromium-test for pause under fetch og gamle kilder; ny avspilling starter ikke, og riktig kilde kan fremdeles lastes.
- **Remaining limitations:** Testene bruker isolerte nettleserfiler, ikke live Supabase eller Safari.

### ST-061 — Store lydkilder kunne belaste nettleserminnet og blokkere hovedtråden

- **Severity:** P2
- **Status:** FIXED – NOT VERIFIED
- **Discovered:** 2026-11-15, ressurssjekk for lokal transkripsjon
- **Reproduction:** Kode kunne lese en ubegrenset fil til ArrayBuffer og lage en ekstra kopi før dekoding; ved Worker-feil kjørte FFT selv for lange lydfiler på hovedtråden.
- **Impact:** Uforholdsmessig RAM-forbruk og treg/frossen UI på store opptak.
- **Affected files:** `sseq_transcribe.js`
- **Root cause:** Manglende pre-decode bytegrense, unødvendig buffer.slice(0), ubetinget hovedtråd-fallback.
- **Change:** 128 MiB kildegrense, direkte decodeAudioData(buffer), 15 s tak på foreground-fallback, eksplisitt timeout/reject.
- **Regression test:** `tests/browser_sseq_conversion.py`
- **Evidence:** PASS kontrollert oversize-avvisning før kildebytes leses; NOT TESTED faktisk lang fil på fysisk mobil.
- **Remaining limitations:** Må måle 1–6 minutters dekoding, Worker-kjøreytelse, mobil-RAM og opplastingsbruk.

## QC7 issue status — generated

| Severity | OPEN | IN PROGRESS | FIXED – NOT VERIFIED | VERIFIED | BLOCKED | WONTFIX | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| P0 | 0 | 0 | 0 | 2 | 2 | 0 | 4 |
| P1 | 5 | 0 | 5 | 15 | 6 | 0 | 31 |
| P2 | 11 | 0 | 1 | 10 | 2 | 0 | 24 |
| P3 | 0 | 0 | 0 | 2 | 0 | 0 | 2 |
| **Total** | 16 | 0 | 6 | 29 | 10 | 0 | **61** |

- Registered: **61**
- New since QC6: **28** (ST-034 onwards)
- New in independent QC7 recheck: **20** (ST-042 onwards)
- Historical ST-001–ST-033: preserved
- Regressions detected in currently passing local tests: **0**; this does not certify untested infrastructure

<!-- COUNTS {"OPEN":{"P0":0,"P1":5,"P2":11,"P3":0},"IN PROGRESS":{"P0":0,"P1":0,"P2":0,"P3":0},"FIXED – NOT VERIFIED":{"P0":0,"P1":5,"P2":1,"P3":0},"VERIFIED":{"P0":2,"P1":15,"P2":10,"P3":2},"BLOCKED":{"P0":2,"P1":6,"P2":2,"P3":0},"WONTFIX":{"P0":0,"P1":0,"P2":0,"P3":0}} -->
