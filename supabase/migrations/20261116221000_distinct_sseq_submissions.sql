-- Distinct user submissions must have distinct IDs even when SSEQ content is identical.
-- Run AFTER 20261116220000_song_deletion.sql against an isolated copy of the deployed schema, after backup.
-- This migration NEVER deletes tracks or upload rows. Do not run on production
-- until the staging duplicate/retry/deletion matrix has passed.
BEGIN;
-- The currently deployed SHA+slot UNIQUE index blocks independent titles.
-- A non-unique B-tree preserves lookup performance and hash-based diagnostics.
DROP INDEX IF EXISTS public.theme_tracks_sha_slot;
CREATE INDEX IF NOT EXISTS theme_tracks_hash_slot_lookup
 ON public.theme_tracks(sha256,sseq_id);
-- The old legacy uniqueness only applies to rows with NULL destination slot.
-- Keep it for truly legacy content; target-slot submissions are not affected.

-- Preserve the deployed signature, account-wide quota, storage, rate limits,
-- per-ID identity and 1500-item library cap; ONLY remove the two hash gates.
CREATE OR REPLACE FUNCTION public.reserve_theme_upload_for_slot(
 p_id uuid, p_secret_hash text, p_sha256 text, p_ip_hash text,
 p_name text, p_size bigint, p_path text, p_extension text, p_slot integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_limit bigint; v_used bigint; v_hour integer; v_day integer; v_global integer;
BEGIN
 IF p_id IS NULL OR p_size IS NULL OR p_size NOT BETWEEN 30 AND 65536
    OR coalesce(length(p_name),0) NOT BETWEEN 1 AND 240
    OR coalesce(p_sha256,'') !~ '^[0-9a-f]{64}$'
    OR coalesce(p_secret_hash,'') !~ '^[0-9a-f]{64}$'
    OR coalesce(p_ip_hash,'') !~ '^[0-9a-f]{64}$'
    OR p_extension IS DISTINCT FROM 'sseq'
    OR p_path IS DISTINCT FROM 'uploads/'||p_id::text||'.sseq'
    OR (p_slot IS NOT NULL AND p_slot NOT BETWEEN 1000 AND 65535)
 THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(98765431);
 -- Different client-initiated submissions can have identical SHA-256 bytes;
 -- only their distinct UUID/reservation secret identifies them. Server retries
 -- of an existing UUID use the upload-status/finish path rather than INSERT.
 SELECT quota_bytes INTO v_limit FROM public.theme_storage_settings WHERE id=true;
 IF v_limit IS NULL THEN RAISE EXCEPTION 'Storage quota configuration missing'; END IF;
 SELECT public.theme_accounted_bytes() INTO v_used;
 IF v_used+p_size>v_limit THEN RAISE EXCEPTION 'Storage quota exhausted'; END IF;
 SELECT count(*) FILTER(WHERE ip_hash=p_ip_hash AND created_at>now()-interval '1 hour'),
        count(*) FILTER(WHERE ip_hash=p_ip_hash), count(*)
 INTO v_hour,v_day,v_global FROM public.theme_uploads
 WHERE created_at>now()-interval '1 day';
 IF v_hour>=30 THEN RAISE EXCEPTION 'Hourly upload limit reached (30 per IP)'; END IF;
 IF v_day>=100 THEN RAISE EXCEPTION 'Daily upload limit reached (100 per IP)'; END IF;
 IF v_global>=500 THEN RAISE EXCEPTION 'Global daily upload capacity reached (500)'; END IF;
 IF (SELECT count(*) FROM public.theme_tracks)
    +(SELECT count(*) FROM public.theme_uploads WHERE status IN ('pending','validating','processing') AND expires_at>now())>=1500
 THEN RAISE EXCEPTION 'Library capacity reached'; END IF;
 INSERT INTO public.theme_uploads(id,secret_hash,sha256,ip_hash,original_filename,size_bytes,storage_path,extension,validation_slot)
 VALUES(p_id,p_secret_hash,p_sha256,p_ip_hash,p_name,p_size,p_path,p_extension,p_slot);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_theme_upload_for_slot(uuid,text,text,text,text,bigint,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_theme_upload_for_slot(uuid,text,text,text,text,bigint,text,text,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
