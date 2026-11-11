"""Independently check completed coastal tile files, hashes, COGs and mask samples."""
import argparse
import hashlib
import json
import time
import zlib
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from shapely import distance, points
from shapely.geometry import shape
from shapely.ops import transform
from shapely.strtree import STRtree

from scripts.ocean_catalog import digest, load, safe
from scripts.ocean_acquisition import save


def verify(root, plan, coastline):
    manifest = load(root / 'datasets/ocean/coastal/vcdem-500m.json')
    key = hashlib.sha256(json.dumps(plan, sort_keys=True).encode()).hexdigest()
    if manifest['plan_sha256'] != key or manifest['state'] != 'complete':
        raise ValueError('Acquisition is incomplete or uses another plan')
    members = {hashlib.sha256(m['name'].encode()).hexdigest()[:24]: m for m in plan['members']}
    if members.keys() != manifest['assets'].keys():
        raise ValueError('Completed set differs from selected tiles')
    lines = [shape(f['geometry']) for f in coastline['features']]
    trees = {}
    for zone in (54, 55):
        projection = Transformer.from_crs(4326, 7800 + zone, always_xy=True)
        geometries = np.array([transform(projection.transform, line) for line in lines], dtype=object)
        trees[zone] = (STRtree(geometries), geometries)
    raw_bytes, cog_bytes, cog_count, empty_count, sample_count = 0, 0, 0, 0, 0
    for ident, entry in manifest['assets'].items():
        member = members[ident]
        if entry['member'] != member:
            raise ValueError('Member provenance differs from selected plan')
        path = safe(root, entry['raw_path'])
        if path.stat().st_size != member['compressed_bytes'] or digest(path) != entry['compressed_sha256']:
            raise ValueError('Compressed source checksum/size failed: ' + ident)
        decoder = zlib.decompressobj(-15)
        raw = decoder.decompress(path.read_bytes(), member['uncompressed_bytes'] + 1)
        if (not decoder.eof or decoder.unconsumed_tail or decoder.unused_data or
                len(raw) != member['uncompressed_bytes'] or zlib.crc32(raw) != member['crc32'] or
                hashlib.sha256(raw).hexdigest() != entry['uncompressed_sha256']):
            raise ValueError('Native member CRC/size/SHA256 failed: ' + ident)
        raw_bytes += path.stat().st_size
        output = entry['output']
        if output['state'] == 'empty':
            empty_count += 1
            continue
        if output['state'] != 'acquired':
            raise ValueError('Unexpected tile output state')
        path = safe(root, output['path'])
        if path.stat().st_size != output['bytes'] or digest(path) != output['sha256']:
            raise ValueError('Output checksum/size failed: ' + ident)
        with rasterio.open(path) as source:
            if (source.res != (2.5, 2.5) or source.count != 1 or source.nodata != -9999 or
                    source.crs.to_string() != member['horizontal_crs'] or
                    source.tags(ns='IMAGE_STRUCTURE').get('LAYOUT') != 'COG'):
                raise ValueError('Numeric COG header failed: ' + ident)
            values = source.read(1)
            valid = values != source.nodata
            if int(valid.sum()) != output['valid_cells'] or not np.isfinite(values[valid]).all():
                raise ValueError('Valid cell counts/nonfinite values failed: ' + ident)
            indices = np.flatnonzero(valid)
            chosen = indices[np.linspace(0, len(indices) - 1, min(17, len(indices)), dtype=int)]
            rows, cols = np.unravel_index(chosen, values.shape)
            x, y = source.xy(rows, cols)
            samples = points(x, y)
            zone = int(member['horizontal_crs'][-2:])
            tree, geometries = trees[zone]
            nearest = geometries[tree.nearest(samples)]
            if np.any(distance(samples, nearest) > plan['distance_from_coast_m'] + 0.01):
                raise ValueError('Sample outside coastal distance: ' + ident)
            sample_count += len(samples)
        cog_bytes += path.stat().st_size
        cog_count += 1
    return {'status': 'verified', 'checked_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'plan_sha256': key, 'tiles_verified': len(members), 'source_member_bytes': raw_bytes,
            'cog_count': cog_count, 'cog_bytes': cog_bytes, 'empty_tiles': empty_count,
            'mask_distance_samples': sample_count,
            'checks': ['Every compressed source SHA256 and size', 'Every inflated source CRC32, SHA256 and size',
                       'Every output SHA256 and size', 'Every numeric COG header and valid-cell count',
                       'Up to 17 valid pixel centres per COG independently within 500m of Vicmap coastline'],
            'scientific_datum_and_source_quality': 'unverified',
            'band_sides': 'both sides of mapped shoreline; no seaward-only classification'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--coastline', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    plan = load(args.plan)
    if digest(args.coastline) != plan['inputs']['coastline']['sha256']:
        raise ValueError('Coastline checksum differs from plan')
    result = verify(args.root.resolve(), plan, load(args.coastline))
    save(args.output, result)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
