/* Searchable and playable HeartGold bank/program catalogue.
 * Instrument previews use honest synthetic timbres: extracted profiles contain
 * SBNK types and ranges, but not the original SWAR sample bytes or ADSR records.
 */
(function(root){
'use strict';
const BANK_TITLES={
 700:'Core · shared game instruments',701:'Retro · Game Boy sound palette',
 702:'Johto · New Bark Town & routes',703:'Johto · Violet City & routes',
 704:'Johto · Azalea Town & routes',705:'Johto · Goldenrod City & routes',
 706:'Johto · Ecruteak City & routes',707:'Johto · Olivine & Cianwood',
 708:'Johto · Mahogany Town & routes',709:'Johto · Blackthorn City & routes',
 710:'Kanto · Viridian City & routes',711:'Kanto · Vermilion City & routes',
 712:'Kanto · Saffron City',713:'Kanto · Cerulean City & routes',
 714:'Kanto · Lavender Town & routes',715:'Kanto · Celadon City & routes',
 716:'Kanto · Fuchsia City & routes',717:'Kanto · Pewter City & routes',
 718:'Kanto · Pallet Town & Cinnabar',719:'Johto · Safari Zone',
 720:'Battle · Wild Pokémon & trainer',721:'Battle · Rival',
 722:'Battle · Champion',723:'Battle · Kanto trainers & Frontier',
 724:'Battle · Kanto Gym Leaders',725:'Battle · Legendary beasts',
 726:'Battle · Ho-Oh',727:'Battle · Lugia',
 728:'Exploration · Underground Passage',729:'Exploration · Sprout Tower',
 730:'Exploration · Burned & Bell Towers',731:'Exploration · Battle Tower',
 732:'Exploration · Parks & events',733:'Exploration · Lighthouse & Rock Tunnel',
 734:'Exploration · Ruins of Alph',735:'Exploration · Dragon’s Den & ship',
 736:'Exploration · Rocket Hideout',
 737:'Special · Title, intro & ending',738:'Special · Arceus event'
};
const TAGS={1:'PCM sample',2:'8-bit square wave',3:'Noise / percussion',16:'Drum / key-range kit',17:'Multisample / key split'};
const FAMILIES=[
 {min:700,max:700,title:'Core instruments',group:'Core'},
 {min:701,max:701,title:'Game Boy palette',group:'Retro'},
 {min:702,max:719,title:'Overworld / towns & routes',group:'Exploration'},
 {min:720,max:727,title:'Battle themes',group:'Battles'},
 {min:728,max:736,title:'Dungeons & special locations',group:'Dungeons'},
 {min:737,max:737,title:'Opening / ending themes',group:'Special'},
 {min:738,max:738,title:'Arceus event',group:'Special'}
];
const ESC={ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'};
const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>ESC[ch]);
const family=id=>FAMILIES.find(f=>id>=f.min&&id<=f.max)||FAMILIES[0];
const bankName=(id,bank)=>{if(BANK_TITLES[id])return BANK_TITLES[id];const f=family(+id),i=+id;
 if(i>=702&&i<=736)return `${f.title} ${String(i-f.min+1).padStart(2,'0')}`;
 return f.title;
};
const programType=kind=>TAGS[kind]||`Unknown SBNK type ${kind}`;
const rangeLabel=ranges=>ranges.map(([lo,hi])=>`${pitchName(lo)}–${pitchName(hi)} (${lo}–${hi})`).join(', ');
const pitchName=n=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][n%12]+(Math.floor(n/12)-1);
function slotsForBank(profiles,bankId){return Object.entries(profiles.sequence_slots).filter(([,slot])=>Number(slot.bank)===Number(bankId)).sort((a,b)=>Number(a[0])-Number(b[0]));}
function catalog(profiles){return Object.entries(profiles.banks).map(([id,bank])=>({id:Number(id),title:bankName(id,bank),group:family(+id).group,sourceName:bank.name,programCount:bank.programs.length,slots:slotsForBank(profiles,id).length})).sort((a,b)=>a.id-b.id);}
function programName(bankId,program,nicknames={}){return nicknames[bankId+':'+program.index]||`Instrument ${String(program.index+1).padStart(3,'0')} · ${programType(program.kind)}`;}
const KEY='sigma-heartgold-instrument-names-v1';
function readNames(){try{const value=JSON.parse(root.localStorage?.getItem(KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}}
function storeName(bankId,index,name){if(!root.localStorage)return;const current=readNames(),key=bankId+':'+index;if(name)current[key]=name.slice(0,65);else delete current[key];root.localStorage.setItem(KEY,JSON.stringify(current));}
function compatible(program,notes){return (notes||[]).every(n=>program.pitch_ranges.some(([lo,hi])=>Number(n.pitch)>=lo&&Number(n.pitch)<=hi));}
let ctx=null,active=[];
function stopPreview(){for(const node of active){try{node.stop?.()}catch{}}active=[];}
function preview(program,midinote=60,bankId=null,profiles=null){
 const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)throw Error('Web Audio unavailable');
 if(!ctx||ctx.state==='closed')ctx=new Audio();
 const resume=ctx.resume();if(resume?.catch)resume.catch(()=>{});
 stopPreview();
 const ranges=program.pitch_ranges||[[0,127]],range=ranges.find(([lo,hi])=>lo<=midinote&&midinote<=hi)||ranges[0];
 const note=Math.max(range[0],Math.min(midinote,range[1])),frequency=440*Math.pow(2,(note-69)/12);
 const t=ctx.currentTime,duration=.6;
 const original=(bankId!==null&&profiles)?root.SigmaHeartGoldSources?.originalWave(bankId,program.index,note,profiles):null;
 const gain=ctx.createGain(),comp=ctx.createDynamicsCompressor();comp.threshold.value=-12;comp.ratio.value=12;
 gain.gain.setValueAtTime(0.0001,t);gain.gain.exponentialRampToValueAtTime(.13,t+.015);
 gain.gain.exponentialRampToValueAtTime(.085,t+.12);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
 gain.connect(comp).connect(ctx.destination);
 if(original&&typeof root.SigmaHeartGoldSources?.schedulePcm==='function'){
  const voice=root.SigmaHeartGoldSources.schedulePcm(ctx,comp,original,{note,start:t,end:t+duration,velocity:72});
  // schedulePcm has its own ADSR gain; skip the generic synthetic preview envelope.
  active.push(voice.node);
 }else if(original){
  const {wave,definition}=original;const buffer=ctx.createBuffer(1,wave.samples.length,wave.rate);buffer.copyToChannel(wave.samples,0);
  const source=ctx.createBufferSource();source.buffer=buffer;source.playbackRate.value=Math.pow(2,(note-definition.baseNote)/12);
  if(wave.loop&&wave.loopWords>0){const byteOffset=wave.loopWords*4;
   const sampleOffset=wave.type===0?byteOffset:wave.type===1?byteOffset/2:Math.max(1,1+(byteOffset-4)*2);
   if(sampleOffset<wave.samples.length-1){source.loop=true;source.loopStart=sampleOffset/wave.rate;source.loopEnd=wave.samples.length/wave.rate;}}

  const pan=ctx.createStereoPanner?.();if(pan){pan.pan.value=Math.max(-1,Math.min(1,(definition.pan-64)/63));source.connect(pan).connect(gain)}else source.connect(gain);
  source.start(t);source.stop(t+duration);active.push(source);
 }else if(program.kind===3||program.kind===16){
  const samples=Math.floor(ctx.sampleRate*.65),buffer=ctx.createBuffer(1,samples,ctx.sampleRate),d=buffer.getChannelData(0);
  for(let i=0;i<samples;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(ctx.sampleRate*.19));
  const source=ctx.createBufferSource();source.buffer=buffer;source.connect(gain);source.start(t);source.stop(t+duration);active.push(source);
 }else{
  const osc=ctx.createOscillator();osc.type=program.kind===2?'square':program.kind===17?'triangle':'sine';osc.frequency.setValueAtTime(frequency,t);osc.connect(gain);osc.start(t);osc.stop(t+duration);active.push(osc);
 }
 return {note,synthetic:!original,archive:original?.archiveId??null};
}
function bankOptions(profiles,current){return catalog(profiles).map((bank,i,a)=>{
 const header=i===0||a[i-1].group!==bank.group?`<optgroup label="${escape(bank.group)}">`:'';
 const footer=i===a.length-1||a[i+1].group!==bank.group?'</optgroup>':'';
 return header+`<option value="${bank.id}"${current===bank.id?' selected':''}>${escape(bank.title)} · Bank ${bank.id} (${bank.programCount})</option>`+footer;
}).join('')}
function selectedBankDefault(profiles,bankId){const id=Number(bankId);return profiles.banks[String(id)]?id:Number(Object.keys(profiles.banks)[0]);}
function mount(element,{profiles,bankId=702,notes=[],onBank=()=>{},onChoose=()=>{},selected=()=>null,compact=false}={}){
 if(!element)throw Error('Missing instrument browser element');let current=selectedBankDefault(profiles,bankId),query='',type='all',sort='index',showLimited=true;
 const heading=`<div class="hg-browser-head"><div><strong>HeartGold instrument library</strong><p class="hint">39 original banks · all available programs · original PCM samples when privately imported, synthetic fallback otherwise</p></div></div>`;
 element.classList.add('hg-browser');
 element.innerHTML=`${heading}
 <div class="hg-bank-line"><label>Find bank <input data-hg-bank-search type="search" placeholder="Search bank, town, battle or event" aria-label="Search HeartGold banks"></label><label>Bank <select data-hg-bank aria-label="HeartGold instrument bank">${bankOptions(profiles,current)}</select></label>
 <label>Find instrument <input data-hg-search type="search" placeholder="Name, type or program number" aria-label="Search instrument catalogue"></label></div>
 <div class="hg-bank-line hg-filters"><label>Type <select data-hg-type><option value="all">All types</option>${Object.entries(TAGS).map(([k,v])=>`<option value="${k}">${escape(v)}</option>`).join('')}</select></label>
 <label>Sort <select data-hg-sort><option value="index">Program number</option><option value="name">Name (A–Z)</option><option value="kind">Sound type</option></select></label></div>
 <details class="hg-source-loader"><summary>Load your original HeartGold SBNK/SWAR files for exact sample previews and full settings</summary>
 <p class="hint">Select one or multiple original .sbnk/.swar files. The browser checks each file's SHA-256 against your HeartGold US metadata, reads them locally, and does <strong>not upload or save them</strong>. Matching SBNK exposes the attack/decay/sustain/release, pan and sample IDs; matching SWAR lets PCM programs play original audio. These files are not included in the downloaded project.</p>
 <input type="file" data-hg-files multiple accept=".sbnk,.swar" aria-label="Import original HeartGold sound bank and wave archives"><div class="hint" data-hg-import-status role="status">No original samples loaded in this tab. Import matching private SBNK/SWAR to hear actual PCM timbres in instrument previews and SSEQ playback.</div></details>
 <div data-hg-bank-details class="hint"></div><div data-hg-program-count role="status" class="hint"></div>
 <div data-hg-list class="hg-program-list"></div>
 <p class="hint hg-data-honesty">▶ Without imported original files the tone is a <strong>synthetic approximation</strong>. With matching SBNK + SWAR, PCM previews use the actual original wave data (with an approximate browser envelope). PSG remains browser synthesis. Sample-based instruments cannot be named accurately from program numbers alone; add your own names to make them searchable.</p>`;
 const bankField=element.querySelector('[data-hg-bank]'),bankSearch=element.querySelector('[data-hg-bank-search]'),finder=element.querySelector('[data-hg-search]'),typeField=element.querySelector('[data-hg-type]'),sortField=element.querySelector('[data-hg-sort]');
 function render(){
  const bank=profiles.banks[String(current)];if(!bank)return;
  const slots=slotsForBank(profiles,current),archives=(bank.wave_archive_slots||[]).filter(x=>x!==null);
  const pretty=bankName(current,bank),names=readNames();
  const source=root.SigmaHeartGoldSources,loaded=source?.loaded(),hasBank=loaded?.banks.includes(current);
  element.querySelector('[data-hg-bank-details]').textContent=`${pretty} · ${bank.name} · ${bank.programs.length} programs · ${slots.length} compatible game slots · SWAR: ${archives.length?archives.join(', '):'none listed'}. ${hasBank?'Original SBNK settings loaded.':'SBNK settings not loaded.'} Export uses ONE bank chosen by the destination game slot.`;
  let items=bank.programs.filter(pg=>type==='all'||String(pg.kind)===type);
  if(query.trim()){const q=query.toLowerCase().trim();items=items.filter(pg=>String(pg.index).includes(q)||programType(pg.kind).toLowerCase().includes(q)||programName(current,pg,names).toLowerCase().includes(q));}
  if(sort==='name')items.sort((a,b)=>programName(current,a,names).localeCompare(programName(current,b,names)));
  if(sort==='kind')items.sort((a,b)=>a.kind-b.kind||a.index-b.index);
  element.querySelector('[data-hg-program-count]').textContent=`Showing ${items.length} / ${bank.programs.length} instruments in bank ${current}`;
  element.querySelector('[data-hg-list]').innerHTML=items.map(pg=>{
   const can=compatible(pg,notes),n=programName(current,pg,names),archive=archives.map(a=>profiles.wave_archives[String(a)]?.name||`SWAR ${a}`).join(', ');
   const pick=selected()===pg.index;
   const raw=source?.details(current,pg.index);
   const settings=raw?.regions?.length?raw.regions.map(r=>`<div class="hg-note-setting"><strong>${escape(pitchName(r.low))}–${escape(pitchName(r.high))}</strong> · ${escape(programType(r.type))} · SWAR slot ${r.archiveSlot} · wave ${r.waveId} · base ${escape(pitchName(r.baseNote))} · attack ${r.attack} · decay ${r.decay} · sustain ${r.sustain} · release ${r.release} · pan ${r.pan}</div>`).join(''):'Not loaded (import the original matching SBNK file above)';
   return `<article class="hg-program" data-hg-id="${pg.index}" aria-label="${escape(n)}">
    <div class="hg-program-main"><strong>${escape(n)}</strong><small>Program ${pg.index} · ${escape(programType(pg.kind))}${can?'':' · ⚠ MIDI note range'}${pick?' · Selected':''}</small></div>
    <div class="hg-program-actions"><button type="button" class="btn small" data-hg-play="${pg.index}" aria-label="Preview ${escape(n)}">▶ Hear</button><button type="button" class="btn small${pick?' primary':''}" data-hg-choose="${pg.index}" aria-label="Choose ${escape(n)}">Choose</button></div>
    <details class="hg-program-details"><summary>Instrument settings / information</summary><dl><dt>Program / type</dt><dd>${pg.index} / ${escape(programType(pg.kind))}</dd><dt>Playable note ranges</dt><dd>${escape(rangeLabel(pg.pitch_ranges))}</dd><dt>Linked wave archive(s)</dt><dd>${escape(archive||'Not listed')}</dd><dt>Original SBNK ADSR / pan / sample / regions</dt><dd>${raw?'Loaded original SBNK (values below)':'Not in extracted metadata; import original SBNK above'}</dd></dl>${raw?`<details class="hg-raw-regions"><summary>Show all ${raw.regions.length} original SBNK key regions and settings</summary>${settings}</details>`:''}<button type="button" class="btn small" data-hg-rename="${pg.index}">✎ Name this instrument</button></details>
   </article>`;
  }).join('')||'<div class="hint hg-empty">No instruments match this search. Try another type or name.</div>';
 }
 function setBank(next,{notify=true}={}){
  current=selectedBankDefault(profiles,next);bankField.value=String(current);query='';finder.value='';type='all';typeField.value='all';render();
  if(notify)onBank(current,slotsForBank(profiles,current).map(([id])=>Number(id)));
 }
 bankSearch.addEventListener('input',()=>{
  const value=bankSearch.value.trim().toLowerCase();
  if(!value){bankField.innerHTML=bankOptions(profiles,current);return;}
  const matched=catalog(profiles).filter(b=>b.id===current||`${b.id} ${b.title} ${b.sourceName} ${b.group}`.toLowerCase().includes(value));
  bankField.innerHTML=matched.map(b=>`<option value="${b.id}"${b.id===current?' selected':''}>${escape(b.title)} · Bank ${b.id} (${b.programCount})</option>`).join('');
 });
 bankField.addEventListener('change',()=>setBank(bankField.value));
 finder.addEventListener('input',()=>{query=finder.value;render()});
 typeField.addEventListener('change',()=>{type=typeField.value;render()});
 sortField.addEventListener('change',()=>{sort=sortField.value;render()});
 element.addEventListener('click',event=>{
  const button=event.target.closest('button[data-hg-play],button[data-hg-choose],button[data-hg-rename]');
  if(!button)return;
  const id=Number(button.dataset.hgPlay??button.dataset.hgChoose??button.dataset.hgRename),pg=profiles.banks[String(current)]?.programs.find(p=>p.index===id);
  if(!pg)return;
  if(button.hasAttribute('data-hg-play')){
   try{const result=preview(pg,60,current,profiles);button.textContent=result.synthetic?'♪ Synth demo':'♪ Original sample';root.setTimeout?.(()=>{if(button.isConnected)button.textContent='▶ Hear'},680)}
   catch(error){button.textContent='Audio unavailable';console.warn(error)}
  }else if(button.hasAttribute('data-hg-choose')){onChoose(current,id);render();}
  else if(button.hasAttribute('data-hg-rename')){
   const newName=root.prompt?.('Personal name for this instrument (saved only in this browser)',readNames()[current+':'+id]||'');
   if(newName!==null&&newName!==undefined){storeName(current,id,newName.trim());render();}
  }
 });
 element.querySelector('[data-hg-files]').addEventListener('change',async event=>{
  const input=event.currentTarget,status=element.querySelector('[data-hg-import-status]');
  if(!input.files.length)return;
  status.textContent='Reading and verifying original files locally...';input.disabled=true;
  try{
   const result=await root.SigmaHeartGoldSources.importFiles(input.files,profiles);
   status.textContent=`Loaded ${result.successful} verified files (${result.bankCount} SBNK banks, ${result.waveCount} SWAR archives in memory). ${result.skipped?`${result.skipped} skipped: ${result.errors.slice(0,2).join('; ')}`:'Select ▶ Hear to play original PCM samples where both corresponding files are present.'}`;
   render();
  }catch(error){status.textContent='Import failed: '+error.message}
  finally{input.disabled=false;input.value=''}
 });
 render();return {setBank,render,getBank:()=>current,dispose:stopPreview};
}
root.SigmaInstrumentLibrary={mount,preview,stopPreview,catalog,bankOptions,slotsForBank,bankName,programName,programType,rangeLabel,compatible,readNames,storeName};
})(typeof globalThis==='object'?globalThis:window);
