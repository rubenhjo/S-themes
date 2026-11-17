/* Reproducible deterministic benchmark, v1.7.1 source vs current. */
import {writeFileSync} from 'node:fs';
import {benchmark} from '../tests/audio-benchmark.mjs';
const candidate=globalThis.SigmaTranscribe;
await import('../tests/baseline-v171-transcribe.js');
const baseline=globalThis.SigmaTranscribe;
const before=benchmark(baseline),after=benchmark(candidate);
const report={method:'exact MIDI pitches, onset and offset within ±200ms; deterministic additive harmonic fixtures',
 cases:before.rows.map((r,i)=>({case:r.name,before:{tp:r.tp,fp:r.fp,fn:r.fn,f1:r.f1},after:{tp:after.rows[i].tp,fp:after.rows[i].fp,fn:after.rows[i].fn,f1:after.rows[i].f1}})),baseline:before.summary,candidate:after.summary};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else console.log('v1.7.1:',before.summary,'\ncandidate:',after.summary);
if(after.summary.f1<before.summary.f1)process.exitCode=1;
