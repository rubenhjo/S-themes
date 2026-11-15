# sigma-themes v1.4.4 — GitHub/Vercel verification

## What this fixes

- A secure-origin Playwright test server replied with HTML at the transcription-worker script URL, so a normal `new Worker()` request failed. The test now serves actual JavaScript and tests the Worker separately with synthetic WAV and MP3.
- The frontend previously kept showing `Connecting` after a failed catalog request even when `/api/config` was ready. It now shows `Catalog unavailable` with a hint to inspect Supabase/Vercel logs, and recovers automatically when the catalog responds.
- `static-and-audio` ran most checks inside one combined step. Its checks now have individually named steps and a preflight check that detects missing source files or a `package.json`/`package-lock.json` version mismatch.

## Updating GitHub in the browser

1. Unzip `sigma-themes-v1.4.4-hotfix.zip` locally. Keep every nested folder path.
2. Commit the changed files to the root of `rubenhjo/S-themes` on its production branch. Upload source files, NOT the archive as a file in the repository. To update `.github/workflows/ci.yml`, you may need to open that existing file in GitHub and use its editor, since some browser upload methods skip hidden folders.
3. Confirm the GitHub file `package.json` has version `1.4.4-sseq-preview`, and `.github/workflows/ci.yml` contains `Validate release file layout` and `browser_transcription_worker.py`.
4. Open Actions -> sigma-themes QA and inspect each step. A red job is NOT fixed until a new GitHub run is green; if it fails, provide the first failing step and full error text (not just a screenshot of the job list).
5. Vercel deployment is independent of Actions. `Ready` means the deployment finished, not that Supabase is configured or that uploads work.

## Live connection diagnosis (credentials must NEVER go to GitHub)

- Open `https://sthemes.vercel.app/api/config`. `ready:false` means production environment variables are missing or incomplete. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAME` and `UPLOAD_HMAC_SECRET` in Vercel's Project Settings -> Environment Variables. Use `.env.example` as the reference. Keep secret values out of chat and public files.
- If `ready:true` but the page says `Catalog unavailable`, open Vercel Functions logs for `/api/catalog` and inspect the Supabase schema/migrations and permissions. Do NOT run migrations against live data without a backup and staging test.
- If the catalog works but uploads never publish, separately configure GitHub Actions repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the scheduled validator workflow and check its logs. Do not expose the service-role key to frontend JavaScript.
- Carry out a live, original short WAV/MP3 -> SSEQ upload and verify the saved bytes begin `SSEQ`, can be played, and export to Sigma Dex with SHA-256 matching. The local tests are not substitutes for this step.

## Known limitations

Do not call this production-ready yet. Transcription of dense multi-instrument mixes is approximate; the Web Audio preview uses generic oscillators; real HeartGold bank playback, full live Supabase, secure-origin CI rerun, and downstream Sigma Dex importer remain unverified.
