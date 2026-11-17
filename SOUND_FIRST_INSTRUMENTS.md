# Sound-first HeartGold instrument navigation · November 17, 2026

## What changed

The instrument browser now opens with **sound families** instead of being ordered by game location/bank. It shows all bank/program combinations from the existing 39-bank catalog. Users can narrow by **Piano & keys**, **Guitars**, **Bass**, **Strings & orchestral**, **Brass**, **Winds & reeds**, **Choirs & voices**, **Synthesizers**, **Drums & percussion**, **FX & atmospheres**, and **Not identified yet**.

The Synthesizers section has eight **sound-character subgroups** with plain-English descriptions: **bright/cutting leads; warm/mellow leads; soft/airy pads; dark/evolving pads; plucks/arpeggios; retro/8-bit; digital/metallic; deep synth bass**. Other families have similar subdivisions. You can search *all 39 banks at once*, page through the results, preview sounds, and assign a category to an instrument. The old bank-by-bank view remains under **Advanced · game banks**.

When selecting an instrument from another bank, the browser invokes the existing bank/slot-selection callback *before* assigning its program. It does not silently mix programs from incompatible banks into one vanilla SSEQ.

## Data integrity: why many entries are initially unclassified

The bundled `heartgold_bank_profiles.json` contains SBNK program type and pitch range, not verified musical instrument names or the game's original PCM bytes. HGSS program numbers **are not a General MIDI sound map**. Assigning program 0 = piano or program 24 = guitar just because the numbers resemble General MIDI would be wrong.

Therefore only **hardware-identifiable** entries receive initial categories: PSG square wave → retro/8-bit synth, noise → noise percussion and drum-key programs → drum kits. User-supplied names containing recognizable instrument words get suggestive categories. All other PCM and key-split entries remain **Not identified yet** until tagged. This preserves honesty but means piano/guitar categories may initially have zero members; the browser does not pretend otherwise.

Every instrument row has a **Sound family / character** selector. Tagging is saved in `localStorage` on that browser/device (`sigma-heartgold-sound-categories-v1`), keyed by **bank:program**. Such manual annotations **do not modify any SSEQ, SBNK, SWAR, Supabase rows, or game files** and **do not automatically propagate to other users**. For a public, pre-classified instrument directory, the original PCM/SWAR sources need to be reviewed and a checked-in community/curator label mapping added in a future release. This release does not claim those unverified labels.

Original sample previews still require personally imported, hash-matching SBNK/SWAR and remain in browser memory. Without them, the preview is only a synthetic approximation and cannot be used to reliably identify a sampled guitar or piano.

## Regression and deployment

- `node --test tests/heartgold-instruments.test.js` — verifies available families, subcategories, conservative defaults and saved overrides.
- `python tests/browser_sound_categories.py` — navigates across the 39 banks, filters synth character, chooses a cross-bank program, and manually tags an unclassified PCM program as piano.
- `python tests/browser_hg39_catalog.py` — checks original bank view, program counts, preview and combined MIDI assignment.
- `npm run verify` and the existing browser suite should continue to pass.

No database migrations, catalog APIs or upload endpoints changed in this UI-only release. The previous production catalog/schema problem is separate and should be confirmed on the live site before deployment.
