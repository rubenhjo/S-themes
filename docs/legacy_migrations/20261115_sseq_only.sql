-- Sigma-themes: verified SSEQ-only public music. Apply AFTER all QC7 migrations.
-- Preserves old audio rows for PRIVATE migration. The public API excludes legacy rows.
-- No copyright-protected SBNK/SWAR binaries are installed here.
ALTER TABLE public.theme_uploads DROP CONSTRAINT IF EXISTS theme_uploads_extension_check;
ALTER TABLE public.theme_uploads ADD CONSTRAINT theme_uploads_extension_check
 CHECK (extension IN ('sseq','mp3','wav','flac','ogg','opus','m4a','aac'));
ALTER TABLE public.theme_uploads DROP CONSTRAINT IF EXISTS theme_uploads_size_bytes_check;
ALTER TABLE public.theme_uploads ADD CONSTRAINT theme_uploads_size_bytes_check CHECK(size_bytes BETWEEN 30 AND 47185920);
ALTER TABLE public.theme_tracks DROP CONSTRAINT IF EXISTS theme_tracks_size_bytes_check;
ALTER TABLE public.theme_tracks ADD CONSTRAINT theme_tracks_size_bytes_check CHECK(size_bytes BETWEEN 30 AND 47185920);
DROP INDEX IF EXISTS public.theme_tracks_unique_sequence;
CREATE INDEX IF NOT EXISTS theme_tracks_target_slot ON public.theme_tracks(sseq_id) WHERE sseq_id IS NOT NULL;
ALTER TABLE public.theme_uploads ADD COLUMN IF NOT EXISTS validation_slot integer CHECK(validation_slot BETWEEN 1000 AND 65535);
-- Old audio records stay in storage for private, resumable migration; no new WAV/MP3 uploads permitted.
UPDATE storage.buckets SET file_size_limit=65536,allowed_mime_types=ARRAY['application/octet-stream'],public=false
 WHERE id='sigma-theme-audio';

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
 if exists(select 1 from public.theme_tracks where sha256=p_sha256)
  or exists(select 1 from public.theme_uploads where sha256=p_sha256
       and status in ('pending','validating','processing') and expires_at>now()) then
   raise exception 'Duplicate audio checksum'; end if;
 select count(*) into v_count from public.theme_uploads where ip_hash=p_ip_hash and created_at>now()-interval '1 hour';
 if v_count>=4 then raise exception 'Hourly upload limit reached';end if;
 select count(*) into v_count from public.theme_uploads where ip_hash=p_ip_hash and created_at>now()-interval '1 day';
 if v_count>=16 then raise exception 'Daily upload limit reached';end if;
 select count(*) into v_count from public.theme_uploads where created_at>now()-interval '1 day';
 if v_count>=80 then raise exception 'Global daily upload capacity reached';end if;
 select count(*) into v_count from public.theme_tracks;
 if v_count>=1500 then raise exception 'Library capacity reached';end if;
 insert into public.theme_uploads(id,secret_hash,sha256,ip_hash,original_filename,size_bytes,storage_path,extension)
 values(p_id,p_secret_hash,p_sha256,p_ip_hash,p_name,p_size,p_path,p_extension);
 return true;
end $$;

create or replace function public.reserve_admin_theme_upload(
 p_id uuid,p_secret_hash text,p_sha256 text,p_name text,p_size bigint,p_path text,p_extension text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_limit bigint; v_used bigint;
begin
 if p_size not between 30 and 65536 or length(p_name)>240
    or p_sha256 !~ '^[0-9a-f]{64}$' or p_secret_hash !~ '^[0-9a-f]{64}$'
    or p_extension <> 'sseq'
    or p_path <> 'uploads/'||p_id::text||'.'||p_extension then raise exception 'Invalid admin reservation';end if;
 perform pg_catalog.pg_advisory_xact_lock(98765431);
 select quota_bytes into v_limit from public.theme_storage_settings where id=true;
 if v_limit is null then raise exception 'Quota configuration missing';end if;
 select public.theme_accounted_bytes() into v_used;
 if v_used+p_size>v_limit then raise exception 'Storage quota exhausted';end if;
 if exists(select 1 from public.theme_tracks where sha256=p_sha256) or
    exists(select 1 from public.theme_uploads where sha256=p_sha256 and status in ('pending','validating','processing') and expires_at>now()) then
  raise exception 'Duplicate audio checksum';end if;
 insert into public.theme_uploads(id,secret_hash,sha256,ip_hash,original_filename,size_bytes,storage_path,extension)
 values(p_id,p_secret_hash,p_sha256,repeat('0',64),p_name,p_size,p_path,p_extension);
 return true;
end $$;

CREATE OR REPLACE FUNCTION public.assign_theme_slot(p_id uuid,p_secret_hash text,p_slot integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_slot IS NULL OR p_slot NOT BETWEEN 1000 AND 65535 THEN RAISE EXCEPTION 'Invalid music slot'; END IF;
 UPDATE public.theme_uploads SET validation_slot=p_slot
 WHERE id=p_id AND secret_hash=p_secret_hash AND extension='sseq' AND status='pending' AND expires_at>now();
 RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.queue_theme_upload(
 p_id uuid,p_secret_hash text,p_title text,p_artist text,p_album text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF length(p_title) NOT BETWEEN 1 AND 220 OR length(p_artist) NOT BETWEEN 1 AND 220 OR length(p_album)>220 THEN
  RAISE EXCEPTION 'Invalid metadata';
 END IF;
 UPDATE public.theme_uploads SET status='validating',validation_title=p_title,validation_artist=p_artist,
 validation_album=p_album,validation_error=null
 WHERE id=p_id AND secret_hash=p_secret_hash AND status='pending' AND extension='sseq'
 AND validation_slot IS NOT NULL AND expires_at>now();
 RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.publish_theme_upload(
 p_id uuid,p_secret_hash text,p_title text,p_artist text,p_album text,
 p_duration numeric,p_mime text,p_lufs numeric,p_peak numeric,p_claim_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.theme_uploads%rowtype; newtrack public.theme_tracks%rowtype;
BEGIN
 SELECT * INTO r FROM public.theme_uploads WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL OR r.secret_hash<>p_secret_hash OR r.status<>'processing'
    OR r.validation_claim_id IS DISTINCT FROM p_claim_id OR r.expires_at<now()
    OR r.extension<>'sseq' OR r.validation_slot IS NULL
    OR p_mime<>'application/octet-stream' THEN
    RAISE EXCEPTION 'SSEQ validation claim, slot, or format invalid';
 END IF;
 IF length(p_title) NOT BETWEEN 1 AND 220 OR length(p_artist) NOT BETWEEN 1 AND 220
    OR length(p_album)>220 OR p_duration NOT BETWEEN 0.1 AND 7200 THEN
    RAISE EXCEPTION 'Invalid metadata';
 END IF;
 INSERT INTO public.theme_tracks
  (id,title,artist,album,duration_s,sha256,storage_path,mime_type,original_filename,size_bytes,lufs,true_peak,sseq_id)
 VALUES(r.id,p_title,p_artist,p_album,p_duration,r.sha256,r.storage_path,p_mime,r.original_filename,r.size_bytes,null,null,r.validation_slot)
 RETURNING * INTO newtrack;
 UPDATE public.theme_uploads SET status='published' WHERE id=r.id;
 RETURN to_jsonb(newtrack);
END $$;

REVOKE ALL ON FUNCTION public.assign_theme_slot(uuid,text,integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_theme_slot(uuid,text,integer) TO service_role;
NOTIFY pgrst, 'reload schema';

-- Previously, the historical anonymous SELECT policy exposed legacy MP3/WAV
-- metadata to direct PostgREST clients even though /api/catalog filtered it.
-- Supabase's public anon key is exposed for Realtime; filtering ONLY the API
-- handler is therefore NOT sufficient. Preserve private legacy migration rows
-- for the service-role worker, while hiding them from anonymous clients.
DROP POLICY IF EXISTS "public read-only track catalog" ON public.theme_tracks;
CREATE POLICY "public read-only track catalog" ON public.theme_tracks
  FOR SELECT TO anon, authenticated
  USING (mime_type = 'application/octet-stream'
         AND sseq_id IS NOT NULL
         AND size_bytes BETWEEN 30 AND 65536);

-- RLS applies to the old rows without deleting any existing catalog IDs.
-- Do not grant write privileges to anon/authenticated.
REVOKE INSERT, UPDATE, DELETE ON public.theme_tracks FROM anon, authenticated;
