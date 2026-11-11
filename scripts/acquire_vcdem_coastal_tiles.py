"""Acquire selected VCDEM ZIP members and write numeric 500m coastal-band COGs.

Shares the ocean acquisition lock, cumulative budget and disk reserve. The old
bulk collector's stop flag remains intact; this runner has its own stop flag.
"""
import argparse
import fcntl
import hashlib
import http.client
import io
import json
import os
import shutil
import struct
import time
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import URLError

import numpy as np
import rasterio
from rasterio.io import MemoryFile
from rasterio.mask import mask
from pyproj import Transformer
from shapely.geometry import box, mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

from scripts import ocean_acquisition as acq
from scripts.ocean_catalog import digest, load
from scripts.plan_vcdem_coastal_tiles import ARCHIVE_URL


def inflate(payload, member):
    decoder = zlib.decompressobj(-15)
    raw = decoder.decompress(payload, member['uncompressed_bytes'] + 1)
    if (not decoder.eof or decoder.unused_data or decoder.unconsumed_tail or
            len(raw) != member['uncompressed_bytes'] or zlib.crc32(raw) != member['crc32']):
        raise ValueError('ZIP member size/CRC mismatch')
    return raw


class Runner:
    def __init__(self, root, plan, coastline):
        self.root, self.plan = root, plan
        self.control = root / '.cache/ocean-coastal-tiles'
        self.control.mkdir(parents=True, exist_ok=True)
        self.ledger_path = root / '.cache/ocean-acquisition/ledger.json'
        self.ledger = load(self.ledger_path)
        self.manifest_path = root / 'datasets/ocean/coastal/vcdem-500m.json'
        self.identity = plan['source_identity']
        if plan['source_url'] != ARCHIVE_URL or not self.identity.get('etag'):
            raise ValueError('Inspected source identity required')
        self.key = hashlib.sha256(json.dumps(plan, sort_keys=True).encode()).hexdigest()
        if self.manifest_path.exists():
            self.manifest = load(self.manifest_path)
            if self.manifest['plan_sha256'] != self.key:
                raise ValueError('Existing run uses a different plan')
        else:
            self.manifest = {'schema_version': 1, 'plan_sha256': self.key,
                             'source_url': plan['source_url'], 'source_identity': self.identity,
                             'licence': 'CC BY 4.0',
                             'attribution': 'State of Victoria; VCDEM 2021/2022, Veris; Vicmap coastline',
                             'distance_m': plan['distance_from_coast_m'], 'cellsize_m': 2.5,
                             'coastline_sha256': plan['inputs']['coastline']['sha256'],
                             'band_sides': 'both sides of mapped shoreline; no land/water mask',
                             'datum_verified': False, 'scientific_quality_review': 'pending',
                             'tile_count': plan['tile_count'], 'assets': {}, 'state': 'running'}
        self.trees = {}
        lines = [shape(f['geometry']) for f in coastline['features']]
        for zone in (54, 55):
            projection = Transformer.from_crs(4326, 7800 + zone, always_xy=True)
            geometries = [transform(projection.transform, line) for line in lines]
            self.trees[zone] = (STRtree(geometries), geometries)

    def save(self):
        acq.save(self.manifest_path, self.manifest)

    def check(self, additional=acq.BLOCK):
        if (self.control / 'stop-request.json').exists():
            raise InterruptedError('Coastal stop requested')
        if shutil.disk_usage(self.root).free < acq.RESERVE + additional + 128 * 1024**2:
            raise InterruptedError('Protected disk reserve reached')
        if self.ledger['charged_bytes'] + additional > acq.LIMIT:
            raise InterruptedError('Shared transfer budget reached')

    def read_range(self, start, end, target=None):
        """Append exactly this byte interval; reserve charges before each read."""
        headers = {'Range': f'bytes={start}-{end}', 'If-Match': self.identity['etag']}
        with acq.request(self.plan['source_url'], headers) as response:
            expected = f"bytes {start}-{end}/{self.identity['bytes']}"
            if response.status != 206 or response.headers.get('Content-Range') != expected:
                raise ValueError('Server did not honor exact range; refusing full download')
            if response.headers.get('ETag') != self.identity['etag']:
                raise ValueError('Archive identity changed')
            stream = target if target is not None else io.BytesIO()
            remaining = end - start + 1
            while remaining:
                n = min(acq.BLOCK, remaining)
                with acq.STATE_LOCK:
                    self.check(n)
                    self.ledger['charged_bytes'] += n
                    acq.save(self.ledger_path, self.ledger)
                # On a failed read the reservation remains a conservative debit.
                data = response.read(n)
                with acq.STATE_LOCK:
                    self.ledger['charged_bytes'] -= n - len(data)
                    self.ledger['received_bytes'] += len(data)
                    acq.save(self.ledger_path, self.ledger)
                if not data:
                    raise ValueError('Truncated range response')
                stream.write(data)
                remaining -= len(data)
            return stream.getvalue() if target is None else None

    def acquire(self, member):
        ident = hashlib.sha256(member['name'].encode()).hexdigest()[:24]
        directory = self.root / 'datasets/raw/ocean/vcdem-2021-coastal-500m' / ident
        directory.mkdir(parents=True, exist_ok=True)
        payload_path = directory / '000000.bin'
        metadata = directory / 'member.json'
        offset = member['local_header_offset']
        if metadata.exists():
            prior = load(metadata)
            if prior['etag'] != self.identity['etag'] or prior['member'] != member:
                raise ValueError('Existing member belongs to different source')
            data_offset = prior['data_offset']
        else:
            header = self.read_range(offset, offset + 29)
            fields = struct.unpack('<4s5H3L2H', header)
            if fields[0] != b'PK\x03\x04' or fields[2] & 1 or fields[3] != 8:
                raise ValueError('Unsupported local ZIP header')
            name_length, extra_length = fields[-2:]
            extra = self.read_range(offset + 30, offset + 29 + name_length + extra_length)
            if extra[:name_length].decode('utf-8') != member['name']:
                raise ValueError('ZIP directory/local filename mismatch')
            data_offset = offset + 30 + name_length + extra_length
            acq.save(metadata, {'etag': self.identity['etag'], 'member': member,
                                'data_offset': data_offset})
        part = directory / 'payload.part'
        if not payload_path.exists():
            size = part.stat().st_size if part.exists() else 0
            if size > member['compressed_bytes']:
                raise ValueError('Oversized partial member')
            if size < member['compressed_bytes']:
                with part.open('ab') as target:
                    self.read_range(data_offset + size,
                                    data_offset + member['compressed_bytes'] - 1, target)
                    target.flush()
                    os.fsync(target.fileno())
            raw = inflate(part.read_bytes(), member)
            os.replace(part, payload_path)
        else:
            raw = inflate(payload_path.read_bytes(), member)
        result = {'member': member, 'raw_path': payload_path.relative_to(self.root).as_posix(),
                  'compressed_sha256': digest(payload_path),
                  'uncompressed_sha256': hashlib.sha256(raw).hexdigest(), 'crc32_verified': True}
        return ident, raw, result

    def crop(self, ident, raw, member):
        zone = int(member['horizontal_crs'][-2:])
        tree, geometries = self.trees[zone]
        with MemoryFile(raw, filename='tile.asc') as memory, memory.open() as source:
            if source.count != 1 or source.res != (2.5, 2.5) or source.nodata is None:
                raise ValueError('Unexpected numeric grid header')
            native = box(*source.bounds)
            nominal = box(*member['nominal_bounds'])
            if not nominal.buffer(0.01).covers(native):
                raise ValueError('Tile header outside planned nominal bounds')
            hits = tree.query(native, predicate='dwithin', distance=self.plan['distance_from_coast_m'])
            if not len(hits):
                return {'state': 'empty', 'reason': 'Truncated tile outside band'}
            band = unary_union([geometries[int(i)] for i in hits]).buffer(
                self.plan['distance_from_coast_m'], quad_segs=64)
            data, affine = mask(source, [mapping(band)], crop=True)
            valid = data != source.nodata
            if not np.any(valid):
                return {'state': 'empty', 'reason': 'No source values in coastal band'}
            output = self.root / 'datasets/processed/vcdem-coastal-500m' / f'{ident}.tif'
            output.parent.mkdir(parents=True, exist_ok=True)
            self.check(data.nbytes + 4 * 1024**2)
            temporary = output.with_suffix('.tmp.tif')
            with rasterio.open(temporary, 'w', driver='COG', height=data.shape[1],
                               width=data.shape[2], count=1, dtype=data.dtype,
                               crs=member['horizontal_crs'], transform=affine,
                               nodata=source.nodata, compress='DEFLATE',
                               overview_resampling='nearest') as target:
                target.write(data)
                target.update_tags(SOURCE_MEMBER=member['name'], LICENCE='CC BY 4.0',
                                   ATTRIBUTION=self.manifest['attribution'],
                                   VERTICAL_DATUM='unverified',
                                   COASTAL_BAND_METRES=str(self.plan['distance_from_coast_m']))
            with rasterio.open(temporary) as check:
                if check.res != (2.5, 2.5) or check.crs.to_string() != member['horizontal_crs']:
                    raise ValueError('Output grid verification failed')
            os.replace(temporary, output)
            return {'state': 'acquired', 'path': output.relative_to(self.root).as_posix(),
                    'bytes': output.stat().st_size, 'sha256': digest(output),
                    'bounds': list(rasterio.transform.array_bounds(data.shape[1], data.shape[2], affine)),
                    'valid_cells': int(valid.sum()), 'horizontal_crs': member['horizontal_crs']}

    def process(self, member):
        for attempt in range(7):
            try:
                ident, raw, result = self.acquire(member)
                result['output'] = self.crop(ident, raw, member)
                return ident, result
            except InterruptedError:
                raise
            except (URLError, ConnectionError, TimeoutError, http.client.IncompleteRead) as error:
                if attempt == 6:
                    raise
                print('retry', attempt + 1, member['name'], type(error).__name__, flush=True)
                for _ in range(min(2 ** attempt, 15)):
                    self.check()
                    time.sleep(1)

    def run(self):
        self.manifest['state'] = 'running'
        self.manifest.pop('error', None)
        self.manifest.pop('error_type', None)
        self.save()
        pending = []
        for member in self.plan['members']:
            ident = hashlib.sha256(member['name'].encode()).hexdigest()[:24]
            prior = self.manifest['assets'].get(ident)
            if prior and prior['output']['state'] in ('acquired', 'empty'):
                raw = self.root / prior['raw_path']
                output = prior['output']
                if (raw.is_file() and digest(raw) == prior['compressed_sha256'] and
                        (output['state'] == 'empty' or
                         ((self.root / output['path']).is_file() and digest(self.root / output['path']) == output['sha256']))):
                    continue
                raise ValueError('Previously completed tile failed integrity check')
            pending.append(member)
        with ThreadPoolExecutor(max_workers=4) as pool:
            for start in range(0, len(pending), 4):
                self.check()
                futures = {pool.submit(self.process, member): member
                           for member in pending[start:start + 4]}
                failure = None
                for future in as_completed(futures):
                    try:
                        ident, result = future.result()
                        self.manifest['assets'][ident] = result
                        self.manifest['completed_tiles'] = len(self.manifest['assets'])
                        self.save()
                        print(len(self.manifest['assets']), '/', self.plan['tile_count'],
                              futures[future]['name'], result['output']['state'], flush=True)
                    except BaseException as error:
                        failure = failure or error
                if failure:
                    raise failure
        self.manifest['state'] = 'complete'
        self.manifest['completed_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        self.save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--coastline', type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    plan = load(args.plan)
    if digest(args.coastline) != plan['inputs']['coastline']['sha256']:
        raise ValueError('Coastline differs from planned input')
    lock_path = root / '.cache/ocean-acquisition/run.lock'
    with lock_path.open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if acq.other_runners(root):
            raise RuntimeError('Bulk acquisition is running')
        ledger = load(root / '.cache/ocean-acquisition/ledger.json')
        checkpoint = root / 'datasets/ocean/checkpoint.json'
        if checkpoint.exists() and ledger['charged_bytes'] < load(checkpoint)['ledger']['charged_bytes']:
            raise RuntimeError('Shared ledger is older than checkpoint')
        actual = acq.probe(plan['source_url'])
        if actual['bytes'] != plan['source_identity']['bytes'] or actual['etag'] != plan['source_identity']['etag']:
            raise ValueError('Archive changed since ZIP index inspection')
        runner = Runner(root, plan, load(args.coastline))
        try:
            runner.run()
        except BaseException as error:
            runner.manifest.update(state='stopped' if isinstance(error, InterruptedError) else 'failed',
                                   error_type=type(error).__name__, error=str(error)[:300])
            runner.save()
            raise


if __name__ == '__main__':
    main()
