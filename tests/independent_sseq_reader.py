"""Read the subset of Nitro SSEQ emitted by sigma-themes independently in Python.

This does NOT use the JavaScript parser/writer. It is a format regression check,
not a licensed ndspy corpus test or evidence of HeartGold game playback.
"""
import struct
import sys
from pathlib import Path


def parse(filename):
    data=Path(filename).read_bytes()
    assert len(data)>=31 and data[:4]==b'SSEQ', 'bad SSEQ header'
    bom,ver,total,head,chunks=struct.unpack_from('<HHIHH',data,4)
    assert (bom,ver,total,head,chunks)==(0xfeff,0x100,len(data),16,1), 'invalid Nitro header'
    assert data[16:20]==b'DATA', 'missing DATA block'
    assert struct.unpack_from('<II',data,20)==(len(data)-16,28), 'bad DATA block length or offset'
    stream=data[28:]
    starts=[(0,0)]
    if stream[0]==0xfe:  # Track definition and 0x93 open-track commands
        assert len(stream)>=4,'truncated track header'
        mask=struct.unpack_from('<H',stream,1)[0]
        assert mask&1, 'missing main track'
        off=3
        openings=[]
        while off<len(stream) and stream[off]==0x93:
            assert off+5<=len(stream),'truncated track open'
            track=stream[off+1]
            target=stream[off+2] | (stream[off+3]<<8) | (stream[off+4]<<16)
            assert track>0 and ((mask>>track)&1) and target<len(stream), 'bad track target'
            openings.append((track,target))
            off+=5
        starts=[(0,off)]+openings
        assert len({x for x,_ in starts})==len(starts), 'duplicate track id'
        assert set(t for t,_ in starts)=={i for i in range(16) if mask&(1<<i)}, 'bad track mask'
    results=[]
    for track,pos in starts:
        notes=[];tick=0;program=0;tempo=None;loop=False;ended=False;steps=0
        def vlq():
            nonlocal pos
            n=0
            for _ in range(4):
                assert pos<len(stream),'truncated VLQ'
                c=stream[pos];pos+=1;n=(n<<7)|(c&127)
                if c<128:return n
            raise AssertionError('invalid VLQ')
        while pos<len(stream):
            steps+=1
            assert steps<50000, 'event budget exceeded'
            op=stream[pos];pos+=1
            if op<128:
                assert pos<len(stream),'truncated note'
                velocity=stream[pos];pos+=1
                duration=vlq()
                assert 1<=velocity<=127 and duration>0,'invalid note event'
                notes.append((op,tick,duration,velocity,program))
            elif op==0x80:tick+=vlq()
            elif op==0x81:program=vlq()
            elif op==0xc7:
                assert pos<len(stream) and stream[pos] in (0,1),'invalid poly mode'
                pos+=1
            elif op==0xe1:
                assert pos+2<=len(stream),'truncated tempo'
                tempo=struct.unpack_from('<H',stream,pos)[0];pos+=2
            elif op==0xd4:
                assert pos<len(stream),'truncated loop'
                loop=(stream[pos]==0);pos+=1
            elif op==0xfc:pass
            elif op==0xff:ended=True;break
            else:raise ValueError(f'Unsupported opcode 0x{op:02x} in fixture reader')
        assert ended, f'missing end for track {track}'
        results.append({'track':track,'notes':notes,'tempo':tempo,'loop':loop})
    notes=[n for tr in results for n in tr['notes']]
    assert notes,'empty musical sequence'
    return {'bytes':len(data),'tracks':results,'notes':[n[0] for n in notes],
            'tempo':next((t['tempo'] for t in results if t['tempo'] is not None),120),
            'loop':any(t['loop'] for t in results)}


if __name__=='__main__':
    if sys.argv[1:]:
        for name in sys.argv[1:]:
            result=parse(name)
            print(name, 'bytes:',result['bytes'],'tracks:',len(result['tracks']),'notes:',result['notes'],'loop:',result['loop'])
    else:
        root=Path(__file__).resolve().parent/'fixtures'
        a=parse(root/'melody.sseq');b=parse(root/'melody_b.sseq')
        c=parse(root/'melody_with_chords.sseq')
        assert a['notes']==[60,62,64,67] and b['notes']==[67,65,62,60]
        assert len(c['tracks'])>=3 and {48,52,55,60,62,65,67}.issubset(c['notes'])
        assert a['loop'] and b['loop'] and c['loop']
        print('PASS independent Python reader: WAV, MP3 and synthetic chord-mix SSEQ outputs')
