"""Optional offline A/B against open-source librosa YIN, same MIDI/WAV/MP3 cases.
YIN is MONOPHONIC. This is a reference comparator, NOT a replacement for the
polyphonic browser engine. This tool never runs on Vercel.
"""
import json,time,subprocess,resource
from pathlib import Path
import numpy as np
import librosa
ROOT=Path(__file__).resolve().parents[1]
MANIFEST=json.loads((ROOT/'tests/fixtures/polyphony/manifest.json').read_text())
BASE=json.loads((ROOT/'POLYPHONIC_BENCHMARK_RESULTS.json').read_text())
# A mono YIN candidate has to be converted into note on/off events for a fair
# comparison; we conservatively refuse frames with weak signal or tiny length.
def yin_decode(file):
 p=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(file),'-ac','1','-ar','11025','-f','f32le','pipe:1'],capture_output=True,check=True)
 return np.frombuffer(p.stdout,dtype='<f4').copy()
def yin_notes(samples):
 pitches=librosa.yin(samples,sr=11025,fmin=75,fmax=1100,frame_length=2048,hop_length=256)
 rms=librosa.feature.rms(y=samples,frame_length=2048,hop_length=256,center=True)[0]
 gate=max(1e-4,float(rms.max())*.075)
 selected=[int(np.rint(librosa.hz_to_midi(p))) if j<len(rms) and rms[j]>=gate and 35<=librosa.hz_to_midi(p)<=92 else None for j,p in enumerate(pitches)]
 notes=[];start=None;last=None;hop=256/11025
 for i,pitch in enumerate(selected+[None]):
  if pitch!=last:
   if last is not None and start is not None and (i-start)*hop>=.11:
    notes.append({'pitch':last,'start':start*hop,'duration':(i-start)*hop})
   start=i if pitch is not None else None
   last=pitch
 return notes

def compare(truth,got,strict):
 used=set();tp=0
 for e in truth:
  best=None;err=float('inf')
  for j,n in enumerate(got):
   if j in used or n['pitch']!=e['pitch']:continue
   ds=abs(e['start']-n['start']);de=abs(e['start']+e['duration']-n['start']-n['duration']);tol=max(.05,e['duration']*.2) if strict else .2
   if ds<=(.05 if strict else .2) and de<=tol and ds+de<err:best=j;err=ds+de
  if best is not None:tp+=1;used.add(best)
 return tp,len(got)-tp,len(truth)-tp

# Warm up JIT and imports, only measure inference thereafter.
yin_notes(np.sin(np.arange(22050)*2*np.pi*220/11025).astype(np.float32))
rows=[]
for case in MANIFEST:
 for ext in ('wav','mp3'):
  x=yin_decode(ROOT/'tests/fixtures/polyphony'/case[ext]);before=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;started=time.perf_counter();notes=yin_notes(x);elapsed=time.perf_counter()-started;after=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
  row={'case':case['name'],'codec':ext,'notes':notes,'milliseconds':round(elapsed*1000,2),'rss_kib_before':before,'rss_kib_after':after,
   'lenient':compare(case['truth'],notes,False),'strict':compare(case['truth'],notes,True)};rows.append(row)
  print(case['name'],ext,'pred',len(notes),'elapsed ms',round(elapsed*1000,1),'strict',row['strict'],flush=True)
summary={}
for label in ('lenient','strict'):
 tp=sum(r[label][0] for r in rows);fp=sum(r[label][1] for r in rows);fn=sum(r[label][2] for r in rows);p=tp/max(1,tp+fp);rec=tp/max(1,tp+fn)
 summary[label]={'tp':tp,'fp':fp,'fn':fn,'precision':p,'recall':rec,'f1':2*p*rec/(p+rec or 1)}
summary['processing_ms_total']=round(sum(r['milliseconds'] for r in rows),2)
summary['rss_kib_peak']=max(r['rss_kib_after'] for r in rows)
(ROOT/'LIBROSA_YIN_RESULTS.json').write_text(json.dumps({'library':f'librosa {librosa.__version__}','algorithm':'YIN mono + RMS silence gate', 'summary':summary,'rows':rows},indent=2))
print('summary',json.dumps(summary,indent=2))
