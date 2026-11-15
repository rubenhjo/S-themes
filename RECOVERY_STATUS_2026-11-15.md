# S-themes upload and ZIP pipeline: verified recovery status

**Date:** 2026-11-15 (Europe/Oslo)

## Already applied to real S-themes Supabase production

Project: `hilonvsfjobmejfxhslr`.

1. Applied `repair_upload_pipeline_privileges_20261115` (20261115203053): necessary server-only GRANTs for upload/track reading, upload cleanup, quota reading and server-side RPCs. Explicit anonymous/authenticated restrictions remain in place.
2. Applied `lock_down_internal_rls_event_trigger_20261115` (20261115203326): removed public/anon/authenticated EXECUTE on `public.rls_auto_enable()`.
3. Re-ran `supabase/VERIFY_PRODUCTION.sql` as a read-only query: **14/14 checks true**.
4. Verified `anon`/`authenticated` cannot invoke `public.rls_auto_enable`, service role can read quota and delete failed uploads.
5. Post-change Supabase security advisor: **no WARNING-level findings**. Two INFO `rls_enabled_no_policy` findings remain: private `theme_uploads` and `theme_storage_settings` intentionally have RLS enabled and no public access policy.

**Do not re-run earlier migrations against production as a troubleshooting experiment.** The privilege and event-trigger migration scripts are retained in the repository as an auditable record; no more SQL editing is required for the above repair.

## Actual historical failure evidenced by Storage logs

2026-11-15 20:17:17 Oslo time: signed PUT of 972-byte `.sseq` succeeded, HTTP 200.

2026-11-15 20:23:29 Oslo time: browser repeated signed PUT to the same object path, received HTTP 400 / `KeyAlreadyExists`. This is *not* evidence of an upload permission denial on the first PUT: it had already succeeded.

As checked, the 972-byte file was present in private `sigma-theme-audio` and the matching upload record was still `pending`, with no published tracks. We did not force-publish or delete that file, alter its receipt or bypass checks. The failure of finalization is NOT yet proven to have a unique cause from these Storage logs alone; the original HTTP 403 was not observed directly in these logs. A Vercel API error, receipt validation, or hostname configuration needs investigation on deployment if the updated client still fails.

## Code repair / local verification

The archive includes the previous recovery patch: `app.js` avoids repeat PUT to already-uploaded objects by asking `/api/upload-finish` to validate their actual bytes and checksum first. `api/upload-finish.js` distinguishes definitive missing objects (404) from permissions/temporary errors (403/5xx). The client never uses `x-upsert:true` to bypass the problem.

Checked locally with Node: `npm run verify`: **92/92 tests passed**, including 4 dedicated upload-reliability tests. `npm run test:ffmpeg` passed. `npm run test:independent:sseq` passed. The demonstration Sigma Dex SSEQ-only ZIP passed `npm run validate:pack -- examples/sigma-dex-example-music.zip`.

These are source-code/local tests, **not** production browser/Cloudflare/Vercel tests. The game's actual importer and real HeartGold DS/ROM playback were not validated.

## Next required actions (code not yet deployed)

1. Publish **the extracted contents** of this repository ZIP to `rubenhjo/S-themes` as normal repository files. Do **not** upload the ZIP as one file and expect Vercel to extract it. Keep `.github/workflows`, `api`, `lib`, `supabase`, tests, and other subdirectories intact. This run did not have a connected GitHub write action, so no commit/push/deploy was performed.
2. Confirm which Vercel production hostname should be canonical. Historical Supabase Storage requests have `https://sthemes.vercel.app/` as referrer, but the user also shared `https://s-themes.vercel.app/`; **these are distinct hostnames**. `TURNSTILE_HOSTNAME` in Vercel must equal the exact hostname returned by the actual Turnstile verification for the production site. Configure the matching domain in the Cloudflare Turnstile widget. Do not place secrets in GitHub.
3. Ensure GitHub Actions trusted `audio-validator.yml` is enabled and its repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist; this worker is what moves validated queued uploads to published tracks.
4. After deployment, reload the chosen domain and run one original, small `.sseq` upload. For the older pending record, a re-selection from the same browser session MAY be able to finalize if the original receipt remains in session storage and is not expired. If the receipt is gone, do not reuse or overwrite the old object; let server expiration/cleanup handle it and start a new upload after expiry.
5. Check `/api/config`, `/api/catalog`, `/api/upload-start`, `/api/upload-finish` and `/api/upload-status` response statuses in the browser Network tab, then verify catalog playback and Sigma Dex ZIP export. If HTTP 403 persists, capture the **exact failed endpoint and safe response message**; storage logs alone cannot classify Vercel/Turnstile failures.

## Limitations

No direct production browser request was possible from this runtime (external site could not be reached), and no GitHub deployment write connection was available. The production user journey remains unverified until the new code is deployed and a fresh real upload is observed. The SSEQ converter's ability to transcribe dense or mixed MP3/WAV recordings faithfully is not established by these fixes.

## Subsequent Cloudflare Turnstile browser error repair

A screenshot at 2026-11-15 20:51 UTC showed `shallow.sseq: Bot-verifisering mislyktes. Prøv igjen.` This string is generated by `client_core.js` **before** `/api/upload-start`. The latest Supabase read showed no `shallow.sseq` reservation. It is not a server-side song validator failure. A subsequent source patch preserves error codes, checks expected hostnames and avoids useless retries for permanent configuration errors. **95/95 local Node tests passed** on this patch. Actual Cloudflare dashboard hostname/sitekey configuration remains to be verified by the site owner; see `TURNSTILE_FIX_2026-11-15.md`. No new Supabase migration is required for this browser failure.
