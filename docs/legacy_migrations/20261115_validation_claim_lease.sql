-- ST-042: fencing token for recycled/long-running audio validation jobs.
-- Run AFTER 20261114_qc7_validation_quota.sql.
-- Every claim creates a unique token. Only its current owner may publish/reject.
ALTER TABLE public.theme_uploads ADD COLUMN IF NOT EXISTS validation_claim_id uuid;

CREATE OR REPLACE FUNCTION public.claim_theme_validation()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.theme_uploads%rowtype;
BEGIN
  SELECT * INTO r FROM public.theme_uploads
  WHERE (status='validating' OR
         (status='processing' AND validation_started_at < now()-interval '15 minutes'))
    AND expires_at > now()
  ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF r.id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.theme_uploads SET
    status='processing', validation_started_at=now(), validation_claim_id=pg_catalog.gen_random_uuid()
  WHERE id=r.id RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;

-- The old two-argument reject RPC can change a newer claim's state: disable it.
REVOKE ALL ON FUNCTION public.reject_theme_validation(uuid,text) FROM public,anon,authenticated,service_role;
DROP FUNCTION public.reject_theme_validation(uuid,text);
CREATE FUNCTION public.reject_theme_validation(p_id uuid,p_reason text,p_claim_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.theme_uploads
  SET status='failed',validation_error=left(coalesce(p_reason,'Audio validation failed'),200)
  WHERE id=p_id AND status='processing' AND validation_claim_id=p_claim_id;
  RETURN FOUND;
END $$;

-- The old nine-argument publish RPC has no claim fencing: disable it.
REVOKE ALL ON FUNCTION public.publish_theme_upload(uuid,text,text,text,text,numeric,text,numeric,numeric)
FROM public,anon,authenticated,service_role;
DROP FUNCTION public.publish_theme_upload(uuid,text,text,text,text,numeric,text,numeric,numeric);
CREATE FUNCTION public.publish_theme_upload(
 p_id uuid,p_secret_hash text,p_title text,p_artist text,p_album text,
 p_duration numeric,p_mime text,p_lufs numeric,p_peak numeric,p_claim_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.theme_uploads%rowtype; newtrack public.theme_tracks%rowtype;
BEGIN
 SELECT * INTO r FROM public.theme_uploads WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL OR r.secret_hash<>p_secret_hash OR r.status<>'processing'
    OR r.validation_claim_id IS DISTINCT FROM p_claim_id OR r.expires_at<now() THEN
    RAISE EXCEPTION 'Upload validation claim expired or changed';
 END IF;
 IF length(p_title) NOT BETWEEN 1 AND 220 OR length(p_artist) NOT BETWEEN 1 AND 220
    OR length(p_album)>220 OR p_duration NOT BETWEEN 0.1 AND 7200 THEN
    RAISE EXCEPTION 'Invalid metadata';
 END IF;
 INSERT INTO public.theme_tracks
  (id,title,artist,album,duration_s,sha256,storage_path,mime_type,original_filename,size_bytes,lufs,true_peak)
 VALUES(r.id,p_title,p_artist,p_album,p_duration,r.sha256,r.storage_path,p_mime,r.original_filename,r.size_bytes,p_lufs,p_peak)
 RETURNING * INTO newtrack;
 UPDATE public.theme_uploads SET status='published' WHERE id=r.id;
 RETURN to_jsonb(newtrack);
END $$;

REVOKE ALL ON FUNCTION public.claim_theme_validation() FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.reject_theme_validation(uuid,text,uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.publish_theme_upload(uuid,text,text,text,text,numeric,text,numeric,numeric,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_theme_validation() TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_theme_validation(uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_theme_upload(uuid,text,text,text,text,numeric,text,numeric,numeric,uuid) TO service_role;

-- Refresh Supabase PostgREST RPC signatures after dropping old overloads.
NOTIFY pgrst, 'reload schema';
