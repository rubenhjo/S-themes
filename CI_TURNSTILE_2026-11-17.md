# QA: GitHub Actions Turnstile-mock-race, 17. november 2026

## Kilde

`logs_119311947455.zip` – 28 jobber, 26 bestått, 2 feilet. Begge feilene er `browser_polyphonic_filepicker.py`: `POLY_SHARD=2/3` på `six-note chord` MP3 og `POLY_SHARD=3/3` på `strong harmonics` MP3. Begge fullfører transkriberingen, men meldingen i opplastingsdialogen er `Cloudflare Turnstile sitekey is missing from /api/config`. Opplastings-API-mockene har da `starts=0`, `uploads=0`, `finishes=0`; feilen oppstår før noen data overføres.

## Root cause

Appens `init()` kjører `refreshService()` asynkront etter at HTML-fixturen er installert. Den gamle nettlesertesten satte `SigmaDebug.state.ready=true` direkte etter at nettverksmocken var installert. Dette satte bare UI-tilstanden, ikke appens private `config`-objekt. Avhengig av rekkefølgen på init-konfigurasjonen og testens klikk kunne `getTurnstileToken()` se en tom `config.turnstileSiteKey`.

## Rettelse

- `tests/browser_polyphonic_filepicker.py`: Fjern kunstig `SigmaDebug.state.ready=true`; vent på `SigmaDebug.loadConfig({silent:true})`. Gjenta en gang dersom en tidligere init-forespørsel feilet, og krev en faktisk mock-konfigurasjonsrespons før opplasting.
- `tests/browser_sseq_upload_pipeline.py`: Spor `__qa.configReads` ved mock `/api/config`, mens API-responsen fortsatt har syntetisk sitekey og simulert Turnstile-token.
- Behold alle kontroller for antall noter, tonehøyder, SSEQ-only og null produksjonskall. Ingen skjult «ignore failures» eller forlenget timeout.

## Kontroll

- `npm run verify`: PASS (164/164 Node-tester)
- `SIGMA_BROWSER_USE_REAL_CRYPTO=1 python -u tests/browser_polyphonic_filepicker.py`: PASS (18/18)
- `POLY_SHARD=1/3`, `2/3`, `3/3`: PASS (6/6 hver)
- `python -u tests/browser_sseq_upload_pipeline.py`: PASS (vanlig browser-mock-modus)
- `python -u tests/browser_arranger_controls.py`: PASS
- `SIGMA_BROWSER_USE_REAL_CRYPTO=1 python -u tests/browser_sseq_upload_pipeline.py`: Ikke gjennomførbar i dette lokale miljøet; localhost-navigation returnerer `net::ERR_BLOCKED_BY_ADMINISTRATOR`, før testkoden kjører.

**Status:** root cause bekreftet i loggene og reparert i testen, lokal regresjon bestått. Ny GitHub Actions-kjøring kreves for å bevise CI-resultatet. Dette bekrefter ikke drift av Vercel, Supabase eller reell Cloudflare Turnstile i produksjon.
