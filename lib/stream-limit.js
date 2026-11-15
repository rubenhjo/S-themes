/** Bound untrusted media streams independently from Content-Length, which may be absent or wrong. */
import {Transform} from 'node:stream';
export function boundedBytes(maxBytes){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new TypeError('Invalid byte limit');
  let total=0;
  return new Transform({
    transform(chunk,encoding,callback){
      total+=chunk.length;
      if(total>maxBytes){
        const error=new Error('Audio object exceeds the allowed byte limit');
        error.code='AUDIO_OBJECT_TOO_LARGE';
        callback(error);
      }else callback(null,chunk);
    }
  });
}
