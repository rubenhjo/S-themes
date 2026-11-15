# sigma-themes v1.4.2 — upload using only your browser (no GitHub Desktop)

The archive is **source code**. GitHub will not unzip a ZIP uploaded as a repository file, and **Vercel will not deploy an uploaded ZIP as source code**. You must unzip it on your computer and commit the extracted files.

1. Download `sigma-themes-vercel-v1.4.2.zip` and extract it. Keep the original folder structure including `.github`, `api`, `lib`, `scripts`, `supabase`, `tests`, and hidden `.gitignore` / `.env.example`.
2. Open `https://github.com/rubenhjo/S-themes` in a browser, ideally in a **new branch** while testing. Choose **Add file → Upload files**.
3. **GitHub's browser uploader accepts a maximum of 100 files at one time.** With this project, do two separate commits. For example upload all root files plus `api`, `lib`, `scripts`, `supabase`, and `.github` (including their subfolders) in the first pass; then `tests`, `docs` and `examples` in the second pass. Always drag the directories together with their paths; do not flatten `api/upload-start.js` into the repo root. If the browser does not accept hidden folders, create `.github/workflows` through GitHub's normal web file editor or use Git with terminal—never omit the trusted validator workflow from a public launch.
4. Check GitHub shows `sseq_codec.js`, `sseq_transcribe.js`, `sseq_player.js`, `heartgold_bank_profiles.json` and `supabase/migrations/20261115_sseq_only.sql` in the expected paths. Confirm `package.json` version is `1.4.2-sseq-preview` and GitHub Actions `sigma-themes QA` is green. Old GitHub v1.3 files are superseded by same-name files; **the upload UI does not automatically delete unneeded old files**.
5. Vercel must point to that repository/branch with project root `/` and Framework Other. It deploys automatically on each successful GitHub commit if already connected. Before accepting public uploads, follow `README.md` staging steps in order: apply Supabase SQL migrations, configure Vercel and GitHub Action secrets, set Cloudflare Turnstile domain/key and run a live SSEQ-only upload and anonymous second-browser playback check.
6. Do NOT upload `HeartGold_instrumentfiler_US.zip`, SBNK, SWAR, ROMs or private Supabase keys. The public generated **metadata-only** bank profile is already present.

## What is and isn't complete

Synthetic WAV/MP3→SSEQ conversion, on-site SSEQ note-synthesis playback, slot/pitch-program structural checks, SHA-256, private backend API rules, one Sigma Dex SSEQ-only ZIP, and regression tests are present. **High-fidelity conversion of complete produced songs, real game playback, production database operation and the receiving Sigma Dex importer are not validated.** Do not claim those are already working.

Sources: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository ; https://github.com/rubenhjo/S-themes
