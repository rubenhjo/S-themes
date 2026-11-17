# Oppdatering 17. november – femminutters WAV/MP3 i CI

Denne komplette prosjektpakken bygger på forrige v1.7.5 ZIP og reparerer **den ene gjenværende feilen** dokumentert i `logs_119325362560.zip`. Av 28 GitHub Actions-jobber bestod 27; `browser_five_minute_import.py` ble stoppet av ekstern tidsgrense (`exit 124`) etter at 300 sekunders WAV allerede hadde bestått. MP3-testen startet, men fikk ikke fullføre før samme 90-sekunders budsjett gikk ut. Dette er en CI-testorkestreringsfeil, **ikke bevis på at MP3-transkripsjonen feiler**.

- WAV og MP3 testes nå som **to separate CI-jobber**, hver med egen Chromium-prosess, generering og hard 150-sekunders grense. Ingen av formatene er hoppet over eller svekket: begge krever 150 korrekte noter, riktig sluttid, vellykket arrangering og én SSEQ-opplasting.
- Lokal `npm run test:browser` kjører også WAV og MP3 som to isolerte underkjøringer og lar hver bruke opptil 150 sekunder.
- Testen skriver ut hvor mye tid nettleseroppsettet tar, slik at nye CI-forsinkelser kan diagnostiseres.
- Lokal verifisering etter endring: `npm run verify` **164/164**, WAV **150/150** og MP3 **150/150** fra separate Chromium-kjøringer. Dette er lokale resultater, ikke en bekreftet ny GitHub-kjøring.
- Ingen produksjonskildekode, database-migrasjoner eller eksisterende sanger er endret av denne siste reparasjonen.

---

# Komplett sigma-themes v1.7.5 – CI-stabilisering og Turnstile-testrettelse, 17.11.2026

Dette er **hele prosjektet**, ikke en patch. Alle nødvendige nettside-, API-, test-, GitHub Actions- og Supabase-kildefiler ligger i ZIP-rotmappen. `node_modules`, miljøvariabler og `.git` følger **ikke** med.

## Ny rettelse basert på GitHub Actions-logg `119311947455` (17.11.2026)

- **Diagnose:** 26 av 28 CI-jobber bestod. `static-and-audio` bestod, men `browser_polyphonic_filepicker.py` i sharder 2/3 og 3/3 stoppet på MP3-opplasting. Begge skrev `Cloudflare Turnstile sitekey is missing from /api/config`. Selve toneanalysen av WAV ble korrekt.
- **Årsak:** nettleserens app starter en asynkron konfigurasjonsforespørsel ved oppstart, mens testen tidligere satte `SigmaDebug.state.ready=true` manuelt. Dette kunne starte opplastingen før intern app-konfigurasjon hadde mottatt `turnstileSiteKey` fra den simulerte `/api/config`-tjenesten. Det er en testkappløpstilstand; loggene alene dokumenterer ikke en feil med produksjonens Cloudflare-innstillinger.
- **Løsning:** testen venter nå på at appens `loadConfig()` faktisk har hentet den simulerte konfigurasjonen før den velger fil og starter opplasting. Mockserveren teller config-forespørsler, slik at en falsk «klar»-status ikke blir akseptert. Feildiagnostikken viser også configReads.
- **Ingen endringer i produksjonskoden:** Turnstile-beskyttelsen, SSEQ-konverteringen, sangkatalogen og Supabase-migrasjonene er uendret.
- **Verifisering:** `npm run verify` bestod (164/164 Node-tester), 18/18 polyfoniske browser-tilfeller bestod, alle tre sharder bestod 6/6, og lokal mock-opplasting samt arrangementskontroller bestod. Variasjonen med localhost og ekte Web Crypto kunne ikke utføres i dette låste testmiljøet (`ERR_BLOCKED_BY_ADMINISTRATOR`); dette må bekreftes i neste GitHub Actions-kjøring.

## Endringer i denne leveransen

- Inkluderer rettelsene fra begge tidligere QA-reparasjoner: generering av WAV/MP3 i CI, servering av `sigma_note_refine.js` i nettlesertesten, sikre migrasjonstester og `POLY_FAILURE`-diagnostikk.
- `npm test` lager nå eventuelle manglende **syntetiske** WAV/MP3-testfiler selv. Krever FFmpeg med libmp3lame ved manglende filer. Dermed fungerer også `npm run verify` fra et rent, nyutpakket prosjekt med FFmpeg installert.
- Polyfonitesten kjøres i tre isolerte GitHub Actions-jobber med til sammen alle 18 WAV/MP3-tilfellene. Ingen krav om noter, akkorder, eksport eller feilrapportering er fjernet.
- GitHub Actions `checkout`, `setup-node` og `setup-python` er oppgradert til v6 (Node 24) for å fjerne de tidligere Node 20-advarslene. Disse workflow-endringene må bekreftes av neste GitHub-kjøring.
- Ingen SQL er endret eller slettet. De seks historiske SQL-migrasjonene ligger fortsatt i `supabase/migrations` og har byte-identiske kopier i `docs/legacy_migrations`.

## Lokal installasjon / opplasting til GitHub

1. Pakk ut ZIP-filen. **Marker alt innholdet inne i ZIP-mappen**, og kopier inn i roten av din eksisterende lokale `S-themes`-mappe (samme mappe som `package.json`). Velg å erstatte eksisterende prosjektfiler. Kopier ikke en ZIP-fil som én fil til GitHub – GitHub pakker den ikke ut.
2. **Ikke slett** eksisterende `.git`-mappe, egne lokale filer, `.env` eller andre konfigurasjoner. Denne pakken inneholder ingen `.git` eller hemmelige nøkler.
3. I PowerShell fra prosjektroten:
   ```powershell
   git status
   npm ci
   npm run verify
   git add -A
   git commit -m "Complete sigma-themes v1.7.5 QA stability fixes"
   git push origin main
   ```
4. Kontroller GitHub Actions. En bestått lokal test beviser ikke at alle CI-jobber eller produksjonsintegrasjoner fungerer.

Før du kopierer: behold en lokal sikkerhetskopi hvis du har nye endringer på PC-en etter commit `6b3a3ae`. Hvis du har endret `main` etter dette, kan en komplett kildekodepakke overskrive nyere arbeid; sjekk `git status` og sammenlign endringer før du erstatter.

## Faktisk verifikasjon / begrensninger

- **BESTÅTT lokalt:** `npm run verify` (164/164 Node-tester), `npm run test:browser` (25/25 Chromium-suiter), tre polyfoni-sharder (6/6 hver), SSEQ-parser og migrasjonssikkerhet. Dette inkluderer test fra ren mappe med de genererte WAV/MP3-filene slettet.
- **Ikke ennå kjørt på GitHub:** CI-shardene og de oppdaterte `actions/*@v6` må bekreftes etter `git push`.
- **Ikke produksjonsverifisert:** ekte Supabase-upload, migrasjon av produksjonsdata, Vercel/Turnstile, fysisk iPhone, original HeartGold og Sigma Dex. Ikke kjør SQL ukritisk i produksjon.
- **Fortsatt åpne**: generell automatisk musikktranskripsjon av kompleks polyfoni, ekte 5-minutters kommersielle musikkopptak, nøyaktig DS-syntese og andre punkter i `KNOWN_ISSUES.md`. Denne leveransen hevder ikke at alle 72 registrerte forholdene er lukket.
