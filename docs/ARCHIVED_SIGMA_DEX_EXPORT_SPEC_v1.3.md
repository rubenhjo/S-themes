# Sigma Dex import contract — SSEQ-only version 2

**Producer:** sigma-themes v1.4 SSEQ-preview. **Receiver:** future Sigma Dex implementation; importing into Sigma Dex itself has NOT been tested. ZIP is a delivery container, **not** an original-HeartGold ROM patch or SDAT archive.

## File structure

```text
sigma-dex-sseq-export.zip
├── manifest.json
├── tracks.json
├── folders.json
├── checksums.sha256
├── README.txt
└── music/
    ├── Battle/Wild/Theme-<UTF8-hex-track-id>.sseq
    └── Overworld/Routes/Route-<UTF8-hex-track-id>.sseq
```

Only `.sseq` files may appear in `music/`. No source WAV, MP3, ROM, SBNK or SWAR files are embedded. Folder names are NFC-normalized and sanitized; duplicate sibling names, cycles, traversal, missing references and collisions fail before successful download. Every track ID is stable and unique, even when titles repeat.

## manifest.json

The manifest contains these mandatory fields: `format` (exact `sigma-themes/sigma-dex-sseq-pack`), `version` (integer `2`), `export_id`, `created_at` (UTC ISO timestamp), `producer` (`sigma-themes`), `game` (`Pokemon HeartGold US`), `bank_profile_sha256` (the SDAT hash fingerprint of the **private** metadata source; **not** itself a proof of ROM compatibility), `folder_count`, `track_count`, `tracks`, `folders_file`, `tracks_file`, `checksums_file`, `note`.

`tracks` must exactly equal `tracks.json` and contain, for each entry:

- Stable ID, title, artist, `original_filename`, `exported_filename`, ZIP-relative `file`, `folder_id`, `folder_path`.
- `format: "SSEQ"`, `codec: "Nitro sequence"`, `bank_id`, `source_slot`, `source_symbol` and `wave_archives` (all derived from user-provided US game bank metadata).
- Calculated `duration_s`, `tempo`, `notes`, `loop_enabled`, optional `event_id`, `bytes`, `sha256`, `source_sha256`.

The **target slot/bank mapping** is outside the SSEQ binary by design. The SSEQ contains instrument/note/timing/loop commands. A future importer must assign the sequence to the designated slot with its existing SBNK/SWAR resources; it must not interpret `bank_id` as data embedded within SSEQ.

`folders.json` stores `{id,name,parent_id,path}` records including `{id:"root", name:"Music", parent_id:null, path:""}`. `checksums.sha256` lists one lowercase SHA-256 hex digest, two spaces, and UTF-8 relative ZIP path per music/JSON file (excluding the checksum file itself and README). Missing, duplicated or extra entries invalidate the package.

## SSEQ binary acceptance

A `.sseq` must have a valid Nintendo Nitro SSEQ v1.0 header, valid DATA offset/length, parseable musical note/timing/events, selected bank's defined instrument programs and actual playable pitch ranges from the generated metadata, no empty music, and size <=65,536 bytes. Current parser supports a **restricted opcode subset**; a valid but more complex game SSEQ may be rejected rather than blindly passed through. Current writers emit note, rest, tempo, program, track-open, loop begin/end and end-of-track commands.

The zip validator reparses each SSEQ with the assigned US slot profile, compares note/tempo/loop/bank metadata and SHA-256 and checks ZIP CRC. Original game bank data are not transferred.

## Loop contract

Current generated SSEQ with looping enabled uses Nitro `BeginLoop` (0xD4) and `EndLoop` (0xFC) events. Exact seconds-based start/end editing in the UI is **not yet wired into the binary SSEQ writer**: values in local export settings must not be treated as proof of actual loop edits. The exported manifest reflects **parsed binary loop status**. A future editor must rewrite and revalidate the SSEQ events, not just modify JSON.

## Verification

```sh
npm run test:example
node scripts/validate-sigma-dex-pack.mjs examples/sigma-dex-example-music.zip
npm run test:sseq
```

Test ZIPs from this tool are valid for the **versioned package contract**, but there is no implemented Sigma Dex receiver and no verified in-game original HeartGold integration yet.
