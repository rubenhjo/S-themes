/* Minimal, dependency-free metadata extraction. ID3v2.3/2.4 MP3 and FLAC Vorbis comments.
   Unsupported tags gracefully fall back to human-readable filenames; no embedded artwork is uploaded. */
(function(root){'use strict';
 const decode=(a,enc='utf-8')=>new TextDecoder(enc,{fatal:false}).decode(a).replace(/\u0000/g,'').trim();
 const syncsafe=(a,p)=>(a[p]<<21)|(a[p+1]<<14)|(a[p+2]<<7)|a[p+3];
 const be32=(a,p)=>(a[p]*16777216+a[p+1]*65536+a[p+2]*256+a[p+3]);
 const le32=(a,p)=>(a[p]+a[p+1]*256+a[p+2]*65536+a[p+3]*16777216);
 function tagText(bytes){if(!bytes.length)return '';const mode=bytes[0];let data=bytes.subarray(1);
  if(mode===0)return decode(data,'windows-1252');
  if(mode===3)return decode(data);
  if(mode===1){if(data[0]===255&&data[1]===254)return decode(data.subarray(2),'utf-16le');if(data[0]===254&&data[1]===255)return decode(data.subarray(2),'utf-16be');return decode(data,'utf-16le')}
  if(mode===2)return decode(data,'utf-16be');return '';
 }
 function parseID3(data){const out={};if(data.length<10||decode(data.subarray(0,3))!=='ID3')return out;
  const version=data[3],size=syncsafe(data,6);if(![3,4].includes(version)||size>4*1024*1024)return out;
  let i=10,stop=Math.min(data.length,10+size);
  if(data[5]&0x40){if(version===3){const extra=be32(data,i);if(extra>stop-i)return out;i+=4+extra}
   else{const extra=syncsafe(data,i);if(extra>stop-i)return out;i+=extra}}
  while(i+10<=stop){const id=decode(data.subarray(i,i+4));if(!/^[A-Z0-9]{4}$/.test(id))break;
   const count=version===4?syncsafe(data,i+4):be32(data,i+4);const flags=(data[i+8]<<8)|data[i+9];i+=10;
   if(count<=0||i+count>stop)break;
   if((flags & (version===4?0x000C:0x00C0))===0){const text=tagText(data.subarray(i,i+count));if(id==='TIT2')out.title=text;else if(id==='TPE1')out.artist=text;else if(id==='TALB')out.album=text}
   i+=count;
  }
  return out;
 }
 function parseFLAC(data){const out={};if(data.length<8||decode(data.subarray(0,4))!=='fLaC')return out;
  let i=4,last=false;while(!last&&i+4<=data.length){const type=data[i]&127;last=!!(data[i]&128);const len=data[i+1]*65536+data[i+2]*256+data[i+3];i+=4;if(len<0||i+len>data.length)break;
   if(type===4){let at=i;const end=i+len;if(at+4>end)break;let vendor=le32(data,at);at+=4+vendor;if(at+4>end)break;let count=Math.min(500,le32(data,at));at+=4;
    for(let k=0;k<count;k++){if(at+4>end)break;const n=le32(data,at);at+=4;if(n<0||at+n>end)break;const s=decode(data.subarray(at,at+n));at+=n;const sep=s.indexOf('=');if(sep>0){const key=s.slice(0,sep).toLowerCase(),value=s.slice(sep+1).trim();if(['title','artist','album'].includes(key)&&!out[key])out[key]=value;}}
    break;
   }
   i+=len;
  }return out;
 }
 async function read(file){const head=new Uint8Array(await file.slice(0,Math.min(file.size,1024*1024)).arrayBuffer());const ext=(file.name.split('.').pop()||'').toLowerCase();return ext==='mp3'?parseID3(head):ext==='flac'?parseFLAC(head):{};}
 root.SigmaMetadata={read,parseID3,parseFLAC};
})(typeof window!=='undefined'?window:globalThis);
