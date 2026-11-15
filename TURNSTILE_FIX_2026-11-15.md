# Turnstile upload failure diagnosis and targeted repair

**Observed:** screenshot `shallow.sseq: Bot-verifisering mislyktes. Prøv igjen.` is created by the **browser** `client_core.js` `error-callback`. It occurs **before** `/api/upload-start`. It is not a GitHub Actions validator rejection. The Supabase production project shows **no reservation** for `shallow.sseq` as of investigation.

**What changed:** The browser now displays the actual Cloudflare Turnstile error code and a specific recovery path instead of a generic error, does not blindly retry permanent sitekey/hostname errors, and logs the code in the console. `/api/config` publishes the non-secret configured hostname so the client can identify Vercel hostname mismatch immediately. Siteverify server failures log only safe diagnostics; no token/key/IP is logged. Successful challenge / receipt / private SSEQ security logic is preserved.

**Production configuration required (cannot be fixed in frontend JavaScript):**

1. Select the actual canonical domain, either `sthemes.vercel.app` or `s-themes.vercel.app` (they are different). Supabase Storage logs historically show requests from `https://sthemes.vercel.app/`.
2. In Cloudflare Dashboard → Turnstile → your widget → Hostname Management, add/allow the *exact* domain used in the browser address bar. Confirm the widget's sitekey corresponds to `TURNSTILE_SITE_KEY` in Vercel.
3. In Vercel project → Settings → Environment Variables, set `TURNSTILE_HOSTNAME` to that same hostname (without `https://`, path or trailing slash). Confirm `TURNSTILE_SECRET_KEY` belongs to the same widget. Redeploy the correct production project to make changes effective. Never share secrets publicly.
4. Hard-refresh the site and try a fresh valid `.sseq` upload once. If it still fails, the updated UI shows the exact Cloudflare code. `110200`/`400021` = unauthorized hostname; `110100`/`110110`/`400020`/`400070` = sitekey problem; `200500` = blocked iframe; `300*`/`600*` = challenge failure. See https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/
5. Separately verify the GitHub Actions validator is configured, so successful uploads progress from pending to published. This screenshot does not indicate a validator failure.

**Verification:** run `npm run verify`; this tests the new error-handling cases with mocked Cloudflare callbacks, not real Cloudflare access. Without direct access to the Cloudflare widget settings or real browser, we cannot assert which error code or account setting causes this particular user's challenge to fail.
