## v1.7.4 arranger export distinction

The editor serializes valid SSEQ with 16-track/65,536-byte guards and checks bank-local program and pitch coverage for selected slot; “Spill hele sangen” shares the exact immutable bytes with the upload path. Part-specific preview solo/listening loop are intentionally not serialized, volume maps to note velocities. These are local codec/Chromium checks, **not an in-game HeartGold US or native Sigma Dex importer test**. Authentic PCM preview still requires the user’s locally imported SBNK/SWAR and is not included in the source ZIP.

---

## 1.7.3 release qualification addendum

- **LOCAL PASS**: exact-pitch SSEQ notes and 4/6/8 simultaneous fixture voices tested by the browser file-picker workflow; initial pauses, bank/slot 1028/702 and SSEQ-only format remain covered by local regression. Original input `.sseq` byte preservation and maximum 65,536 bytes remain under existing tests.
- **LOCAL PASS with limitation**: project's **independently implemented** Python SSEQ reader and synthetic Sigma Dex ZIP validator. These are not commercial importer or original-game runtime tests.
- **NOT TESTED**: third-party `ndspy` parser. `tests/external_ndspy_optional.py` explicitly returns NOT TESTED when package absent; offline PyPI installation failed. Do not claim ndspy verification.
- **NOT TESTED**: actual Sigma Dex importer, two full native HeartGold US game loop cycles, physical Nintendo DS, actual 6-voice game playback and physical iPhone Safari. Legal ROM/emulator and those external environments are not available here. To test, import the generated `examples/sigma-dex-example-music.zip` into Sigma Dex, select 1028 (bank 702 with its mapped SWAR 700/702), and compare source and `music/*.sseq` SHA-256 and two played loops; test 4/6/8 note sequences separately, record observed program, timing and mixing. On iPhone Safari test cold Play, pause during fetch, resume, next track.
- **NOT TESTED**: equivalence of browser approximation to DS ADSR/pan/PSG/noise. The private authentic PCM preview uses the original locally imported sample but is not a bit-exact DS emulator.

---

# HEARTGOLD_COMPATIBILITY — evidence and limits

## Claim matrix

| Capability | Current evidence | Status |
|---|---|---|
| 39 banks, 2,593 metadata program entries | Profile and browser suite; all 39 bank identifiers represented | **LOCAL PASS** |
| Independent instrument per each of up to five MIDI inputs | Node/Chromium import+combine+export | **LOCAL PASS** |
| Game-slot-specific SBNK program validation | Slot/profile checks and parser | **LOCAL PASS** |
| SSEQ binary Nitro header/tracks/notes/timing | Native JS tests plus independently implemented Python fixture parser | **LOCAL PASS** for supported emitted subset |
| Max 16 logical tracks and 65,536-byte site limit | Export validation and fixture tests | **LOCAL PASS** for tested fixtures |
| Authentic source bank SHA-256 verification | Private original HeartGold US bank archive: 39 SBNK + 39 SWAR; matches fingerprints | **PRIVATE LOCAL PASS** |
| PCM sample root pitch, loop, envelope and pan | Shared Web Audio scheduler; 506 sample region lookups, 365 loop-capable; browser trial with bank 702 program 21 | **LOCAL PASS** (approximation) |
| PSG/noise exact synthesis and DS envelope register curves | Not emulated to DS specification | **NOT VERIFIED** |
| Real HeartGold US game sound and timing | No lawful ROM/emulator or physical DS integration test executed | **NOT TESTED** |
| Sigma Dex importer in deployed environment | Locally validated ZIP manifest and SSEQ fixtures only | **NOT TESTED end-to-end** |
| Vercel live publish/download/delete | Staging and production write tests not executed | **NOT TESTED** |

## Exports

Only real SSEQ binary note/event data may be stored as public audio or exported to Sigma Dex. Source MP3, M4A, WAV and MIDI remain inputs only. Normal SSEQ program selection is **bank-dependent**; a SSEQ is **not** a sound bank and cannot embed arbitrary original samples or rewritten SBNK ADSR settings. Changes requiring game-side soundbank patching are not promised as exportable. Do not mix instruments from unrelated banks into one standard game-slot sequence.

The format-level tests exercise the project's emitted commands. The independent Python fixture parser checks Nitro structural validity separately from the JavaScript parser; this is not an external third-party implementation or proof of the Nintendo DS runtime behavior. A third-party SSEQ parser could not be installed in the isolated test runtime. Preserve the site-specific 65,536-byte limit and 16-track cap. A successful parse cannot establish in-game compatibility alone.

## PCM sample decoding and preview

`heartgold_source_audio.js` parses Nintendo SBNK and SWAR structures locally, verifies original-file SHA-256, maps key splits and wave archive slots, decodes PCM8/PCM16/IMA ADPCM, and passes a single `schedulePcm` path to both the instrument preview and the finished SSEQ player. Source files are not transmitted to a server. A valid 60-byte SWAR with zero waves is accepted and does not offer fictitious PCM sounds.

Loop points, root pitch, pan and simplified attack/decay/sustain/release shapes are applied in browser Web Audio. The envelope uses **approximate** conversions because Nintendo's encoded ADSR bytes are not seconds; PSG/noise and DS mixer quirks are approximated separately. Some source instruments can fall back to synthetic timbres without corresponding private source imports. Absence of local sample files never blocks legal SSEQ export.

The **private source Chromium trial** is `python tests/browser_original_sources_local.py '/private/path/HeartGold_instrumentfiler_US.zip'`. It verifies original import through actual SHA-256, that an SSEQ note and the instrument preview both invoke shared PCM scheduling and use bank 702 program 21 with a loop. The restricted test container uses Python hashlib behind a test-only crypto digest shim, not a deployed runtime change. All private ROM/sound data are excluded from the ZIP. None of these prove bit-exact hardware rendering.

## Additional compatibility tests required before public guarantee

1. Legal HeartGold US ROM test environment; inject validated SSEQ at the corresponding game slot and compare playback, loops and timing for melody, chords, bass and five-MIDI arrangement.
2. Confirm each original SBNK/SWAR bank and sound archive mapping with actual game resource behavior.
3. Run a non-proprietary third-party SSEQ/Nitro parser on generated files and inspect all emitted opcodes, wait behavior and track ends.
4. Import a complete example into **Sigma Dex** and verify end-to-end without hand-editing ROM resources.
5. Repeat on iPhone Safari with local private SBNK/SWAR and perform a listening-level comparison.

**Verdict: verified against the local source metadata and supported SSEQ subset; full in-game compatibility is NOT VERIFIED.**
