/* sigma-themes: upload progress + browser health diagnostics.
   Percent is reported ONLY for actual note-analysis frames and upload bytes.
   Decode and other stages remain indeterminate because the platform exposes no metric.
   A slow heartbeat is a warning, not proof of a crash. No audio is copied or logged. */
(() => {
  'use strict';
  const boot = () => {
    const root = document.querySelector('#uploadProgress');
    const label = document.querySelector('#uploadProgressText');
    const fill = document.querySelector('#uploadProgressFill');
    const cancel = document.querySelector('#cancelUpload');
    if (!root || !label || !fill || !cancel || root.dataset.sigmaMonitor) return;
    root.dataset.sigmaMonitor = 'true';
    root.classList.add('sigma-monitor');
    const styles = document.createElement('style');
    styles.textContent = `
      .upload-progress.sigma-monitor { width:min(555px,calc(100vw - 24px));padding:17px 18px;
        max-height:min(75dvh,525px);overflow-y:auto;color:#352b4d;border-radius:17px;
        border:1px solid #c9b6e1;box-shadow:0 19px 58px #32223c44;background:#fffefd; }
      .sigma-monitor .sigma-monitor-head {display:flex;align-items:center;gap:10px;min-width:0}
      .sigma-monitor .sigma-activity {width:11px;height:11px;flex:none;border-radius:50%;background:#7759bd;
        box-shadow:0 0 0 0 #7759bd77;animation:sigma-heartbeat 1.65s ease-out infinite}
      .sigma-monitor .sigma-monitor-title{font-weight:800;font-size:14px;min-width:0;flex:1}
      .sigma-monitor .sigma-time {font-size:12px;font-variant-numeric:tabular-nums;color:#766d87;white-space:nowrap}
      .sigma-monitor .sigma-stage-text{margin-top:8px;color:#51465f;font-size:12px;overflow-wrap:anywhere}
      .sigma-monitor .progress{height:12px;border-radius:20px;margin:13px 0 6px;background:#eae2ef;overflow:hidden}
      .sigma-monitor .progress #uploadProgressFill{height:100%;border-radius:20px;
        background:linear-gradient(90deg,#7960c4,#b876c3);transition:width .2s ease}
      .sigma-monitor[data-sigma-mode='indeterminate'] .progress #uploadProgressFill {
        width:32%!important;transition:none;
        background:linear-gradient(90deg,#7458bd,#d9b2e6,#7458bd);
        animation:sigma-indeterminate 1.65s ease-in-out infinite;
      }
      .sigma-monitor .sigma-monitor-meta{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;
        font-size:11px;line-height:1.5;color:#756e82}
      .sigma-monitor .sigma-measured{white-space:nowrap;color:#684daa;font-weight:800;font-variant-numeric:tabular-nums}
      .sigma-monitor .sigma-steps {display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;
        list-style:none;margin:15px 0 10px;padding:0}
      .sigma-monitor .sigma-steps li{border-top:3px solid #e9e3ee;padding-top:6px;
        font-size:10px;line-height:1.3;color:#938c9b;text-align:center}
      .sigma-monitor .sigma-steps li.current {border-color:#7055bb;font-weight:800;color:#59428f}
      .sigma-monitor .sigma-steps li.done {border-color:#51967f;color:#357965}
      .sigma-monitor .sigma-health{display:flex;align-items:center;gap:7px;font-size:11px;margin-top:8px;color:#65776c}
      .sigma-monitor .sigma-health-dot{height:8px;width:8px;border-radius:50%;background:#4e9576;flex:none}
      .sigma-monitor[data-sigma-health='slow'] .sigma-health{color:#986823}
      .sigma-monitor[data-sigma-health='slow'] .sigma-health-dot{background:#d4a041}
      .sigma-monitor[data-sigma-health='stalled'] .sigma-health,
      .sigma-monitor[data-sigma-health='error'] .sigma-health{color:#a04456}
      .sigma-monitor[data-sigma-health='stalled'] .sigma-health-dot,
      .sigma-monitor[data-sigma-health='error'] .sigma-health-dot{background:#b64e62}
      .sigma-monitor .sigma-warning{margin-top:7px;background:#fff3df;border:1px solid #e4ca9e;
        border-radius:8px;padding:8px 9px;color:#725128;font-size:11px;line-height:1.5}
      .sigma-monitor .sigma-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}
      .sigma-monitor .sigma-actions button{margin:0!important}
      .sigma-monitor .sigma-diagnostics{border:1px solid #e8deec;background:#f7f3fa;
        border-radius:8px;padding:8px;white-space:pre-wrap;word-break:break-word;
        max-height:140px;overflow:auto;font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}
      .sigma-monitor .sigma-diagnostics[hidden],.sigma-monitor .sigma-warning[hidden]{display:none!important}
      .sigma-monitor .sigma-health-note{font-size:10px;color:#7c7485;margin-top:4px}
      .sigma-monitor[data-sigma-cancel='true'] .sigma-activity{animation:none;background:#cf9446}
      @keyframes sigma-heartbeat{0%{box-shadow:0 0 0 0 #7759bd77}70%{box-shadow:0 0 0 9px #7759bd00}100%{box-shadow:0 0 0 0 #7759bd00}}
      @keyframes sigma-indeterminate{0%{transform:translateX(-115%)}50%{transform:translateX(110%)}100%{transform:translateX(325%)}}
      @media(max-width:420px){.upload-progress.sigma-monitor{padding:12px 13px}.sigma-monitor .sigma-steps li{font-size:9px}}
      @media(prefers-reduced-motion:reduce){.sigma-monitor .sigma-activity,
        .sigma-monitor[data-sigma-mode='indeterminate'] .progress #uploadProgressFill{animation:none!important}}
    `;
    document.head.appendChild(styles);
    const heading=document.createElement('div');heading.className='sigma-monitor-head';
    heading.innerHTML='<span class="sigma-activity" aria-hidden="true"></span><strong class="sigma-monitor-title">Processing music</strong><time class="sigma-time">0:00</time>';
    root.insertBefore(heading,label);
    label.classList.add('sigma-stage-text');
    const meta=document.createElement('div');meta.className='sigma-monitor-meta';
    meta.innerHTML='<span class="sigma-detail">Working…</span><span class="sigma-measured">Working…</span>';
    fill.parentElement.after(meta);
    const steps=document.createElement('ol');steps.className='sigma-steps';
    const stepNames=['Decode','Notes','SSEQ','Upload','Verify'];
    const stepNodes=stepNames.map(name=>{const li=document.createElement('li');li.textContent=name;steps.appendChild(li);return li;});
    meta.after(steps);
    const health=document.createElement('div');health.className='sigma-health';
    health.innerHTML='<span class="sigma-health-dot" aria-hidden="true"></span><span class="sigma-health-text">Browser responding</span>';
    steps.after(health);
    const warning=document.createElement('div');warning.className='sigma-warning';warning.setAttribute('role','alert');warning.hidden=true;
    health.after(warning);
    const note=document.createElement('div');note.className='sigma-health-note';
    note.textContent='No progress does not necessarily mean a crash. Audio decoding does not report a percentage.';
    warning.after(note);
    const actions=document.createElement('div');actions.className='sigma-actions';
    cancel.parentNode.insertBefore(actions,cancel);actions.append(cancel);
    const copy=document.createElement('button');copy.type='button';copy.className='btn small';copy.textContent='Copy diagnostics';
    actions.append(copy);
    const details=document.createElement('button');details.type='button';details.className='btn small';details.textContent='Details';
    details.setAttribute('aria-expanded','false');actions.append(details);
    const report=document.createElement('pre');report.className='sigma-diagnostics';report.hidden=true;actions.after(report);
    const description=meta.querySelector('.sigma-detail');
    const measured=meta.querySelector('.sigma-measured');
    const statusText=health.querySelector('.sigma-health-text');
    const time=heading.querySelector('.sigma-time');

    let begun=0,lastEvent=0,lastStage=0,lastTick=0,stage=0,stageName='idle',source=null;
    let fraction=null,mode='indeterminate',labelText='',cancelRequested=false,wasVisible=false;
    let reportedError='',unresponsiveMs=0,healthLevel='good',warnText='';
    const now=()=>performance.now();
    function classify(raw){
      const text=raw.toLowerCase();
      if(/cancel/.test(text))return {index:stage,kind:'cancel',description:'Stopping at the next safe cancellation point.'};
      if(/decod|converting |reading audio/.test(text))return {index:0,kind:'decode',description:'Decoding audio · the browser cannot measure this step.'};
      if(/transcrib|melody|note candidate|extracting|preparing audio|loudness/.test(text))return {index:1,kind:'notes',description:'Detecting notes and timing in your recording.'};
      if(/building sseq|validated existing sseq|calculating sha|sha-256/.test(text))return {index:2,kind:'sequence',description:'Building and checking the SSEQ sequence.'};
      if(/uploading audio|uploading in chunks/.test(text))return {index:3,kind:'transfer',description:'Uploading SSEQ bytes to storage.'};
      if(/upload|transfer|permission|bot verification|turnstile/.test(text))return {index:3,kind:'request',description:'Preparing a secure upload.'};
      if(/validat|verif|awaiting trusted|server/.test(text))return {index:4,kind:'verify',description:'Waiting for SSEQ verification by the server.'};
      return {index:Math.max(0,stage),kind:'other',description:'Working on the current operation.'};
    }
    const seconds=(ms)=>Math.max(0,Math.floor(ms/1000));
    function snapshot(){const n=now();return {
      status:healthLevel,step:stepNames[stage],label:labelText.slice(0,180),
      elapsedSeconds:seconds(n-begun),secondsSinceProgress:seconds(n-lastEvent),secondsInStage:seconds(n-lastStage),
      percentOfCurrentStage:mode==='determinate'&&Number.isFinite(fraction)?Math.round(fraction*100):null,
      browserUnresponsiveGapSeconds:Math.round(unresponsiveMs/1000),fileType:source?.extension||null,
      sourceBytes:source?.bytes||null,cancelRequested,online:navigator.onLine,
      lastJavaScriptError:reportedError.slice(0,200),
      warning:warnText,
      note:'Timing is measured in this browser; a lack of progress is not proof of a crash. Source audio is not included.'
    };}
    function redraw(){
      if(!wasVisible)return;
      const n=now(), elapsed=seconds(n-begun),idle=seconds(n-lastEvent);
      const s=classify(labelText);
      if(!cancelRequested && document.visibilityState==='visible'){
        if(reportedError){healthLevel='error';warnText='JavaScript reported an error. Copy diagnostics to investigate.';}
        else if(unresponsiveMs>4000){healthLevel='slow';warnText='The browser was unresponsive or the tab was paused briefly.';}
        else if(idle>=60){healthLevel='stalled';warnText='No measurable progress for over one minute. The process may be stuck; try Cancel.';}
        else if(idle>=20){healthLevel='slow';warnText='Still working, but no measurable progress recently.';}
        else {healthLevel='good';warnText='';}
      }else if(cancelRequested){healthLevel='slow';warnText='Cancellation requested. The decoder may finish its current operation first.';}
      else {healthLevel='good';warnText='';}
      root.dataset.sigmaHealth=healthLevel;
      statusText.textContent=healthLevel==='good'?'Interface responding · processing':
        healthLevel==='stalled'?'Possible stall · no progress':
        healthLevel==='error'?'JavaScript error observed':cancelRequested?'Stopping…':'Slow or interrupted';
      warning.hidden=!warnText;warning.textContent=warnText;
      time.textContent=`${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`;
      description.textContent=s.description+` · last update ${idle}s ago`;
      measured.textContent=mode==='determinate'&&Number.isFinite(fraction)
        ?Math.round(fraction*100)+'% of '+(s.kind==='transfer'?'upload':'note analysis')
        :'Active…';
      root.dataset.sigmaMode=mode;
      if(mode==='determinate'&&Number.isFinite(fraction))fill.style.width=(fraction*100)+'%';
      root.setAttribute('aria-busy','true');
      const bar=fill.parentElement;
      bar.setAttribute('role','progressbar');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');
      if(mode==='determinate')bar.setAttribute('aria-valuenow',String(Math.round(fraction*100)));
      else bar.removeAttribute('aria-valuenow');
      bar.setAttribute('aria-label',stepNames[stage]+' progress');
      stepNodes.forEach((li,i)=>{li.className=i<stage?'done':i===stage?'current':''});
      if(!report.hidden)report.textContent=JSON.stringify(snapshot(),null,2);
    }
    function activate(){const n=now();if(wasVisible)return;wasVisible=true;begun=n;lastEvent=n;lastStage=n;
      cancelRequested=false;reportedError='';unresponsiveMs=0;lastTick=n;}
    function onProgress(e){
      if(root.classList.contains('hide'))return;
      activate();const data=e.detail||{},text=String(data.text||label.textContent||'');
      const info=classify(text);const f=Number(data.metrics?.fraction);
      const newMode=(info.kind==='notes'&&/^Transcribing melody/i.test(text)||info.kind==='transfer')&&
        Number.isFinite(f)&&data.metrics?.fraction!==null&&data.metrics?.fraction!==undefined?'determinate':'indeterminate';
      const v=newMode==='determinate'?Math.min(1,Math.max(0,f)):null;
      const n=now();
      if(info.index!==stage){lastStage=n;stage=info.index;stageName=info.kind;}
      if(text!==labelText || mode!==newMode || v!==fraction)lastEvent=n;
      labelText=text;mode=newMode;fraction=v;redraw();
    }
    function onSource(e){source=e.detail||null;wasVisible=false;stage=0;labelText='';fraction=null;mode='indeterminate';}
    function onFinish(){wasVisible=false;root.dataset.sigmaMode='indeterminate';
      root.removeAttribute('aria-busy');lastTick=0;source=null;}
    window.addEventListener('sigma:upload-progress',onProgress);
    window.addEventListener('sigma:upload-source',onSource);
    window.addEventListener('sigma:upload-finished',onFinish);
    cancel.addEventListener('click',()=>{if(!wasVisible)return;cancelRequested=true;
      statusText.textContent='Stopping…';measured.textContent='Cancel requested';redraw();},{capture:true});
    const update=()=>{const n=now();if(wasVisible&&document.visibilityState==='visible'&&lastTick&&n-lastTick>5000)
      unresponsiveMs=Math.max(unresponsiveMs,n-lastTick-1000);
      lastTick=n;redraw();};
    setInterval(update,900);
    window.addEventListener('error',e=>{if(!wasVisible)return;reportedError=String(e.message||'Script error').slice(0,200);redraw();});
    window.addEventListener('unhandledrejection',e=>{if(!wasVisible)return;
      reportedError=String(e.reason?.message||'Unhandled async error').slice(0,200);redraw();});
    details.addEventListener('click',()=>{report.hidden=!report.hidden;
      details.setAttribute('aria-expanded',String(!report.hidden));details.textContent=report.hidden?'Details':'Hide details';redraw();});
    copy.addEventListener('click',async()=>{
      const data=JSON.stringify(snapshot(),null,2);
      try{if(!navigator.clipboard?.writeText)throw Error('Clipboard API unavailable');
        await navigator.clipboard.writeText(data);copy.textContent='Copied ✓';}
      catch{report.hidden=false;report.textContent=data;details.textContent='Hide details';
        details.setAttribute('aria-expanded','true');copy.textContent='Select diagnostics below';}
    });
    window.SigmaUploadMonitor={snapshot};
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
