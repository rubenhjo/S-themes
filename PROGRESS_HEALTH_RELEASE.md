# sigma-themes — progress and health update (2026-11-15)

This release is built **directly from the uploaded S-themes-main.zip**, not from a reconstructed older archive. The uploaded package.json identifies itself as `1.4.4-sseq-preview`, although the user reported a Vercel deployment labelled v1.4.5. The GitHub/Vercel labels and package.json were not silently reconciled.

## Changes

- `sigma_upload_monitor.js` (new): animated indeterminate decoder/processing indicator, 5 stages, elapsed time, measured progress for FFT note analysis and network bytes, warnings for long inactivity, browser responsiveness checks, copyable privacy-conscious diagnostics. **Stall warnings are not crash detection proof.**
- `app.js`: emits small upload-progress, upload-source and finish events for the monitor. Existing API/database operations and cancellation remain intact. Progress metrics are measured fractions, not invented percentages.
- `sseq_transcribe.js`: audio decode `Promise` now races cancellation and a 90-second timeout (180 seconds for input above 12 MiB); reading file bytes has a 30-second timeout. Resampling yields to the browser every 8192 output samples and checks cancellation, so long loops do not indefinitely block click handlers. The browser's native decoder cannot always be terminated, though upload cancellation prevents subsequent upload work.
- `index.html`: loads the new monitor from the existing root; there is no external dependency.
- `tests/browser_progress_health.py`: Chromium regression for real UI, stage percentages, diagnostics, cancel feedback and a hung decode rejection. CI includes the regression.

## Verification

- `npm run verify`: 88/88 Node tests and known-issue ledger passed on the uploaded archive after these changes.
- `python tests/browser_progress_health.py`: passed in Chromium.
- Tests with simulated browser/server APIs do **not** establish live production readiness or musical accuracy for dense recordings.

## Installation

Unzip all repository files, keeping subfolders including `.github/`, `api/`, `tests/`, `lib/` and `supabase/`. Commit the modified files to your GitHub repository; a Vercel-linked production branch should redeploy automatically. Keep Vercel and Supabase secrets in environment settings, not in git.

If the browser's main thread is completely frozen at the operating system/native decoder level, JavaScript timers and click handlers cannot run until it becomes responsive. The panel cannot truthfully show live progress during that freeze.
