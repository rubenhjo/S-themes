/** Offline reference validator for the versioned Sigma Dex import package. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const file=process.argv[2];if(!file){console.error('Usage: node scripts/validate-sigma-dex-pack.mjs <path-to-zip>');process.exit(2)}
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ctx={Blob,TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView,Float32Array,crypto:webcrypto,console,Math,Date,Promise,Map,Set,Error,Number,String,Object,Array};ctx.globalThis=ctx;
for(const file of ['ds_audio.js','sseq_codec.js','sigma_dex_export.js'])runInNewContext(readFileSync(resolve(base,file),'utf8'),ctx);
ctx.SigmaBankProfiles=JSON.parse(readFileSync(resolve(base,'heartgold_bank_profiles.json')));
try{
 const fileBlob=new Blob([readFileSync(resolve(file))]);
 const result=await ctx.SigmaDexExport.verifyPackage(fileBlob);
 console.log('PASS Sigma Dex import package:',JSON.stringify(result));
}catch(e){console.error('FAIL Sigma Dex import package:',e.message);process.exitCode=1}
