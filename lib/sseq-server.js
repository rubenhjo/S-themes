import {readFileSync} from 'node:fs';
import '../sseq_codec.js';
// No copyrighted bank samples or .sbnk are distributed with this metadata profile.
const profiles=JSON.parse(readFileSync(new URL('../heartgold_bank_profiles.json',import.meta.url),'utf8'));
export function parseSseq(data,slot,maxBytes=65536){
  if(!Number.isInteger(Number(slot)))throw Error('Missing HeartGold target slot');
  const out=globalThis.SigmaSSEQ.parse(data,{profiles,slot:Number(slot),maxBytes});
  if(out.notes.length<2)throw Error('SSEQ contains too few musical events');
  if(out.durationTicks<=0)throw Error('SSEQ has no duration');
  return out;
}
export function getProfile(slot){return globalThis.SigmaSSEQ.profileSlot(profiles,slot)}
export {profiles};
