"""Independently compare manifest/catalog SSEQ hashes to ZIP music bytes.

This verifies our *synthetic example* package, NOT the live Supabase catalog or
Sigma Dex's separate game-side importer.
"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

path=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).parent.parent/'examples/sigma-dex-example-music.zip'
with zipfile.ZipFile(path) as z:
    files=set(z.namelist())
    entries=json.loads(z.read('tracks.json'))
    assert entries and all('source_sha256' in x for x in entries), 'missing source checksums'
    for entry in entries:
        name=entry['file']
        assert name.startswith('music/') and name.endswith('.sseq') and name in files, name
        data=z.read(name)
        actual=hashlib.sha256(data).hexdigest()
        assert actual==entry['source_sha256']==entry['sha256'], (name,actual,entry)
        assert data[:4]==b'SSEQ' and entry['bytes']==len(data), name
        print('PASS SSEQ source/ZIP identity:',name,actual)
    print(f'PASS {len(entries)} synthetic package song hashes; live catalog was NOT tested')
