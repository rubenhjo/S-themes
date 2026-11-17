-- 2026-11-16 / sigma-themes: one-click server-side SSEQ publication.
-- Apply once AFTER 20261115_validation_claim_lease.sql AND
-- 20261115_upload_pipeline_permissions.sql. Non-destructive to old songs.
BEGIN;
-- A game bank/slot is a destination, not a one-song-per-library constraint.
DROP INDEX IF EXISTS public.theme_tracks_unique_sequence;
ALTER TABLE public.theme_tracks DROP CONSTRAINT IF EXISTS theme_tracks_sha256_key;
CREATE INDEX IF NOT EXISTS theme_tracks_hash_lookup ON public.theme_tracks(sha256);
create or replace function public.reserve_theme_upload(
 p_id uuid,p_secret_hash text,p_sha256 text,p_ip_hash text,
 p_name text,p_size bigint,p_path text,p_extension text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer; v_limit bigint; v_used bigint;
begin
 if p_size not between 30 and 65536 or length(p_name)>240
    or p_sha256 !~ '^[0-9a-f]{64}$' or p_secret_hash !~ '^[0-9a-f]{64}$'
    or p_ip_hash !~ '^[0-9a-f]{64}$' or p_extension <> 'sseq'
    or p_path <> 'uploads/'||p_id::text||'.'||p_extension then
    raise exception 'Invalid reservation'; end if;
 perform pg_catalog.pg_advisory_xact_lock(98765431);
 select quota_bytes into v_limit from public.theme_storage_settings where id=true;
 if v_limit is null then raise exception 'Storage quota configuration missing';end if;
 select public.theme_accounted_bytes() into v_used;
 if v_used+p_size>v_limit then raise exception 'Storage quota exhausted'; end if;
 select count(*) into v_count from public.theme_uploads where ip_hash=p_ip_hash and created_at>now()-interval '1 hour';
 if v_count>=30 then raise exception 'Hourly upload limit reached';end if;
 select count(*) into v_count from public.theme_uploads where ip_hash=p_ip_hash and created_at>now()-interval '1 day';
 if v_count>=100 then raise exception 'Daily upload limit reached';end if;
 select count(*) into v_count from public.theme_uploads where created_at>now()-interval '1 day';
 if v_count>=500 then raise exception 'Global daily upload capacity reached';end if;
 select count(*) into v_count from public.theme_tracks;
 if v_count>=1500 then raise exception 'Library capacity reached';end if;
 insert into public.theme_uploads(id,secret_hash,sha256,ip_hash,original_filename,size_bytes,storage_path,extension)
 values(p_id,p_secret_hash,p_sha256,p_ip_hash,p_name,p_size,p_path,p_extension);
 return true;
end $$;


CREATE OR REPLACE FUNCTION public.claim_theme_validation_for_upload(p_id uuid,p_secret_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.theme_uploads%rowtype;
BEGIN
 SELECT * INTO r FROM public.theme_uploads
 WHERE id=p_id AND secret_hash=p_secret_hash AND status='validating'
   AND validation_slot IS NOT NULL AND expires_at>now()
 FOR UPDATE SKIP LOCKED;
 IF r.id IS NULL THEN RETURN NULL; END IF;
 UPDATE public.theme_uploads
 SET status='processing',validation_started_at=now(),
     validation_claim_id=pg_catalog.gen_random_uuid()
 WHERE id=r.id RETURNING * INTO r;
 RETURN pg_catalog.jsonb_build_object('validation_claim_id',r.validation_claim_id);
END $$;
REVOKE ALL ON FUNCTION public.claim_theme_validation_for_upload(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_theme_validation_for_upload(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
