# Vercel / Supabase — stagingplan for v1.7.0

1. Behold kopi av eksisterende GitHub-main, Vercel miljøvariabler, Supabase schema/storage og katalog. **Ikke slett** sanger/mapper.
2. Pakk den komplette ZIP-en **i repoets rot** (ikke én ekstra overordnet mappe), inkludert `.github/workflows`. Se `package.json` for Node 22.x. Verifiser `npm ci && npm run verify` før push.
3. Ta Supabase-backup og kontroller SQL-versjonene i `supabase/migrations`. Sørg for at `20261115_validation_claim_lease.sql`, `20261115_sseq_only.sql` og `20261115_upload_pipeline_permissions.sql` er anvendt, og legg deretter til `20261116_inline_sseq_publication.sql`. Verifiser RLS, unikhetsindekser og RPC service_role-permisjoner. Ikke kjør uten gjennomgang av live schema.
4. Kontroller at Vercel har de **hemmelige servervariablene** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPLOAD_HMAC_SECRET`, `TURNSTILE_SECRET_KEY` og `TURNSTILE_HOSTNAME`; eventuelle public site keys skal bare brukes for Turnstile-widgeten. Ikke legg servernøkler i Vite/JS eller offentlig repo.
5. Test på staging med én gyldig 100-byte SSEQ: hent signert URL, utfør PUT, kall `upload-finish`, kontroller `published:true` og offentlig katalog. Simuler midlertidig databasefeil og kontroller automatisk validator-fallback uten manuell `Run workflow`.
6. Test to forskjellige titler med **identisk SHA-256** som separate katalog-ID-er; sjekk at retry av samme opplasting er idempotent. Test HTTP 429 ved 30/time/IP, 100/døgn/IP og 500/døgn globalt (egne staging-testdata).
7. Test original iPhone/Safari, mobilvisning, SSEQ-lydpreview og fem MIDI-filer. Bekreft fysisk eller emulatorbasert HeartGold US-kompatibilitet separat.

**Ikke utført her:** live GitHub, Vercel, Cloudflare eller Supabase-tilgang/endringer. Lokale browser-mocks er ikke produksjonstest.
