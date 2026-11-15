# Sigma Dex music import package — v1

**Source and exporter:** sigma-themes v1.3.0 (GitHub/Vercel application).
**Receiver:** a future Sigma Dex importer that implements this document. No receiver or Pokémon game code is included or changed.

## Purpose and format

A user selects the complete catalog, one or more folders (recursively), or individual tracks. sigma-themes downloads and SHA-256-verifies each selected original audio file, decodes and resamples each file in the browser, encodes a **32,728 Hz two-channel RIFF/WAVE IMA-ADPCM (WAVEFORMATEX tag 0x0011)** WAV, validates it, then creates and verifies a **single** ZIP32 package. MP3 is never used as the game-export audio format.

The v1 package consists of:

```text
sigma-dex-music-export-YYYY-MM-DD.zip
├── manifest.json
├── folders.json
├── tracks.json
├── checksums.sha256
├── README.txt
└── music/
    ├── Battle/
    │   └── Wild/
    │       └── Theme-<hex-encoded-stable-track-id>.wav
    ├── Overworld/
    │   └── Routes/
    └── <root-track>.wav
```

**Filename collision rule:** the final component is `${sanitized-title}-${UTF8-hex(track-id)}.wav`. The tree uses validated NFC-normalized folder names. Sibling folders cannot have case-insensitively identical names. The exporter rejects duplicate IDs, missing parents, folder cycles, path traversal, bad loop metadata, missing/invalid audio, missing metadata, and all ZIP/file integrity mismatches. Folder names allow human-readable characters except reserved slash/backslash/control and Windows-invalid filename characters. Folder depth is capped at 12 and a package at 1,500 tracks.

## manifest.json

A UTF-8 JSON object. Required keys:

| Field | Meaning |
|---|---|
| `format` | Exact string `sigma-themes/sigma-dex-music-pack` |
| `version` | JSON integer `1` |
| `export_id` | Unique export identifier |
| `created_at` | ISO 8601 UTC timestamp |
| `producer` | `sigma-themes` |
| `sample_rate` | 32728 |
| `codec` | `RIFF WAVE IMA-ADPCM` |
| `channels` | 2 |
| `folder_count`, `track_count` | Exact counts |
| `tracks` | Array identical to `tracks.json` |
| `folders_file`, `tracks_file`, `checksums_file` | Exact relative paths to supporting files |

`tracks.json` contains ordered objects with: `id`, `title`, `artist`, `original_filename`, `exported_filename`, `file`, `folder_id`, `folder_path`, `source_sha256`, `format`, `samplerate`, `channels`, `duration_s`, `loop_enabled`, `loop_start_sample`, `loop_end_sample`, `loop_start_sec`, `loop_end_sec`, `event_id`, `bytes`, `sha256`. File references are rooted at the package root and use forward slashes.

`folders.json` contains `id`, `name`, `parent_id`, `path` records. The root record is `{ "id": "root", "name": "Music", "parent_id": null, "path": "" }`. Parent folders of selected descendants are included, even when empty, so the full selected hierarchy can be reconstructed. The root `Music/` container is represented by the top-level `music/` path in the ZIP, rather than an extra nested folder.

`checksums.sha256` lists the lowercase SHA-256 hex digest followed by two spaces and the relative filename for **every WAV and every JSON file**. `README.txt` describes the expected receiver and explicitly says the package is not a ROM patch.

## Loop contract

The browser resamples to 32,728 Hz before encoding. Each loop's start/end is represented in the WAV `smpl` chunk as **inclusive sample frame indices**, and in the JSON as both samples and seconds. The start and exclusive end of custom IMA-ADPCM loops are rounded to the nearest WAV ADPCM block boundary (505 sample frames per stereo block with block-align 512). In JSON `loop_end_sample` is the inclusive end; `loop_end_sec` is `(loop_end_sample + 1) / 32728`. The original request in seconds may therefore differ slightly from the final exported values; the WAV `smpl` chunk is authoritative. If looping is disabled, `smpl` must be absent and the sample/second loop fields must be null. The exporter checks these invariants and fails closed on invalid values.

## Folder ownership and persistence

The **shared music catalog remains in Supabase**. The v1 folder tree, track-to-folder choices, editable export metadata and loop points are **personal to the current browser** and stored together with existing local playlists/favorites. They are included in personal ZIP backups. Folder changes never alter other users' records or bypass server-side upload validation. This avoids giving anonymous users destructive write permission over shared folders. Cross-device/shared folder editing is **not implemented** in v1.

## Validator and sample data

```bash
npm run test:example
node scripts/validate-sigma-dex-pack.mjs examples/sigma-dex-example-music.zip
```

The `scripts/create-sigma-dex-example.mjs` generator creates three **synthetic** audio excerpts without copyrighted recordings. The validator opens the real ZIP, checks ZIP32 CRC, reads the complete manifest and folder tree, verifies every `checksums.sha256` line and audio SHA-256, checks each WAV's codec, channel count, sample rate, and `smpl` metadata. The reference WAVs are additionally tested with FFprobe/FFmpeg. A failure must never show an export-success message.

## Known limitations

- **Single ZIP32** only (under 4 GiB with metadata overhead); the exporter fails explicitly rather than silently splitting a package that Sigma Dex might interpret incorrectly. ZIP64 and browser disk-streamed output require a separate implementation and validation.
- Conversion decodes each track in browser audio memory, then encodes it in a Worker. Existing browser limitations: at most 12 minutes / 180 MiB source per song and available memory per device. Larger libraries may require batching or a trusted server-side export worker.
- The format is an **import contract proposed by sigma-themes**, not a guarantee that an unmodified HeartGold ROM can play WAV/IMA-ADPCM. Sigma Dex import support and the actual game streaming hook are separate projects and outside the present scope.
- No end-to-end import into Sigma Dex has been claimed or performed.
