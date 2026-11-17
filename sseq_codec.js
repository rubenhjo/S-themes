/* sigma-themes Nitro SSEQ 1.0 reader/writer: strict supported subset.
 * Header and commands cross-checked against ndspy.soundSequence documentation.
 * A SSEQ file does NOT embed a SBNK ID: bank selection belongs to the SDAT sequence slot.
 * This module deliberately rejects unknown events, rather than 'validating' opaque bytes.
 */
(function(root,factory){const x=factory();if(typeof module!=='undefined'&&module.exports)module.exports=x;root.SigmaSSEQ=x;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const u16=(b,o)=>b[o]|(b[o+1]<<8), u24=(b,o)=>b[o]|(b[o+1]<<8)|(b[o+2]<<16),u32=(b,o)=>(b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0;
const word=(arr,value)=>{arr.push(value&255,value>>>8&255)};
const dword=(arr,value)=>{arr.push(value&255,value>>>8&255,value>>>16&255,value>>>24&255)};
const bytes=s=>[...s].map(c=>c.charCodeAt(0));
function asBytes(data){if(data instanceof Uint8Array)return data;if(data instanceof ArrayBuffer)return new Uint8Array(data);if(typeof Buffer!=='undefined'&&Buffer.isBuffer(data))return new Uint8Array(data);throw Error('Expected binary SSEQ');}
function vlq(n){if(!Number.isSafeInteger(n)||n<0||n>0x0fffffff)throw Error('Invalid SSEQ variable-length integer');const parts=[n&127];while((n>>=7)>0)parts.unshift((n&127)|128);return parts;}
function readVLQ(b,p,end){let value=0,n=0;do{if(p.i>=end||++n>4)throw Error('Truncated SSEQ variable-length integer');const c=b[p.i++];value=(value<<7)|(c&127);if(!(c&128))return value;}while(true)}
function profileSlot(profiles,slot){const item=profiles?.sequence_slots?.[String(slot)];if(!item)throw Error('Unknown HeartGold music slot: '+slot);const bank=profiles.banks?.[String(item.bank)];if(!bank)throw Error('Missing instrument bank for slot '+slot);return {slot:Number(slot),symbol:item.name,bankId:Number(item.bank),bank,player:item.player};}
function validProgram(context,program,pitch=null){
 const item=context.bank.programs.find(p=>p.index===program);
 if(!Number.isInteger(program)||program<0||program>127||!item)
  throw Error('Instrument '+program+' is not defined in HeartGold bank '+context.bankId);
 if(pitch!==null && item.pitch_ranges && !item.pitch_ranges.some(([low,high])=>pitch>=low&&pitch<=high))
  throw Error('Instrument '+program+' cannot play note '+pitch+' with valid samples in HeartGold bank '+context.bankId);
 return program;
}
function build({tracks,slot,profiles,tempo=120,loop=false,limit=65536,endTick=null}){
 const location=profileSlot(profiles,slot);
 if(!Number.isInteger(tempo)||tempo<30||tempo>300)throw Error('Tempo outside 30–300 BPM');
 if(!Array.isArray(tracks)||tracks.length<1||tracks.length>16)throw Error('1–16 sequencer tracks supported');
 const seq=[]; const origins=[];
 const fullLength=Math.max(0,...tracks.flatMap(tr=>(tr.notes||[]).map(n=>n.start+n.duration)));
 if(endTick!==null&&(!Number.isSafeInteger(endTick)||endTick<fullLength))throw Error('End tick precedes a sounding note');
 const songEnd=endTick??fullLength;
 const mask=(1<<tracks.length)-1;
 if(tracks.length>1){seq.push(0xfe,mask&255,mask>>>8&255);for(let k=1;k<tracks.length;k++){seq.push(0x93,k,0,0,0);origins.push(seq.length-3)}}
 const trackOffsets=[];let allNotes=0;
 for(let index=0;index<tracks.length;index++){
  const track=tracks[index];validProgram(location,track.program);trackOffsets[index]=seq.length;
  const notes=(track.notes||[]).map(n=>({...n})).sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
  if(!notes.length && index===0 && tracks.length===1)throw Error('Empty SSEQ track');
  if(index===0)seq.push(0xe1,tempo&255,tempo>>>8&255);
  seq.push(0x81,...vlq(track.program));
  seq.push(0xc7,0); // Nitro 0=POLY (1=MONO); rests control onsets independently.
  if(loop)seq.push(0xd4,0); // 0 = infinite repeat of loop area, see Nitro SSEQ.
  let tick=0;
  for(const note of notes){
   if(!Number.isInteger(note.start)||note.start<0||!Number.isInteger(note.duration)||note.duration<1||!Number.isInteger(note.pitch)||note.pitch<0||note.pitch>127)throw Error('Invalid note timing or pitch');
   validProgram(location,track.program,note.pitch);
   if(note.start<tick)throw Error('Note onsets within a track must increase (use multiple tracks)');
   if(note.start>tick)seq.push(0x80,...vlq(note.start-tick));
   const vel=Math.round(note.velocity??96);if(vel<1||vel>127)throw Error('Invalid note velocity');
   seq.push(note.pitch,vel,...vlq(note.duration));tick=note.start;
   allNotes++;if(allNotes>30000)throw Error('Too many notes');
  }
  // Let the last sounding note finish before ending or looping.
  const total=songEnd; // Every track loops at the same musical boundary, including early-ending voices.
  if(total>tick)seq.push(0x80,...vlq(total-tick));
  if(loop)seq.push(0xfc);
  seq.push(0xff);
 }
 if(!allNotes)throw Error('Empty SSEQ: no musical notes');
 for(let k=1;k<tracks.length;k++){
  const o=origins[k-1],v=trackOffsets[k];seq[o]=v&255;seq[o+1]=v>>>8&255;seq[o+2]=v>>>16&255;
 }
 const result=Uint8Array.from([...bytes('SSEQ'),0xff,0xfe,0,1,0,0,0,0,0x10,0,1,0,...bytes('DATA'),0,0,0,0,0x1c,0,0,0,...seq]);
 const size=result.length,view=new DataView(result.buffer);view.setUint32(8,size,true);view.setUint32(20,size-16,true);
 if(size>limit)throw Error('SSEQ '+size+' bytes exceeds the '+limit+'-byte limit');
 return result;
}
function parse(buffer,{profiles=null,slot=null,maxBytes=262144}={}){
 const b=asBytes(buffer);if(b.length<30||b.length>maxBytes)throw Error('SSEQ size invalid or exceeds limit');
 if(String.fromCharCode(...b.slice(0,4))!=='SSEQ'||u16(b,4)!==0xfeff||u16(b,6)!==0x100||u32(b,8)!==b.length||u16(b,12)!==16||u16(b,14)!==1)throw Error('Invalid Nitro SSEQ header');
 if(String.fromCharCode(...b.slice(16,20))!=='DATA'||u32(b,20)!==b.length-16||u32(b,24)!==28)throw Error('Invalid Nitro SSEQ DATA block');
 const start=28,len=b.length-28;
 let starts=[0],offset=0,defines=false;
 if(b[start]===0xfe){
  if(len<4)throw Error('Truncated track definition');
  const mask=u16(b,start+1);if(!(mask&1))throw Error('Track zero must be included');
  defines=true;offset=3;starts=[-1];let guard=0;
  while(b[start+offset]===0x93){
   const trackId=b[start+offset+1],dest=u24(b,start+offset+2);
   if(dest>=len||trackId>15||!((mask>>trackId)&1)||starts[trackId]!==undefined)throw Error('Invalid SSEQ track pointer');
   starts[trackId]=dest;offset+=5;if(++guard>15)throw Error('Too many tracks');
  }
  starts[0]=offset;
  if(starts.filter(v=>v!==undefined).length!==((mask.toString(2).match(/1/g))||[]).length)throw Error('SSEQ track mask mismatch');
 }
 let globalTempo=120;const tracks=[], all=[];let infinite=false;
 for(const [trackId,source] of starts.entries()){
  if(source===undefined||source<0)continue;
  const notes=[];let tick=0,pos=start+source,program=0,poly=false,ended=false,steps=0,loopStart=-1,loopStartTick=0,loopEnd=-1;
  while(pos<b.length){
   if(++steps>120000)throw Error('SSEQ execution budget exceeded');const cmd=b[pos++];
   if(cmd<128){if(pos>=b.length)throw Error('Truncated note');const velocity=b[pos++];const p={i:pos};const duration=readVLQ(b,p,b.length);pos=p.i;if(!velocity||!duration)throw Error('Silent or zero-duration note');notes.push({track:trackId,start:tick,duration,pitch:cmd,velocity,program});if(!poly)tick+=duration;}
   else if(cmd===0x80||cmd===0x81){const p={i:pos};const val=readVLQ(b,p,b.length);pos=p.i;if(cmd===0x80)tick+=val;else {const id=val&127; if(val>>>7!==0)throw Error('Unsupported bank-relative instrument code');program=id;} }
   else if(cmd===0xc7){if(pos>=b.length||b[pos]>1)throw Error('Invalid mono/poly mode');poly=b[pos++]===0;}
   else if((cmd>=0xc0&&cmd<=0xd3)||cmd===0xd5||cmd===0xd6||cmd===0xe0){if(pos>=b.length)throw Error('Truncated sequence control');pos++;}
   else if(cmd===0xe1){if(pos+1>=b.length)throw Error('Truncated tempo');const v=u16(b,pos);pos+=2;if(v<1||v>1000)throw Error('Invalid tempo');if(trackId===0)globalTempo=v;}
   else if(cmd===0xd4){if(pos>=b.length||loopStart>=0)throw Error('Invalid nested SSEQ loop');const times=b[pos++];loopStart=pos;loopStartTick=tick;if(times===0)infinite=true;}
   else if(cmd===0xfc){if(loopStart<0)throw Error('SSEQ loop end without begin');loopEnd=pos;loopStart=-1;}
   else if(cmd===0x94){if(pos+2>=b.length)throw Error('Truncated jump');const target=u24(b,pos);if(target>=len)throw Error('SSEQ jump out of bounds');infinite=true;ended=true;break;}
   else if(cmd===0xff){ended=true;break;}
   else throw Error('Unsupported SSEQ command: 0x'+cmd.toString(16)+' at offset '+(pos-1));
   if(tick>48*60*180)throw Error('SSEQ exceeds 3-hour timeline');
  }
  if(!ended)throw Error('Unterminated SSEQ track '+trackId);
  tracks.push({track:trackId,notes,loopStartTick,loopEndTick:loopEnd>=0?tick:null,endTick:tick});all.push(...notes);
 }
 if(!all.length)throw Error('SSEQ contains no playable notes');
 if(profiles && slot!==null){const context=profileSlot(profiles,slot);for(const n of all)validProgram(context,n.program,n.pitch);}
 return {tracks,notes:all,tempo:globalTempo,durationTicks:Math.max(...tracks.map(t=>t.endTick),all.reduce((m,n)=>Math.max(m,n.start+n.duration),0)),infinite,bytes:b.length,slot};
}
return {build,parse,profileSlot,validProgram,asBytes,vlq};
});
