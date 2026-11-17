# Cute melody(1).m4a — faktisk før/etter-kontroll, 16. november 2026

**Datagrunnlag:** Original privat 7,744 sekunders opptak, SHA-256
`84cb65fa0f50e19e1d82629c0aa100e1aec5c9de9a48d03809b62bf16cde53dc`.
Originalfilen er ikke inkludert i denne kildekodepakken.

**Metode:** Originalen ble dekodet med FFmpeg til mono float32, 11 025 Hz. Den samme dekodede bølgeformen ble analysert med `spectralFrames` + `smooth` fra kildeversjon v1.6.0 og fra den sammenslåtte v1.7.0. Den nye koden ble dessuten kjørt gjennom **hele `convertFile`-løpet** på den originale M4A-filen i Chromium, med slot 1028 / bank 702, og utdataene ble parset som SSEQ.

| Måling | v1.6.0, samme lyd og spektralmodell | v1.7.0, samme lyd og spektralmodell |
|---|---:|---:|
| Detekterte notehendelser | 24 | 23 |
| Brukte analysekanaler | 4 | 6 |
| Ulike notenumre | 10 | 14 |
| Start rundt 3,18 s | F4 (MIDI 65), start 2,93 s | F4 (MIDI 65), start 2,93 s |
| Rundt 6,52 s | B3 (59), start 6,36 s | B3 (59), start 6,34 s; mulig B1 (35) fra 6,55 s |
| Rundt 7,36 s | F2 (41) og G#2 (44), fordeling 7,29/7,36 s | F2 (41) og G#2 (44), begge fra 7,29 s |

MIDI-numrene i tabellen er kontrollverdiene; notenavnene er kun lesehjelp.

Fra **Chromium-konverteringen** i v1.7.0 ble den ferdige SSEQ-en **147 byte, 23 noter, ett programspor, 7,50 s sekvensvarighet**; det er innenfor 65 536-byte-grensen. Én SSEQ-spor kan ha samtidige noter; sporantall alene angir ikke polyfoni. Den tidligere QC-beskrivelsen oppga 196 byte / 3 spor for v1.6.0; dette er en tidligere måling, **ikke** nytestet eksakt eksport fra den versjonen.

## Hva testen viser — og ikke viser

- **Verifisert:** Begge implementasjonene prosesserer samme originale bølgeform. Den nye utgaven klarer faktisk M4A → binær SSEQ lokalt i Chromium. Den har ikke hardkodet fire analysekanaler.
- **Ikke verifisert:** At 23 noter er musikalsk mer korrekt enn 24, eller at de ekstra lave tonene etter ca. 6,52 s er ekte. Den nye algoritmen introduserer en mulig subharmonisk B1 (35). En menneskekontrollert referanse med manuell note-for-note-avlytting og stemmeskille er ikke etablert.
- **NOT TESTED:** eksakt notepresisjon, falske/manglende noter målt mot en uavhengig menneskelig fasit, onset-/varighetsavvik mot fasit, oktavavvik, lyttende A/B-bedømmelse, originale HeartGold-lyder i emulator/hardware.

**Konklusjon:** Automatiske tester på syntetisk musikk kan bekrefte bestemte feiltilfeller, men **den musikalske lydkvaliteten er ikke godkjent** for vilkårlige opptak. Særlig bass-/subharmonikkfiltreringen trenger mer arbeid og en menneskelig referanse. Dette er et åpent P1-kvalitetspunkt, ikke en bestått lyd-QC.

## Reproduksjon uten å legge originalen i GitHub

`python tests/browser_user_audio_local_only.py "/lokal/sti/Cute melody(1).m4a"` kjører en lokal Chromium-konvertering og skriver kun notemetrikk til terminalen. Filen lagres ikke på serveren eller i offentlig ZIP. For identisk spektralmodell-sammenligning kreves kildekoden fra begge versjoner og en lokal FFmpeg-dekoding; tidligere v1.6.0 er ikke pakket inn i denne releasen.
