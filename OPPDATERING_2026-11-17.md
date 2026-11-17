# sigma-themes — komplett prosjekt, QA-oppdatering (17.11.2026)

Denne ZIP-en inneholder hele kildekoden for sigma-themes v1.7.5 med reparasjonene som ble kontrollert mot GitHub Actions-loggene etter commit `6b3a3ae`.

## Inkludert

- Alle nettsidens kilder, API-ruter, Supabase SQL-migrasjoner, Workflows, HeartGold-instrumentbanker og tester.
- Generering av de ni polyfoniske WAV/MP3-testparene i GitHub Actions for både statisk jobb og nettleserjobber (`.github/workflows/ci.yml`). Lydfilene bygges under test og er ikke nødvendig å lagre i Git.
- Rettelse av browser-testserveren slik at `sigma_note_refine.js` leveres som JavaScript (`tests/browser_sseq_upload_pipeline.py`).
- Migrasjonstest som bevarer historiske SQL-filer og kontrollerer at de er identiske med arkiverte kopier (`tests/migration-versioning.test.js`).
- `POLY_FAILURE`-feildiagnostikk for den ennå ikke bekreftet løste GitHub CI-timeouten (`tests/browser_polyphonic_filepicker.py`).

## Oppdater et eksisterende Git-prosjekt i Windows

1. Ta gjerne en kopi av mappen `S-themes` først.
2. Pakk ut ZIP-en, marker **alt innhold** og kopier det inn i rotmappen til det eksisterende Git-prosjektet (`...\\S-themes\\S-themes\\`). Godta erstatning av filer når Windows spør. **Ikke** kopier selve ZIP-arkivet inn i GitHub, og **ikke** overskriv `.git` (pakken inneholder ikke `.git`).
3. Åpne PowerShell i den eksisterende prosjektmappen og kjør:

   ```powershell
   git status
   npm run verify
   git add -A
   git commit -m "Complete v1.7.5 QA update"
   git push origin main
   ```

4. Kontroller resultatet i GitHub Actions. Opplasting til GitHub bekrefter ikke i seg selv at alle nettlesertester består i CI.

**Viktig:** Siden dette er basert på kildekopien fra commit `6b3a3ae`, må du se på `git status` og kontrollere at du ikke overskriver nyere lokale endringer før du kopierer. Ingen produksjonsdatabase er endret ved å pakke ut kildekoden.
