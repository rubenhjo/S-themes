# Oppdatering 17. november – femminutters WAV/MP3 i CI

Denne komplette prosjektpakken bygger på forrige v1.7.5 ZIP og reparerer **den ene gjenværende feilen** dokumentert i `logs_119325362560.zip`. Av 28 GitHub Actions-jobber bestod 27; `browser_five_minute_import.py` ble stoppet av ekstern tidsgrense (`exit 124`) etter at 300 sekunders WAV allerede hadde bestått. MP3-testen startet, men fikk ikke fullføre før samme 90-sekunders budsjett gikk ut. Dette er en CI-testorkestreringsfeil, **ikke bevis på at MP3-transkripsjonen feiler**.

- WAV og MP3 testes nå som **to separate CI-jobber**, hver med egen Chromium-prosess, generering og hard 150-sekunders grense. Ingen av formatene er hoppet over eller svekket: begge krever 150 korrekte noter, riktig sluttid, vellykket arrangering og én SSEQ-opplasting.
- Lokal `npm run test:browser` kjører også WAV og MP3 som to isolerte underkjøringer og lar hver bruke opptil 150 sekunder.
- Testen skriver ut hvor mye tid nettleseroppsettet tar, slik at nye CI-forsinkelser kan diagnostiseres.
- Lokal verifisering etter endring: `npm run verify` **164/164**, WAV **150/150** og MP3 **150/150** fra separate Chromium-kjøringer. Dette er lokale resultater, ikke en bekreftet ny GitHub-kjøring.
- Ingen produksjonskildekode, database-migrasjoner eller eksisterende sanger er endret av denne siste reparasjonen.

---

## Hva GitHub-loggen faktisk viser

- 12:10:07: test startet med `timeout 90s`.
- 12:10:12: 52,9 MB stereo-WAV og 7,2 MB stereo-MP3 opprettet.
- 12:11:25–12:11:32: WAV-testen startet og bestod; 150 noter, ingen feil, siste note 299,75 s.
- 12:11:32: MP3-test startet.
- 12:11:37: `Process completed with exit code 124` (90 s total). Ingen MP3-resultat finnes i denne kjøringen.

## Hva som fortsatt må kontrolleres

Ny GitHub-kjøring må vise begge navngitte femminuttersjobber grønne. 150 sekunder er en eksplisitt fail-closed grense; den er ikke en tvungen passering. Ekte lydopptak, produksjons-Supabase, Vercel, iPhone og DS-hardware er ikke bekreftet av disse syntetiske testene.
