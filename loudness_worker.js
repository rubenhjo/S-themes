/* Self-contained loudness worker. Gated K-weighted EBU R128/ITU-R BS.1770 and 4x FIR true-peak.
   Avoids claiming Spotify's proprietary limiter or codec. */
function coeffShelf(fs){
 const gain=3.99984385397,fc=1681.974450955533,Q=.7071752369554196;
 const A=Math.pow(10,gain/40),w=2*Math.PI*fc/fs,cs=Math.cos(w),sn=Math.sin(w),alpha=sn/(2*Q),root=2*Math.sqrt(A)*alpha;
 const b0=A*((A+1)+(A-1)*cs+root),b1=-2*A*((A-1)+(A+1)*cs),b2=A*((A+1)+(A-1)*cs-root),a0=(A+1)-(A-1)*cs+root,a1=2*((A-1)-(A+1)*cs),a2=(A+1)-(A-1)*cs-root;
 return [b0/a0,b1/a0,b2/a0,a1/a0,a2/a0];
}
function coeffHighPass(fs){
 const w=2*Math.PI*38.13547087602444/fs,cs=Math.cos(w),sn=Math.sin(w),alpha=sn/(2*.5003270373238773);
 const b0=(1+cs)/2,b1=-(1+cs),b2=(1+cs)/2,a0=1+alpha,a1=-2*cs,a2=1-alpha;
 return [b0/a0,b1/a0,b2/a0,a1/a0,a2/a0];
}
function integrated(channels,fs){
 const hop=Math.max(1,Math.round(fs*.1)),n=channels[0].length,N=Math.ceil(n/hop),totals=new Float64Array(N),sh=coeffShelf(fs),hp=coeffHighPass(fs);
 for(const input of channels){
  let x1=0,x2=0,y1=0,y2=0,u1=0,u2=0,v1=0,v2=0,sum=0,b=0,idx=0;
  for(let i=0;i<n;i++){
   const x=input[i],y=sh[0]*x+sh[1]*x1+sh[2]*x2-sh[3]*y1-sh[4]*y2;
   x2=x1;x1=x;y2=y1;y1=y;
   const z=hp[0]*y+hp[1]*u1+hp[2]*u2-hp[3]*v1-hp[4]*v2;
   u2=u1;u1=y;v2=v1;v1=z;sum+=z*z;b++;
   if(b===hop||i===n-1){totals[idx++]+=sum/b;sum=0;b=0}
  }
 }
 const energies=[];for(let i=0;i+3<N;i++){const z=(totals[i]+totals[i+1]+totals[i+2]+totals[i+3])/4;
  if(z>0&&-.691+10*Math.log10(z)>-70)energies.push(z)}
 if(!energies.length)return -Infinity;
 const mean=energies.reduce((a,b)=>a+b,0)/energies.length,rel=mean*.1;
 let sum=0,count=0;for(const z of energies)if(z>=rel){sum+=z;count++}
 return count?-.691+10*Math.log10(sum/count):-Infinity;
}
function truePeak(channels){
 const L=24;const phaseFilters=[];
 for(let phase=1;phase<4;phase++){
  const coefficients=new Float64Array(L*2+1);let normalize=0;
  for(let k=-L;k<=L;k++){
   const delta=phase/4-k,p=Math.PI*delta;
   const sinc=delta===0?1:Math.sin(p)/p;
   const angle=(k+L)/(L*2),blackman=.42-.5*Math.cos(2*Math.PI*angle)+.08*Math.cos(4*Math.PI*angle);
   const v=sinc*blackman;coefficients[k+L]=v;normalize+=v;
  }
  for(let k=0;k<coefficients.length;k++)coefficients[k]/=normalize;
  phaseFilters.push(coefficients);
 }
 let maximum=0;
 for(const samples of channels){
  const length=samples.length;for(let i=0;i<length;i++)maximum=Math.max(maximum,Math.abs(samples[i]));
  for(let i=0;i<length;i++){
   // Sinc interpolation of samples between original sample instants (4x true-peak).
   for(const f of phaseFilters){let interpolated=0;
    const kmin=Math.max(-L,-i),kmax=Math.min(L,length-i-1);
    for(let k=kmin;k<=kmax;k++)interpolated+=samples[i+k]*f[k+L];
    maximum=Math.max(maximum,Math.abs(interpolated));
   }
  }
 }
 return maximum>0?20*Math.log10(maximum):-Infinity;
}
self.onmessage=e=>{
 try{const {id,channels,fs}=e.data;if(!channels||channels.length<1||channels.length>2)throw Error('Only mono and stereo are supported for loudness metering');
  const lufs=integrated(channels,fs),truePk=truePeak(channels);
  self.postMessage({id,metrics:{lufs:Math.round(lufs*100)/100,truePeak:Math.round(truePk*100)/100}});
 }catch(error){self.postMessage({id,error:String(error.message||error)})}
};
