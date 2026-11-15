-- READ ONLY. Run after applying every migration in chronological order.
-- All 'ok' values should be true. Never paste API keys here.
SELECT 'tracks service_role SELECT' AS check_name, has_table_privilege('service_role','public.theme_tracks','SELECT') AS ok
UNION ALL SELECT 'uploads service_role SELECT',has_table_privilege('service_role','public.theme_uploads','SELECT')
UNION ALL SELECT 'uploads service_role DELETE',has_table_privilege('service_role','public.theme_uploads','DELETE')
UNION ALL SELECT 'storage settings service_role SELECT',has_table_privilege('service_role','public.theme_storage_settings','SELECT')
UNION ALL SELECT 'anon no upload SELECT',NOT has_table_privilege('anon','public.theme_uploads','SELECT')
UNION ALL SELECT 'anon no upload INSERT',NOT has_table_privilege('anon','public.theme_uploads','INSERT')
UNION ALL SELECT 'anon no track INSERT',NOT has_table_privilege('anon','public.theme_tracks','INSERT')
UNION ALL SELECT 'reserve_theme_upload RPC',has_function_privilege('service_role','public.reserve_theme_upload(uuid,text,text,text,text,bigint,text,text)','EXECUTE')
UNION ALL SELECT 'assign_theme_slot RPC',has_function_privilege('service_role','public.assign_theme_slot(uuid,text,integer)','EXECUTE')
UNION ALL SELECT 'queue_theme_upload RPC',has_function_privilege('service_role','public.queue_theme_upload(uuid,text,text,text,text)','EXECUTE')
UNION ALL SELECT 'claim_theme_validation RPC',has_function_privilege('service_role','public.claim_theme_validation()','EXECUTE')
UNION ALL SELECT 'publish_theme_upload RPC',has_function_privilege('service_role','public.publish_theme_upload(uuid,text,text,text,text,numeric,text,numeric,numeric,uuid)','EXECUTE')
UNION ALL SELECT 'SSEQ reservation function',position('p_extension <> ''sseq''' IN lower(pg_get_functiondef('public.reserve_theme_upload(uuid,text,text,text,text,bigint,text,text)'::regprocedure)))>0
UNION ALL SELECT 'private 64KiB SSEQ bucket',EXISTS(SELECT 1 FROM storage.buckets WHERE id='sigma-theme-audio' AND public=false AND file_size_limit=65536 AND 'application/octet-stream'=ANY(allowed_mime_types));
