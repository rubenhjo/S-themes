-- sigma-themes public, account-free release.
-- Non-destructive: legacy sigma_* member-only tables are left intact but NOT used by the new app.
-- Run once in Supabase SQL Editor; do not publish service-role key.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.theme_tracks (
 id uuid primary key,
 title text not null check(length(title) between 1 and 220),
 artist text not null check(length(artist) between 1 and 220),
 album text not null default '',
 duration_s numeric not null default 0 check(duration_s between 0 and 7200),
 sha256 text not null unique check(sha256 ~ '^[0-9a-f]{64}$'),
 storage_path text not null unique,
 mime_type text not null,
 original_filename text not null,
 size_bytes bigint not null check(size_bytes between 64 and 47185920),
 created_at timestamptz not null default now(),
 sseq_id integer check(sseq_id between 0 and 65535),
 loop_enabled boolean not null default true,
 lufs numeric,
 true_peak numeric
);
create unique index if not exists theme_tracks_unique_sequence on public.theme_tracks(sseq_id) where sseq_id is not null;
create index if not exists theme_tracks_recent on public.theme_tracks(created_at desc);

create table if not exists public.theme_uploads (
 id uuid primary key,
 secret_hash text not null,
 sha256 text not null,
 ip_hash text not null,
 original_filename text not null,
 size_bytes bigint not null check(size_bytes between 64 and 47185920),
 storage_path text not null unique,
 extension text not null check(extension in ('mp3','wav','flac','ogg','opus','m4a','aac')),
 status text not null default 'pending' check(status in ('pending','published','failed','expired')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '2 hours')
);
create index if not exists theme_upload_limits on public.theme_uploads(ip_hash,created_at desc);
create index if not exists theme_upload_expiry on public.theme_uploads(status,expires_at);

alter table public.theme_tracks enable row level security;
alter table public.theme_uploads enable row level security;

-- Public can READ ONLY published track metadata. No public INSERT/UPDATE/DELETE.
revoke all on public.theme_tracks, public.theme_uploads from public, anon, authenticated;
grant select on public.theme_tracks to anon, authenticated;
-- Drop known policy on re-run (avoids duplicate policies).
drop policy if exists "public read-only track catalog" on public.theme_tracks;
create policy "public read-only track catalog" on public.theme_tracks
 for select to anon,authenticated using (true);
-- Upload reservations are never exposed via RLS.

-- Never grant storage object create/delete/read to anon/authenticated.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('sigma-theme-audio','sigma-theme-audio',false,47185920,
 array['audio/mpeg','audio/wav','audio/flac','audio/ogg','audio/mp4','audio/aac'])
on conflict(id) do update set public=false,file_size_limit=47185920,
 allowed_mime_types=excluded.allowed_mime_types;

-- Limit per IP and globally via SERIALIZED Postgres transaction, not per-function memory.
create or replace function public.reserve_theme_upload(
 p_id uuid,p_secret_hash text,p_sha256 text,p_ip_hash text,
 p_name text,p_size bigint,p_path text,p_extension text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if p_size not between 64 and 47185920 or length(p_name) > 240
    or p_sha256 !~ '^[0-9a-f]{64}$' or p_secret_hash !~ '^[0-9a-f]{64}$'
    or p_ip_hash !~ '^[0-9a-f]{64}$' or p_extension not in ('mp3','wav','flac','ogg','opus','m4a','aac')
    or p_path <> 'uploads/' || p_id::text || '.' || p_extension then
   raise exception 'Invalid reservation';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 7));
 perform pg_catalog.pg_advisory_xact_lock(98765431); -- global quota serialization
 if exists(select 1 from public.theme_tracks where sha256=p_sha256)
    or exists(select 1 from public.theme_uploads where sha256=p_sha256 and status='pending' and expires_at>now()) then
   raise exception 'Duplicate audio checksum';
 end if;
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

create or replace function public.fail_theme_upload(p_id uuid,p_secret_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.theme_uploads set status='failed'
 where id=p_id and secret_hash=p_secret_hash and status='pending';
 return found;
end $$;

create or replace function public.publish_theme_upload(
 p_id uuid,p_secret_hash text,p_title text,p_artist text,p_album text,p_duration numeric,p_mime text,p_lufs numeric default null,p_peak numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.theme_uploads%rowtype; newtrack public.theme_tracks%rowtype;
begin
 select * into r from public.theme_uploads where id=p_id for update;
 if r.id is null or r.secret_hash<>p_secret_hash or r.status<>'pending' or r.expires_at<now() then
  raise exception 'Upload is not valid';
 end if;
 if length(p_title) not between 1 and 220 or length(p_artist) not between 1 and 220
    or length(p_album)>220 or p_duration not between 0 and 7200 then raise exception 'Invalid metadata';end if;
 if (p_lufs is not null and (p_lufs<-80 or p_lufs>0)) or
    (p_peak is not null and (p_peak<-80 or p_peak>6)) then raise exception 'Invalid audio metrics'; end if;
 insert into public.theme_tracks(id,title,artist,album,duration_s,sha256,storage_path,mime_type,original_filename,size_bytes,lufs,true_peak)
 values(r.id,p_title,p_artist,p_album,p_duration,r.sha256,r.storage_path,p_mime,r.original_filename,r.size_bytes,p_lufs,p_peak)
 returning * into newtrack;
 update public.theme_uploads set status='published' where id=r.id;
 return to_jsonb(newtrack);
end $$;

revoke all on function public.reserve_theme_upload(uuid,text,text,text,text,bigint,text,text) from public, anon,authenticated;
revoke all on function public.fail_theme_upload(uuid,text) from public, anon,authenticated;
revoke all on function public.publish_theme_upload(uuid,text,text,text,text,numeric,text,numeric,numeric) from public, anon,authenticated;
grant execute on function public.reserve_theme_upload(uuid,text,text,text,text,bigint,text,text) to service_role;
grant execute on function public.fail_theme_upload(uuid,text) to service_role;
grant execute on function public.publish_theme_upload(uuid,text,text,text,text,numeric,text,numeric,numeric) to service_role;

-- Enable Realtime for public catalog. If already added, the anonymous block keeps migration repeatable.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='theme_tracks') then
   alter publication supabase_realtime add table public.theme_tracks;
 end if;
end $$;

-- Legacy schema stays untouched for recovery, but new app never uses old user/member tables.
