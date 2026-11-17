# sigma-themes v1.7.0-regression-repair — QC og leveransestatus

**Status: lokal kildekodekandidat, IKKE produksjonssertifisert.** Arbeidet er en faktisk kildekodesammenslåing, med testene nedenfor. Ingen deploy, databaseendring eller GitHub-commit er utført.

## Kildegrunnlag og hvilke versjoner som ble slått sammen

- Basis: full kildekode fra `sigma-themes-v1.6.0-39-heartgold-banks.zip` (39-bankkatalog, 2 593 programoppføringer, valgfri lokal SBNK/SWAR-import, instrumentvelger).
- Selektivt gjeninnført fra `sigma-themes-qc-upgrade-2026-11-16.zip`: server-side ferdigstilling, kvoter, hashduplikat-policy, melody-only, separat forhåndskontroll av SSEQ, forbedret arbeidsflyt for MIDI og lydtranskripsjon, forsøk/gjenopptakelse og tilhørende tester/migrasjon.
- Tidligere v1.5.0/v1.5.1-funksjonalitet verifisert gjennom fem-MIDI- og banktester. **Nåværende GitHub `main` kunne ikke hentes** (ingen tilgjengelig repo-tilgang / DNS), og kan dermed ikke ærlig erklæres binært sammenlignet.
- Privat `HeartGold_instrumentfiler_US.zip` var tilgjengelig for lokal test av faktisk SBNK/SWAR, men verken dette arkivet, de utpakkede filene eller `Cute melody(1).m4a` er lagt i den offentlige kildekoden.

## Rettelser

1. Versjon i `package.json` og `package-lock.json` er konsistent, `check-release-layout.mjs` er med i `npm run verify`, og Sigma Dex-eksempelpakken bygges og valideres.
2. SSEQ-innholdet leses fra privat Storage og kontrolleres for riktig byteantall, SHA-256, Nitro SSEQ og HeartGold slot/program før serveren forsøker beskyttet publisering i `api/upload-finish.js`. Hvis inline publisering ikke lykkes, fortsetter status som køet for validator-worker. Den eksisterende planlagte Actions-validatoren beholdes som fallback.
3. Seneste SQL-migrasjon `20261116_inline_sseq_publication.sql` setter 30/time/IP, 100/døgn/IP og 500/døgn globalt. Transaksjonell advisory lock beskytter reservasjoner; separate katalogoppføringer kan ha identiske sekvenshash mens opplastingsforsøk har unike ID-er. Migrationen er ikke kjørt mot live Supabase.
4. Forhåndskontroll av ferdig SSEQ med hele arrangementet, melodi alene og akkompagnement er gjeninnført. Lydanalyse begrenses ikke automatisk til fire stemmer (maks åtte kandidater); falske harmoniske toner begrenses, men ekte lydkvalitet er fortsatt usikker.
5. Kombinering av 1–5 MIDI-filer til én SSEQ bevarer uavhengige HeartGold-programmer, tempo/PPQ, og kontroller for offset, velocity-skala, mute og solo; opptil 16 utgående spor. Ugyldige programmer/toner avvises, ingen stille sletting.
6. Alle 39 bankene og 2 593 programoppføringene fra v1.6.0 er bevart. Originalfilimporten støtter dupliserte SWAR-hasher som deles mellom banker; samplingsbasert avspilling benytter valgt SBNK-program, sample-loop, pitch og pan når faktiske filer er importert. **ADSR og loop er tilnærmet i Web Audio, ikke bitperfekt DS.** PSG-/noise-stemmer faller tilbake til eksplisitt merket syntetisk lyd.
7. Eldre tester for DS/WAV-backup ble tilpasset den faktisk gjeldende SSEQ-only eksporten, slik at de tester separat utvalg, flere ZIP-deler og forskjellig sang-ID med likt SSEQ-innhold i stedet for å forvente slettet legacy-funksjonalitet.

## Lokale tester kjørt

| Test | Faktisk status | Avgrensning |
|---|---|---|
| `npm ci` | PASS | én låst, lokal prosjektinstallasjon |
| `npm run lint` | PASS | JS syntax/check |
| `npm test` / `npm run verify` | PASS | **131/131 Node-tester** + layout + Sigma Dex-eksempel |
| `npm run test:sseq` | PASS | 18 SSEQ/decoder-tester |
| `python tests/independent_sseq_reader.py` | PASS | separat Python-parser; sjekker faktisk triade ved samme tick, ikke spillmotor |
| `browser_hg39_catalog.py` | PASS | 39 banker / bank 701=128 / bank 702=68 / fem uavhengige valg |
| `browser_all_instruments.py` | PASS | 68 instrumenter synlige, toneområde-advarsel, eksport |
| `browser_midi_five.py` og `browser_multi_midi.py` | PASS | 5 MIDI-filer → 5 programmer i 1 SSEQ; 2 MIDI-filer med review |
| `browser_sseq_conversion.py` | PASS | WAV, MP3, MIDI, chord-test, gyldig SSEQ; feil MP3 avvist |
| `browser_sseq_player.py` | PASS | avspilling, pause, kontroller, on-end-relaterte tester |
| `browser_sseq_upload_pipeline.py` | PASS | faktisk UI → mock API, WAV/MP3 er ikke lagret |
| `browser_upload_recovery.py` / `browser_upload_cancel.py` | PASS | simulert feil etter PUT, eksisterende objekt, cancel |
| `browser_qc7.py` | PASS | foreldet reservasjon avvises, ny brukes |
| `browser_transcription_worker.py` | PASS | WAV/MP3 Worker til SSEQ |
| `browser_exports.py` / `browser_qc5.py` | PASS | oppdatert SSEQ-backup-eksport, forskjellige ID-er med samme hash, andre QC5-scenarioer |
| `browser_sigma_export.py` | PASS | Sigma Dex-utvalgs-UI, mapper, metadata |
| `browser_public.py` / `browser_sprite_visibility.py` | PASS | 390/768/1440/1920 px; sprite/overflow |
| `browser_catalog_integrity.py`, `browser_progress_health.py`, `browser_status.py`, `browser_upload_dialog.py` | PASS | browser-mock regresjoner |
| SHA-256-kontrollert import av ekte bank 700/702 | PASS | lokal SBNK/SWAR, 17 samplende programmer for note 60 i bank 702 |
| Original `Cute melody(1).m4a` i Chromium | PASS som teknisk transkripsjon / **NOT VERIFIED** som lydkvalitet | 23 noter, 147-byte SSEQ, 7,5 s; se separat rapport |

**Ikke utførte kontroller (NOT TESTED):** PostgreSQL RLS/kvoter under reell samtidig trafikk, migrasjonsanvendelse på eksisterende produksjonsdata, live Supabase/Vercel, Cloudflare Turnstile med faktiske nøkler, GitHub Actions med produkjsonssecrets, fysisk Safari/iPhone, ekte HeartGold US-rom i emulator/hardware, faktisk import inn i Sigma Dex, full menneskeannotert korrekthetstest av `Cute melody`, full bitperfekt samplesyntese, kompatibilitet for alle 2 593 instrumentinstanser i spillet. Blant de 39 bankene ble kun 700 og 702 brukt med originale private filer i de nyeste avspillingstestene.

## Kjente åpne krav

- Realistiske timbrenavn for 2 593 instrumentinstanser kan ikke verifiseres ut fra kun metadata; teknisk type, banktema og brukerdefinerte navn er bevart uten å dikte opp instrumenter.
- Redigerbare SBNK-envelopes/SWAR-samples er **ikke** en del av vanlig SSEQ-eksport. Game-side bankpatch trengs for faktisk persistens; et komplett bankredigeringsgrensesnitt er ikke levert.
- 16 SSEQ-spor er en syntaktisk grense; faktisk samtidig polyfoni og effekter i originalspillet er ikke testet.
- Transkripsjon av tette opptak med akkorder og bass kan skape falske, manglende eller oktavforskjøvne noter. Det finnes ikke en menneskelig referansefasit; se `REAL_AUDIO_COMPARISON_2026-11-16.md`.

## Produksjon og sikkerhet

- Konfigurer Vercel med `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPLOAD_HMAC_SECRET`, Turnstile-nøkler/hostname. Hemmelige nøkler **kun** på serveren.
- Sikkerhetskopier databasen. Gjennomgå og anvend SQL-migrasjoner i korrekt rekkefølge **i staging først**; kontroller aktuelle indekser, RLS, Storage-regler, RPC execute-grants og SHA-256-indeksendringer.
- Verifiser 429 ved kvoter og at to ulike sang-ID-er med samme gyldige SSEQ kan publiseres. Verifiser inline publisering og fallback-arbeidsflyt med to anonyme nettlesere. Ikke deaktiver Turnstile eller gjør bucket offentlig for å få testen grønn.
- Behold `.github/workflows` ved publisering. Endringer i repoet og Vercel er **ikke** utført fra denne samtalen.

**Release-beslutning:** Klar for forsiktig staging-testing; **ikke marker end-to-end-produksjon eller musikalsk kvalitet som bestått**. Følg de utestede punktene før offentlig produksjonsrelease.
