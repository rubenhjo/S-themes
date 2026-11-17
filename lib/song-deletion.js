import {timingSafeEqual} from 'node:crypto';
import {env,BUCKET,err,rpc} from './common.js';

export function isValidSecret(value){return typeof value==='string'&&/^[0-9a-f]{64}$/i.test(value)}
export function isAdminDeletionToken(value){
 const expected=process.env.SONG_DELETE_ADMIN_TOKEN;
 if(!isValidSecret(expected)||!isValidSecret(value))return false;
 return timingSafeEqual(Buffer.from(value,'hex'),Buffer.from(expected,'hex'));
}
export function assertStoredSongPath(path,id){
 if(path!==`uploads/${id}.sseq`)throw err(502,'Stored music path has an unexpected format');
}
export async function removeSongObject(path,id){
 assertStoredSongPath(path,id);
 const {url,key}=env();
 let response;
 try{response=await fetch(url+'/storage/v1/object/'+BUCKET+'/'+path,{
   method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)
 });}catch{return false}
 if(!response.ok&&response.status!==404)return false;
 try{return !!(await rpc('mark_theme_song_storage_deleted',{p_id:id,p_path:path}))}catch{return false}
}
