# HeartGold 39-bank instrument browser · v1.6.0

This release expands the earlier 5-MIDI arrangement workflow with a complete **39-bank** navigator and instrument explorer.

## What is included

- Every bank from the verified local `heartgold_bank_profiles.json`: IDs **700–738**.
- Every program entry in those banks; programs are grouped by bank and can be filtered by *SBNK instrument type*, searched and sorted.
- Descriptive bank titles based on the known sequence-slot locations (e.g. New Bark Town, Kanto, Ho-Oh, Lugia). This is intended as navigation assistance, **not proof that every instrument within a bank is exclusive to that location**.
- Program descriptions are deliberately factual (PCM sampled, square-wave PSG, noise, drum/key range, key-split). **GM instrument names cannot be inferred reliably from program IDs.** Users can add and search their own browser-local program names; no personal metadata is uploaded.
- A `▶ Hear` control on every instrument row. With only the metadata bundle, Web Audio plays a synthetic demo **not an authentic HeartGold sound**.
- Optional import of original SBNK and SWAR files (multi-select) with SHA-256 verification against the supplied HeartGold US metadata. Files remain in browser memory only; no server upload, copying into archives, or automatic persistent storage.
- Once an original SBNK is imported, all raw instrument settings are available under each program, including key splits/ranges and base note, sample/WAR slot, attack, decay, sustain, release and pan.
- Once the matching SWAR sample archive is also imported, PCM instrument preview plays the **actual source sample**, with approximate envelope and pitch playback. PSG/noise previews remain browser synth approximations.
- The upload dialog exposes 39 banks and maps each bank to its actual destination game sequence slots. Five MIDI files can select independent programs in the **same** chosen bank; track/channel overrides remain available.
- Export remains strict SSEQ only, and validates that all chosen programs and note pitches exist in the destination bank. Mixing programs from different SBNKs into one vanilla SSEQ would require patching the game's bank resources, so it is not misrepresented as supported.

## Original source requirement

The project includes metadata and SHA-256 checksums but **does not include the game's original SBNK or SWAR bytes**. Thus true sample playback and full per-program ADSR are conditional on manually loading legitimate matching source files through the instrument browser. Original Nintendo audio assets are not redistributed in this package.

SSEQ alone does not hold a bank ID or a custom collection of samples; the selected game's SDAT slot determines the SBNK and SWAR mapping. Changing the selector therefore changes the destination slot, not the SSEQ format.

## Testing

Run `npm run verify` for the Node + static QC suite, and `python tests/browser_hg39_catalog.py` plus `python tests/browser_midi_five.py` to test the instrument browser and upload flow with mocked server responses in Chromium. Browser tests are **not production Supabase/Vercel deployment verification**. Sample parser unit tests use deliberately synthesized SBNK/SWAR fixtures, **not an authenticated Nintendo game dump**.

## Known limitations

- No all-bank combinations within one unmodified SSEQ. The destination bank must be selected first and limits exported instruments.
- Native original audio still requires the user's SBNK+SWAR; synthesized sound does not faithfully reproduce the ROM instruments.
- The Web Audio envelope for loaded sample playback is approximate and does not emulate Nintendo DS hardware ADSR timing perfectly.
- No editing/replacing SBNK content in the target game or sound sample shipping with Sigma Dex.
- Other preexisting issues documented in `KNOWN_ISSUES.md` and `RELEASE_QC_2026-11-16.md` remain open.
