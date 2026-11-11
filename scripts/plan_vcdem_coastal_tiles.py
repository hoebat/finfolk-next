"""Plan selective VCDEM ZIP-member downloads; performs no network or DB writes.

Inputs are an inspected ZIP64 index and detailed WGS84 Vicmap coast GeoJSON.
The plan selects only unblended 2.5m ASCII grids intersecting a coastal band.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import box, shape
from shapely.ops import transform
from shapely.strtree import STRtree


ARCHIVE_URL = ('https://cl-isd-prd-datashare-s3-delivery.s3.amazonaws.com/'
               'PrePackages/VicCoastDEM2021_250cm.zip')
# Nominal tile origins verified against native ASCII headers in this archive.
# Northing in the filename denotes the nominal top edge, not lower-left.
# Edge tiles can be truncated; nominal 5km footprints conservatively include them.
GRID_OFFSETS = {54: (98.3987136998, 1.207304242),
                55: (99.6147534847, 0.107296828)}
TILE = re.compile(
    r'^VicCoastDEM2021_250cm/Tiled_NoBlend/Z(54|55)/'
    r'VCDEM_GDA2020z\1_.*_e(\d+)_n(\d+)\.asc$')


def tile_footprint(member):
    match = TILE.fullmatch(member['name'])
    if not match:
        return None
    zone, easting, northing = map(int, match.groups())
    dx, dy = GRID_OFFSETS[zone]
    left, top = easting * 100 + dx, northing * 1000 + dy
    return zone, box(left, top - 5000, left + 5000, top)


def select(index, coastline, distance_m=500):
    if not math.isfinite(distance_m) or distance_m <= 0:
        raise ValueError('Coastal distance must be positive and finite')
    if index.get('url') != ARCHIVE_URL:
        raise ValueError('Grid offsets are specific to the inspected VCDEM archive')
    if coastline.get('exceededTransferLimit') or coastline.get('properties', {}).get('exceededTransferLimit'):
        raise ValueError('Coastline is an incomplete service page')
    crs = coastline.get('crs', {}).get('properties', {}).get('name', '')
    if crs and not (crs.endswith('4326') or crs.endswith('CRS84')):
        raise ValueError('Coastline must use WGS84 longitude/latitude')
    lines = []
    for feature in coastline['features']:
        if feature['properties'].get('FEATURE_TYPE_CODE') != 'coast':
            raise ValueError('Expected only detailed coastline, not borders or watercourses')
        geometry = shape(feature['geometry'])
        if geometry.geom_type not in ('LineString', 'MultiLineString') or geometry.is_empty or not geometry.is_valid:
            raise ValueError('Invalid coastline geometry')
        if not (-180 <= geometry.bounds[0] <= geometry.bounds[2] <= 180 and
                -90 <= geometry.bounds[1] <= geometry.bounds[3] <= 90):
            raise ValueError('Invalid geographic coastline bounds')
        lines.append(geometry)
    if not lines:
        raise ValueError('No coastline features')
    trees = {}
    for zone in GRID_OFFSETS:
        projection = Transformer.from_crs(4326, 7800 + zone, always_xy=True)
        trees[zone] = STRtree([transform(projection.transform, line) for line in lines])
    selected, seen = [], set()
    for member in index['entries']:
        candidate = tile_footprint(member)
        if candidate is None:
            continue
        if member['name'] in seen:
            raise ValueError('Duplicate archive member')
        seen.add(member['name'])
        zone, footprint = candidate
        if not len(trees[zone].query(footprint, predicate='dwithin', distance=distance_m)):
            continue
        for field in ('compressed_bytes', 'uncompressed_bytes', 'local_header_offset', 'crc32'):
            if not isinstance(member[field], int) or member[field] < 0:
                raise ValueError('Invalid ZIP member metadata')
        if member['compression'] != 8:
            raise ValueError('Unexpected compression; re-inspect archive')
        selected.append({**member, 'horizontal_crs': f'EPSG:{7800 + zone}',
                         'nominal_bounds': list(footprint.bounds)})
    return {
        'schema_version': 1, 'source_url': index['url'],
        'distance_from_coast_m': distance_m, 'native_cellsize_m': 2.5,
        'variant': 'Tiled_NoBlend',
        'selection': 'Nominal 5km tile footprint within stated distance of Vicmap coastline; metric MGA2020 zones 54/55.',
        'limitations': [
            'Tile selection includes both sides of coastline. Seaward-only output requires an independently verified land/water mask.',
            'Download whole selected compressed members, then crop cells to the coastal band; this is not a 500m-wide network read.',
            'Nominal footprints may overselect truncated edge tiles. Check every native header before production cropping.',
            'Source gaps and mixed source resolution remain. Output grid spacing does not establish measured accuracy.',
            'This is an offline plan, not a running downloader. Validate archive identity and range responses before using offsets.'
        ],
        'coastline_feature_count': len(lines), 'tile_count': len(selected),
        'compressed_member_bytes': sum(m['compressed_bytes'] for m in selected),
        'uncompressed_member_bytes': sum(m['uncompressed_bytes'] for m in selected),
        'members': selected,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip-index', type=Path, required=True)
    parser.add_argument('--coastline', type=Path, required=True)
    parser.add_argument('--distance-m', type=float, default=500)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    plan = select(json.loads(args.zip_index.read_text()),
                  json.loads(args.coastline.read_text()), args.distance_m)
    plan['inputs'] = {name: {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                      for name, path in [('zip_index', args.zip_index), ('coastline', args.coastline)]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(plan, indent=2, allow_nan=False) + '\n')
    print(json.dumps({key: plan[key] for key in ('tile_count', 'compressed_member_bytes',
                                                'uncompressed_member_bytes', 'coastline_feature_count')}))


if __name__ == '__main__':
    main()
