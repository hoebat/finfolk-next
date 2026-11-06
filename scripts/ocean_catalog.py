"""File-based ocean source registry. No database or network access."""
import argparse
import hashlib
import html
import json
import math
import re
from urllib.parse import urlsplit
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUSES = {'discovered', 'partial', 'acquired', 'verified', 'blocked'}
POINTER = b'version https://git-lfs.github.com/spec/v1'


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def load(path):
    return json.loads(Path(path).read_text())


def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


def safe(root, relative):
    p = Path(relative)
    if p.is_absolute() or '..' in p.parts or not p.parts:
        raise ValueError('Unsafe asset path: ' + relative)
    path = root / p
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('Asset escapes repository: ' + relative)
    return path


def product(meta, fallback):
    url = meta.get('source_url', '')
    if 'NSW_Marine_Lidar' in url:
        return 'nsw-marine-lidar-2018'
    if 'Mapshare/MarineCoastal' in url:
        return 'victoria-port-phillip-contours'
    if 'CoastKit/BathyContours' in url:
        return 'victoria-coastkit-contours'
    if 'imas' in url and 'wfs' in url:
        return 'seamap-tasmania-contours'
    return fallback


def observe(root):
    inventory_path = root / 'datasets/inventory.json'
    inv = load(inventory_path)
    records = {}

    def add(ident, title, meta, paths, kind, region=None):
        r = records.setdefault(ident, {'id': ident, 'title': title, 'source_url': meta.get('source_url'),
                                     'attribution': meta.get('attribution'), 'licence': meta.get('licence'),
                                     'observed': {'inventory_sha256': digest(inventory_path), 'packages': [], 'assets': []}})
        r['observed']['packages'].append({'region': region, 'kind': kind, 'metadata': meta})
        for role, relative in paths:
            path = safe(root, 'datasets/' + relative)
            if not path.is_file():
                raise ValueError('Missing inventoried asset: ' + str(path))
            with path.open('rb') as f:
                if f.read(len(POINTER)) == POINTER:
                    raise ValueError('Materialize LFS asset before sync: ' + relative)
            asset = {'path': path.relative_to(root).as_posix(), 'role': role, 'sha256': digest(path), 'bytes': path.stat().st_size}
            if asset not in r['observed']['assets']:
                r['observed']['assets'].append(asset)

    for region, meta in sorted(inv.get('contours', {}).items()):
        processed = Path(meta['file'])
        raw = Path('raw') / processed.parent.name / processed.stem
        paths = [('processed', meta['file']), ('raw', (raw / 'original.geojson').as_posix())]
        if (root / 'datasets' / raw / 'service.json').is_file():
            paths.append(('service_metadata', (raw / 'service.json').as_posix()))
        add(product(meta, region), product(meta, region), meta, paths, 'published_contour', region)
    for meta in inv.get('rasters', []):
        paths = [('processed', meta['file'])] + [('raw', x['file']) for x in meta.get('originals', [])]
        add(product(meta, meta['id']), meta['title'], meta, paths, 'numeric_raster', meta['region'])
    for ident, meta in inv.get('context_contours', {}).items():
        add(ident, meta['title'], meta, [('processed', m['file']) for m in meta['areas'].values()], 'context')
    for r in records.values():
        r['observed']['assets'].sort(key=lambda a: a['path'])
    return records


def sync(root):
    directory = root / 'datasets/ocean/records'
    for ident, imported in observe(root).items():
        path = directory / (ident + '.json')
        old = load(path) if path.exists() else {}
        # Operational provenance is imported; human decisions are never overwritten.
        record = {**imported, **old, 'id': ident, 'observed': imported['observed']}
        record.setdefault('schema_version', 1)
        record.setdefault('review', {'acquisition_status': 'partial', 'quality': 'unverified',
                                    'datum_verified': False, 'blocker': '',
                                    'next_action': 'Review source lineage, datum and coverage; acquire numeric rasters where missing.'})
        save(path, record)


def records(root):
    return [load(p) for p in sorted((root / 'datasets/ocean/records').glob('*.json'))]


def validate(root, metadata_only=False):
    errors, pointers = [], []
    rows = records(root)
    ids = [r.get('id') for r in rows]
    if len(ids) != len(set(ids)):
        errors.append('Duplicate dataset identity')
    seen = {}
    inv_hash = digest(root / 'datasets/inventory.json')
    for r in rows:
        name = r.get('id', '?')
        if not isinstance(name,str) or not re.fullmatch(r'[a-z0-9][a-z0-9_-]*',name):
            errors.append(str(name)+': invalid identity')
        url=urlsplit(r.get('source_url',''))
        if url.scheme!='https' or not url.hostname or url.username or url.password:
            errors.append(str(name)+': invalid public source URL')
        if not isinstance(r.get('review',{}).get('next_action'),str):
            errors.append(str(name)+': next action required')
        if r.get('schema_version') != 1 or r.get('review', {}).get('acquisition_status') not in STATUSES:
            errors.append(name + ': invalid record version/status')
        if not r.get('title') or not r.get('source_url') or not r.get('licence') or not r.get('attribution'):
            errors.append(name + ': incomplete provenance')
        if r.get('observed', {}).get('inventory_sha256', inv_hash) != inv_hash:
            errors.append(name + ': inventory drift; run sync-existing')
        for a in r.get('observed', {}).get('assets', []):
            try:
                path = safe(root, a['path'])
                if len(a['sha256']) != 64 or any(c not in '0123456789abcdef' for c in a['sha256']) or not isinstance(a['bytes'], int) or a['bytes'] < 0:
                    raise ValueError('Invalid checksum/size: ' + a['path'])
                if a['path'] in seen and seen[a['path']] != a['sha256']:
                    raise ValueError('Conflicting asset reference: ' + a['path'])
                seen[a['path']] = a['sha256']
                if not metadata_only:
                    if not path.is_file():
                        raise ValueError('Missing asset: ' + a['path'])
                    with path.open('rb') as f:
                        pointer = f.read(len(POINTER)) == POINTER
                    if pointer:
                        pointers.append(a['path'])
                    elif path.stat().st_size != a['bytes'] or digest(path) != a['sha256']:
                        raise ValueError('Corrupt asset: ' + a['path'])
            except (KeyError, ValueError) as e:
                errors.append(str(e))
    for r in rows:
        for a in r.get('acquisitions',[]):
            parts=a.get('parts',[])
            if not parts or sum(p.get('bytes',0) for p in parts)!=a.get('bytes') or len(a.get('sha256',''))!=64:
                errors.append(r['id']+': invalid acquired asset manifest')
            for part in parts:
                try:
                    safe(root,part['path'])
                    if part['bytes']>1024**3 or len(part['sha256'])!=64:raise ValueError('Invalid LFS part')
                except (ValueError,KeyError) as e:errors.append(str(e))
    targets = load(root / 'datasets/ocean/coverage-targets.json')
    known_areas = {a['id'] for a in load(root / 'config/areas.json')['areas']}
    for t in targets['regions']:
        if t['id'] not in known_areas or any(x not in ids for x in t['candidate_datasets']):
            errors.append(t['id'] + ': broken region/dataset reference')
    if {t['id'] for t in targets['regions']} != known_areas:
        errors.append('Coverage targets do not match browsing regions')
    # Detect removed or changed inventory assets even when the old catalog remains internally valid.
    if not metadata_only and not pointers and not errors:
        observed = observe(root)
        indexed = {r['id']: r.get('observed') for r in rows if r.get('observed')}
        if indexed != {k: v['observed'] for k, v in observed.items()}:
            errors.append('Operational asset drift; run sync-existing')
    return {'records': len(rows), 'assets': len(seen), 'errors': errors, 'unmaterialized_lfs': sorted(set(pointers))}


def report(root, sites_path, output):
    rows = records(root)
    for r in rows:
        for a in r.get('acquisitions',[]):
            parts=a.get('parts',[])
            if not parts or sum(p.get('bytes',0) for p in parts)!=a.get('bytes') or len(a.get('sha256',''))!=64:
                errors.append(r['id']+': invalid acquired asset manifest')
            for part in parts:
                try:
                    safe(root,part['path'])
                    if part['bytes']>1024**3 or len(part['sha256'])!=64:raise ValueError('Invalid LFS part')
                except (ValueError,KeyError) as e:errors.append(str(e))
    targets = load(root / 'datasets/ocean/coverage-targets.json')['regions']
    sites = load(sites_path)['beaches'] if sites_path else []
    geometry_error = None
    lines = []
    try:
        from shapely.geometry import shape, box, Point
        from shapely.strtree import STRtree
        from shapely.affinity import affine_transform
        for r in rows:
            for p in r.get('observed', {}).get('packages', []):
                if p['kind'] == 'published_contour':
                    data = load(root / 'datasets' / p['metadata']['file'])
                    lines.extend(shape(f['geometry']) for f in data['features'] if f.get('geometry'))
        tree = STRtree(lines)
    except (ImportError, ValueError, OSError) as e:
        geometry_error = type(e).__name__

    def probe(site):
        point = site.get('point')
        nearest = None
        if point and not geometry_error and lines:
            lon, lat = point
            sx = 111320 * math.cos(math.radians(lat))
            for index in tree.query(box(lon-5000/sx, lat-5000/111320, lon+5000/sx, lat+5000/111320)):
                distance = affine_transform(lines[index], [sx, 0, 0, 111320, -lon*sx, -lat*111320]).distance(Point(0, 0))
                if distance <= 5000:
                    nearest = min(distance, nearest if nearest is not None else float('inf'))
        raster_results = []
        for r in rows:
            for p in r.get('observed', {}).get('packages', []):
                if p['kind'] != 'numeric_raster' or not point:
                    continue
                try:
                    from depth_explorer.raster import Raster
                    value = Raster(root / 'datasets', p['metadata']).samples([point])[0]
                    raster_results.append({'dataset': r['id'], 'status': 'no_data' if value is None else 'above_datum' if value < 0 else 'valid_cell', 'value_m': value})
                except (ValueError, OSError, RuntimeError, ImportError, KeyError) as e:
                    raster_results.append({'dataset': r['id'], 'status': 'unverified', 'reason': type(e).__name__})
        return {'numeric_check': 'no_acquired_raster' if not raster_results else 'unverified' if all(r['status']=='unverified' for r in raster_results) else 'checked', 'id': site['id'], 'area_id': site.get('area_id'), 'nearest_regional_contour_m': round(nearest) if nearest is not None else None,
                'contour_check': 'unverified' if geometry_error or not point else 'checked', 'rasters': raster_results}

    probes = [probe(s) for s in sites]
    summaries = []
    for t in targets:
        members = [s for s in probes if s['area_id'] == t['id']]
        summaries.append({**t, 'sites_checked': len(members), 'site_check_status': 'checked' if sites_path else 'not_requested',
                          'regional_contour_within_1km': sum(s['nearest_regional_contour_m'] is not None and s['nearest_regional_contour_m'] <= 1000 for s in members),
                          'regional_contour_within_5km': sum(s['nearest_regional_contour_m'] is not None for s in members),
                          'sites_with_numeric_cell': sum(any(r['status'] == 'valid_cell' for r in s['rasters']) for s in members),
                          'numeric_assets_acquired': sum(p['kind'] == 'numeric_raster' for r in rows for p in r.get('observed', {}).get('packages', []) if r['id'] in t['candidate_datasets']),
                          'datum_verified': [r['id'] for r in rows if r['id'] in t['candidate_datasets'] and r['review'].get('datum_verified')],
                          'source_quality': {r['id']: r['review'].get('quality', 'unknown') for r in rows if r['id'] in t['candidate_datasets']}})
    result = {'schema_version': 1, 'inputs': {'inventory_sha256': digest(root / 'datasets/inventory.json'), 'records_sha256': hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest(), 'targets_sha256': digest(root / 'datasets/ocean/coverage-targets.json'), 'sites_sha256': digest(sites_path) if sites_path else None},
              'limitations': ['Contour distances are approximate proximity, not surveyed coverage.', 'Reference-point cells do not establish coverage around a dive site.', 'Missing raster acquisitions are distinct from NoData cells.', 'Context grids do not establish measured detail.'], 'acquisitions': {r['id']:{'originals':len(r.get('acquisitions',[])),'bytes':sum(a['bytes'] for a in r.get('acquisitions',[]))} for r in rows}, 'geometry_check_error': geometry_error, 'regions': summaries, 'sites': probes}
    save(output / 'report.json', result)
    content = '<!doctype html><meta charset="utf-8"><title>Ocean dataset gaps</title><style>body{font:16px system-ui;margin:2rem}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:.5rem;text-align:left}</style><h1>Ocean dataset coverage and acquisition backlog</h1><p>'+html.escape(' '.join(result['limitations']))+'</p><table><tr><th>Region</th><th>Sites checked</th><th>Contour within 5km</th><th>Numeric cell</th><th>Priority</th><th>Blocker / next action</th></tr>'
    for r in summaries:
        content += '<tr>' + ''.join('<td>'+html.escape(str(v))+'</td>' for v in [r['id'], r['sites_checked'] if sites_path else 'Not checked', r['regional_contour_within_5km'] if sites_path and not geometry_error else 'Unverified', r['sites_with_numeric_cell'] if sites_path else 'Not checked', r['priority'], r['blocker']+' '+r['next_action']])+'</tr>'
    content += '</table><h2>Source acquisition records</h2><table><tr><th>Dataset</th><th>Status</th><th>Quality</th><th>Datum verified</th><th>Assets</th><th>Next action</th></tr>'
    for r in rows:
        content += '<tr>'+''.join('<td>'+html.escape(str(v))+'</td>' for v in [r['title'],r['review']['acquisition_status'],r['review'].get('quality','unknown'),r['review'].get('datum_verified',False),str(len(r.get('observed',{}).get('assets',[])))+' existing / '+str(len(r.get('acquisitions',[])))+' new originals',r['review']['next_action']])+'</tr>'
    (output / 'report.html').write_text(content+'</table>')
    return {'regions': len(summaries), 'sites_checked': len(probes), 'report': str(output / 'report.html')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('sync-existing')
    for name in ['discover-assets','acquire','verify-acquisitions','acquisition-status']: sub.add_parser(name)
    mat=sub.add_parser('materialize');mat.add_argument('asset_id')
    val = sub.add_parser('validate'); val.add_argument('--metadata-only', action='store_true')
    rep = sub.add_parser('report'); rep.add_argument('--sites', type=Path); rep.add_argument('--output', type=Path, default=ROOT / '.cache/ocean-catalog')
    args = parser.parse_args()
    if args.command in ['discover-assets','acquire','verify-acquisitions','materialize','acquisition-status']:
        import ocean_acquisition as acq
        result = acq.discover(args.root) if args.command=='discover-assets' else acq.acquire(args.root) if args.command=='acquire' else acq.verify(args.root) if args.command=='verify-acquisitions' else acq.status(args.root) if args.command=='acquisition-status' else acq.materialize(args.root,args.asset_id)
        print(json.dumps(result,indent=2))
    elif args.command == 'sync-existing':
        sync(args.root); print('Existing asset provenance synchronized; curated reviews preserved.')
    elif args.command == 'validate':
        result = validate(args.root, args.metadata_only); print(json.dumps(result, indent=2))
        if result['errors'] or result['unmaterialized_lfs']:
            raise SystemExit(1)
    else:
        print(json.dumps(report(args.root, args.sites, args.output), indent=2))


if __name__ == '__main__':
    main()
