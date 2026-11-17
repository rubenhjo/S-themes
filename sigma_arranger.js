/* sigma-themes: non-destructive, song-local note arrangement.
 * Source recordings remain in memory; only validated SSEQ is exportable.
 * Five editable PARTS are not a five-note or five-voice restriction.
 */
(function(root,factory){const value=factory();root.SigmaArranger=value;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const MODES=['auto','melody','melody-chords'];
const LABELS={melody:'Melodi',bass:'Bass',chords:'Akkorder',counter:'Motmelodi',rhythm:'Rytme'};
const FILTERS={safe:.84,balanced:.52,more:.25};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function timedNote(n){return {pitch:Number(n.pitch),start:Number(n.startTick??n.start),duration:Number(n.durationTick??n.duration),velocity:Number(n.velocity??90),confidence:clamp(Number(n.confidence??.72),0,1)};}
function create(model,{mode='auto',slot=1028}={}){
 if(!MODES.includes(mode))throw Error('Unknown arrangement mode');
 const events=[];
 for(let v=0;v<(model?.voices||[]).length;v++)for(const source of model.voices[v]){
  const n=timedNote(source);
  if(!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127||!Number.isInteger(n.start)||n.start<0||!Number.isInteger(n.duration)||n.duration<1)throw Error('Invalid transcribed note');
  events.push({...n,id:'note-'+events.length,originVoice:v});
 }
 if(!events.length)throw Error('No usable notes in recording');
 // Low-confidence candidates may be surfaced on the 'more' slider, never
 // silently mixed into the initial Auto recommendation.
 const suggestions=[];
 for(const lane of model.candidateVoices||[])for(const source of lane){const n=timedNote(source);
  if(n.pitch>=0&&n.pitch<=127&&Number.isInteger(n.start)&&n.start>=0&&Number.isInteger(n.duration)&&n.duration>=1)
   suggestions.push({...n,id:'maybe-'+suggestions.length,originVoice:-1,confidence:Math.min(.48,n.confidence)});
 }
 events.sort((a,b)=>a.start-b.start||a.pitch-b.pitch||a.id.localeCompare(b.id));
 // Retain stable NOTE ids (not MIDI pitch ids): excluding one C4 must not exclude another C4.
 const pitchSpan=Math.max(...events.map(e=>e.pitch))-Math.min(...events.map(e=>e.pitch));
 // A five-minute recording can contain thousands of note events. Count
 // overlapping intervals with an end-time min-heap (O(n log n)), never an
 // every-note-versus-every-note comparison on the UI thread (O(n²)).
 const activeEnds=[];
 function pushEnd(end){let i=activeEnds.length;activeEnds.push(end);
  while(i>0){const parent=(i-1)>>1;if(activeEnds[parent]<=end)break;
   activeEnds[i]=activeEnds[parent];i=parent;}activeEnds[i]=end;}
 function popEnd(){const last=activeEnds.pop();if(!activeEnds.length)return;
  let i=0;while(i*2+1<activeEnds.length){let child=i*2+1;
   if(child+1<activeEnds.length&&activeEnds[child+1]<activeEnds[child])child++;
   if(activeEnds[child]>=last)break;activeEnds[i]=activeEnds[child];i=child;
  }activeEnds[i]=last;}
 let maxConcurrency=0;
 for(const event of events){while(activeEnds.length&&activeEnds[0]<=event.start)popEnd();
  pushEnd(event.start+event.duration);maxConcurrency=Math.max(maxConcurrency,activeEnds.length);}
 const groups=new Map();
 function put(kind,n){if(!groups.has(kind))groups.set(kind,[]);groups.get(kind).push(n)}
 if(maxConcurrency===1){for(const n of events)put('melody',n)}
 else if(mode==='melody'){const upper=Math.max(...events.map(n=>n.pitch));for(const n of events)if(n.pitch>=upper-12)put('melody',n)}
 else {
  // Long overlapping chord tones must not disguise a later melody as one huge
  // block chord. Only a near-simultaneous onset cluster is a dense chord.
  const onsetSpread=Math.max(...events.map(n=>n.start))-Math.min(...events.map(n=>n.start));
  const denseChord=maxConcurrency>=6&&events.length<=maxConcurrency+1&&onsetSpread<=7;
  for(const n of events){
   let kind='chords';
   if(!denseChord){
    if(pitchSpan>=14&&n.pitch<=51)kind='bass';
    else if(n.pitch>=64)kind='melody';
    else kind='chords';
   }
   put(kind,n);
  }
 }
 const order=['melody','bass','chords','counter','rhythm'];
 // Candidate tones are attributed to an EXISTING part so filtering a
 // bass part cannot unexpectedly change melody or create a new ghost part.
 for(const n of suggestions){
  const role=n.pitch<=51&&groups.has('bass')?'bass':n.pitch>=64&&groups.has('melody')?'melody':groups.has('chords')?'chords':groups.has('melody')?'melody':order.find(k=>groups.has(k));
  if(role)groups.get(role).push(n);
 }
 const parts=order.filter(k=>groups.has(k)).map((role,i)=>({
  id:'part-'+i,role,label:LABELS[role],notes:groups.get(role),included:true,solo:false,
  program:'auto',volume:100,filter:'balanced',excluded:[],
 }));
 return {sourceDuration:Number(model.sourceDuration??model.durationSeconds??0),slot:Number(slot),mode,parts,loopExport:true,
  loopPreview:false,rangeStart:0,rangeEnd:Math.max(.25,Number(model.sourceDuration??model.durationSeconds??0)),tempo:120,
  originalNoteCount:events.length,undo:[]};
}
function visibleNotes(part,{ignoreFilter=false,ignoreIncluded=false}={}){
 if(!part?.included&&!ignoreIncluded)return [];
 const excluded=new Set(part.excluded||[]),minimum=ignoreFilter?0:(FILTERS[part.filter]??FILTERS.balanced);
 return part.notes.filter(n=>!excluded.has(n.id)&&n.confidence>=minimum);
}
function update(state,partId,field,value){
 const part=state.parts.find(p=>p.id===partId);if(!part)throw Error('Unknown arrangement part');
 if(field==='exclude'){
  const id=String(value),note=part.notes.find(n=>n.id===id);if(!note)throw Error('Unknown note');
  if(!part.excluded.includes(id)){part.excluded.push(id);state.undo.push({partId,id});}
  return state;
 }
 if(field==='undo'){
  const i=state.undo.map(x=>x.partId).lastIndexOf(partId);
  if(i>=0){const [entry]=state.undo.splice(i,1);part.excluded=part.excluded.filter(x=>x!==entry.id)}
  return state;
 }
 if(field==='filter'&&!Object.hasOwn(FILTERS,value))throw Error('Invalid note support filter');
 if(field==='volume'&&(!Number.isFinite(Number(value))||Number(value)<1||Number(value)>200))throw Error('Part volume must be between 1 and 200%');
 if(field==='program'&&value!=='auto'&&(!Number.isInteger(Number(value))||Number(value)<0||Number(value)>127))throw Error('Invalid HeartGold program');
 if(!['included','solo','filter','volume','program'].includes(field))throw Error('Invalid arranger setting');
 part[field]=field==='volume'?Number(value):field==='program'&&value!=='auto'?Number(value):value;
 return state;
}
function supportedPrograms(context,notes,S){
 // Key-range compatibility only depends on distinct pitches, not how many
 // times a note repeats. Do not recheck thousands of identical pitches for
 // every instrument every time the five-minute editor redraws.
 const pitches=[...new Set(notes.map(n=>n.pitch))];
 return context.bank.programs.filter(p=>pitches.every(pitch=>{
  try{S.validProgram(context,p.index,pitch);return true}catch{return false}
 })).map(p=>p.index);
}
function invalidPitches(context,program,notes,S){return [...new Set(notes.filter(n=>{try{S.validProgram(context,program,n.pitch);return false}catch{return true}}).map(n=>n.pitch))].sort((a,b)=>a-b)}
function build(state,{profiles,slot=state.slot,loop=state.loopExport,partId=null,previewSolo=false}={}){
 const S=(typeof window!=='undefined'?window.SigmaSSEQ:globalThis.SigmaSSEQ);
 if(!S)throw Error('Missing SSEQ serializer');
 const context=S.profileSlot(profiles,slot),tracks=[],detail=[];
 for(const part of state.parts){
  if(partId!==null&&part.id!==partId)continue;
  if(partId===null&&!part.included)continue;
  if(partId===null&&previewSolo&&state.parts.some(p=>p.solo)&&!part.solo)continue;
  const notes=visibleNotes(part,{ignoreIncluded:partId!==null});
  if(!notes.length)continue;
  const candidates=supportedPrograms(context,notes,S);
  if(!candidates.length)throw Error('No valid instrument covers every note in '+part.label);
  const program=part.program==='auto'?candidates[0]:Number(part.program);
  const bad=invalidPitches(context,program,notes,S);
  if(bad.length)throw Error(part.label+': instrument '+program+' cannot play MIDI notes '+bad.join(', ')+'. Select a compatible program.');
  tracks.push({program,notes:notes.map(n=>({start:n.start,duration:n.duration,pitch:n.pitch,velocity:clamp(Math.round(n.velocity*part.volume/100),1,127)}))});
  detail.push({partId:part.id,role:part.role,program,noteIds:notes.map(n=>n.id)});
 }
 if(!tracks.length)throw Error('No notes selected for the final SSEQ');
 if(tracks.length>16)throw Error('More than 16 sequencer tracks');
 const bytes=S.build({tracks,slot,profiles,tempo:state.tempo||120,loop:!!loop,limit:65536});
 const parsed=S.parse(bytes,{profiles,slot});
 const expected=tracks.reduce((n,t)=>n+t.notes.length,0);
 if(parsed.notes.length!==expected)throw Error('A note was lost during SSEQ export');
 return {bytes,parsed,tracks,detail,slot,method:'User-reviewed song arrangement',sourceDuration:state.sourceDuration,
  notes:expected,byteSize:bytes.byteLength};
}
return {create,visibleNotes,update,build,supportedPrograms,invalidPitches,FILTERS,MODES};
});
