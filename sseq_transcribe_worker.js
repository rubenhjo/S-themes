/* Off-main-thread spectral transcription. No audio files, banks, or samples are stored. */
'use strict';
importScripts('sseq_transcribe.js');
self.onmessage = (event)=>{
 try{
  const mono=new Float32Array(event.data.mono);
  const result=self.SigmaTranscribe.spectralFrames(mono,event.data.rate,{maxSeconds:360,
   onProgress:(fraction)=>self.postMessage({progress:fraction})});
  self.postMessage({result});
 }catch(e){self.postMessage({error:String(e.message||e)})}
};
