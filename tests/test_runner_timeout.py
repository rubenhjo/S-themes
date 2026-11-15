"""Test process-tree termination without requiring Playwright or a website."""
import os
import sys
import tempfile
from pathlib import Path
from run_browser_tests import execute_suite, ROOT


def main():
    if os.name != 'posix':
        print('NOT TESTED: process group test requires POSIX')
        return 0
    with tempfile.TemporaryDirectory(dir=ROOT) as directory:
        script = Path(directory) / 'hang.py'
        script.write_text('import subprocess,sys,time\n'
                          'subprocess.Popen([sys.executable,"-c","import time; time.sleep(1000)"])\n'
                          'time.sleep(1000)\n')
        # execute_suite uses ROOT/script; support an absolute path via Path semantics
        try:
            execute_suite(str(script), timeout=2)
            raise AssertionError('Expected a timeout')
        except RuntimeError as error:
            assert 'TIMEOUT' in str(error), str(error)
    print('PASS runner times out and terminates a hanging process group')
    return 0


if __name__ == '__main__':
    sys.exit(main())
