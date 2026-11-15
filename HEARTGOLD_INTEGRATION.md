# HeartGold instrument profile and SSEQ integration status

## Verified from the user-provided private instrument bundle

The uploaded `HeartGold_instrumentfiler_US(1).zip` contains `bankkart.json`, 39 Nitro `SBNK` banks and 39 `SWAR` sample archives. `bankkart.json` enumerates 362 music/sequence slots. `scripts/build_bank_profiles.py` checks binary headers and SHA-256 digests, reads SBNK instruments and tests referenced wave IDs against the included SWAR sample counts. It derives **metadata only** in `heartgold_bank_profiles.json` and `.js`; none of the original wave/sample contents are shipped to GitHub or the ZIP exporter.

**Example mapping from the supplied profile:** original sequence slot `1028`, `SEQ_GS_R_1_29` (Route 29), uses bank `702` (`BANK_BGM_FIELD1`). The browser displays the supported slots/programs. The writer and server reject notes outside the extracted pitch ranges. SSEQ has no independent SBNK pointer; correct sound comes from the assigned slot in the game's SDAT.

## Actual implementation

- Generate Nintendo Nitro SSEQ with notes, timing, tempo, programs and loop commands, with no streamed WAV/MP3 bytes.
- Validate SSEQ against a **specific** US HeartGold slot/program/range profile; files not compatible with this supported subset are rejected.
- Web Audio preview synthesizes **the stored SSEQ notes** with generic oscillators. Authentic HeartGold SWAR timbres are not reproduced publicly.
- Export only SSEQ+metadata to Sigma Dex v2 ZIP; Sigma Dex's future importer will be responsible for assigning the binary sequences to slots in the game build.

## What has NOT been verified

**Original HeartGold emulator playback is NOT VERIFIED.** No legal ROM test copy, exact original-revision build, melonDS environment/slot replacement or audible two-loop test was available in this task. No ROM modification or source edit has been made. Measured SDAT delta = **NOT TESTED**, not 0. The public metadata fingerprints do not prove in-game compatibility with an unknown game version. Neither a simple four-note SSEQ nor a ZIP passing our own reader is equivalent to passing an independent Nintendo SDK-compatible parser or a running DS sound driver.

To verify on a locally owned lawful copy: confirm exact HeartGold US revision and SDAT fingerprint; choose target slot 1028/bank 702; insert the exported SSEQ into that slot with a suitable established NitroFS/SDAT tool on a **private copy**, maintaining the existing bank and wave-archive associations; run in melonDS, play at the corresponding route, check two loops, SFX, transition out/back, duration, memory/performance, and record ROM/SSEQ hashes and actual SDAT byte delta. The user requested **no changes** to Sigma Dex, hg-engine or the Pokémon game in this project, so these tests remain external.

## Musical fidelity limitation

The built-in browser transcriber is an untrained spectral approximation. Simple synthetic WAV/MP3 melodies were transcribed with the right four notes, but a test mixing a melody with accompanying chords kept mostly the melody and **dropped chord voices**. This does not meet robust mixed-music reconstruction. A multi-instrument trained model, followed by real SBNK program assignment/timbre evaluation, remains required for the intended end-user quality. See ST-051 onward in `KNOWN_ISSUES.md`.

## v1.4.1 ongoing checks

The independent Python reader now verifies emitted multitrack pointers and command structure and the browser conversion retains partial synthetic triad content. Neither validation supplies the actual original HeartGold execution environment. The experimental SSEQ listening-level controls do not reproduce Nintendo's SBNK/SWAR sounds. `ST-010` and `ST-052` remain blocked.
