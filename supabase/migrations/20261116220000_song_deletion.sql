-- sigma-themes v1.7.1: account-free, authorized track deletion.
-- Apply to a verified copy of the deployed November 16 schema, after backups. Do NOT replay archived legacy migrations. Never execute Storage deletes in SQL.
-- A tombstone hides the song immediately; the Storage API removes the file; cron retries failures.
BEGIN;
ALTER TABLE public.theme_tracks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.theme_tracks ADD COLUMN IF NOT EXISTS storage_deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS theme_tracks_deletion_queue ON public.theme_tracks(deleted_at,storage_deleted_at)
 WHERE deleted_at IS NOT NULL AND storage_deleted_at IS NULL;

-- The anon key is used by Realtime, so RLS itself must hide deleted tracks.
DROP POLICY IF EXISTS "public read-only track catalog" ON public.theme_tracks;
CREATE POLICY "public read-only track catalog" ON public.theme_tracks
 FOR SELECT TO anon,authenticated
 USING (deleted_at IS NULL AND mime_type='application/octet-stream'
   AND sseq_id IS NOT NULL AND size_bytes BETWEEN 30 AND 65536);
REVOKE INSERT,UPDATE,DELETE ON public.theme_tracks FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.theme_uploads FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.theme_tracks TO service_role;
GRANT SELECT ON public.theme_uploads TO service_role;

-- Only server's service_role may call these RPCs. In particular, no bearer secret
-- received by the browser is ever allowed to perform a direct PostgREST UPDATE.
CREATE OR REPLACE FUNCTION public.request_theme_song_delete(
 p_id uuid,p_secret_hash text,p_admin boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t public.theme_tracks%rowtype;
BEGIN
 SELECT * INTO t FROM public.theme_tracks WHERE id=p_id FOR UPDATE;
 IF t.id IS NULL THEN RETURN NULL; END IF;
 IF NOT p_admin AND NOT EXISTS (
   SELECT 1 FROM public.theme_uploads u
   WHERE u.id=t.id AND u.status='published' AND u.secret_hash=p_secret_hash
 ) THEN RETURN NULL; END IF;
 IF t.deleted_at IS NULL THEN
   UPDATE public.theme_tracks SET deleted_at=now() WHERE id=t.id RETURNING * INTO t;
 END IF;
 RETURN pg_catalog.jsonb_build_object('id',t.id,'storage_path',t.storage_path,
   'storage_deleted',t.storage_deleted_at IS NOT NULL);
END $$;
CREATE OR REPLACE FUNCTION public.mark_theme_song_storage_deleted(p_id uuid,p_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.theme_tracks SET storage_deleted_at=coalesce(storage_deleted_at,now())
 WHERE id=p_id AND storage_path=p_path AND deleted_at IS NOT NULL;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.request_theme_song_delete(uuid,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mark_theme_song_storage_deleted(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_theme_song_delete(uuid,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_theme_song_storage_deleted(uuid,text) TO service_role;

-- Continue conservatively charging storage until the Storage API confirms removal.
CREATE OR REPLACE FUNCTION public.theme_accounted_bytes()
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT sum(size_bytes) FROM public.theme_tracks
     WHERE deleted_at IS NULL OR storage_deleted_at IS NULL),0)::bigint
 + coalesce((SELECT sum(size_bytes) FROM public.theme_uploads WHERE status<>'published'),0)::bigint
 + coalesce((SELECT sum(CASE
    WHEN (o.metadata->>'size') ~ '^[0-9]{1,15}$'
      THEN greatest((o.metadata->>'size')::bigint,0)
    ELSE 47185920 END) FROM storage.objects o
    WHERE o.bucket_id='sigma-theme-audio'
      AND NOT EXISTS (SELECT 1 FROM public.theme_uploads u WHERE u.storage_path=o.name)
      AND NOT EXISTS (SELECT 1 FROM public.theme_tracks t WHERE t.storage_path=o.name)),0)::bigint
$$;
REVOKE ALL ON FUNCTION public.theme_accounted_bytes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.theme_accounted_bytes() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
