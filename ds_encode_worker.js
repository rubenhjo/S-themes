/* Dedicated DSP worker for batch Nintendo DS audio encoding. Keeps ZIP preparation responsive. */
self.importScripts('ds_audio.js');
self.onmessage=async event=>{
 const {id,channels,rate,format,loop}=event.data||{};
 try{
  if(!Array.isArray(channels)||channels.length<1||channels.length>2)throw Error('Only one or two channels allowed');
  if(channels.some(c=>!(c instanceof Float32Array)||c.length===0))throw Error('Invalid audio channels');
  const blob=format==='pcm16'?self.SigmaDS.encodePcmWav(channels,rate,loop):self.SigmaDS.encodeImaWav(channels,rate,loop);
  const output=await blob.arrayBuffer();
  self.postMessage({id,audio:output},[output]);
 }catch(e){self.postMessage({id,error:String(e.message||e)})}
};
