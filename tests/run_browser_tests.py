"""Run independent browser suites with deadlines and process-tree cleanup.

A Python child can exit while leaving Chromium children running. `subprocess.run`
with a timeout only terminates the Python parent, not its browser descendants.
Starting a new process group and killing that group on timeout prevents a hung
suite from poisoning the next suite or leaving CI runners blocked.
"""
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SUITES = [
    'browser_sprite_visibility.py',
    'browser_public.py',
    # The historical large-MP3/TUS upload case is obsolete for <=64 KiB SSEQ.
    # Regression remains in source history; new SSEQ file-input path is tested below.
    'browser_sseq_upload_pipeline.py',
    'browser_catalog_integrity.py',
    'browser_sigma_export.py',
    'browser_sseq_conversion.py',
    'browser_sseq_player.py',
    'browser_upload_dialog.py',
    'browser_transcription_worker.py',
    'browser_progress_health.py',
    'browser_status.py',
]



def execute_suite(script: str, timeout: int = 75) -> float:
    started = time.monotonic()
    print(f'RUN {script}', flush=True)
    cmd = [sys.executable, '-u', str(ROOT / script)]
    kwargs = {'start_new_session': True} if os.name == 'posix' else {
        'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP
    }
    process = subprocess.Popen(cmd, **kwargs)
    try:
        code = process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f'TIMEOUT {script} after {timeout}s; browser process tree killed')
    finally:
        # Even on a successful Python exit, Chromium descendants might remain.
        # Cleanup their isolated process group so the next suite starts cleanly.
        if os.name == 'posix':
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        elif process.poll() is None:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(process.pid)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        if process.poll() is None:
            process.wait(timeout=10)
    if code != 0:
        raise RuntimeError(f'FAIL {script}: exit {code}')
    elapsed = time.monotonic() - started
    print(f'PASS {script} in {elapsed:.1f}s', flush=True)
    return elapsed


def main():
    try:
        for script in SUITES:
            execute_suite(script)
    except (RuntimeError, OSError) as error:
        print(error, file=sys.stderr, flush=True)
        return 1
    print(f'PASS all {len(SUITES)} Chromium suites', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
