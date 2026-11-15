-- sigma-themes: complete the server-only grants required by the upload API.
-- APPLY ONLY AFTER the four historical migrations, in chronological order.
-- Safe to repeat. Does not grant anonymous uploads or expose private receipts.
BEGIN;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON TABLE public.theme_tracks TO service_role;
GRANT SELECT, DELETE ON TABLE public.theme_uploads TO service_role;
GRANT SELECT ON TABLE public.theme_storage_settings TO service_role;
-- Fail closed for all anonymous API consumers.
REVOKE ALL ON TABLE public.theme_uploads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.theme_storage_settings FROM PUBLIC, anon, authenticated;
-- Public music catalog only, guarded by the existing SSEQ-only RLS policy.
GRANT SELECT ON TABLE public.theme_tracks TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.theme_tracks FROM anon, authenticated;
-- Server-side RPC capabilities. SQL functions are security definer and validate
-- signed receipts and quotas; only trusted server-side service_role may invoke them.
REVOKE ALL ON FUNCTION public.reserve_theme_upload(uuid,text,text,text,text,bigint,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_theme_upload(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.assign_theme_slot(uuid,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.queue_theme_upload(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_theme_validation() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reject_theme_validation(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.publish_theme_upload(uuid,text,text,text,text,numeric,text,numeric,numeric,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_admin_theme_upload(uuid,text,text,text,bigint,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.theme_accounted_bytes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_theme_upload(uuid,text,text,text,text,bigint,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_theme_upload(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_theme_slot(uuid,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_theme_upload(uuid,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_theme_validation() TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_theme_validation(uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_theme_upload(uuid,text,text,text,text,numeric,text,numeric,numeric,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_admin_theme_upload(uuid,text,text,text,bigint,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.theme_accounted_bytes() TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
