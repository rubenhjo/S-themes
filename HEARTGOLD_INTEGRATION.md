## Scope update (2026-11-15): Sigma Dex importer contract, not game patches

See `SIGMA_DEX_EXPORT_SPEC.md` for the new `sigma-themes/sigma-dex-music-pack` v1 ZIP structure. sigma-themes performs all **audio preparation**, loop metadata, folder structure, SHA-256 checks and archive verification. **We are not modifying Sigma Dex, Origin HeartGold, hg-engine, or the Nintendo DS streaming driver** in this change. The future Sigma Dex music importer is assumed to understand this documented contract. Its receiver is not implemented or tested here. ST-010 remains blocked for real in-game streaming verification and is not marked VERIFIED.

# sigma-themes × Origin HeartGold — audited integration status (QC7)

**Status: DS-oriented audio export PASS (local); direct in-game integration BLOCKED / NOT TESTED.** This release does not contain a game-modding patch or any Nintendo copyrighted ROM. Do not label the output ZIP "ready to install in Origin HeartGold".

## Verified in sigma-themes source

The existing `ds_audio.js`, `ds_encode_worker.js` and `app.js::exportDS` convert user-selected tracks to **RIFF/WAVE IMA-ADPCM (format-tag 0x0011), 32,728 Hz, stereo**. A WAV `smpl` chunk can describe loop frames. Every output WAV is named deterministically and placed under `music/` with IDs chosen by the user; duplicate chosen game IDs are rejected. Multi-part archives include part-local `manifest.json`, `sequence-map.csv`, `READ_FIRST.txt` and global inventory. Every file has a SHA-256 digest; ZIP entries have CRC32 checks.

`npm run test:ffmpeg` locally produced a test file: FFprobe reports `adpcm_ima_wav`, 32728 Hz, stereo and `smpl` metadata. FFmpeg decoded it. This confirms it is a *valid RIFF IMA-ADPCM WAV*, not that a retail HeartGold sound engine can read it.

## Examined external game architecture

- The public [sigma-dex](https://github.com/arvindfroi/sigma-dex) describes Origin HeartGold built on **hg-engine**, but also explicitly says its **Origin HeartGold game export code is not contained in this repository**; game build and integration live separately.
- [hg-engine](https://github.com/BluRosie/hg-engine) is a publicly available HeartGold engine source framework, but is not automatically the exact fork, revision or configured sound code used by this group.
- Standard Pokémon HeartGold/SoulSilver stores its `SDAT` at `data/sound/gs_sound_data.sdat`, normally referring to `SSEQ` note sequences, `SBNK` instruments and `SWAR` sample banks. A finished MP3/WAV cannot become a playable SSEQ by renaming the file. The relevant alternative is streaming audio (`STRM` or another ROM-side streaming hook), not MIDI reconstruction.
- [NitroWAV-Player](https://github.com/TheGameratorT/NitroWAV-Player) documents a **New Super Mario Bros. DS** module that streams ordinary RIFF WAV (PCM8/PCM16/IMA-ADPCM), mono/stereo, up to 32728 Hz, and reads `smpl` loops. It also documents a Mario Kart DS legacy NWAV implementation. **It does not publish a ready-made Origin HeartGold patch.** The NSMB-specific `BGMReplace` hooks, sound IDs and build configuration cannot safely be pasted into hg-engine without adaptation and testing.
- The separate Origin HeartGold English translation repository contains translation/build patch tooling, but is not proof of this group's streaming integration.

## What is still necessary for genuine direct-import exports

1. **Identify the exact group game source/build**: its specific hg-engine fork/commit, build system, sound-ID constants, layout and local changes; publicly linked Sigma-dex does not supply these.
2. Decide **actual ROM sound strategy**: verified NitroFS streaming hook adapted to HeartGold/hg-engine or an already integrated module, with resource budgeting (ARM7/ARM9, mixer channels, streaming I/O buffering, thread scheduling) and fallback to original sequences.
3. Integrate hooks for **overworld music, trainer/battle transitions, event triggers, fade-in/fade-out, pause/resume, loop, audio volume** and coexistence with sound effects. Confirm how SSEQ IDs are intercepted and resolved.
4. Once the actual source/tree is known, create a **versioned game-target profile** inside sigma-themes containing exact filenames, file IDs, expected build paths, replacement IDs and generated C/header config for that version. Today `sseq_id` is a *suggested ID*, not an enforced game-engine assignment.
5. Check a user-owned legal ROM/build in **melonDS** (and preferably Nintendo DS hardware): actual sound playback, loop boundary accuracy, music changes with field/battle/event, long play, CPU/VRAM/RAM, streaming bandwidth and frame rate. None of these have been performed here.
6. Release only compatible **source edits/patches + original user-owned audio**, never a copyrighted `.nds` ROM.

## Honest acceptance matrix

| Check | Status |
|---|---|
| Selected song(s) → valid IMA-ADPCM RIFF WAV | PASS (local FFmpeg) |
| 32728 Hz, stereo, `smpl` | PASS (local FFmpeg/FFprobe) |
| Per-part manifest / mapping / SHA-256 | PASS (local ZIP tests) |
| Unique proposed SSEQ IDs | PASS (local tests) |
| Official source target paths and music ID replacement in Origin HeartGold | BLOCKED (group's actual build missing) |
| Ported streaming hook with validated audio memory/CPU behavior | NOT IMPLEMENTED |
| melonDS / real DS in-game playback | BLOCKED |

**KNOWN_ISSUES reference:** ST-010 remains **BLOCKED**. The audio files are genuinely encoded for an available DS streaming approach, but the **game-facing hook, event/music-ID mapping and installable patch are not delivered**. No unsupported statement of direct game compatibility is made.

## QC7 recheck, 2026-11-15

The v1.2.1 changes do **not** add a ROM streaming hook or a verified Origin HeartGold build. Current game export remains an audio/ID asset package, not a patch. See ST-010. The public NitroWAV code demonstrates DS streaming in other games, while integration with the exact Origin HeartGold project must be verified in its separate build.
