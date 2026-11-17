# v1.7.6 sound-first instrument browser · release candidate

- Default HeartGold instrument selector browses **instrument families and sonic character**, rather than game location.
- Added instrument-family cards, sound-character subcategories, explanatory labels, all-bank search, and paginated results. Synth options include bright leads, warm leads, airy pads, dark pads, plucks, retro/8-bit, digital/metallic and deep bass.
- Every instrument can be manually classified, stored locally and revisited by category. Unknown PCM timbres **are not misrepresented as named piano/guitar sounds**.
- Original bank/program and source type remain visible; advanced bank navigation and vanilla SSEQ constraints stay intact. Cross-bank program selection updates the destination bank *before* assigning the program.
- The upload modal now opens its instrument explorer by default.
- Added sound-first Node/Chromium tests and retained the original 39-bank regression.
- No database changes or audio/codec algorithm changes in this release.

**Important:** The source JSON only documents hardware type and playable notes. Accurate PCM labels require a reviewed instrument-name dataset or user-supplied original sample playback and manual curation. Personal annotations do not automatically synchronize to other visitors. 

Release is locally tested but not yet deployed or production verified.
