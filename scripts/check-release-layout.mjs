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
 'supabase/migrations/20261115_sseq_only.sql','tests/browser_sseq_upload_pipeline.py',
 'KNOWN_ISSUES.md','QC_REPORT.md'
];
const missing=required.filter(name=>!existsSync(new URL('../'+name,import.meta.url)));
if(missing.length)throw Error('Missing release files (GitHub browser upload may have omitted folders): '+missing.join(', '));
console.log(`Release layout OK: ${pkg.version}, ${required.length} required files present`);
