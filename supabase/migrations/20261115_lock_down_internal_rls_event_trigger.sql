-- Applied to S-themes production on 2026-11-15.
-- Security hardening: this DDL event trigger must not be RPC-callable by
-- anonymous/public API roles. Trigger registration itself is not changed.
BEGIN;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
COMMIT;
