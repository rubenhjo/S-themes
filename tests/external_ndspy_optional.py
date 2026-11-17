"""Optional genuinely independent Nintendo DS SSEQ reader.
Requires `python -m pip install ndspy==4.2.0` in an environment with PyPI.
Does not silently substitute our own Python parser if the package is missing.
Usage: python tests/external_ndspy_optional.py path/to/song.sseq [...]
"""
import sys
from pathlib import Path
try:
 import ndspy.soundSequence as nds
except ImportError:
 print('NOT TESTED: external ndspy is not installed; install ndspy on a network-enabled test machine')
 sys.exit(2)
files=sys.argv[1:] or [str(Path(__file__).parent/'fixtures'/'melody.sseq'),str(Path(__file__).parent/'fixtures'/'melody_with_chords.sseq')]
for filename in files:
 sseq=nds.SSEQ.fromFile(filename)
 sseq.parse()
 events=getattr(sseq,'events',None)
 if not events:raise RuntimeError('ndspy yielded no events for '+filename)
 count=sum(isinstance(event,nds.NoteSequenceEvent) for event in events)
 if count==0:raise RuntimeError('ndspy decoded no note commands in '+filename)
 print('PASS external ndspy parser:',filename,'note commands:',count)
