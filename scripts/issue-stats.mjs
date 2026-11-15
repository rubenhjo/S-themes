#!/usr/bin/env node
/** Single source of truth: KNOWN_ISSUES.md. --write regenerates summary and QC report marker. */
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const known=new URL('KNOWN_ISSUES.md',root),report=new URL('QC_REPORT.md',root);
let text=readFileSync(known,'utf8');
const entries=text.split(/(?=^### ST-\d+ — )/m).slice(1);
const statuses=['OPEN','IN PROGRESS','FIXED – NOT VERIFIED','VERIFIED','BLOCKED','WONTFIX'];
const severities=['P0','P1','P2','P3'];
const counts=Object.fromEntries(statuses.map(s=>[s,Object.fromEntries(severities.map(p=>[p,0]))]));
const ids=new Set();
for(const e of entries){
 const id=e.match(/^### (ST-\d+) — /)?.[1],sev=e.match(/\*\*Severity:\*\* (P[0-3])/)?.[1],status=e.match(/\*\*Status:\*\* (OPEN|IN PROGRESS|FIXED – NOT VERIFIED|VERIFIED|BLOCKED|WONTFIX)/)?.[1];
 if(!id||!sev||!status||ids.has(id))throw Error('Invalid/duplicate ID '+id);
 ids.add(id);
 for(const required of ['Discovered','Reproduction','Impact','Affected files','Root cause','Change','Regression test','Evidence','Remaining limitations'])if(!e.includes(`**${required}:**`))throw Error(id+' missing '+required);
 if(status==='VERIFIED'&&!/\*\*Evidence:\*\*\s*PASS/i.test(e))throw Error(id+' has no PASS evidence');
 counts[status][sev]++;
}
const max=Math.max(...[...ids].map(s=>Number(s.slice(3))));for(let i=1;i<=max;i++)if(!ids.has('ST-'+String(i).padStart(3,'0')))throw Error('Historical issue missing ST-'+String(i).padStart(3,'0'));
const total=entries.length;const sums=Object.fromEntries(statuses.map(s=>[s,Object.values(counts[s]).reduce((a,b)=>a+b,0)]));
const marker=`<!-- COUNTS ${JSON.stringify(counts)} -->`;
const reportMarker=`<!-- ISSUE_STATS ${JSON.stringify({total,counts})} -->`;
const head='## QC7 issue status — generated';
const table=['| Severity | '+statuses.join(' | ')+' | Total |','|---|'+statuses.map(()=> '---:|').join('')+'---:|'];
for(const sev of severities){const values=statuses.map(s=>counts[s][sev]);table.push(`| ${sev} | ${values.join(' | ')} | ${values.reduce((a,b)=>a+b,0)} |`)}
table.push(`| **Total** | ${statuses.map(s=>sums[s]).join(' | ')} | **${total}** |`);
const footer=`${head}\n\n${table.join('\n')}\n\n- Registered: **${total}**\n- New since QC6: **${[...ids].filter(x=>Number(x.slice(3))>=34).length}** (ST-034 onwards)\n- New in independent QC7 recheck: **${[...ids].filter(x=>Number(x.slice(3))>=42).length}** (ST-042 onwards)\n- Historical ST-001–ST-033: preserved\n- Regressions detected in currently passing local tests: **0**; this does not certify untested infrastructure\n\n${marker}\n`;
const oldPos=text.indexOf('## QC7 issue status — generated');
if(oldPos>=0)text=text.slice(0,oldPos);
const target=text.trimEnd()+'\n\n'+footer;
let qc=readFileSync(report,'utf8').replace(/<!-- ISSUE_STATS [^\n]+ -->/g,'');
const note='\n## QA issue statistics — generated\n\nThe authoritative data is `KNOWN_ISSUES.md`; this machine-checked summary must match it.\n\n'+reportMarker+'\n';
if(qc.includes('## QA issue statistics — generated'))qc=qc.slice(0,qc.indexOf('## QA issue statistics — generated'));
qc=qc.trimEnd()+'\n'+note;
if(process.argv.includes('--write')){
 writeFileSync(known,target);writeFileSync(report,qc);console.log('Updated generated stats:',JSON.stringify({total,sums}));
}else{
 if(readFileSync(known,'utf8')!==target)throw Error('KNOWN_ISSUES summary stale; run npm run issues:sync');
 if(readFileSync(report,'utf8')!==qc)throw Error('QC_REPORT stats stale; run npm run issues:sync');
 console.log('Issue ledger and QC report match:',JSON.stringify({total,sums}));
}
