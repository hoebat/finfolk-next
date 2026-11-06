"""Transfer a paused ocean acquisition between computers without resetting its budget."""
import argparse
import fcntl
import json
import re
import shutil
import time
from contextlib import contextmanager
from pathlib import Path

try:
    import ocean_acquisition as acq
except ImportError:
    from scripts import ocean_acquisition as acq

CHECKPOINT = 'datasets/ocean/checkpoint.json'


@contextmanager
def stopped(root):
    cache = root / '.cache/ocean-acquisition'
    cache.mkdir(parents=True, exist_ok=True)
    with (cache / 'run.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if acq.other_runners(root):
            raise RuntimeError('Stop acquisition before transferring its checkpoint')
        yield cache


def export(root):
    with stopped(root) as cache:
        manifest = root / 'datasets/ocean/acquisition-manifest.json'
        assets = {a['id']: a for s in acq.load(manifest)['sources'] for a in s['assets']}
        ledger = acq.load(cache / 'ledger.json')
        partials = []
        for directory in sorted((cache / 'partial').iterdir()):
            files = acq.parts_for(directory)
            if not files:
                continue
            asset = assets[directory.name]
            resume = acq.load(directory / 'resume.json')
            if not resume.get('validator') or resume['validator'] != (asset.get('etag') or asset.get('last_modified')):
                raise ValueError('Unverified resume validator: ' + directory.name)
            if sum(p.stat().st_size for p in files) > asset['bytes']:
                raise ValueError('Oversized partial: ' + directory.name)
            parts = []
            for i, source in enumerate(files):
                size = source.stat().st_size
                if source.name != f'{i:06d}.bin' or not 0 < size <= acq.PART or (i < len(files)-1 and size != acq.PART):
                    raise ValueError('Malformed partial: ' + str(source))
                target = root / 'datasets/raw/ocean/_checkpoint' / directory.name / source.name
                target.parent.mkdir(parents=True, exist_ok=True)
                checksum = acq.digest(source)
                if not target.exists() or acq.digest(target) != checksum:
                    shutil.copyfile(source, target)
                if acq.digest(target) != checksum:
                    raise ValueError('Checkpoint copy failed')
                parts.append({'path': target.relative_to(root).as_posix(), 'bytes': size, 'sha256': checksum})
            partials.append({'id': directory.name, 'resume': resume, 'parts': parts})
        checkpoint = {'schema_version': 1, 'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                      'paused': True, 'limit_bytes': acq.LIMIT, 'ledger': ledger,
                      'manifest_sha256': acq.digest(manifest), 'partials': partials,
                      'note': 'Quarantined suspect bytes remain on the original computer and are not resumable assets.'}
        acq.save(root / CHECKPOINT, checkpoint)
        return {'partials': len(partials), 'bytes': sum(p['bytes'] for a in partials for p in a['parts']),
                'charged_bytes': ledger['charged_bytes'], 'checkpoint': CHECKPOINT}


def restore(root):
    with stopped(root) as cache:
        checkpoint = acq.load(root / CHECKPOINT)
        if checkpoint['schema_version'] != 1 or checkpoint['limit_bytes'] != acq.LIMIT:
            raise ValueError('Unsupported checkpoint or changed batch budget')
        if acq.digest(root / 'datasets/ocean/acquisition-manifest.json') != checkpoint['manifest_sha256']:
            raise ValueError('Manifest differs from checkpoint; do not restore over newer acquisition state')
        ledger = checkpoint['ledger']
        if not 0 <= ledger['charged_bytes'] <= acq.LIMIT:
            raise ValueError('Invalid checkpoint ledger')
        copies = []
        resumes = []
        for partial in checkpoint['partials']:
            ident = partial['id']
            if not re.fullmatch(r'[a-z0-9_-]+', ident):
                raise ValueError('Unsafe partial identity')
            directory = cache / 'partial' / ident
            expected_names = set()
            for i, part in enumerate(partial['parts']):
                source = acq.safe(root, part['path'])
                if source.name != f'{i:06d}.bin' or not 0 < part['bytes'] <= acq.PART:
                    raise ValueError('Invalid checkpoint part')
                if i < len(partial['parts'])-1 and part['bytes'] != acq.PART:
                    raise ValueError('Incomplete non-final checkpoint part')
                if source.stat().st_size != part['bytes'] or acq.digest(source) != part['sha256']:
                    raise ValueError('Missing, unhydrated or corrupt checkpoint payload: ' + part['path'])
                target = directory / source.name
                expected_names.add(source.name)
                if target.exists() and (target.stat().st_size != part['bytes'] or acq.digest(target) != part['sha256']):
                    raise ValueError('Existing partial differs; refusing to overwrite: ' + str(target))
                if not target.exists():
                    copies.append((source, target, part['bytes']))
            if any(p.name not in expected_names for p in acq.parts_for(directory)):
                raise ValueError('Existing partial contains newer parts')
            resume = directory / 'resume.json'
            if resume.exists() and acq.load(resume) != partial['resume']:
                raise ValueError('Existing resume validator differs')
            resumes.append((resume, partial['resume']))
        if shutil.disk_usage(root).free < acq.RESERVE + sum(size for _, _, size in copies):
            raise ValueError('Insufficient free space to restore partials and retain reserve')
        # Validate everything before restoring. Write the ledger first so an
        # interrupted restore can never expose an empty acquisition allowance.
        ledgerpath = cache / 'ledger.json'
        if not ledgerpath.exists() or acq.load(ledgerpath)['charged_bytes'] < ledger['charged_bytes']:
            acq.save(ledgerpath, ledger)
        acq.save(cache / 'stop-request.json', {'reason': 'Restored checkpoint; acquisition remains paused'})
        for source, target, _ in copies:
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix('.restore-tmp')
            shutil.copyfile(source, temporary)
            temporary.replace(target)
        for path, value in resumes:
            acq.save(path, value)
        return {'restored_partials': len(resumes), 'charged_bytes': acq.load(ledgerpath)['charged_bytes'],
                'paused': True, 'next_action': 'Review handoff and explicitly resume; restoration does not start downloads.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['export', 'restore'])
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    print(json.dumps(export(args.root) if args.command == 'export' else restore(args.root), indent=2))
