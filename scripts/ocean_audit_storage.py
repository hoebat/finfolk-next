"""Reversible macOS filesystem compression for immutable large audit JSON.

Paths, logical bytes and hashes remain unchanged. Other platforms are a no-op.
"""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def digest(path):
    result=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(8*1024**2),b''):result.update(chunk)
    return result.hexdigest()


def compact(path, minimum_bytes=64*1024**2):
    path=Path(path);before=path.stat()
    if sys.platform!='darwin' or not shutil.which('ditto') or before.st_size<minimum_bytes:
        return 0
    allocated=before.st_blocks*512
    if allocated<before.st_size//2:return 0
    checksum=digest(path)
    with tempfile.TemporaryDirectory(prefix='.audit-compact-',dir=path.parent) as directory:
        target=Path(directory)/path.name
        subprocess.run(['ditto','--hfsCompression',str(path),str(target)],check=True,capture_output=True)
        if digest(target)!=checksum:raise ValueError('Audit compression changed logical bytes')
        current=path.stat()
        if (current.st_mtime_ns,current.st_size)!=(before.st_mtime_ns,before.st_size):
            raise ValueError('Audit changed during compaction')
        after=target.stat().st_blocks*512
        if after>=allocated:return 0
        os.replace(target,path)
        return allocated-after


def compact_run(root, plan):
    from scripts import ocean_coastal as c
    paths=[c.run_directory(root,plan)/'non-vic-coverage.json']
    paths.extend(c.state_directory(root,plan,state)/'catalog.json' for state in c.STATES)
    saved=0
    for path in paths:
        if not path.exists():continue
        try:saved+=compact(path)
        except (OSError,ValueError,subprocess.CalledProcessError) as error:
            # Compression is optional. A failed copy is discarded by compact;
            # it must never invalidate a verified scientific source.
            print('Audit compression skipped; original retained:',path,type(error).__name__,flush=True)
    return saved
