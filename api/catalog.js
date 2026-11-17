import {sb, safeError, requireMethod, err} from '../lib/common.js';

// Keyset pagination: Supabase/PostgREST defaults to a maximum 1000 returned
// rows. A stable two-column cursor also avoids OFFSET shifting when a new
// track is inserted while the catalog is loading.
const PAGE_SIZE=500;
const MAX_ROWS=5000;
export async function readCatalog(fetchPage=sb){
  const tracks=[],seen=new Set();let cursor=null;
  for(let page=0;page<Math.ceil(MAX_ROWS/PAGE_SIZE);page++){
    const filter=cursor ? `&or=(created_at.lt.${encodeURIComponent(cursor.created_at)},and(created_at.eq.${encodeURIComponent(cursor.created_at)},id.lt.${cursor.id}))` : '';
    const requestUrl=`/rest/v1/theme_tracks?select=id,title,artist,album,duration_s,sha256,storage_path,mime_type,original_filename,size_bytes,created_at,sseq_id,loop_enabled,lufs,true_peak&mime_type=eq.application%2Foctet-stream&sseq_id=not.is.null&deleted_at=is.null&order=created_at.desc,id.desc&limit=${PAGE_SIZE}${filter}`;
    let rows;
    for(let attempt=0;attempt<3;attempt++){
      try{rows=await fetchPage(requestUrl);break;}catch(e){
        if(attempt===2 || (e.status && e.status<500 && e.status!==429))throw e;
        await new Promise(resolve=>setTimeout(resolve,200*(2**attempt)));
      }
    }
    if(!Array.isArray(rows) || rows.length>PAGE_SIZE)throw err(502,'Catalog pagination failed');
    for(const row of rows){if(!row.id||!row.created_at)throw err(502,'Catalog row incomplete');if(seen.has(row.id))throw err(502,'Catalog duplicate row');seen.add(row.id);tracks.push(row)}
    if(rows.length<PAGE_SIZE)return tracks;
    const last=rows.at(-1);const next={id:last.id,created_at:last.created_at};
    if(cursor&&cursor.id===next.id&&cursor.created_at===next.created_at)throw err(502,'Catalog cursor failed to advance');
    cursor=next;
  }
  throw err(503,'Catalog exceeds configured safe page limit');
}
export default async function handler(req,res){
 try{requireMethod(req,'GET');const tracks=await readCatalog();res.setHeader('Cache-Control','no-store');return res.status(200).json({tracks,complete:true});}
 catch(e){return safeError(res,e)}
}
