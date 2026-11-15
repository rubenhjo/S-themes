/** Strict RFC 4180-compatible small metadata CSV parser.
 * Accepts CRLF/LF, quoted commas, doubled quotes, embedded newlines, UTF-8 BOM.
 * Rejects unterminated quotations rather than silently producing the wrong metadata.
 */
export function parseCSV(raw){
 const text=String(raw||'').replace(/^\uFEFF/,'');
 const rows=[];let row=[],cell='',quoted=false,afterQuote=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else {quoted=false;afterQuote=true}}
   else cell+=c;
   continue;
  }
  if(c==='"'){
   if(cell||afterQuote)throw Error('Unexpected quote in CSV');
   quoted=true;continue;
  }
  if(afterQuote && c!==',' && c!=='\r' && c!=='\n')throw Error('Characters after quoted field');
  if(c===','){row.push(cell);cell='';afterQuote=false;continue}
  if(c==='\r'||c==='\n'){
   if(c==='\r'&&text[i+1]==='\n')i++;
   row.push(cell);if(row.some(x=>x!==''))rows.push(row);
   row=[];cell='';afterQuote=false;continue;
  }
  cell+=c;
 }
 if(quoted)throw Error('Unterminated quoted CSV field');
 row.push(cell);
 if(row.some(x=>x!==''))rows.push(row);
 if(rows.length===0)return [];
 const width=rows[0].length;
 for(let i=1;i<rows.length;i++)if(rows[i].length!==width)throw Error(`CSV column mismatch on record ${i+1}`);
 return rows;
}
export function parseMetadataCSV(text){
 const rows=parseCSV(text);if(!rows.length)return new Map();
 const headers=rows.shift().map(x=>x.trim().toLowerCase());
 if(!headers.includes('filename')||new Set(headers).size!==headers.length)throw Error('CSV requires unique filename column');
 const map=new Map();for(const values of rows){
  const entry=Object.fromEntries(headers.map((key,i)=>[key,values[i]||'']));
  if(entry.filename){if(map.has(entry.filename))throw Error('Duplicate filename in metadata CSV');map.set(entry.filename,entry)}
 }
 return map;
}
