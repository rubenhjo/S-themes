# Delete songs from sigma-themes — v1.7.1

## What the user sees

1. Open a song's **•••** menu, select **Delete song from shared library**.
2. Choose the authorisation method: **This browser** (if the receipt was saved here), **upload receipt** (a copied private receipt), or **site administrator**.
3. Type `DELETE` and confirm. The browser does **not** issue a deletion until confirmation and a high-entropy credential have been provided.
4. A successfully authorised song immediately disappears from the public catalog; the SSEQ object is deleted from the private Storage bucket. If Storage is temporarily unavailable, the object is queued for retry in the existing protected cron (`/api/cleanup`).

**Deleting from a personal playlist remains separate.** Deleting a shared song also removes its entries in local favorites, queues and playlists on the browser that issued the deletion. Other visitors may temporarily see an unavailable local reference if they have a personal playlist containing the removed song; their personal playlists are not accessed by the server. A different track with identical SSEQ bytes is never deleted by hash matching.

## Security model

- Public visitors cannot delete music with just a song ID or publicly visible SHA-256.
- For a newly uploaded track, the 32-byte random upload receipt is saved as a scoped **deletion capability** in the upload browser's `localStorage`; it is **not included** in public catalog responses or personal playlist backups. The server stores only a keyed HMAC for verification.
- Existing songs uploaded before v1.7.1 can be deleted using the separate site administrator key; users whose browser did not retain a receipt cannot prove ownership through the song ID alone.
- The optional `SONG_DELETE_ADMIN_TOKEN` must be a random 64-character hexadecimal value configured **only in Vercel environment variables**, not in GitHub, JSON, or frontend code. Generate with `openssl rand -hex 32`. The frontend does not store the administrator key.
- SQL RPCs are invoker-rights and are granted only to the server-side `service_role`. The anon and authenticated roles retain a read-only catalog, with deleted entries filtered in the **RLS policy** as well as `/api/catalog` and `/api/audio`.
- Once a deletion is requested, the tombstone is committed in PostgreSQL **before** the Storage DELETE. `deleted_at` is an irreversible public-hide marker; `storage_deleted_at` is written **only after** the Storage API reports success or confirmed not-found. This makes retries idempotent and ensures that accounted Storage space is not released prematurely.
- The tombstone stays in the database for audit and idempotency. This feature **does not** remove a stored song through a SQL-only deletion of `storage.objects`, which would leave an orphaned physical object.

## Deployment checklist (required)

1. Backup the database and your current GitHub project before deploying.
2. Apply **all existing migrations through `20261116_inline_sseq_publication.sql`** in order, then apply `supabase/migrations/20261116_song_deletion.sql` to your Supabase database (SQL Editor or migration mechanism).
3. Generate a new 32-byte random admin token via `openssl rand -hex 32`. Add it in Vercel under **SONG_DELETE_ADMIN_TOKEN**, for production only. Do **not** copy it into `.env.example` literally.
4. Keep the preexisting `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `UPLOAD_HMAC_SECRET`, and `CRON_SECRET` configured correctly. Never expose any of them in `api/config.js` or any client bundle.
5. Deploy the code from this ZIP to GitHub, and let Vercel redeploy.
6. Verify `/api/catalog` no longer includes deleted rows, `/api/audio?id=<deleted-uuid>` returns HTTP 404, and a second unrelated track with the same SHA-256 remains accessible.
7. Upload a fresh **test** SSEQ, delete it from the same browser, confirm it disappears globally, and confirm the physical Storage object is gone. Repeat in staging with the admin key on a separate test track and without a receipt.
8. Make sure the existing Vercel Cron `/api/cleanup` remains enabled to retry delayed Storage cleanup. Note that the supplied schedule is daily; retries are not instant if the initial deletion fails.

### API

`POST /api/song-delete`

Payload: `{ "trackId": "<track-uuid>", "receipt": "<64-hex>" }` **or** `{ "trackId": "<track-uuid>", "adminToken": "<64-hex>" }`.

- 200 `{deleted:true,cleanupPending:false}`: tombstone committed; file removed or already absent.
- 202 `{deleted:true,cleanupPending:true}`: tombstone committed; file cleanup will retry automatically.
- 403: invalid receipt, admin key, or ownership.
- 405: wrong HTTP method.
- 5xx: database or service unavailable. Do not assume a failed response means that a deletion was rolled back; reload the catalog to reconcile.

## Test boundaries

The repo contains `tests/song-deletion.test.js` (mocked API routes and static migration controls) and `tests/browser_song_deletion.py` (Chromium with mocked catalog/delete API, 390px viewport). These tests do not prove that the SQL migration was applied to a real Supabase project or that Vercel's production credentials work. Validate those in an authorised staging deployment before using the delete operation on real songs.
