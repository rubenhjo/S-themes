# Test results — v1.4.0 SSEQ preview (2026-11-15)

## Verified locally (not staging)

| Check | Method | Status |
|---|---|---|
| JavaScript syntax, Node regression, issue register | `npm run verify` | **PASS — 84/84** Node tests; old historical fixes + new SSEQ tests |
| Real Chromium browser suites | `npm run test:browser` | **PASS — 6/6** active suites, exit 0 |
| WAV without MIDI → SSEQ | `tests/browser_sseq_conversion.py`; four original sine notes C4 D4 E4 G4 | **PASS**; resulting SSEQ 59 B, exactly four correct pitches |
| MP3 without MIDI → SSEQ | Different four-note melody G4 F4 D4 C4 | **PASS**; resulting SSEQ 59 B, exactly four correct pitches |
| WAV containing chord accompaniment | Source includes melody + three sustained bass/chord tones | **FAIL musical completeness**; melody reconstructed, chords **not** reconstructed (ST-051) |
| MIDI → SSEQ | Type-0 MIDI fixture 60 62 64 67 | **PASS**; 59 B SSEQ |
| Valid SSEQ input, byte preservation | Re-upload generated 59 B sequence | **PASS**; identical bytes |
| Corrupt MP3 | Invalid binary | **PASS (rejected)**; no generated track |
| Stored SSEQ preview | Chromium `SigmaSeqAudio` with binary SSEQ Blob, Web Audio osc | **PASS**; play/pause and elapsed time; auditory similarity not evaluated |
| Bank and sample-range checks | 39 SBNK metadata profiles, 362 slots, legal and illegal program/pitch cases | **PASS** structural/program-reference tests |
| Sigma Dex sample ZIP | `node scripts/create-sigma-dex-example.mjs`, `node scripts/validate-sigma-dex-pack.mjs` | **PASS**; 3 SSEQ, 8,245 B ZIP, manifest/folders/SHA256 |
| SSEQ selected export (1, 6, 10 tracks), corruption, idempotent re-export | `tests/sseq-core.test.js`, `tests/sigma-dex-export.test.js` | **PASS** |
| UI local playlists and background sprites | Chromium 390, 768, 1440, 1920 px; visual placement fixture | **PASS**; six distinct visible motifs, no horizontal overflow |
| Public SSEQ upload cancel | Chromium fake PUT transport, click Cancel | **PASS**; one abort, zero finish requests |
| Actual SSEQ-only Vercel API + Supabase SQL/RLS | No connected staging environment or secrets | **NOT TESTED** |
| Real SSEQ playback from private Supabase URL under mobile CORS | No deployed environment | **NOT TESTED** |
| Original Pokémon HeartGold, melody, loops, program timbre, SDAT byte delta | No lawful local ROM/build or melonDS test | **BLOCKED** |
| Advanced multivoice transcription model | Not integrated or tested | **NOT IMPLEMENTED** |
| Legacy MP3/WAV migration preserving track IDs | No migration pipeline | **NOT IMPLEMENTED** |

### Test source sizes and outputs

| Input fixture | Source size | Generated SSEQ | Permanent music format | Program | Notes |
|---|---:|---:|---|---|---|
| `tests/fixtures/melody.wav` | 88,244 B | 59 B | SSEQ only | HeartGold US bank 702, program 0 | C4 D4 E4 G4 |
| `tests/fixtures/melody_b.mp3` | See fixture in repository (encoded with FFmpeg) | 59 B | SSEQ only | HeartGold US bank 702, program 0 | G4 F4 D4 C4 |
| `tests/fixtures/melody.mid` | See fixture | 59 B | SSEQ only | HeartGold US bank 702, program 0 | C4 D4 E4 G4 |
| `tests/fixtures/melody.sseq` | 59 B | 59 B (no re-encoding) | SSEQ only | HeartGold US bank 702, program 0 | C4 D4 E4 G4 |

Times vary by browser hardware and are **not** benchmarked in these tests; do not infer a production processing-time SLA. There is no permanent source-audio storage in the new browser upload code. Production Storage usage and migration were not tested.

**Test infrastructure limitation:** previous QC browser scripts that explicitly demanded WAV/NWAV export (rather than the new SSEQ-only contract) remain present as historical files, but are excluded from the current six-suite runner; counting them as current PASS would be incorrect. `test:browser` uses mocked API responses/fixture sprites where appropriate, not actual Supabase.
