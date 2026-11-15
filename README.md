# sigma-themes v1.2.1 — QC7 independent recheck

## Sigma Dex music export (v1.3.0)

The application now has **Music folders** in the sidebar, a song-level folder/metadata/loop editor under `•••`, and a **Export to Sigma Dex** button. Choose all songs, one or more folders with descendants, or individual songs. A single ZIP contains ready-converted 32,728 Hz stereo IMA-ADPCM WAVs, complete folder metadata, versioned `manifest.json`, file hashes and a verification inventory. **The future Sigma Dex importer is a separate project.** See [SIGMA_DEX_EXPORT_SPEC.md](SIGMA_DEX_EXPORT_SPEC.md).

**Folders are currently personal to this browser**, just like playlists and favorites, while audio files remain centralized in Supabase. This avoids unrestricted anonymous folder mutation in the shared database. Export selections and settings persist in local browser storage and personal ZIP backups; changes do not synchronize between devices. If shared editable folders are desired later, add a moderated server-side model and migration instead of anonymous RLS writes.

Run `npm run test:example` to generate and independently validate the synthetic example pack. The pack is included as `examples/sigma-dex-example-music.zip` and can be used as a future import contract test.

**Background artwork:** 24 placements of 17 original Sigma-dex sprites are served from official GitHub raw assets, with fallback to GitHub Pages. Unlike the offline HTML demo, this is the multi-file Vercel version. Sprites need access to the upstream server; they are decorative, respect reduced-motion preferences, and cannot intercept UI controls. Local Playwright layout tests use synthetic image fixtures to avoid relying on the external network.


An account-free, public music library for original Sigma compositions, with shared catalog on Supabase, Vercel hosting, locally stored personal playlists/favorites, Spotify-inspired listening controls and a Nintendo DS **audio-asset** exporter.

**Release qualification:** Locally tested. **NOT production-verified.** Do not launch public uploads until the Supabase migrations, GitHub validator workflow, Turnstile, and live upload tests are complete. The existing DS export is **not** an installable Origin HeartGold patch.

## Architecture

```text
Browser (public, NO LOGIN)
  ├─ GET /api/catalog → paginated, public metadata (Supabase)
  ├─ GET /api/audio   → short-lived signed URL to private Storage
  ├─ POST /api/upload-start  → Turnstile + IP limits + atomic byte reservation
  ├─ PUT / TUS to signed Storage URL → pending and still invisible
  ├─ POST /api/upload-finish → byte/hash/header check, queue for trusted validation
  ├─ POST /api/upload-status → scoped receipt, no public listing of pending files
  └─ POST /api/upload-cancel → scoped cancellation, server/storage cleanup

GitHub Actions (trusted, secrets) / manual workflow_dispatch
  └─ scripts/validate-pending.mjs: claim → download → FFprobe → full FFmpeg decode
      → publish atomically only on success; reject and delete invalid media

Supabase PostgreSQL + PRIVATE Storage bucket
  ├─ theme_tracks  (public SELECT only; published files)
  ├─ theme_uploads (service-role only; reservations and validation status)
  └─ theme_storage_settings (byte budget; service-role only)
```

**Important practical limitation:** GitHub scheduled Actions are not a low-latency job queue. They may run late or be skipped. Uploads remain **unpublished** until a trusted validation job actually runs; the UI shows this as pending. ST-040 remains OPEN. Production that requires predictable seconds-long publishing should use a tested always-on worker or Vercel Fluid Compute media processing instead. Never bypass validation to make uploads seem faster.

## 1. Prepare GitHub

1. Create an empty repository (private or public), unzip `sigma-themes-vercel.zip` and place its **contents** in the repository root.
2. Commit **source only**; `.gitignore` excludes `.env`, audio uploads, `node_modules`, raw test binaries and test screenshots.
3. GitHub Actions is configured in `.github/workflows/ci.yml` for tests and `.github/workflows/audio-validator.yml` for processing public submissions. Allow Actions in the repository settings.
4. Add these GitHub **Actions Secrets** (Settings → Secrets and variables → Actions):

| Secret | Source |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase private service-role key |

These values are used by the trusted validator only. **Never** place service-role, Turnstile secret, or upload HMAC secret in frontend code or a public `.env` file. The scheduled validator runs every five minutes on a best-effort basis and can be started via **Actions → Validate submitted audio → Run workflow**.

## 2. Supabase

1. Create a Supabase project. Free tier: **1 GB included Storage** and **50 MB max file upload**. The app uses an enforced **45 MiB** per-file limit, but administrators must also account for other buckets/projects and usage quotas.
2. In SQL Editor apply migrations **in order**:
   - `supabase/migrations/20261114_public_release.sql`
   - `supabase/migrations/20261114_qc7_validation_quota.sql`
3. Confirm bucket `sigma-theme-audio` is **private** with `47,185,920` bytes maximum and allowed audio MIME types.
4. Confirm `theme_tracks` permits only anon/authenticated `SELECT`; no unauthenticated INSERT/UPDATE/DELETE on tables or Storage objects. New RPCs should be executable by `service_role` only.
5. The default in-app quota is **850,000,000 bytes**, configured in the DB table `public.theme_storage_settings`. It is **not** a claim about the live project’s available bytes. If other buckets use storage, lower the budget:

```sql
update public.theme_storage_settings set quota_bytes=650000000, updated_at=now() where id=true;
```

Quota accounts for published bytes, nonpublished upload reservations and untracked objects in the Sigma bucket under an atomic global DB lock. Quota and RLS SQL require actual concurrent staging tests before production approval.

### QC7 recheck migration (v1.2.1)

After `20261114_public_release.sql` and `20261114_qc7_validation_quota.sql`, apply **`supabase/migrations/20261115_validation_claim_lease.sql`**. It rotates each trusted validation worker's lease token and removes the old, unfenced publish/reject RPCs. **Deploy the SQL migration and worker code together**, preferably with validation jobs paused during the change. A missing migration deliberately prevents worker publication. Do not describe this as production-verified until a live parallel-worker staging test passes.

The trusted worker also now enforces the byte limit on the actual download stream, regardless of Content-Length. Admin batch import will preserve ambiguous/queued objects and print their upload IDs so they can be reconciled instead of deleting possibly committed audio.

## 3. Vercel

Import the GitHub repo at **Vercel → Add New Project → Import Git Repository**. Framework `Other`, root project directory `/`, no build command, no output directory override. Static HTML/JS and `api/*.js` serverless handlers are deployed from the repository.

Set **Environment Variables** in Vercel (for production AND preview as appropriate):

| Variable | Visibility |
|---|---|
| `SUPABASE_URL` | Server, public hostname only |
| `SUPABASE_ANON_KEY` | Public Supabase anon key; may be passed to browser for Realtime |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server secret** |
| `TURNSTILE_SITE_KEY` | Public key |
| `TURNSTILE_SECRET_KEY` | **Server secret** |
| `TURNSTILE_HOSTNAME` | Exact production/preview domain without scheme |
| `UPLOAD_HMAC_SECRET` | **Server secret**, ≥32 random bytes, e.g. `openssl rand -hex 32` |
| `CRON_SECRET` | **Server secret**, independent random token |

Configure Cloudflare Turnstile for this hostname. Bot validation is mandatory for ordinary public uploads, but **no sign-in is required** for listening or uploading. Re-deploy after changing variables. `/api/config` should show `ready:true`; `/api/catalog` should show `{tracks:[],complete:true}` for a new project. The worker's health is not represented by `ready`; monitor its Actions runs separately.

### Normal upload lifecycle

- Browser computes a SHA-256, obtains Turnstile token and one scoped reservation, uploads by signed PUT or TUS (>6 MiB) and queues final validation.
- `/api/upload-finish` returns HTTP **202** (pending), not HTTP 201. The browser polls `/api/upload-status` using its opaque receipt. A background validator **must** decode the file successfully before it is visible in the catalog.
- Wrong MIME, fake MP3 header, malformed container, bad codec, invalid samplerate/channels/duration, checksum failure or failed FFmpeg full decode must result in rejection.
- If worker/secrets are unavailable, uploads remain pending and are **not published**. The user is told explicitly; a queued upload is never represented as complete.
- Failed reservations are eventually deleted. A worker cleans stale/expired objects; a protected Vercel cron provides another cleanup path. Reservations can occupy quota until cleanup succeeds.
- File limit = 45 MiB, regardless of TUS chunking. Public rate limits remain 4/hour, 16/day per IP, 80/day global.

### Owner batch import

Keep the private Supabase key **on your computer only**, never in a public page. FFmpeg and FFprobe must be installed locally. In a terminal run:

```bash
export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
node scripts/admin-import.mjs ./my-original-songs --dry-run
node scripts/admin-import.mjs ./my-original-songs --csv=metadata.csv --retry=3
```

The CLI validates audio locally, uses a **privileged but quota-limited** database reservation, uploads to private Storage and queues final trusted validation. Files become publicly listed only after the separate worker confirms full decode. Use the README in your terminal platform to adapt environment-variable syntax for Windows PowerShell. No user accounts are introduced.

## 4. Test commands

Requires Node ≥20, Python 3 and Chromium/Playwright for browser tests; FFmpeg + FFprobe for audio tests.

```bash
npm ci
npm run verify            # JS syntax + Node tests + issues ledger/QC counts
npm run test:ffmpeg       # DS IMA-ADPCM file + loop marker validation
python -m pip install playwright pillow
python -m playwright install chromium
npm run test:browser      # 7 isolated Chromium scripts; mocked API, not Supabase
# only with a live staging deployment configured:
SIGMA_STAGING_URL=https://STAGING.vercel.app npm run test:staging
```

The browser suites use stubbed transport but **real Chromium behavior**. Unit tests validate the FFmpeg media parser with synthesized MP3/WAV and invalid files. They do not prove SQL transaction isolation, real rate limiting, Turnstile, signed Storage, Realtime or the GitHub worker in production. Run real staging upload tests with two clients and inspect the DB before approving public launch.

## 5. Nintendo DS / Origin HeartGold

The exporter creates 32,728 Hz stereo RIFF WAVE IMA-ADPCM (`0x0011`), optional WAV `smpl` loop metadata, deterministic file naming, unique suggested sequence IDs, per-ZIP manifests and SHA-256 digests. ZIP files are split when large.

**This is not a complete HeartGold integration**. Ordinary HGSS stores sequences in `data/sound/gs_sound_data.sdat` (`SSEQ/SBNK/SWAR`); a WAV cannot replace an SSEQ without a ROM-side streaming hook. Public NitroWAV Player supports other DS games, but not a verifiably integrated build for this project's private Origin HeartGold fork. ST-010 remains BLOCKED pending access to exact game source/build and melonDS test. See `HEARTGOLD_INTEGRATION.md`.

## 6. Known limits and debugging

- **No account**: favorites, playlists, queue and preferences are private to the device's localStorage. Back up your playlists before clearing site data.
- Public catalog uses cursor pagination (500 rows per response, stable created_at/id order, hard failure rather than silent truncation).
- Supabase Free quota includes project resources beyond this app; set conservative DB quota. Other Storage buckets are not automatically included; ST-041 OPEN.
- Large browser ZIP exports and mobile memory usage require load testing; ST-008, ST-014 remain OPEN.
- Audio links are signed for 900 seconds; interrupted seek/expired-link behavior requires staging; ST-031 OPEN.
- Malicious audio processing occurs on a trusted isolated job runner, not in the public browser. Update FFmpeg on runner through regular CI maintenance.
- **No ROMs or commercial copyrighted recordings are distributed.** Upload only music you have permission to share.

## Primary documentation

- https://supabase.com/docs/guides/storage/uploads/file-limits
- https://supabase.com/pricing
- https://vercel.com/docs/functions/limitations
- https://github.com/vercel-labs/ffmpeg-on-vercel
- https://github.com/BluRosie/hg-engine
- https://github.com/arvindfroi/sigma-dex
- https://ds-pokemon-hacking.github.io/docs/universal/guides/music_insertion/
- https://github.com/TheGameratorT/NitroWAV-Player
