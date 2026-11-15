-- QC7: the initial reservation RPC is replaced with a byte-accurate budget.
-- Apply AFTER 20261114_public_release.sql. All functions remain service_role only.
-- This release deliberately FAILS CLOSED if this migration is missing.

create table if not exists public.theme_storage_settings (
  id boolean primary key default true check(id),
  quota_bytes bigint not null check(quota_bytes between 1048576 and 1099511627776),
  updated_at timestamptz not null default now()
);
insert into public.theme_storage_settings(id,quota_bytes)
 values(true,850000000) on conflict(id) do nothing;
revoke all on public.theme_storage_settings from public, anon, authenticated;
alter table public.theme_storage_settings enable row level security;

alter table public.theme_uploads drop constraint if exists theme_uploads_status_check;
alter table public.theme_uploads add constraint theme_uploads_status_check
  check(status in ('pending','validating','processing','published','failed','expired'));
alter table public.theme_uploads add column if not exists validation_title text;
alter table public.theme_uploads add column if not exists validation_artist text;
alter table public.theme_uploads add column if not exists validation_album text;
alter table public.theme_uploads add column if not exists validation_started_at timestamptz;
alter table public.theme_uploads add column if not exists validation_error text;
create index if not exists theme_upload_validation_queue on public.theme_uploads(status,created_at);

-- Metadata from storage.objects is needed for orphan objects. An object whose
-- size metadata is missing is conservatively charged a full allowed file size.
create or replace function public.theme_accounted_bytes()
returns bigint language sql security definer set search_path='' as $$
 select coalesce((select sum(size_bytes) from public.theme_tracks),0)::bigint
       + coalesce((select sum(size_bytes) from public.theme_uploads where status<>'published'),0)::bigint
       + coalesce((select sum(
          case when (o.metadata->>'size') ~ '^[0-9]{1,15}$'
            then greatest((o.metadata->>'size')::bigint,0)
            else 47185920 end)
          from storage.objects o
          where o.bucket_id='sigma-theme-audio'
          and not exists(select 1 from public.theme_uploads u where u.storage_path=o.name)
          and not exists(select 1 from public.theme_tracks t where t.storage_path=o.name)),0)::bigint
$$;
revoke all on function public.theme_accounted_bytes() from public,anon,authenticated;
grant execute on function public.theme_accounted_bytes() to service_role;

create or replace function public.reserve_theme_upload(
 p_id uuid,p_secret_hash text,p_sha256 text,p_ip_hash text,
 p_name text,p_size bigint,p_path text,p_extension text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer; v_limit bigint; v_used bigint;
begin
 if p_size not between 64 and 47185920 or length(p_name)>240
    or p_sha256 !~ '^[0-9a-f]{64}$' or p_secret_hash !~ '^[0-9a-f]{64}$'
    or p_ip_hash !~ '^[0-9a-f]{64}$' or p_extension not in ('mp3','wav','flac','ogg','opus','m4a','aac')
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

create or replace function public.queue_theme_upload(
 p_id uuid,p_secret_hash text,p_title text,p_artist text,p_album text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if length(p_title) not between 1 and 220 or length(p_artist) not between 1 and 220 or length(p_album)>220 then
  raise exception 'Invalid metadata';end if;
 update public.theme_uploads set status='validating',validation_title=p_title,validation_artist=p_artist,
   validation_album=p_album,validation_error=null
 where id=p_id and secret_hash=p_secret_hash and status='pending' and expires_at>now();
 return found;
end $$;

-- Workers atomically acquire a single job, preventing duplicate validation.
create or replace function public.claim_theme_validation()
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.theme_uploads%rowtype;
begin
 select * into r from public.theme_uploads
 where (status='validating' or (status='processing' and validation_started_at<now()-interval '15 minutes')) and expires_at>now()
 order by created_at,id limit 1 for update skip locked;
 if r.id is null then return null;end if;
 update public.theme_uploads set status='processing',validation_started_at=now() where id=r.id;
 return to_jsonb(r);
end $$;

create or replace function public.reject_theme_validation(p_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.theme_uploads set status='failed',validation_error=left(coalesce(p_reason,'Audio validation failed'),200)
 where id=p_id and status='processing';return found;
end $$;

create or replace function public.fail_theme_upload(p_id uuid,p_secret_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.theme_uploads set status='failed'
 where id=p_id and secret_hash=p_secret_hash and status in ('pending','validating','processing');
 return found;
end $$;

-- Publish can only be called by the trusted worker after complete FFmpeg decode.
create or replace function public.publish_theme_upload(
 p_id uuid,p_secret_hash text,p_title text,p_artist text,p_album text,
 p_duration numeric,p_mime text,p_lufs numeric default null,p_peak numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.theme_uploads%rowtype; newtrack public.theme_tracks%rowtype;
begin
 select * into r from public.theme_uploads where id=p_id for update;
 if r.id is null or r.secret_hash<>p_secret_hash or r.status<>'processing' or r.expires_at<now() then
  raise exception 'Upload not validated';end if;
 if length(p_title) not between 1 and 220 or length(p_artist) not between 1 and 220
  or length(p_album)>220 or p_duration not between 0.1 and 7200 then raise exception 'Invalid metadata';end if;
 insert into public.theme_tracks(id,title,artist,album,duration_s,sha256,storage_path,mime_type,original_filename,size_bytes,lufs,true_peak)
 values(r.id,p_title,p_artist,p_album,p_duration,r.sha256,r.storage_path,p_mime,r.original_filename,r.size_bytes,p_lufs,p_peak)
 returning * into newtrack;
 update public.theme_uploads set status='published' where id=r.id;
 return to_jsonb(newtrack);
end $$;

revoke all on function public.queue_theme_upload(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.claim_theme_validation() from public,anon,authenticated;
revoke all on function public.reject_theme_validation(uuid,text) from public,anon,authenticated;
revoke all on function public.publish_theme_upload(uuid,text,text,text,text,numeric,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.queue_theme_upload(uuid,text,text,text,text) to service_role;
grant execute on function public.claim_theme_validation() to service_role;
grant execute on function public.reject_theme_validation(uuid,text) to service_role;
grant execute on function public.publish_theme_upload(uuid,text,text,text,text,numeric,text,numeric,numeric) to service_role;

-- Administrator's local importer has its own rate-limit-free reservation RPC.
-- It DOES NOT bypass the same global storage budget or duplicate checks.
create or replace function public.reserve_admin_theme_upload(
 p_id uuid,p_secret_hash text,p_sha256 text,p_name text,p_size bigint,p_path text,p_extension text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_limit bigint; v_used bigint;
begin
 if p_size not between 64 and 47185920 or length(p_name)>240
    or p_sha256 !~ '^[0-9a-f]{64}$' or p_secret_hash !~ '^[0-9a-f]{64}$'
    or p_extension not in ('mp3','wav','flac','ogg','opus','m4a','aac')
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
revoke all on function public.reserve_admin_theme_upload(uuid,text,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.reserve_admin_theme_upload(uuid,text,text,text,bigint,text,text) to service_role;
