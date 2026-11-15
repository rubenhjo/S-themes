# Sigma Dex SSEQ-only music import contract — v2 (proposal)

**Publisher**: sigma-themes v1.4 preview. **Receiver**: future Sigma Dex importer (not implemented here). No game ROM or instrument-bank binaries are distributed. This spec supersedes the archived v1 WAV-based `docs/ARCHIVED_SIGMA_DEX_EXPORT_SPEC_v1.3.md`.

## Package shape

```text
sigma-dex-sseq-export.zip
├── manifest.json
├── tracks.json
├── folders.json
├── checksums.sha256
├── README.txt
└── music/
    ├── Battle/
    │   └── Wild/
    │       └── Theme-<UTF8-hex-stable-track-id>.sseq
    └── Other-<UTF8-hex-stable-track-id>.sseq
```

Every `music/` entry is an actual Nitro `SSEQ` (little-endian `SSEQ` header + `DATA` section + supported event stream). **No MP3, WAV, M4A, FLAC, SBNK, SWAR, ROM, or streaming driver is allowed in an import pack.** The zip is transport, not a Sound Data Archive and not a game patch. The receiver must use the appropriate existing HeartGold US SDAT sequence slot and its bank/sample mappings.

## Metadata schema

`manifest.json` keys:

- `format`: exact literal `sigma-themes/sigma-dex-sseq-pack`
- `version`: integer `2`
- `export_id`, `created_at` (ISO 8601), `producer` (`sigma-themes`), `game` (`Pokemon HeartGold US`), `bank_profile_sha256` (reference metadata fingerprint)
- `folder_count`, `track_count`, `tracks`, and `folders_file`, `tracks_file`, `checksums_file`

Each `tracks.json` / `manifest.tracks` object contains `id` (stable), `title`, `artist`, `original_filename`, `exported_filename`, `file` (safe ZIP path), `folder_id`, `folder_path`, `source_sha256`, `format: SSEQ`, `codec: Nitro sequence`, `bank_id`, `source_slot`, `source_symbol`, `wave_archives`, `duration_s`, `tempo`, `notes`, `loop_enabled`, `event_id` (nullable), `bytes`, and `sha256`.

The `bank_id`, `source_slot`, and `wave_archives` fields describe the bank/waves ALREADY PRESENT in the original HeartGold US build. `bank_profile_sha256` is an inventory identifier, not a cryptographic proof that an arbitrary ROM uses the same layout. An SSEQ does not itself embed a playable instrument sound sample.

`folders.json` contains a synthetic root `{id:'root',name:'Music',parent_id:null,path:''}` and one record per included folder. `checksums.sha256` lists SHA-256 for the three JSON files and every actual SSEQ entry, each as `digest` + two spaces + relative path. `README.txt` explicitly states the future importer requirement.

## Export selection and integrity

Users select all music, individual songs or folders recursively; only selected tracks and their necessary ancestor folders appear. Unselected songs never enter the ZIP. Empty selected folders are retained in metadata. Filenames are derived deterministically from a sanitized title and hex-encoded immutable track ID, preventing collisions/traversal. Event IDs must be unique among selected songs. SSEQ bytes are fetched from published private Storage, independently SHA-checked and parsed against the chosen HeartGold slot; **no reconversion occurs during export**, so repeated download of a given song revision yields the same SSEQ SHA-256. The pack validator checks ZIP CRC, inventory uniqueness, hashes, references, event assignments and SSEQ music notes/programs.

The ZIP32 implementation fails explicitly when a package exceeds its supported size rather than silently returning an incomplete archive. Very large packs and real memory-limited devices need dedicated performance validation. The package is a **proposed schema**; it has not been imported by Sigma Dex and has **not** been played in a HeartGold emulator.

## Loop semantics

SSEQ uses Nitro sequencer loop events (`0xD4`/`0xFC`) in the supported writer. The current SSEQ-only writer uses a full-phrase repeat, not sample-index loop slices. Personal loop-editor metadata can describe start/end seconds but **does not yet rewrite an already published SSEQ's actual loop events**. The exported `loop_enabled` is read from the binary `SSEQ`, and correctness of arbitrary custom musical loop points remains OPEN. Browser playback is a Web Audio approximation and not exact SBNK/SWAR timbre.

## Independent reproducibility

Run `npm run test:example` to generate 3 synthetic SSEQ tracks and `node scripts/validate-sigma-dex-pack.mjs examples/sigma-dex-example-music.zip` to verify the transport contract. Browser WAV/MP3 tests are in `tests/browser_sseq_conversion.py`. Real game and Sigma Dex receiver checks are outside the current scope.
