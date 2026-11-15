/** A lost HTTP response does not mean a queue/write operation was rolled back. */
export function adminUploadOutcome(row,expectedHash){
 if(!row || row.sha256!==expectedHash)return 'unknown';
 if(row.status==='published')return 'published';
 if(row.status==='validating'||row.status==='processing')return 'queued';
 if(row.status==='pending')return 'fail-first';
 if(row.status==='failed'||row.status==='expired')return 'delete';
 return 'unknown';
}
