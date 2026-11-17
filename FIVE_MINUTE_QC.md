# 300-second WAV / MP3 — local release quality control (v1.7.5)

## Test provenance and exact observations

`tests/browser_five_minute_import.py` synthesizes 150 independent, known MIDI pitches with explicit 60 ms attack offsets, 1.67 s note lengths, 330 ms gaps, over 300 s. FFmpeg converts the locally generated fixture to 44.1 kHz stereo PCM16 WAV and 44.1 kHz stereo 192-kb/s MP3. The temporary source files are **generated at test time and are not included in the repository**.

Actual browser file-picker → browser decode → resampling → the project's real Worker script (`sigma_note_refine.js`, `sseq_transcribe.js`, `sseq_transcribe_worker.js`) → arranger modal → all-SSEQ export → mocked server upload finish. Because the test uses an about:blank fixture, a blob URL rehosts the exact Worker source instead of fetching its web path; this changes no transcription code. The test also walks the 15 s editor window, inspects notes at 285–300 s, and verifies that unedited notes outside the current view remain in the final SSEQ.

| Measurement | WAV | MP3 |
|---|---:|---:|
| Source | 300 s, 44.1 kHz stereo WAV (52,920,078 bytes) | 300 s, 44.1 kHz stereo MP3 (7,201,688 bytes) |
| Expected 150 pitched events | 150/150 | 150/150 |
| Wrong or missing pitches | 0 | 0 |
| Worst onset absolute error | 18.3 ms | 18.3 ms |
| Worst offset absolute error | 20.0 ms | 20.0 ms |
| Latest audible note end | 299.75 s | 299.75 s |
| Final valid SSEQ bytes | 1,091 | 1,091 |
| Mocked reservations / finishes | 1 / 1 | 1 / 1 |

`node --test tests/five-minute-arranger.test.js`: 8,000 note-event editor construction PASS in 15.4 ms on this local machine. The benchmark is a regression guard, not a promise of identical phone speed. UI rendering is bounded to at most 240 interactive note buttons *per part* in the selected time window; if notes are denser, shrink the editable range. All notes remain in the model and export regardless of whether they are in the displayed interval.

## Real limitations

- This synthetic, clean monophonic tune is a **successful compatibility/performance example**, not proof of polyphonic transcriber accuracy for 5 minutes. The known 18-clip synthetic set retains the existing stricter quality benchmark; human-annotated real songs are still needed.
- Final Nitro SSEQ limit is 65,536 bytes. Dense notes can exceed this and must produce a visible rejection, not silently drop material. 8 voices are candidate detection limits, not a statement about available DS polyphony. Three hundred seconds is below the app's 360-second decode cap, but source file size limit (128 MiB) and RAM/CPU determine whether a particular phone succeeds.
- A *mock server* accepted the one final SSEQ; **no actual Vercel/Supabase/Turnstile upload or automatic public publication was tested**.
- A physical iPhone, external ndspy, real HeartGold SSEQ playback and native Sigma Dex import are **not tested**, and the project was not deployed.

## Local reproduction

```sh
npm ci
node --test tests/five-minute-arranger.test.js
python tests/browser_five_minute_import.py
npm run verify
python tests/run_browser_tests.py
```

Requires FFmpeg (`libmp3lame`), Playwright and Chromium. The CI browser matrix includes the 5-minute fixture. All generated test recordings are deleted after the test.
