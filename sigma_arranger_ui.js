/* Interactive 'Arranger sangen' panel. The SSEQ used for full preview is the
 * same immutable Uint8Array returned on acceptance for publication.
 */
(function(root,factory){root.SigmaArrangeUI=factory();})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=s=>(Number(s)||0).toFixed(2)+'s';
const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const pitchName=n=>names[n%12]+(Math.floor(n/12)-1);
function mount(element,{model,sourceFile,profiles,slot,mode='auto',loop=true,onAccept,onCancel}){
 const A=window.SigmaArranger,S=window.SigmaSSEQ;
 let state=A.create(model,{mode,slot});state.loopExport=!!loop;
 let preview=new window.SigmaSeqAudio();preview.slot=slot;
 const sourceUrl=URL.createObjectURL(sourceFile),original=new Audio(sourceUrl);
 let currentUrl=null,cached=null,disposed=false,interval=null,playMode='sseq';
 const time=Math.max(.5,state.sourceDuration||2);
 // Short songs retain the original whole-song review. Long recordings use
 // a navigable 15-second edit/listen window, while export always keeps ALL
 // notes and the full song timeline (including the remaining ~285 seconds).
 const longSong=time>30;const windowSeconds=15;
 state.rangeEnd=longSong?Math.min(time,windowSeconds):time;
 function stop(){if(interval){clearInterval(interval);interval=null;}preview.pause();original.pause();}
 function destroy(){if(disposed)return;disposed=true;stop();preview.dispose();if(currentUrl)URL.revokeObjectURL(currentUrl);URL.revokeObjectURL(sourceUrl);}
 function notify(msg,error=false){const field=element.querySelector('#arrangeStatus');if(field){field.textContent=msg;field.dataset.error=error?'true':'false';}}
 function current(){if(!cached)cached=A.build(state,{profiles,slot,loop:state.loopExport});return cached;}
 function previewUrl(bytes){if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));return currentUrl;}
 function compatible(part){const notes=A.visibleNotes(part);const ctx=S.profileSlot(profiles,slot);return A.supportedPrograms(ctx,notes.length?notes:part.notes,S)}
 function programSelect(part){const programs=compatible(part),options=[`<option value="auto"${part.program==='auto'?' selected':''}>Auto · program ${programs[0]??'?'}</option>`];
  for(const p of programs)options.push(`<option value="${p}"${String(part.program)===String(p)?' selected':''}>Program ${p}</option>`);
  // Do not silently substitute an invalid user selection when filtering changes.
  if(part.program!=='auto'&&!programs.includes(Number(part.program)))options.push(`<option value="${part.program}" selected>⚠ Program ${part.program} · outside key range</option>`);
  return options.join('');}
 function noteRows(part){
  const from=state.rangeStart,to=state.rangeEnd,span=Math.max(.05,to-from);
  const excluded=new Set(part.excluded);
  const inWindow=part.notes.filter(n=>n.start/96<to&&(n.start+n.duration)/96>from);
  // 240 interactive notes per part bounds mobile DOM size; zoom to a
  // smaller interval to inspect exceptional high-density passages.
  const displayed=inWindow.slice(0,240);
  const bars=displayed.map(n=>{
   const left=Math.max(0,Math.min(99,((n.start/96-from)/span)*100));
   const right=Math.min(100,((n.start+n.duration)/96-from)/span*100);
   const width=Math.max(.6,Math.min(100-left,right-left));
   return `<button type="button" class="arrange-note${excluded.has(n.id)?' excluded':''}" data-note="${esc(n.id)}" data-part="${part.id}" title="${pitchName(n.pitch)} · ${pad(n.start/96)} · ${pad(n.duration/96)}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%">${pitchName(n.pitch)}</button>`;
  }).join('');
  const visible=A.visibleNotes(part).length;
  const extra=inWindow.length-displayed.length;
  return `<div class="arrange-timeline" role="group" aria-label="Toner i ${esc(part.label)} fra ${pad(from)} til ${pad(to)}">${bars}</div><small>${visible}/${part.notes.length} toner valgt i hele sangen · ${inWindow.length} i vist tidsrom${extra>0?' · '+extra+' skjult for ytelse; velg kortere tidsrom':''} · trykk på en tone for å utelate bare dette anslaget</small>`;
 }
 function partHTML(part){const selected=A.visibleNotes(part);
  return `<section class="arrange-part" data-part-card="${part.id}"><div class="arrange-part-title"><strong>${esc(part.label)}</strong><span>${selected.length} noter</span></div>
  <div class="arrange-controls"><label><input type="checkbox" data-setting="included" data-part="${part.id}"${part.included?' checked':''}> Ta med i sangen</label>
  <button class="btn small" type="button" data-preview-part="${part.id}">▶ Hør alene</button><label><input type="checkbox" data-setting="solo" data-part="${part.id}"${part.solo?' checked':''}> Solo i prøvelytting</label>
  <label>Instrument <select data-setting="program" data-part="${part.id}" aria-label="Instrument ${esc(part.label)}">${programSelect(part)}</select></label>
  <label>Volum <input type="range" min="1" max="200" step="5" value="${part.volume}" data-setting="volume" data-part="${part.id}"> <output>${part.volume}%</output></label>
  <label>Tonestøtte <select data-setting="filter" data-part="${part.id}"><option value="safe"${part.filter==='safe'?' selected':''}>Bare sikre toner</option><option value="balanced"${part.filter==='balanced'?' selected':''}>Balansert</option><option value="more"${part.filter==='more'?' selected':''}>Ta med flere mulige toner</option></select></label>
  </div>${noteRows(part)}<div class="arrange-note-detail" id="arrangeDetail${part.id}"></div>
  <button class="btn small" type="button" data-undo="${part.id}"${part.excluded.length?'':' disabled'}>↶ Angre utelatelse</button></section>`;
 }
 function render(){const summary=state.parts.map(p=>A.visibleNotes(p).length).reduce((a,b)=>a+b,0);
  element.innerHTML=`<div class="arrange-heading"><p>Kun en validert SSEQ publiseres. Alle endringer gjelder bare denne sangen.</p>
  <label>Forslag <select id="arrangeMode"><option value="auto"${mode==='auto'?' selected':''}>Auto</option><option value="melody"${mode==='melody'?' selected':''}>Kun melodi</option><option value="melody-chords"${mode==='melody-chords'?' selected':''}>Melodi med akkompagnement</option></select></label>
  <span>${state.parts.length} deler · ${summary} valgte noter · ${pad(time)} kilde · slot ${slot}</span></div>
  <div class="arrange-part-list">${state.parts.map(partHTML).join('')}</div>
  <section class="arrange-section"><h3>Prøvelytting og sammenligning</h3><p>Velg et tidsrom. Notefeltene ovenfor viser bare dette utsnittet; <strong>hele sangen eksporteres</strong>. Lytteløkken endrer aldri sangens eksporterte loop.</p>
   <div class="arrange-play-actions"><button class="btn small" type="button" id="arrangePrevious"${state.rangeStart<=0?' disabled':''}>◀ Forrige 15 s</button><strong id="arrangeWindowLabel">Viser ${pad(state.rangeStart)}–${pad(state.rangeEnd)} av ${pad(time)}</strong><button class="btn small" type="button" id="arrangeNext"${state.rangeEnd>=time?' disabled':''}>Neste 15 s ▶</button></div>
   <div class="arrange-range"><label>Fra <input id="arrangeFrom" type="number" min="0" max="${time}" step="0.05" value="${state.rangeStart.toFixed(2)}"></label>
   <label>Til <input id="arrangeTo" type="number" min="0.05" max="${time}" step="0.05" value="${state.rangeEnd.toFixed(2)}"></label>
   <label><input type="checkbox" id="arrangeListenLoop"${state.loopPreview?' checked':''}> Gjenta lyttetidsrommet</label>
   <label><input type="checkbox" id="arrangeGameLoop"${state.loopExport?' checked':''}> Loop i eksportert spillfil</label></div>
   <div class="arrange-play-actions"><button class="btn" type="button" id="arrangeOriginal">▶ Original</button><button class="btn" type="button" id="arrangeSseq">▶ SSEQ fra samme tidspunkt</button><button class="btn" type="button" id="arrangeFull">▶ Spill hele sangen (publiserte bytes)</button><button class="btn" type="button" id="arrangeStop">■ Stopp</button></div>
   <p class="hint">Når original SBNK/SWAR ikke er importert, er instrumentlyden en syntetisk tilnærming. Tone- og rytmevalgene lagres i SSEQ.</p></section>
  <div class="arrange-footer"><p class="hint" id="arrangeStatus" role="status">Auto er klart. Du kan godta forslaget umiddelbart eller redigere notene først.</p>
  <button class="btn primary" type="button" id="arrangeAccept">✓ Godta og publiser validert SSEQ</button> <button class="btn" type="button" id="arrangeCancel">Avbryt</button></div>`;
  hook();}
 function changeMode(next){mode=next;const kept=state;state=A.create(model,{mode:next,slot});state.loopExport=kept.loopExport;state.loopPreview=kept.loopPreview;state.rangeStart=kept.rangeStart;state.rangeEnd=kept.rangeEnd;cached=null;stop();render();notify('Forslaget er oppdatert. Tidligere manuelle endringer i dette forslaget er nullstilt.');}
 function mutate(partId,field,value){try{A.update(state,partId,field,value);cached=null;stop();render();}catch(e){notify(e.message,true)}}
 function selectNote(partId,id){const part=state.parts.find(p=>p.id===partId),note=part?.notes.find(n=>n.id===id);if(!note)return;
  const field=element.querySelector('#arrangeDetail'+partId);if(!field)return;
  field.innerHTML=`<strong>${pitchName(note.pitch)} (MIDI ${note.pitch})</strong> · anslag ${pad(note.start/96)}, varighet ${pad(note.duration/96)} · støtte ${(note.confidence*100).toFixed(0)}% (heuristisk, ikke kalibrert sannsynlighet) <button type="button" class="btn small" data-exclude="${esc(note.id)}" data-part="${partId}">Utelat tone</button>`;
  field.querySelector('[data-exclude]').onclick=()=>mutate(partId,'exclude',id);
 }
 function play(partId=null,originalMode=false,whole=false){
  stop();try{
   const start=whole?0:state.rangeStart,end=whole?state.sourceDuration:state.rangeEnd;
   if(originalMode){playMode='original';original.currentTime=start;const promise=original.play();promise.catch(e=>notify('Original playback: '+e.message,true));}
   else{playMode='sseq';const result=partId?A.build(state,{profiles,slot,loop:false,partId}):!whole&&state.parts.some(p=>p.solo)?A.build(state,{profiles,slot,loop:false,previewSolo:true}):current();
    preview.src=previewUrl(result.bytes);preview.slot=slot;preview.primeFromGesture();
    void preview.load().then(()=>{preview.currentTime=start;return preview.play({primed:true})}).catch(e=>notify('SSEQ preview: '+e.message,true));}
   notify('Lytter fra '+pad(start)+' til '+pad(end)+(originalMode?' · Original':' · SSEQ'));
   interval=setInterval(()=>{
    const now=originalMode?original.currentTime:preview.currentTime;
    if(now>=end-.025){if(state.loopPreview&&!whole){if(originalMode){original.currentTime=start;void original.play().catch(()=>{});}else{preview.currentTime=start;}}
     else stop();}
   },80);
  }catch(e){notify('Kan ikke prøvelytte: '+e.message,true)}
 }
 function hook(){
  element.querySelector('#arrangeMode').onchange=e=>changeMode(e.target.value);
  function shiftWindow(direction){const width=Math.min(windowSeconds,time),start=Math.max(0,Math.min(time-width,state.rangeStart+direction*width));
   state.rangeStart=start;state.rangeEnd=Math.min(time,start+width);stop();render();}
  element.querySelector('#arrangePrevious').onclick=()=>shiftWindow(-1);
  element.querySelector('#arrangeNext').onclick=()=>shiftWindow(1);
  element.querySelectorAll('[data-setting]').forEach(el=>{
   const field=el.dataset.setting;
   el.addEventListener(field==='volume'?'change':'change',()=>mutate(el.dataset.part,field,(field==='included'||field==='solo')?el.checked:el.value));
  });
  element.querySelectorAll('[data-preview-part]').forEach(el=>el.onclick=()=>play(el.dataset.previewPart));
  element.querySelectorAll('[data-note]').forEach(el=>el.onclick=()=>selectNote(el.dataset.part,el.dataset.note));
  element.querySelectorAll('[data-undo]').forEach(el=>el.onclick=()=>mutate(el.dataset.undo,'undo',null));
  element.querySelector('#arrangeFrom').onchange=e=>{state.rangeStart=Math.max(0,Math.min(time-.05,Number(e.target.value)||0));state.rangeEnd=Math.max(state.rangeStart+.05,state.rangeEnd);render()};
  element.querySelector('#arrangeTo').onchange=e=>{state.rangeEnd=Math.max(state.rangeStart+.05,Math.min(time,Number(e.target.value)||time));render()};
  element.querySelector('#arrangeListenLoop').onchange=e=>{state.loopPreview=e.target.checked};
  element.querySelector('#arrangeGameLoop').onchange=e=>{state.loopExport=e.target.checked;cached=null;stop()};
  element.querySelector('#arrangeOriginal').onclick=()=>play(null,true);
  element.querySelector('#arrangeSseq').onclick=()=>play();
  element.querySelector('#arrangeFull').onclick=()=>play(null,false,true);
  element.querySelector('#arrangeStop').onclick=stop;
  element.querySelector('#arrangeCancel').onclick=()=>{destroy();onCancel?.()};
  element.querySelector('#arrangeAccept').onclick=()=>{try{const converted=current();destroy();onAccept(converted);}catch(e){notify(e.message,true)}};
 }
 render();return {destroy,getState:()=>state,getExport:()=>current()};
}
return {mount};
});
