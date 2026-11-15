#!/usr/bin/env python3
"""Build *metadata only* profiles from private, user-supplied HeartGold sound assets.

No original SBNK/SWAR data is copied into the output. Instrument ranges are
included only when their note definitions reference available archive slots and
valid sample IDs. Keep input ZIP private; generated metadata should be treated
as version-specific, not proof of in-game playback.
"""
from pathlib import Path
import hashlib
import json
import struct
import sys
import zipfile

source = Path(sys.argv[1] if len(sys.argv) > 1 else 'HeartGold_instrumentfiler_US.zip')
target = Path(sys.argv[2] if len(sys.argv) > 2 else 'heartgold_bank_profiles.json')


def intervals(xs):
    xs = sorted(set(xs))
    result = []
    for v in xs:
        if result and v == result[-1][1] + 1:
            result[-1][1] = v
        else:
            result.append([v, v])
    return result


def valid_note(b, pos, kind, archive_slots, waves):
    if pos < 0 or pos + 10 > len(b):
        return False
    wave_id, archive_index = struct.unpack_from('<HH', b, pos)
    if kind == 1:
        if archive_index >= len(archive_slots):
            return False
        archive_id = archive_slots[archive_index]
        if archive_id is None or str(archive_id) not in waves:
            return False
        return wave_id < waves[str(archive_id)]['sample_count']
    if kind == 2:
        return wave_id <= 7  # PSG square duty cycle
    if kind == 3:
        return True  # White noise generator; no SWAR sample
    return False


def valid_program_pitches(b, pos, kind, archive_slots, waves):
    if kind in (1, 2, 3):
        return list(range(128)) if valid_note(b, pos, kind, archive_slots, waves) else []
    if kind == 16:
        if pos + 2 > len(b):
            return []
        first, last = b[pos:pos + 2]
        if first > last or last > 127 or pos + 2 + (last-first+1)*12 > len(b):
            return []
        return [n for n in range(first, last + 1)
                if (b[pos + 2 + 12*(n-first)] in (1,2,3)
                    and valid_note(b, pos + 2 + 12*(n-first) + 2,
                                   b[pos + 2 + 12*(n-first)], archive_slots, waves))]
    if kind == 17:
        if pos + 8 > len(b):
            return []
        ends = b[pos:pos+8]
        pitches = []
        start = 0
        for idx, end in enumerate(ends):
            if end == 0 and idx > 0:
                break
            if end < start or end > 127:
                return []
            entry_pos = pos + 8 + idx*12
            if entry_pos+12 > len(b):
                return []
            note_kind = b[entry_pos]
            if note_kind in (1,2,3) and valid_note(b, entry_pos+2, note_kind, archive_slots, waves):
                pitches.extend(range(start,end+1))
            start = end+1
            if end == 127:
                break
        return pitches
    return []

with zipfile.ZipFile(source) as z:
    src = json.loads(z.read('bankkart.json'))
    slots = {}
    for seq,v in src['sequence_slots'].items():
        if isinstance(v,dict) and str(v.get('bank')) in src['instrument_banks']:
            slots[seq] = {'name':v.get('name',f'SEQ_{seq}'),
                          'bank':int(v['bank']),'player':v.get('player',1)}
    waves = {}
    for id, entry in src['wave_archives'].items():
        b = z.read(entry['file'])
        digest = hashlib.sha256(b).hexdigest()
        if digest != entry['sha256'] or b[:4] != b'SWAR' or int.from_bytes(b[8:12], 'little') != len(b):
            raise ValueError(f'Invalid SWAR {id}')
        waves[id] = {'name':entry['name'], 'sample_count':int(entry['sample_count']),
                     'source_swar_sha256':digest}
    banks = {}
    for id,entry in src['instrument_banks'].items():
        b = z.read(entry['file'])
        digest = hashlib.sha256(b).hexdigest()
        if digest != entry['sha256'] or b[:4]!=b'SBNK' or b[16:20]!=b'DATA' or int.from_bytes(b[8:12],'little')!=len(b):
            raise ValueError(f'Invalid SBNK {id}')
        count = struct.unpack_from('<I',b,0x38)[0]
        if count>4096 or 0x3c+4*count>len(b):
            raise ValueError(f'Invalid instrument table {id}')
        archive_slots = entry['wave_archive_slots']
        programs=[]
        for i in range(count):
            kind=b[0x3c + i*4]
            ofs=struct.unpack_from('<H',b,0x3d + i*4)[0]
            if kind not in (1,2,3,16,17) or ofs < 0x3c + 4*count or ofs >= len(b):
                continue
            valid=valid_program_pitches(b,ofs,kind,archive_slots,waves)
            if valid:
                programs.append({'index':i,'kind':kind,'pitch_ranges':intervals(valid)})
        if not programs:
            raise ValueError(f'No validated instrument programs in bank {id}')
        banks[id]={'name':entry['name'],'programs':programs,
                   'wave_archive_slots':archive_slots,'source_sbnk_sha256':digest}

profile={'schema':'sigma-themes/heartgold-bank-profiles-v2', 'game':src['game'],
         'source_sdat_sha256':src['sdat_sha256'],
         'source':'private user-supplied HeartGold US instrument bundle (metadata only)',
         'sequence_slots':slots,'banks':banks,'wave_archives':waves}
target.write_text(json.dumps(profile,ensure_ascii=False,separators=(',',':'))+'\n')
print('Bank profiles:',len(banks),'sequence slots:',len(slots),'wave archives:',len(waves),
      'valid programs:',sum(len(x['programs']) for x in banks.values()), 'bytes:',target.stat().st_size)
