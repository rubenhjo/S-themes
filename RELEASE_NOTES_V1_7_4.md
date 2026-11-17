# sigma-themes v1.7.4 — Arranger sangen

**Status: complete source ZIP; locally tested release candidate, NOT publicly deployed or DS-certified.**

Changes:
1. “Arranger sangen” opens automatically for one WAV/MP3 and compatible M4A after choosing a HeartGold slot. Auto is initially selected; all final uploads still contain only a valid <=65536-byte SSEQ.
2. Five editable parts maximum, independent of note polyphony; manual one-onset exclusion/undo, instrument per part, volume scaled into MIDI velocity, local confidence filters and localized Bass adjustments. Existing five-MIDI arranger unchanged.
3. Original vs SSEQ A/B region listening, optional preview loop independent of exported loop and exact byte equality between full SSEQ preview and confirmed upload.
4. Note timing improvement with bounded onset-compensation and 60-ms demodulation; short possible notes preserved for opt-in review. Four-/six-/eight-note simultaneous chords preserved.
5. Two uniquely numbered staging-only SQL migrations, historic SQL preserved as immutable references; existing production data untouched.
6. Expanded Node and Chromium browser regression suites, real WAV/MP3 file input tests, missing Worker-load regression fixed and synthetic benchmark / private Cute melody caveat documented.

Verification: 162/162 Node, 24/24 Chromium, 18/18 browser WAV/MP3 polyphony, strict known 100% / 3 additional blind synthetic 88.9% F1; independent in-project Python reader and synthetic Sigma Dex pack validator PASS.

NOT TESTED: latest Github remote `main` checkout, Vercel Preview + staging Supabase/Turnstile, real public upload timing, DB migrations in staging, private game ROM/real Sigma Dex application, third-party ndspy, physical Safari. See TEST_RESULTS.md and DEPLOYMENT.md.
