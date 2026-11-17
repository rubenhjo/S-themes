# sigma-themes – iPhone / Safari SSEQ playback patch

## Scope

Only the preview playback path (`sseq_player.js`, `app.js`) changed. Uploading,
conversion, SSEQ validator rules, bank mapping, database schema, playlists and
song byte payloads are not changed. The full release includes the already
corrected `.github/workflows/audio-validator.yml` (without FFmpeg), to avoid
regressing a separate GitHub Actions fix.

## Problem and fix

Previously `playAt()` awaited `/api/audio` before starting the Web Audio API.
On iOS, starting an `AudioContext` after asynchronous work may lose the direct
user gesture and remain `suspended` or `interrupted`, leading to a silent player.

Now a Play tap synchronously:

1. Selects `navigator.audioSession.type = 'playback'` where supported.
2. Creates the Web Audio graph and invokes `AudioContext.resume()` *before* the
   SSEQ fetch and its first `await`.
3. Starts an inaudible one-sample buffer in that same gesture as a Safari
   unlock fallback; **no alternative song audio is stored or played**.
4. Waits for the stored SSEQ and schedules only its decoded note events.
5. Shows a specific error if audio remains blocked instead of hanging forever.

After a browser interruption, the player tries to resume on return; if it
cannot, it pauses and explicitly asks for a new Play tap. The next gesture can
recreate an unrecoverable audio context. These changes preserve cancellation
and source-changing behavior, so a late fetch never autoplays after Pause.

## Installation (recommended; protects newer GitHub changes)

Copy **only `app.js` and `sseq_player.js`** into the root of your current
`rubenhjo/S-themes` repository and commit/push them. Vercel then deploys.
The small `sigma-themes-ios-audio-patch.zip` contains those two files.

Do *not* overwrite your working validator workflow with an older copy. For a
completely fresh replacement you can use the full ZIP, which already preserves
its FFmpeg-free workflow.

After deployment, open **https://sthemes.vercel.app** in Safari (not Snapchat's
in-app browser), reload, and test Play with an unmuted track. The site may be
silent if its own volume is 0, if iPhone output is routed to another device,
or if the operating system is blocking audio for the embedded web view.

## Tests executed

- `npm run verify` – Node lint and unit tests.
- `node --test tests/ios-audio.test.js` – simulated iPhone gesture unlock,
  interruption recovery, and UI call order.
- `python tests/browser_sseq_player.py` – actual Chromium Web Audio play,
  pause/cancel, and gain/mute behavior.

**Limitation:** These tests cannot run physical iPhone Safari or reproduce every
hardware/silent-mode and third-party WKWebView audio policy. The production
site and an iPhone device still require a real listening test after deploy.
