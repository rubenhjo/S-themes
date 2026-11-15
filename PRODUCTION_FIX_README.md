# sigma-themes: complete upload pipeline repair

## WHY there were multiple failures

The repository and live Supabase schema were deployed separately. The live
`service_role` was missing DELETE on `theme_uploads` and SELECT on
`theme_storage_settings`; reads required for finalization and recovery were
not all available. The current reservation function DOES accept SSEQ. These
are SQL grants, not RLS policies.
The client also blindly re-used the same no-upsert signed storage URL after the
file had already reached Storage and `/api/upload-finish` had failed.

## Production repair status (2026-11-15)

The production privilege migration below has already been applied and checked
14/14; it does not need repeating. A separate security-hardening migration has
also been applied. See `RECOVERY_STATUS_2026-11-15.md` for exact status and the
remaining GitHub/Vercel deployment steps.

## One-time controlled production recovery (for a NEW environment only)

1. **Backup** live Supabase and ideally test on staging first.
2. Confirm prior migrations were run in this order:
   `20261114_public_release.sql`, `20261114_qc7_validation_quota.sql`,
   `20261115_validation_claim_lease.sql`, `20261115_sseq_only.sql`.
   **DO NOT replay the older migrations in production** if already applied.
3. In Supabase SQL Editor run **only**
   `supabase/migrations/20261115_upload_pipeline_permissions.sql`
   against the existing updated database. It is idempotent.
4. Run `supabase/VERIFY_PRODUCTION.sql` (read-only). All checks must be true.
5. Commit all project files to GitHub so Vercel publishes the recovery code.
6. For validation/publishing, confirm GitHub Actions `audio-validator.yml` is
   enabled and GitHub Actions Secrets `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` are present. Do not paste secret values into chat.
7. In an incognito browser upload ONE SHORT, ORIGINAL `.sseq`, confirm the browser
   reports queued, then wait for the trusted worker to mark published. Verify
   `/api/catalog`, actual playback, and Sigma Dex export.

## Upload behavior and safety

- If a previous attempt reached Storage but did not finish, a re-selected file
  with the same SSEQ SHA-256 and saved receipt first asks the server to validate
  the existing object; it no longer does an unnecessary second PUT.
- If a PUT acknowledgement is lost or Storage reports an existing object, the
  server validates *actual bytes + SHA-256 + HeartGold bank slot* before reuse.
- Only a definitive HTTP 404 means the file is absent. A 403/500 is an error,
  never permission to overwrite something with a fresh PUT.
- Storage overwrites (`x-upsert: true`) are NOT used. Abandoning a pending
  reservation without its receipt cannot grant an anonymous user control over
  another person's upload. Pending rows expire and are cleaned by the worker.

## Known limits / not demonstrated

The SQLite/browser simulations are NOT a live production Supabase test. Actual
Storage integration, GitHub Actions scheduling, Cloudflare, and ROM compatibility
must still be checked with the deployed system. This patch does not substitute
for complete recovery of lost session receipts or human moderation.
