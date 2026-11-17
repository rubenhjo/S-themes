#!/usr/bin/env node
import {existsSync,readFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url)));
if(pkg.version!==lock.packages?.['']?.version){
 throw Error(`package-lock.json version ${lock.packages?.['']?.version||'missing'} does not match package.json ${pkg.version}; commit both files`);
}
const required=[
 'index.html','app.js','sigma_upload_monitor.js','sseq_codec.js','sseq_transcribe.js','sseq_transcribe_worker.js',
 'sseq_player.js','heartgold_bank_profiles.json','heartgold_bank_profiles.js',
 'api/catalog.js','api/config.js','api/upload-start.js','api/upload-finish.js',
 'docs/legacy_migrations/20261115_sseq_only.sql',
 'docs/legacy_migrations/20261115_upload_pipeline_permissions.sql','supabase/VERIFY_PRODUCTION.sql',
 'tests/browser_sseq_upload_pipeline.py','tests/browser_upload_recovery.py','tests/upload-reliability.test.js',
 'tests/song-deletion.test.js','tests/browser_song_deletion.py','api/song-delete.js','lib/song-deletion.js','supabase/migrations/20261116220000_song_deletion.sql',
 'tests/audio-benchmark.mjs','tests/baseline-v171-transcribe.js','tests/heartgold-sample-voice.test.js','scripts/compare-audio-benchmark.mjs','AUDIO_BENCHMARK.md','HEARTGOLD_COMPATIBILITY.md','DEPLOYMENT.md','OPEN_ISSUES.md',
 'KNOWN_ISSUES.md','QC_REPORT.md','supabase/migrations/20261116221000_distinct_sseq_submissions.sql','tests/polyphony-preservation.test.js','tests/polyphonic-benchmark.mjs','tests/browser_polyphonic_filepicker.py','tests/browser_song_arranger.py','tests/browser_five_minute_import.py','tests/five-minute-arranger.test.js','tests/browser_arranger_controls.py','tests/timing-acceptance.mjs','tests/song-arranger.test.js','sigma_arranger.js','sigma_arranger_ui.js','sigma_arranger.css','sigma_note_refine.js','ARRANGER_QC.md','ARRANGER_TIMING_RESULTS.json','POLYPHONY_QC.md','POLYPHONIC_BENCHMARK_RESULTS.json','docs/legacy_migrations/20261116_inline_sseq_publication.sql','heartgold_source_audio.js','heartgold_instruments.js','tests/browser_hg39_catalog.py','tests/browser_all_instruments.py'
];
const missing=required.filter(name=>!existsSync(new URL('../'+name,import.meta.url)));
if(missing.length)throw Error('Missing release files (GitHub browser upload may have omitted folders): '+missing.join(', '));
console.log(`Release layout OK: ${pkg.version}, ${required.length} required files present`);
