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
// These are navigation labels, not a General MIDI program map. HGSS program IDs
// are bank-specific; a PCM/key-split entry has no trustworthy timbre label until
// it is identified by ear from a legitimately imported SBNK/SWAR.
const SOUND_FAMILIES=[
 {id:'keys',label:'Piano & keys',description:'Pianos, electric keys, organs and mallet sounds',sub:[
  ['keys-piano','Acoustic piano','Natural, resonant keys'],['keys-electric','Electric piano','Soft, bell-like or gritty electric keys'],
  ['keys-organ','Organs','Sustained, rounded keyboard tones'],['keys-mallet','Bells & mallets','Short, chiming and wooden attacks']]},
 {id:'guitar',label:'Guitars',description:'Picked, strummed and amplified string sounds',sub:[
  ['guitar-acoustic','Acoustic & nylon','Clean, warm picked strings'],['guitar-clean','Clean electric','Clear, bright or jazzy electric guitars'],
  ['guitar-drive','Overdrive & distortion','Crunchy, aggressive and sustained guitars'],['guitar-pluck','Muted & plucked','Short, tight, percussive strings']]},
 {id:'bass',label:'Bass',description:'Low-end instruments and rhythmic bass tones',sub:[
  ['bass-acoustic','Acoustic & electric bass','Plucked or sustained low strings'],['bass-synth','Synth bass','Deep, round, buzzing or punchy bass'],
  ['bass-sub','Sub bass','Smooth, deep fundamental low end']]},
 {id:'strings',label:'Strings & orchestral',description:'Bowed strings, orchestral sections and harps',sub:[
  ['strings-solo','Solo strings','Violin, viola and cello'],['strings-ensemble','Ensembles','Smooth, layered string sections'],
  ['strings-harp','Harp & pizzicato','Plucked orchestral strings']]},
 {id:'brass',label:'Brass',description:'Trumpets, horns and bright brass sections',sub:[
  ['brass-solo','Solo brass','Trumpet, trombone and horn'],['brass-ensemble','Brass ensembles','Wide, punchy orchestral brass']]},
 {id:'winds',label:'Winds & reeds',description:'Flutes, saxophones, reeds and breathy woodwinds',sub:[
  ['winds-flute','Flutes & airy','Breathy, light wind sounds'],['winds-reed','Reeds & saxes','Reedy, nasal or smooth lead winds']]},
 {id:'voice',label:'Choirs & voices',description:'Human-sounding choirs and vocal textures',sub:[
  ['voice-choir','Choir','Soft or full vocal sections'],['voice-solo','Vocal & formant','Solo voices and vowel-like tones']]},
 {id:'synth',label:'Synthesizers',description:'Electronic sounds grouped by how they feel and behave',sub:[
  ['synth-lead','Bright & cutting leads','Sharp, forward synths for melodies'],
  ['synth-soft','Warm & mellow leads','Rounded, gentle synth melodies'],
  ['synth-pad','Soft & airy pads','Slow, floating sounds for atmosphere'],
  ['synth-dark','Dark & evolving pads','Moody, moving textures with long tails'],
  ['synth-pluck','Plucks & arpeggios','Short, snappy electronic notes'],
  ['synth-retro','Retro & 8-bit','Buzzy square waves and chiptune sounds'],
  ['synth-digital','Digital & metallic','Glassy, bell-like and bright electronic tones'],
  ['synth-bass','Deep synth bass','Thick, low electronic tones']]},
 {id:'drums',label:'Drums & percussion',description:'Drum kits, noise hits and rhythmic accents',sub:[
  ['drums-kit','Drum kits','Multi-key percussion sets'],['drums-noise','Noise & hits','Noise-based percussion or impacts'],
  ['drums-tuned','Tuned percussion','Pitched rhythmic and percussive sounds']]},
 {id:'fx',label:'FX & atmospheres',description:'Unusual sound effects and ambient textures',sub:[
  ['fx-atmosphere','Ambient & texture','Evolving backgrounds and soundscapes'],
  ['fx-game','Game & special effects','Transitions, noises and one-shot effects']]},
 {id:'other',label:'Not identified yet',description:'Sampled sounds waiting to be identified by listening',sub:[
  ['other-unknown','Unclassified samples','No reliable instrument name in the available metadata']]}
];
const ALL_SOUND_TYPES=SOUND_FAMILIES.flatMap(f=>f.sub.map(([id,label,description])=>({id,label,description,family:f.id,familyLabel:f.label})));
const SOUND_BY_ID=Object.fromEntries(ALL_SOUND_TYPES.map(x=>[x.id,x]));
const SOUND_STORAGE_KEY='sigma-heartgold-sound-categories-v1';
function readSoundTags(){try{const data=JSON.parse(root.localStorage?.getItem(SOUND_STORAGE_KEY)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{}}catch{return {}}}
function storeSoundTag(bankId,index,id){try{if(!root.localStorage)return;const tags=readSoundTags(),key=`${bankId}:${index}`;
 if(id&&SOUND_BY_ID[id])tags[key]=id;else delete tags[key];
 root.localStorage.setItem(SOUND_STORAGE_KEY,JSON.stringify(tags));}catch{/* Private browsing may block localStorage. */}}
function nameBasedSoundTag(name){
 const n=String(name||'').toLowerCase();if(!n)return null;
 const rules=[
  [/(synth\s*bass|bass\s*synth)/,'synth-bass'],[/(sub\s*bass)/,'bass-sub'],[/(electric\s*bass|finger\s*bass|fretless\s*bass|acoustic\s*bass|slap\s*bass)/,'bass-acoustic'],
  [/(electric\s*piano|rhodes|epiano|e-piano)/,'keys-electric'],[/(piano|grand|honky.?tonk)/,'keys-piano'],[/(organ|clavinet)/,'keys-organ'],[/(glockenspiel|xylophone|marimba|vibraphone|music\s*box|tubular\s*bell)/,'keys-mallet'],
  [/(distort|overdrive|heavy\s*guitar)/,'guitar-drive'],[/(nylon|steel\s*string|acoustic\s*guitar)/,'guitar-acoustic'],[/(jazz\s*guitar|electric\s*guitar|clean\s*guitar)/,'guitar-clean'],[/(guitar|sitar|koto|banjo)/,'guitar-pluck'],
  [/(pizzicato|harp)/,'strings-harp'],[/(violin|viola|cello|solo\s*string)/,'strings-solo'],[/(string\s*ensemble|strings|orchestra\s*string)/,'strings-ensemble'],
  [/(trumpet|trombone|tuba|french\s*horn)/,'brass-solo'],[/(brass)/,'brass-ensemble'],
  [/(flute|piccolo|whistle|pan\s*flute)/,'winds-flute'],[/(sax|clarinet|oboe|bassoon|english\s*horn)/,'winds-reed'],
  [/(choir|aahs|oohs)/,'voice-choir'],[/(voice|vocal|vocoder)/,'voice-solo'],
  [/(mellow\s*synth|warm(?:\s+synth)?\s*lead|soft(?:\s+synth)?\s*lead)/,'synth-soft'],[/(synth\s*lead|sawtooth|bright\s*synth)/,'synth-lead'],
  [/(dark\s*pad|evolving\s*pad)/,'synth-dark'],[/(pad|polysynth|synth\s*strings)/,'synth-pad'],
  [/(pluck|arpeggio|arp\b)/,'synth-pluck'],[/(square\s*(wave|lead)|chiptune|8.bit|game.?boy)/,'synth-retro'],
  [/(digital\s*synth|metallic|fm\s*synth)/,'synth-digital'],
  [/(drum\s*kit|percussion\s*kit)/,'drums-kit'],[/(drum|percussion|noise|snare|kick|cymbal|hi.?hat|timpani)/,'drums-noise'],
  [/(atmosphere|ambient|wind\s*sound)/,'fx-atmosphere'],[/(effect|laser|sfx|explosion)/,'fx-game']
 ];return rules.find(([rx])=>rx.test(n))?.[1]||null;
}
function soundTagFor(bankId,pg,tags=readSoundTags(),names=readNames()){
 const explicit=tags[`${bankId}:${pg.index}`];if(SOUND_BY_ID[explicit])return {id:explicit,source:'custom'};
 const nickname=names[`${bankId}:${pg.index}`];const suggested=nameBasedSoundTag(nickname);
 if(suggested)return {id:suggested,source:'name'};
 if(pg.kind===2)return{id:'synth-retro',source:'hardware'};
 if(pg.kind===3)return{id:'drums-noise',source:'hardware'};
 if(pg.kind===16)return{id:'drums-kit',source:'hardware'};
 return{id:'other-unknown',source:'unknown'};
}
const SOUND_FILTER_OPTIONS=SOUND_FAMILIES.map(f=>`<option value="${f.id}">${escape(f.label)}</option>`).join('');
const SOUND_TAG_OPTIONS=`<option value="">Automatic / unknown</option>`+SOUND_FAMILIES.map(f=>`<optgroup label="${escape(f.label)}">${f.sub.map(([id,label])=>`<option value="${id}">${escape(label)}</option>`).join('')}</optgroup>`).join('');
function selectedBankDefault(profiles,bankId){const id=Number(bankId);return profiles.banks[String(id)]?id:Number(Object.keys(profiles.banks)[0]);}
function mount(element,{profiles,bankId=702,notes=[],onBank=()=>{},onChoose=()=>{},selected=()=>null,compact=false}={}){
 if(!element)throw Error('Missing instrument browser element');
 let current=selectedBankDefault(profiles,bankId),query='',type='all',sort='family',familyFilter='all',detailFilter='all',view='sound',limit=48;
 const heading=`<div class="hg-browser-head"><div><strong>Find your sound · HeartGold instruments</strong><p class="hint">Browse by sound family across all 39 banks. Choose a tone, then the matching game bank is selected automatically.</p></div></div>`;
 element.classList.add('hg-browser');
 element.innerHTML=`${heading}
 <div class="hg-view-switch" role="group" aria-label="Instrument browsing mode"><button type="button" class="btn small primary" data-hg-view="sound" aria-pressed="true">♫ Browse by sound</button><button type="button" class="btn small" data-hg-view="bank" aria-pressed="false">Advanced · game banks</button></div>
 <div class="hg-sonic-filters"><label>Instrument family <select data-hg-family aria-label="Instrument sound family"><option value="all">All sound families</option>${SOUND_FILTER_OPTIONS}</select></label>
 <label>Sound character <select data-hg-character aria-label="Instrument sound character"><option value="all">All characters</option></select></label>
 <label>Search every bank <input data-hg-search type="search" placeholder="e.g. warm synth, piano, guitar, square wave" aria-label="Search instrument catalogue across all banks"></label></div>
 <div data-hg-category-overview class="hg-category-overview" aria-label="Sound family categories"></div>
 <details data-hg-advanced class="hg-advanced-tools"><summary>Advanced: game bank, MIDI program and file type</summary>
 <div class="hg-bank-line"><label>Find game bank <input data-hg-bank-search type="search" placeholder="Search game area or bank" aria-label="Search HeartGold banks"></label><label>Original game bank <select data-hg-bank aria-label="HeartGold instrument bank">${bankOptions(profiles,current)}</select></label></div>
 <div class="hg-bank-line hg-filters"><label>Technical source type <select data-hg-type><option value="all">Every source type</option>${Object.entries(TAGS).map(([k,v])=>`<option value="${k}">${escape(v)}</option>`).join('')}</select></label>
 <label>Sort <select data-hg-sort><option value="family">Sound family</option><option value="name">Name A–Z</option><option value="index">Program number</option><option value="kind">Technical source type</option></select></label></div></details>
 <details class="hg-source-loader"><summary>Import original SBNK / SWAR for authentic instrument previews</summary>
 <p class="hint">Select your own matching original .sbnk and .swar files. They are verified against the HeartGold US metadata and stay in browser memory; they are never uploaded. Without them, PCM sounds cannot be identified accurately from the metadata alone.</p>
 <input type="file" data-hg-files multiple accept=".sbnk,.swar" aria-label="Import original HeartGold sound bank and wave archives"><div class="hint" data-hg-import-status role="status">No original samples loaded. Synth demos are approximate.</div></details>
 <p class="hint hg-category-notice" data-hg-guidance>Instrument names in the game are not a General MIDI list. Piano, guitar and other sampled sounds appear in their families once identified from an original preview or named/tagged. Unknown samples stay under “Not identified yet” rather than being mislabeled.</p>
 <div data-hg-bank-details class="hint"></div><div data-hg-program-count role="status" class="hint"></div>
 <div data-hg-list class="hg-program-list"></div><button type="button" class="btn small hg-show-more" data-hg-more hidden>Show more instruments</button>
 <p class="hint hg-data-honesty">The original bank and program are always shown. A category marked “Hardware” follows the SBNK type; a category marked “Your tag” is your browser-local classification. Sampled instruments cannot be identified by program numbers alone. The ▶ demo is synthetic unless the verified original sample is loaded. A vanilla SSEQ still uses one bank associated with the destination slot.</p>`;
 const bankField=element.querySelector('[data-hg-bank]'),bankSearch=element.querySelector('[data-hg-bank-search]'),finder=element.querySelector('[data-hg-search]'),typeField=element.querySelector('[data-hg-type]'),sortField=element.querySelector('[data-hg-sort]');
 const familyField=element.querySelector('[data-hg-family]'),characterField=element.querySelector('[data-hg-character]'),categoryOverview=element.querySelector('[data-hg-category-overview]');
 const moreButton=element.querySelector('[data-hg-more]'),list=element.querySelector('[data-hg-list]');
 const basePrograms=Object.entries(profiles.banks).flatMap(([id,bank])=>bank.programs.map(program=>({bankId:Number(id),program})));
 function characterOptions(){const f=SOUND_FAMILIES.find(f=>f.id===familyFilter);characterField.innerHTML='<option value="all">All characters</option>'+(f?.sub||[]).map(([id,label,description])=>`<option value="${id}">${escape(label)} · ${escape(description)}</option>`).join('');characterField.value=detailFilter;}
 function selectView(next){view=next==='bank'?'bank':'sound';element.querySelectorAll('[data-hg-view]').forEach(button=>{const on=button.dataset.hgView===view;button.classList.toggle('primary',on);button.setAttribute('aria-pressed',String(on))});element.querySelector('[data-hg-advanced]').open=view==='bank';render();}
 function selectFamily(next){familyFilter=next;detailFilter='all';limit=48;familyField.value=next;characterOptions();if(view!=='sound')selectView('sound');else render();}
 function render(){
  const names=readNames(),tags=readSoundTags();
  const source=root.SigmaHeartGoldSources,loaded=source?.loaded();
  const currentBank=profiles.banks[String(current)];if(!currentBank)return;
  const all=basePrograms.map(({bankId,program})=>{const sound=soundTagFor(bankId,program,tags,names);return {bankId,program,sound,meta:SOUND_BY_ID[sound.id]}});
  const counts={};for(const item of all)counts[item.meta.family]=(counts[item.meta.family]||0)+1;
  const activeFamily=SOUND_FAMILIES.find(f=>f.id===familyFilter);
  const subcounts={};for(const item of all)subcounts[item.sound.id]=(subcounts[item.sound.id]||0)+1;
  categoryOverview.hidden=view==='bank'||!!query.trim()||detailFilter!=='all';
  categoryOverview.innerHTML=activeFamily
   ? activeFamily.sub.map(([id,label,description])=>`<button type="button" data-hg-character-pick="${id}" class="hg-category-tile"><strong>${escape(label)} <span>${subcounts[id]||0}</span></strong><small>${escape(description)}</small></button>`).join('')
   : SOUND_FAMILIES.map(f=>`<button type="button" data-hg-family-pick="${f.id}" class="hg-category-tile"><strong>${escape(f.label)} <span>${counts[f.id]||0}</span></strong><small>${escape(f.description)}</small></button>`).join('');
  const slots=slotsForBank(profiles,current),archives=(currentBank.wave_archive_slots||[]).filter(x=>x!==null);const hasBank=loaded?.banks.includes(current);
  element.querySelector('[data-hg-bank-details]').textContent=view==='bank'?`${bankName(current,currentBank)} · bank ${current} · ${currentBank.programs.length} programs · ${slots.length} game slots · SWAR: ${archives.join(', ')||'none'}. ${hasBank?'Original settings loaded.':'Original settings not loaded.'}`:`Browsing every HeartGold bank. Current destination: bank ${current} (${bankName(current,currentBank)}). Choosing a program from a different bank switches the destination slot.`;
  const search=query.trim().toLowerCase();let items=all.filter(({bankId,program,sound,meta})=>
    (view==='sound'||bankId===current)&&
    (type==='all'||String(program.kind)===type)&&
    (view==='bank'||familyFilter==='all'||meta.family===familyFilter)&&
    (view==='bank'||detailFilter==='all'||sound.id===detailFilter)&&
    (!search||`${programName(bankId,program,names)} ${program.index} ${bankId} ${bankName(bankId,profiles.banks[String(bankId)])} ${meta.label} ${meta.familyLabel} ${meta.description} ${programType(program.kind)}`.toLowerCase().includes(search)));
  if(sort==='name')items.sort((a,b)=>programName(a.bankId,a.program,names).localeCompare(programName(b.bankId,b.program,names))||a.bankId-b.bankId||a.program.index-b.program.index);
  else if(sort==='kind')items.sort((a,b)=>a.program.kind-b.program.kind||a.bankId-b.bankId||a.program.index-b.program.index);
  else if(sort==='index')items.sort((a,b)=>a.program.index-b.program.index||a.bankId-b.bankId);
  else items.sort((a,b)=>SOUND_FAMILIES.findIndex(f=>f.id===a.meta.family)-SOUND_FAMILIES.findIndex(f=>f.id===b.meta.family)||a.sound.id.localeCompare(b.sound.id)||a.bankId-b.bankId||a.program.index-b.program.index);
  const visible=view==='bank'?items:items.slice(0,limit);moreButton.hidden=view==='bank'||visible.length>=items.length;
  moreButton.textContent=`Show more instruments (${items.length-visible.length} remaining)`;
  element.querySelector('[data-hg-program-count]').textContent=`${items.length} matches across ${view==='bank'?'bank '+current:'39 original banks'}${view==='sound'?', showing '+visible.length:''}`;
  let lastGroup='';
  list.innerHTML=visible.map(({bankId,program:pg,sound,meta})=>{
   const bank=profiles.banks[String(bankId)],can=compatible(pg,notes),name=programName(bankId,pg,names),chosen=selected(),selectedHere=bankId===current&&chosen!==null&&chosen!==undefined&&Number(chosen)===pg.index;
   const raw=source?.details(bankId,pg.index),groupHeader=view==='sound'&&sort==='family'&&meta.family!==lastGroup?`<div class="hg-sound-group"><strong>${escape(meta.familyLabel)}</strong><small>${escape(SOUND_FAMILIES.find(f=>f.id===meta.family)?.description||'')}</small></div>`:'';
   lastGroup=meta.family;
   const sourceLabel=sound.source==='custom'?'Your tag':sound.source==='name'?'From your name':sound.source==='hardware'?'Hardware':'Not identified';
   const settings=raw?.regions?.length?raw.regions.map(r=>`<div class="hg-note-setting"><strong>${escape(pitchName(r.low))}–${escape(pitchName(r.high))}</strong> · ${escape(programType(r.type))} · SWAR slot ${r.archiveSlot} · wave ${r.waveId} · base ${escape(pitchName(r.baseNote))} · attack ${r.attack} · decay ${r.decay} · sustain ${r.sustain} · release ${r.release} · pan ${r.pan}</div>`).join(''):'';
   return groupHeader+`<article class="hg-program" data-hg-id="${pg.index}" data-hg-bank-id="${bankId}" aria-label="${escape(name)}">
     <div class="hg-program-main"><strong>${escape(name)}</strong><small class="hg-sound-label">${escape(meta.familyLabel)} › ${escape(meta.label)} <span>· ${sourceLabel}</span></small><small>Bank ${bankId} · Program ${pg.index} · ${escape(programType(pg.kind))}${can?'':' · ⚠ Note range'}${selectedHere?' · Selected':''}</small><small>${escape(meta.description)}</small></div>
     <div class="hg-program-actions"><button type="button" class="btn small" data-hg-play="${pg.index}">▶ Hear</button><button type="button" class="btn small${selectedHere?' primary':''}" data-hg-choose="${pg.index}">Choose</button></div>
     <label class="hg-tag-control">Sound family / character<select data-hg-tag="${pg.index}" aria-label="Categorize bank ${bankId} program ${pg.index}">${SOUND_TAG_OPTIONS}</select></label>
     <details class="hg-program-details"><summary>Original program details</summary><dl><dt>Program / type</dt><dd>${pg.index} / ${escape(programType(pg.kind))}</dd><dt>Note ranges</dt><dd>${escape(rangeLabel(pg.pitch_ranges))}</dd><dt>Original bank</dt><dd>${escape(bankName(bankId,bank))} · ${bankId}</dd><dt>SBNK instrument data</dt><dd>${raw?'Original SBNK loaded':'Import your own original SBNK to see ADSR and regions'}</dd></dl>${raw?`<details><summary>Show ${raw.regions.length} original SBNK regions</summary>${settings}</details>`:''}<button type="button" class="btn small" data-hg-rename="${pg.index}">✎ Rename instrument</button></details>
    </article>`;
  }).join('')||'<div class="hint hg-empty">No instruments in this category yet. Try another sound family, browse the unclassified sample programs, or import original audio and assign a sound category after listening.</div>';
  list.querySelectorAll('[data-hg-tag]').forEach(select=>{const item=select.closest('[data-hg-bank-id]');const key=`${item.dataset.hgBankId}:${item.dataset.hgId}`;select.value=SOUND_BY_ID[tags[key]]?tags[key]:''});
 }
 function setBank(next,{notify=true}={}){
  current=selectedBankDefault(profiles,next);bankField.value=String(current);limit=48;
  if(notify)onBank(current,slotsForBank(profiles,current).map(([id])=>Number(id)));
  render();
 }
 element.querySelectorAll('[data-hg-view]').forEach(button=>button.addEventListener('click',()=>selectView(button.dataset.hgView)));
 categoryOverview.addEventListener('click',event=>{const familyButton=event.target.closest('[data-hg-family-pick]');if(familyButton){selectFamily(familyButton.dataset.hgFamilyPick);return}const characterButton=event.target.closest('[data-hg-character-pick]');if(characterButton){detailFilter=characterButton.dataset.hgCharacterPick;characterField.value=detailFilter;limit=48;render()}});
 familyField.addEventListener('change',()=>selectFamily(familyField.value));
 characterField.addEventListener('change',()=>{detailFilter=characterField.value;limit=48;render()});
 bankSearch.addEventListener('input',()=>{const value=bankSearch.value.trim().toLowerCase();const choices=catalog(profiles).filter(b=>b.id===current||!value||`${b.id} ${b.title} ${b.sourceName} ${b.group}`.toLowerCase().includes(value));bankField.innerHTML=choices.map(b=>`<option value="${b.id}"${b.id===current?' selected':''}>${escape(b.title)} · Bank ${b.id} (${b.programCount})</option>`).join('')});
 bankField.addEventListener('change',()=>{query='';finder.value='';setBank(bankField.value);selectView('bank')});
 finder.addEventListener('input',()=>{query=finder.value;limit=48;render()});
 typeField.addEventListener('change',()=>{type=typeField.value;limit=48;render()});
 sortField.addEventListener('change',()=>{sort=sortField.value;limit=48;render()});
 moreButton.addEventListener('click',()=>{limit+=48;render()});
 element.addEventListener('click',event=>{
  const button=event.target.closest('button[data-hg-play],button[data-hg-choose],button[data-hg-rename]');if(!button)return;
  const article=button.closest('[data-hg-bank-id]');if(!article)return;
  const bankId=Number(article.dataset.hgBankId),id=Number(article.dataset.hgId),pg=profiles.banks[String(bankId)]?.programs.find(p=>p.index===id);if(!pg)return;
  if(button.hasAttribute('data-hg-play')){
   try{const result=preview(pg,60,bankId,profiles);button.textContent=result.synthetic?'♪ Approx. demo':'♪ Original sample';root.setTimeout?.(()=>{if(button.isConnected)button.textContent='▶ Hear'},680)}catch(error){button.textContent='Audio unavailable';console.warn(error)}
  }else if(button.hasAttribute('data-hg-choose')){
   if(bankId!==current)setBank(bankId,{notify:true});
   onChoose(bankId,id);render();
  }else if(button.hasAttribute('data-hg-rename')){
   const newName=root.prompt?.('Your name for this instrument (saved in this browser)',readNames()[`${bankId}:${id}`]||'');
   if(newName!==null&&newName!==undefined){storeName(bankId,id,newName.trim());render();}
  }
 });
 element.addEventListener('change',event=>{
  const select=event.target.closest('select[data-hg-tag]');if(!select)return;
  const article=select.closest('[data-hg-bank-id]');storeSoundTag(Number(article.dataset.hgBankId),Number(article.dataset.hgId),select.value);render();
 });
 element.querySelector('[data-hg-files]').addEventListener('change',async event=>{
  const input=event.currentTarget,status=element.querySelector('[data-hg-import-status]');if(!input.files.length)return;
  status.textContent='Reading and verifying original files locally...';input.disabled=true;
  try{const result=await root.SigmaHeartGoldSources.importFiles(input.files,profiles);
   status.textContent=`Loaded ${result.successful} verified files (${result.bankCount} SBNK banks, ${result.waveCount} SWAR archives in memory). ${result.skipped?`${result.skipped} skipped: ${result.errors.slice(0,2).join('; ')}`:'▶ Hear now uses original PCM samples when the matching bank and wave archive are loaded.'}`;render();
  }catch(error){status.textContent='Import failed: '+error.message}finally{input.disabled=false;input.value=''}
 });
 characterOptions();render();return {setBank,render,getBank:()=>current,dispose:stopPreview};
}
root.SigmaInstrumentLibrary={mount,preview,stopPreview,catalog,bankOptions,slotsForBank,bankName,programName,programType,rangeLabel,compatible,readNames,storeName,SOUND_FAMILIES,ALL_SOUND_TYPES,readSoundTags,storeSoundTag,soundTagFor,nameBasedSoundTag};
})(typeof globalThis==='object'?globalThis:window);
