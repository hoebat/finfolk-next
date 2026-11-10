"""Reviewed, resumable non-Victorian coastal raster packages (no database access).

Discovery is deliberately a review inventory, not permission to download every
catalog entry. Plans require reviewed numeric sources and authoritative shoreline.
"""
import argparse
import contextlib
from contextvars import ContextVar
import hashlib
import io
import json
import math
import os
import re
import tempfile
import time
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path, PurePosixPath

import numpy as np
import rasterio
from rasterio.io import MemoryFile
from rasterio.features import geometry_mask, shapes
from rasterio.windows import Window, transform as window_transform
from pyproj import Transformer
from pyproj import CRS as ProjectionCRS
from shapely.geometry import shape, mapping, box
from shapely.ops import transform, unary_union

from scripts import ocean_acquisition as acq
from scripts.ocean_catalog import digest, load, safe
from scripts.ocean_coastal_geometry import coastal_band, check_distances, shoreline_distances

STATES = ('NSW', 'QLD', 'SA', 'TAS', 'WA', 'NT', 'JBT')
MARGIN = 128 * 1024**2
MEMORY_LIMIT = 512 * 1024**2
MASK_METHOD = 'projected_candidates_then_ellipsoidal_pixel_centres_le_500m'
CRS_POLICY = 'horizontal_geotiff_and_exact_source_compound_wkt'
DEFAULT_PLAN = 'datasets/ocean/coastal/non-vic-plan.json'
RESERVE_OVERRIDE=ContextVar('coastal_reserve_override',default=None)


def reserve_bytes():
    value=RESERVE_OVERRIDE.get()
    return acq.RESERVE if value is None else value


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def source_identity(source):
    return {k:source.get(k) for k in ('url','bytes','etag','sha256','retrieval')}


def run_directory(root,plan):
    ident=plan.get('run_id')
    if ident is None:return root/'datasets/ocean/coastal'
    if not re.fullmatch('[A-Za-z0-9_-]+',ident):raise ValueError('Unsafe coastal run ID')
    return root/'datasets/ocean/coastal/runs'/ident


def state_directory(root,plan,state):
    directory=root/'datasets/processed/coastal'/state
    if plan.get('run_id'):
        run_directory(root,plan)
        directory=directory/plan['run_id']
    return directory


def discover(root):
    manifest = load(root / 'datasets/ocean/acquisition-manifest.json')
    snapshot_path=root/'resources/atlas/snapshot.json'
    snapshot=load(snapshot_path).get('surveys',[]) if snapshot_path.exists() else []
    metadata={row.get('download_url'):row for row in snapshot if row.get('download_url')}
    entries = {}
    for source in manifest['sources']:
        for asset in source['assets']:
            if asset['state'] in ('alias', 'excluded'):
                continue
            url=asset['url']
            if url in entries:
                entries[url]['collections'].append(source['id'])
                if asset['state']=='acquired': entries[url]['acquisition_state']='acquired'
                continue
            row=metadata.get(url,{})
            title=row.get('name',asset['filename'])
            resolutions=[float(v) for v in re.findall(r'(?<![\d.])(\d+(?:\.\d+)?)\s*m\b',title,re.I)]
            resolutions += [float(v)/100 for v in re.findall(r'(?<![\d.])(\d+(?:\.\d+)?)\s*cm\b',title,re.I)]
            inspection=root/'datasets/ocean/provenance/native-inspections'/f"{asset['id']}.json"
            entries[url]={'id': asset['id'], 'collection': source['id'],'collections':[source['id']],
                            'url': asset['url'], 'filename': asset['filename'],
                            'bytes': asset.get('bytes'), 'acquisition_state': asset['state'],
                            'title':title,'metadata_url':row.get('metadata_url'),
                            'bounds_lead':row.get('bounds'),'bounds_are_valid_coverage':False,
                            'declared_resolution_values_m':resolutions,'resolution_header_verified':False,
                            'survey_start':row.get('survey_start'),'survey_end':row.get('survey_end'),
                            'licence_lead':row.get('licence'),
                            'native_inspection':inspection.relative_to(root).as_posix() if inspection.exists() else None,
                            'review_state': 'needs_footprint_resolution_and_datum_review'}
    return {'schema_version': 1, 'states': STATES, 'candidates': list(entries.values()),
            'unique_sources':len(entries),'catalog_asset_count':sum(len(s['assets']) for s in manifest['sources']),
            'note': 'Discovery candidates are not an acquisition allowlist. Include state publisher and ELVIS sources during review.'}


def review_source(source):
    required = ('id', 'states', 'survey_derived', 'resolution_m', 'horizontal_crs_verified',
                'footprint', 'licence', 'attribution', 'vertical_datum', 'units',
                'sign', 'survey_date', 'output_bytes_estimate')
    missing = [k for k in required if k not in source]
    if missing:
        raise ValueError('Missing reviewed source fields: ' + ', '.join(missing))
    if len(source['states']) != 1 or set(source['states']) - set(STATES):
        raise ValueError('Source includes excluded jurisdiction')
    if not source['id'] or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in source['id']):
        raise ValueError('Unsafe source ID')
    if source['survey_derived'] is not True or source['horizontal_crs_verified'] is not True:
        raise ValueError('Survey origin and horizontal CRS must be verified')
    if not 0 < source['resolution_m'] <= 5:
        raise ValueError('Native resolution must be at most 5 m')
    if not source['licence'] or not source['attribution']:
        raise ValueError('Licence and attribution required')
    geom = shape(source['footprint'])
    if geom.geom_type not in ('Polygon','MultiPolygon') or geom.is_empty or not geom.is_valid or not box(-180, -90, 180, 90).covers(geom):
        raise ValueError('Valid geographic footprint required')
    if not math.isfinite(source['output_bytes_estimate']) or source['output_bytes_estimate'] <= 0:
        raise ValueError('Positive output size forecast required')
    if not source.get('parts') and (not source.get('url') or not source.get('etag') or not source.get('bytes')):
        raise ValueError('Remote source requires pinned URL, ETag and size')
    if not source.get('parts') and (not isinstance(source['bytes'],int) or isinstance(source['bytes'],bool) or source['bytes']<=0):
        raise ValueError('Remote source byte count must be a positive integer')
    binding=source.get('publisher_crs_metadata')
    if binding:
        member=binding.get('member','')
        if not source.get('member') or not member or PurePosixPath(member).is_absolute() or '..' in PurePosixPath(member).parts or '\\' in member:
            raise ValueError('Publisher CRS must reference a safe metadata member in the source archive')
        if not re.fullmatch('[a-f0-9]{64}',binding.get('sha256','')) or not binding.get('crs'):
            raise ValueError('Publisher CRS metadata requires its pinned checksum and reviewed CRS')
    retrieval=source.get('retrieval',{})
    if retrieval:
        if retrieval.get('kind')=='zip_member':
            from scripts.ocean_coastal_members import validate_descriptor
            validate_descriptor(retrieval)
            if source.get('sha256'): raise ValueError('Use compressed_sha256 for a member; a full-archive checksum cannot verify a partial retrieval')
        elif retrieval.get('kind')=='numeric_export':
            if retrieval.get('band_semantics') not in ('depth','elevation') or not retrieval.get('publisher_evidence'):
                raise ValueError('Reviewed numeric band semantics and publisher evidence required')
            grid=retrieval.get('grid',{})
            if any(k not in grid for k in ('width','height','dtype','crs','transform')) or len(grid['transform'])!=6:
                raise ValueError('Reviewed native export grid required')
            if grid['dtype'] not in ('float32','float64') or any(not isinstance(grid[k],int) or isinstance(grid[k],bool) or grid[k]<=0 for k in ('width','height')):
                raise ValueError('Reviewed export must be a positive-size floating point grid')
            if not all(math.isfinite(v) for v in grid['transform']):raise ValueError('Invalid export alignment')
        else: raise ValueError('Unsupported remote retrieval adapter')
    scratch=source.get('scratch_bytes_estimate',MEMORY_LIMIT)
    if not math.isfinite(scratch) or scratch<0: raise ValueError('Invalid scratch estimate')


def make_plan(root, catalog, coastline):
    coast = load(coastline)
    provenance = coast.get('properties', {})
    if provenance.get('review_state','').startswith('requires_'):
        raise ValueError('Publisher shoreline still requires certainty/jurisdiction review')
    if provenance.get('authoritative') is not True or not provenance.get('source_url') or not provenance.get('version'):
        raise ValueError('Pinned authoritative shoreline provenance required')
    if not coast.get('features') or any(shape(f['geometry']).geom_type not in ('LineString', 'MultiLineString') for f in coast['features']):
        raise ValueError('Shoreline line features required')
    crs=coast.get('crs',{}).get('properties',{}).get('name','CRS84').upper()
    if not ('CRS84' in crs or crs.endswith('CRS::84') or crs.endswith(':4326')): raise ValueError('Geographic shoreline CRS required')
    for feature in coast['features']:
        geometry=shape(feature['geometry'])
        if geometry.is_empty or not geometry.is_valid or not box(-180,-90,180,90).covers(geometry):
            raise ValueError('Invalid geographic shoreline geometry')
    for state, review in provenance.get('coverage_review',{}).items():
        if state not in STATES: raise ValueError('Excluded shoreline jurisdiction')
        if review.get('complete') and (not review.get('reviewed_at') or not review.get('jurisdiction_reference')):
            raise ValueError('Complete shoreline review requires jurisdiction reference and review date')
    sources = catalog['sources']
    reviews = catalog.get('inventory_review', {})
    for state, review in reviews.items():
        if state not in STATES: raise ValueError('Excluded inventory jurisdiction')
        if review.get('complete') and (not review.get('reviewed_at') or not review.get('publisher_catalogs')):
            raise ValueError('Complete source review requires dated publisher catalog evidence')
    ids = set()
    for source in sources:
        review_source(source)
        if source['id'] in ids:
            raise ValueError('Duplicate source ID')
        ids.add(source['id'])
    return {'schema_version': 1, 'states': list(STATES), 'distance_m': 500, 'mask_method': MASK_METHOD,
            'crs_storage_policy': CRS_POLICY,
            'band_sides': 'both', 'survey_derived_only': True,
            'inventory_review': reviews,
            'coastline': {'path': coastline.relative_to(root).as_posix(), 'sha256': digest(coastline),
                          'provenance': provenance},
            'sources': sorted(sources, key=lambda s: (s['resolution_m'], s['id']))}


def capacity(root, plan):
    raw=0
    for source in plan['sources']:
        if source.get('parts'): continue
        dest=root/'datasets/raw/ocean/coastal-nonvic'/source['id']/'original.bin'
        receipt=dest.with_suffix('.identity.json')
        identity=source_identity(source)
        saved=load(receipt) if receipt.exists() else {}
        existing=0
        member=source.get('retrieval',{}).get('kind')=='zip_member'
        total=source['retrieval']['compressed_bytes'] if member else source.get('bytes',0)
        if saved.get('identity')==identity:
            if dest.exists() and dest.stat().st_size==total and saved.get('completed_sha256'):
                existing=total
            elif dest.with_suffix('.partial').exists():
                existing=min(total,saved.get('partial_bytes',0))
        raw+=max(0,total-existing)
        if member and not dest.exists():
            from scripts.ocean_coastal_members import HEADER_ALLOWANCE
            raw+=HEADER_ALLOWANCE
    output = sum(s['output_bytes_estimate'] for s in plan['sources'])
    scratch = max([s.get('scratch_bytes_estimate', MEMORY_LIMIT) for s in plan['sources']] or [0])
    free = __import__('shutil').disk_usage(root).free
    ledger = load(root / '.cache/ocean-acquisition/ledger.json')
    required = reserve_bytes() + MARGIN + raw + output + scratch
    return {'free_bytes': free, 'required_free_bytes': required,
            'storage_shortfall_bytes': max(0, required-free), 'planned_transfer_bytes': raw,
            'remaining_transfer_bytes': acq.LIMIT-ledger['charged_bytes'],
            'budget_shortfall_bytes': max(0, raw-(acq.LIMIT-ledger['charged_bytes']))}


def readiness(root):
    ledger=load(root/'.cache/ocean-acquisition/ledger.json')
    free=__import__('shutil').disk_usage(root).free
    reserve=reserve_bytes()
    return {'state':'blocked_storage' if free < reserve+MARGIN else 'blocked_review','states':list(STATES),
            'free_bytes':free,'reserve_bytes':reserve,'headroom_above_reserve_bytes':free-reserve,
            'minimum_additional_free_bytes_for_guard':max(0,reserve+MARGIN-free),
            'guard_shortfall_excludes_payload_and_output_storage':True,
            'remaining_transfer_bytes':acq.LIMIT-ledger['charged_bytes'],
            'blockers':(['Protected storage reserve is not available'] if free < reserve+MARGIN else []) + ['Authoritative shoreline and jurisdiction references not yet staged',
                        'Publisher discovery and reviewed source catalog incomplete',
                        'Production storage forecast cannot be calculated until source review is complete'],
            'archive_completion':False}


def lock(root):
    @contextlib.contextmanager
    def held():
        import fcntl
        path = root / '.cache/ocean-acquisition/run.lock'
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('a+') as handle:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            yield
    return held()


@contextlib.contextmanager
def processing_lock(root, plan):
    """Serialize one immutable run without blocking the transfer ledger."""
    import fcntl
    directory=root/'.cache/ocean-coastal-nonvic'
    directory.mkdir(parents=True,exist_ok=True)
    ident=run_directory(root,plan).name
    with (directory/(ident+'.lock')).open('a+') as handle:
        fcntl.flock(handle,fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def guard(root, additional=0):
    if (root / '.cache/ocean-coastal-nonvic/stop-request.json').exists():
        raise InterruptedError('Coastal stop requested')
    if __import__('shutil').disk_usage(root).free < reserve_bytes() + MARGIN + additional:
        raise InterruptedError('Protected disk reserve reached')


def acquire(root, plan):
    forecast = capacity(root, plan)
    if forecast['storage_shortfall_bytes'] or forecast['budget_shortfall_bytes']:
        raise ValueError('Capacity gate: ' + json.dumps(forecast))
    # Local sources are immutable; remote sources must expose a pinned length,
    # ETag and exact byte ranges. The legacy bulk stop flag is never changed.
    ledger_path = root / '.cache/ocean-acquisition/ledger.json'
    ledger = load(ledger_path)
    checkpoint = root / 'datasets/ocean/checkpoint.json'
    if checkpoint.exists() and ledger['charged_bytes'] < load(checkpoint)['ledger']['charged_bytes']:
        raise ValueError('Live ledger trails checkpoint')
    for source in plan['sources']:
        ledger=load(ledger_path)
        if source.get('parts'):
            validate_parts(root, source['parts'])
            continue
        if not source.get('bytes') or not source.get('etag'):
            raise ValueError('Pinned remote bytes and ETag required')
        dest = root / 'datasets/raw/ocean/coastal-nonvic' / source['id'] / 'original.bin'
        identity = source_identity(source)
        if source.get('retrieval',{}).get('kind')=='numeric_export':
            from scripts.ocean_coastal_exports import acquire_export
            acquire_export(root,source,dest,identity,guard)
            continue
        if source.get('retrieval',{}).get('kind')=='zip_member':
            from scripts.ocean_coastal_members import acquire_member
            acquire_member(root,source,dest,identity,guard)
            continue
        identity_path = dest.with_suffix('.identity.json')
        if identity_path.exists() and load(identity_path)['identity'] != identity:
            raise ValueError('Stored source identity changed; review a new source ID')
        if dest.exists():
            if not identity_path.exists() or digest(dest) != load(identity_path).get('completed_sha256'):
                raise ValueError('Completed source checksum mismatch')
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        partial = dest.with_suffix('.partial')
        if partial.exists() and not identity_path.exists(): raise ValueError('Unidentified partial source')
        saved=load(identity_path) if identity_path.exists() else {'identity':identity}
        offset=saved.get('partial_bytes',0)
        hasher=hashlib.sha256()
        if partial.exists():
            if partial.stat().st_size<offset: raise ValueError('Partial is shorter than checkpoint')
            with partial.open('rb') as stream:
                remaining=offset
                while remaining:
                    chunk=stream.read(min(acq.BLOCK,remaining));hasher.update(chunk);remaining-=len(chunk)
            if offset and hasher.hexdigest()!=saved.get('partial_sha256'):
                raise ValueError('Resumable source prefix checksum failed')
            if partial.stat().st_size>offset:
                # Only an uncommitted tail from this downloader is discarded.
                # Its network debit is retained; completed originals are immutable.
                with partial.open('r+b') as stream: stream.truncate(offset)
        elif offset: raise ValueError('Missing checkpointed partial source')
        acq.save(identity_path,saved)
        if offset > source['bytes']:
            raise ValueError('Partial exceeds source length')
        while offset < source['bytes']:
            guard(root, acq.BLOCK)
            end = min(offset + acq.BLOCK, source['bytes']) - 1
            with acq.request(source['url'], {'Range': f'bytes={offset}-{end}', 'If-Match': source['etag']}) as response:
                if response.status != 206 or response.headers.get('Content-Range') != f"bytes {offset}-{end}/{source['bytes']}" or response.headers.get('ETag') != source['etag']:
                    raise ValueError('Source identity or exact range response changed')
                n = end-offset+1
                if ledger['charged_bytes'] + n > acq.LIMIT:
                    raise InterruptedError('Transfer budget reached')
                ledger['charged_bytes'] += n
                acq.save(ledger_path, ledger)
                data = response.read(n)
                ledger['received_bytes'] += len(data)
                acq.save(ledger_path, ledger)
                if len(data) != n:
                    raise ValueError('Truncated range response; conservative debit retained')
                with partial.open('ab') as out:
                    out.write(data)
                    out.flush()
                    __import__('os').fsync(out.fileno())
                offset += n
                hasher.update(data)
                acq.save(identity_path,{'identity':identity,'partial_bytes':offset,'partial_sha256':hasher.hexdigest()})
        actual = digest(partial)
        if source.get('sha256') and actual != source['sha256']:
            raise ValueError('Source checksum failed')
        acq.save(identity_path, {'identity': identity, 'completed_sha256': actual})
        partial.replace(dest)
    return {'status': 'acquired', 'sources': len(plan['sources'])}


def validate_parts(root, parts):
    for part in parts:
        path = safe(root, part['path'])
        if path.stat().st_size != part['bytes'] or digest(path) != part['sha256']:
            raise ValueError('Native source part checksum failed')


def catalog_parts(root, dataset, ident, original, expected_sha256):
    """Create <=1 GiB catalog parts without changing the verified original.

    Concatenating the returned parts restores the original byte-for-byte.
    Existing matching parts are reused; conflicting files are never replaced.
    Catalog registration itself must hold the shared acquisition lock.
    """
    if any(not re.fullmatch('[A-Za-z0-9_-]+',value) for value in (dataset,ident)):
        raise ValueError('Unsafe catalog part identity')
    original=safe(root,original.resolve().relative_to(root.resolve()).as_posix())
    if digest(original)!=expected_sha256:raise ValueError('Original checksum changed before partitioning')
    size=original.stat().st_size
    if size<=acq.PART:
        return [{'path':original.relative_to(root).as_posix(),'bytes':size,'sha256':expected_sha256}]
    directory=root/'datasets/raw/ocean'/dataset/ident
    directory.mkdir(parents=True,exist_ok=True);parts=[]
    whole=hashlib.sha256()
    with original.open('rb') as stream:
        remaining=size
        while remaining:
            length=min(acq.PART,remaining);target=directory/f'{len(parts):06d}.bin'
            temporary=None;hasher=hashlib.sha256()
            try:
                with tempfile.NamedTemporaryFile(dir=directory,delete=False) as out:
                    temporary=Path(out.name);pending=length
                    while pending:
                        guard(root,min(pending,acq.BLOCK))
                        data=stream.read(min(pending,acq.BLOCK))
                        if not data:raise ValueError('Original truncated during partitioning')
                        out.write(data);hasher.update(data);whole.update(data);pending-=len(data)
                    out.flush();os.fsync(out.fileno())
                checksum=hasher.hexdigest()
                if target.exists():
                    if target.stat().st_size!=length or digest(target)!=checksum:
                        raise ValueError('Existing catalog part conflicts with original')
                else:temporary.replace(target)
                parts.append({'path':target.relative_to(root).as_posix(),'bytes':length,'sha256':checksum})
            finally:
                if temporary is not None:temporary.unlink(missing_ok=True)
            remaining-=length
    if whole.hexdigest()!=expected_sha256:raise ValueError('Original changed during partitioning')
    return parts


class JoinedParts(io.RawIOBase):
    """Seekable concatenation for ZIP indexes without duplicating raw chunks."""
    def __init__(self, paths):
        self.paths = paths
        self.sizes = [p.stat().st_size for p in paths]
        self.pos = 0
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos+offset if whence == 1 else sum(self.sizes)+offset
        if self.pos < 0: raise ValueError('Negative seek')
        return self.pos
    def read(self, size=-1):
        remaining = sum(self.sizes)-self.pos if size < 0 else size
        chunks = []
        base = 0
        for path, length in zip(self.paths, self.sizes):
            if self.pos < base+length and remaining > 0:
                with path.open('rb') as handle:
                    handle.seek(self.pos-base)
                    data = handle.read(min(remaining, base+length-self.pos))
                chunks.append(data); self.pos += len(data); remaining -= len(data)
            base += length
        return b''.join(chunks)


@contextlib.contextmanager
def zip_raster(paths, member):
    """Expose chunked ZIPs to GDAL without copying or inflating their members."""
    if not member or PurePosixPath(member).is_absolute() or '..' in PurePosixPath(member).parts or '\\' in member:
        raise ValueError('Unsafe archive member')
    xml=ET.Element('VSISparseFile')
    ET.SubElement(xml,'Length').text=str(sum(p.stat().st_size for p in paths))
    offset=0
    for path in paths:
        region=ET.SubElement(xml,'SubfileRegion')
        ET.SubElement(region,'Filename',{'relative':'0'}).text=str(path.resolve())
        ET.SubElement(region,'DestinationOffset').text=str(offset)
        ET.SubElement(region,'SourceOffset').text='0'
        ET.SubElement(region,'RegionLength').text=str(path.stat().st_size)
        offset+=path.stat().st_size
    with MemoryFile(ET.tostring(xml),filename='parts.xml') as control:
        virtual='/vsisparse/'+control.name
        with rasterio.Env(GDAL_CACHEMAX=64*1024**2):
            with rasterio.open('/vsizip/{'+virtual+'}/'+member) as ds:
                yield ds


@contextlib.contextmanager
def metadata_bound_raster(ds, paths, binding):
    """Bind checked publisher PAM SRS to original samples, without resampling.

    Some AIG headers lose datum identity even though their accompanying PAM
    file supplies it. Preserve both descriptions and exact metadata provenance.
    """
    with zipfile.ZipFile(JoinedParts(paths)) as archive:
        info=archive.getinfo(binding['member'])
        if info.file_size>256*1024:raise ValueError('Publisher CRS metadata exceeds limit')
        body=archive.read(info)
    if hashlib.sha256(body).hexdigest()!=binding['sha256']:
        raise ValueError('Publisher CRS metadata checksum changed')
    srs=ET.fromstring(body).findtext('SRS')
    if not srs:raise ValueError('Publisher metadata has no SRS')
    declared=ProjectionCRS.from_user_input(srs)
    if not declared.is_projected or declared.is_compound or declared!=ProjectionCRS.from_user_input(binding['crs']):
        raise ValueError('Publisher CRS differs from reviewed CRS')
    node=ET.Element('VRTDataset',rasterXSize=str(ds.width),rasterYSize=str(ds.height))
    ET.SubElement(node,'SRS').text=srs
    ET.SubElement(node,'GeoTransform').text=','.join(map(str,ds.transform.to_gdal()))
    metadata=ET.SubElement(node,'Metadata')
    tags={**ds.tags(),'SOURCE_EMBEDDED_CRS_WKT':ds.crs.to_wkt() if ds.crs else '',
          'PUBLISHER_CRS_METADATA_MEMBER':binding['member'],'PUBLISHER_CRS_METADATA_SHA256':binding['sha256'],
          'PUBLISHER_CRS_WKT':srs}
    for key,value in tags.items():ET.SubElement(metadata,'MDI',key=key).text=str(value)
    dtype={'float32':'Float32','float64':'Float64'}.get(ds.dtypes[0])
    if not dtype:raise ValueError('Publisher CRS binding requires a floating point survey band')
    band=ET.SubElement(node,'VRTRasterBand',dataType=dtype,band='1')
    if ds.nodata is not None:ET.SubElement(band,'NoDataValue').text=str(ds.nodata)
    simple=ET.SubElement(band,'SimpleSource')
    ET.SubElement(simple,'SourceFilename',relativeToVRT='0').text=ds.name
    ET.SubElement(simple,'SourceBand').text='1'
    with MemoryFile(ET.tostring(node),filename='publisher-crs.vrt') as memory:
        with memory.open() as corrected:yield corrected


@contextlib.contextmanager
def raster(root, source):
    parts = source.get('parts')
    if parts:
        paths = [safe(root, p['path']) for p in parts]
    else:
        paths = [root / 'datasets/raw/ocean/coastal-nonvic' / source['id'] / 'original.bin']
        identity_path = paths[0].with_suffix('.identity.json')
        if not identity_path.exists() or load(identity_path).get('identity')!=source_identity(source) or digest(paths[0]) != load(identity_path).get('completed_sha256'):
            raise ValueError('Downloaded source is not verified')
    if source.get('retrieval',{}).get('kind')=='zip_member':
        from scripts.ocean_coastal_members import inflate_member
        with MemoryFile(inflate_member(paths[0],source['retrieval'])) as memory:
            with memory.open() as ds:yield ds
    elif source.get('member'):
        with zip_raster(paths,source['member']) as ds:
            if source.get('publisher_crs_metadata'):
                with metadata_bound_raster(ds,paths,source['publisher_crs_metadata']) as corrected:yield corrected
            else:yield ds
    else:
        if len(paths) != 1: raise ValueError('Direct raster must have one part')
        options = {'driver': 'BAG'} if source.get('format') == 'BAG' else {}
        with rasterio.open(paths[0], **options) as ds: yield ds


def band_for(ds, coast):
    from rasterio.warp import transform_bounds
    bounds = transform_bounds(ds.crs, 4326, *ds.bounds)
    search = box(bounds[0]-.05,bounds[1]-.05,bounds[2]+.05,bounds[3]+.05)
    geographic = coastal_band(coast['features'], search)
    return transform(Transformer.from_crs(4326,ds.crs,always_xy=True).transform,geographic)


def valid_geometry(ds):
    mask = ds.read_masks(1) > 0
    polygons = [shape(g) for g,v in shapes(mask.astype('uint8'),mask=mask,transform=ds.transform) if v]
    geom = unary_union(polygons)
    return transform(Transformer.from_crs(ds.crs,4326,always_xy=True).transform,geom)


def finer_coverage(root, result, source):
    geometries=[]
    for entry in result['outputs'].values():
        if entry.get('empty') or entry.get('resolution_m',math.inf) >= source['resolution_m']:
            continue
        if source['states'][0] not in entry.get('states',[]): continue
        with rasterio.open(safe(root,entry['path'])) as ds: geometries.append(valid_geometry(ds))
    return unary_union(geometries)


def native_spacing(ds):
    if ds.crs.is_projected:
        factor=ds.crs.linear_units_factor[1]
        return max(abs(v)*factor for v in ds.res)
    from rasterio.warp import transform_bounds
    bounds=transform_bounds(ds.crs,4326,*ds.bounds)
    latitude=0 if bounds[1]<=0<=bounds[3] else min(abs(bounds[1]),abs(bounds[3]))
    return max(abs(ds.res[0])*111320*math.cos(math.radians(latitude)),abs(ds.res[1])*111320)


def retained_cells(data, affine, crs, band, features):
    """Refine the projected candidate mask against ellipsoidal distances.

    GEOS buffer simplification can retain cells just outside 500 m. Keep the
    original values only where their centres also satisfy the distance limit.
    """
    inside=geometry_mask([mapping(band)],out_shape=data.shape,transform=affine,invert=True)
    valid=inside & ~np.ma.getmaskarray(data) & np.isfinite(data.data)
    rows,cols=np.nonzero(valid)
    if len(rows):
        xs,ys=rasterio.transform.xy(affine,rows,cols)
        valid[rows,cols]=shoreline_distances(xs,ys,crs,features)<=500
    return valid


def storage_crs(crs):
    """GeoTIFF cannot round-trip every BAG vertical axis/datum description.

    Store its horizontal CRS without reprojection; the exact compound WKT is
    retained separately as authoritative source metadata for reconstruction.
    Canonicalize recognized EPSG aliases only after semantic equality is proved;
    original labels remain recoverable from the source and publisher metadata.
    """
    parsed=ProjectionCRS.from_wkt(crs.to_wkt())
    horizontal=parsed.to_2d() if parsed.is_compound else parsed
    code=horizontal.to_epsg()
    if code is not None and horizontal==ProjectionCRS.from_epsg(code):
        return rasterio.crs.CRS.from_epsg(code)
    return rasterio.crs.CRS.from_wkt(horizontal.to_wkt()) if parsed.is_compound else crs


def coverage(root, plan, result):
    sources = {s['id']:s for s in plan['sources']}
    coast=load(safe(root,plan['coastline']['path']))
    features=[]; summaries={}
    for state in STATES:
        fine=[];fallback=[]
        for entry in result['outputs'].values():
            if entry.get('empty') or state not in sources[entry['source']]['states']: continue
            with rasterio.open(safe(root,entry['path'])) as ds: geom=valid_geometry(ds)
            (fine if entry['resolution_m'] <= 1 else fallback).append(geom)
        f=unary_union(fine);b=unary_union(fallback).difference(f)
        area=Transformer.from_crs(4326,9473,always_xy=True)
        reference=[feature for feature in coast['features'] if feature.get('properties',{}).get('state') == state]
        band=coastal_band(reference) if reference else None
        reviewed=plan.get('inventory_review',{}).get(state,{}).get('complete') is True
        summaries[state]={'preferred_area_km2':transform(area.transform,f).area/1e6,
                          'fallback_area_km2':transform(area.transform,b).area/1e6,
                          'source_discovery_complete':reviewed,
                          'shoreline_reference_complete':band is not None and coast.get('properties',{}).get('coverage_review',{}).get(state,{}).get('complete') is True,
                          'complete':reviewed and band is not None and coast.get('properties',{}).get('coverage_review',{}).get(state,{}).get('complete') is True,
                          'gap_status':'quantified' if band is not None else 'missing jurisdiction shoreline reference'}
        if band is not None:
            gap=band.difference(f.union(b))
            summaries[state]['band_area_km2']=transform(area.transform,band).area/1e6
            summaries[state]['gap_area_km2']=transform(area.transform,gap).area/1e6
            if not gap.is_empty: features.append({'type':'Feature','geometry':mapping(gap),'properties':{'state':state,'tier':'gap'}})
        for tier,geom in [('preferred',f),('fallback',b)]:
            if not geom.is_empty: features.append({'type':'Feature','geometry':mapping(geom),'properties':{'state':state,'tier':tier}})
    return {'type':'FeatureCollection','features':features,'properties':{'jurisdictions':summaries,'plan_sha256':fingerprint(plan),
            'archive_completion':all(s['complete'] for s in summaries.values())}}


def state_package(plan,result,report,state):
    return {'schema_version':1,'state':state,'plan_sha256':fingerprint(plan),'stage':'processed',
            'sources':[source for source in plan['sources'] if state in source['states']],
            'rasters':[entry for entry in result['outputs'].values() if state in entry.get('states',[])],
            'coverage':{'type':'FeatureCollection','features':[feature for feature in report['features'] if feature['properties']['state']==state]},
            'summary':report['properties']['jurisdictions'][state],
            'coastline':plan['coastline'],'distance_m':500,'band_sides':'both'}


def process(root, plan):
    if plan.get('mask_method') != MASK_METHOD:
        raise ValueError('Plan must use the current geodesic mask method; prepare a new named run')
    guard(root)
    coast = load(safe(root, plan['coastline']['path']))
    if digest(safe(root, plan['coastline']['path'])) != plan['coastline']['sha256']:
        raise ValueError('Shoreline changed')
    key = fingerprint(plan)
    manifest_path = run_directory(root,plan) / 'non-vic-results.json'
    result = load(manifest_path) if manifest_path.exists() else {'plan_sha256': key, 'outputs': {}, 'state': 'processing'}
    if result['plan_sha256'] != key: raise ValueError('Existing outputs use a different plan')
    for source in sorted(plan['sources'],key=lambda s:(s['resolution_m'],s['id'])):
        if source.get('parts'): validate_parts(root, source['parts'])
        with raster(root, source) as ds:
            if not ds.crs: raise ValueError('Missing raster CRS')
            compound=ProjectionCRS.from_wkt(ds.crs.to_wkt()).is_compound
            if compound and plan.get('crs_storage_policy')!=CRS_POLICY:
                raise ValueError('Compound source requires reviewed CRS storage policy in a new run')
            if ds.dtypes[0] not in ('float32','float64'): raise ValueError('Depth raster must use floating point values')
            spacing=native_spacing(ds)
            if spacing > 5.00001 or spacing > source['resolution_m']*1.01:
                raise ValueError('Native raster spacing exceeds reviewed spacing')
            footprint = transform(Transformer.from_crs(4326, ds.crs, always_xy=True).transform, shape(source['footprint']))
            band = band_for(ds, coast).intersection(footprint)
            finer=finer_coverage(root,result,source)
            if not finer.is_empty:
                band=band.difference(transform(Transformer.from_crs(4326,ds.crs,always_xy=True).transform,finer))
            for row in range(0, ds.height, 4096):
                for col in range(0, ds.width, 4096):
                    window = Window(col, row, min(4096, ds.width-col), min(4096, ds.height-row))
                    affine = window_transform(window, ds.transform)
                    extent = box(*rasterio.windows.bounds(window, ds.transform))
                    if not band.intersects(extent): continue
                    ident = f"{source['id']}-{row}-{col}"
                    prior = result['outputs'].get(ident)
                    if prior:
                        if prior.get('empty') or digest(safe(root, prior['path'])) == prior['sha256']: continue
                        raise ValueError('Completed output checksum mismatch')
                    guard(root, int(window.width*window.height*12))
                    data = ds.read(1, window=window, masked=True)
                    valid = retained_cells(data,affine,ds.crs,band,coast['features'])
                    if not valid.any():
                        result['outputs'][ident] = {'empty': True, 'source': source['id']}
                    else:
                        # Source layers remain separate when datums differ. A coverage
                        # priority records resolution; no depth interpolation occurs.
                        state = source['states'][0]
                        path = state_directory(root,plan,state) / f'{ident}.tif'
                        path.parent.mkdir(parents=True, exist_ok=True)
                        tmp = path.with_suffix('.tmp.tif')
                        values = np.where(valid, data.data, np.nan).astype(ds.dtypes[0])
                        with rasterio.open(tmp, 'w', driver='COG', width=data.shape[1], height=data.shape[0], count=1,
                                           dtype=ds.dtypes[0], crs=storage_crs(ds.crs), transform=affine, nodata=float('nan'),
                                           compress='DEFLATE', overview_resampling='nearest') as out:
                            out.write(values, 1)
                            out.update_tags(SOURCE_ID=source['id'], LICENCE=source['licence'], ATTRIBUTION=source['attribution'],
                                            VERTICAL_DATUM=source['vertical_datum'], UNITS=source['units'], SIGN=source['sign'],
                                            COASTAL_BAND_METRES='500', NATIVE_RESOLUTION_M=str(source['resolution_m']),
                                            SURVEY_DATE=source['survey_date'],AREA_OR_POINT=ds.tags().get('AREA_OR_POINT','Area'))
                            if compound:
                                out.update_tags(SOURCE_CRS_WKT=ds.crs.to_wkt(),CRS_STORAGE_POLICY=CRS_POLICY)
                            if source.get('publisher_crs_metadata'):
                                out.update_tags(**{key:value for key,value in ds.tags().items() if key=='SOURCE_EMBEDDED_CRS_WKT' or key.startswith('PUBLISHER_CRS_')})
                        tmp.replace(path)
                        result['outputs'][ident] = {'path': path.relative_to(root).as_posix(), 'sha256': digest(path),
                                                  'source': source['id'], 'states': source['states'],
                                                  'window': [col,row,int(window.width),int(window.height)],
                                                  'valid_cells': int(valid.sum()), 'resolution_m': source['resolution_m']}
                    acq.save(manifest_path, result)
    result['state'] = 'processed'
    acq.save(manifest_path, result)
    report=coverage(root,plan,result)
    acq.save(run_directory(root,plan)/'non-vic-coverage.json',report)
    for state in STATES:
        acq.save(state_directory(root,plan,state)/'catalog.json',state_package(plan,result,report,state))
    return result


def verify(root, plan):
    if plan.get('mask_method') != MASK_METHOD:
        raise ValueError('Plan must use the current geodesic mask method; prepare a new named run')
    result = load(run_directory(root,plan)/'non-vic-results.json')
    if result['plan_sha256'] != fingerprint(plan) or result['state'] != 'processed':
        raise ValueError('Outputs incomplete or plan changed')
    coast = load(safe(root, plan['coastline']['path']))
    if digest(safe(root, plan['coastline']['path'])) != plan['coastline']['sha256']: raise ValueError('Shoreline changed')
    if any(entry.get('source') not in {s['id'] for s in plan['sources']} for entry in result['outputs'].values()):
        raise ValueError('Output references unplanned source')
    expected_ids=set()
    maximum_distance=0.0
    for source in plan['sources']:
        if source.get('parts'): validate_parts(root, source['parts'])
        with raster(root, source) as original:
            compound=ProjectionCRS.from_wkt(original.crs.to_wkt()).is_compound
            if compound and plan.get('crs_storage_policy')!=CRS_POLICY:
                raise ValueError('Compound source requires reviewed CRS storage policy in a new run')
            footprint = transform(Transformer.from_crs(4326, original.crs, always_xy=True).transform, shape(source['footprint']))
            band = band_for(original, coast).intersection(footprint)
            finer=finer_coverage(root,result,source)
            if not finer.is_empty:
                band=band.difference(transform(Transformer.from_crs(4326,original.crs,always_xy=True).transform,finer))
            for row in range(0, original.height, 4096):
                for col in range(0, original.width, 4096):
                    window = Window(col,row,min(4096,original.width-col),min(4096,original.height-row))
                    if band.intersects(box(*rasterio.windows.bounds(window,original.transform))):
                        ident = f"{source['id']}-{row}-{col}"
                        expected_ids.add(ident)
                        if ident not in result['outputs']: raise ValueError('Missing planned output window')
                        entry=result['outputs'][ident]
                        if not entry.get('empty') and entry['window'] != [col,row,int(window.width),int(window.height)]:
                            raise ValueError('Output window identity changed')
                        if result['outputs'][ident].get('empty'):
                            data = original.read(1,window=window,masked=True)
                            if retained_cells(data,window_transform(window,original.transform),original.crs,band,coast['features']).any():
                                raise ValueError('Incorrect empty window')
            for entry in result['outputs'].values():
                if entry['source'] != source['id'] or entry.get('empty'): continue
                path = safe(root, entry['path'])
                if digest(path) != entry['sha256']: raise ValueError('Output checksum failed')
                with rasterio.open(path) as ds:
                    data = ds.read(1, masked=True)
                    valid = ~np.ma.getmaskarray(data)
                    inside = geometry_mask([mapping(band)], out_shape=data.shape, transform=ds.transform, invert=True)
                    if np.any(valid & ~inside) or int(valid.sum()) != entry['valid_cells']:
                        raise ValueError('Coastal mask or cell count failed')
                    rows,cols=np.nonzero(valid)
                    xs,ys=ds.xy(rows,cols)
                    maximum_distance=max(maximum_distance,check_distances(xs,ys,ds.crs,coast['features']))
                    expected = original.read(1, window=Window(*entry['window']), masked=True)
                    expected_valid=retained_cells(expected,ds.transform,original.crs,band,coast['features'])
                    if not np.array_equal(valid,expected_valid): raise ValueError('Output omitted valid source cells')
                    if ds.transform != window_transform(Window(*entry['window']), original.transform):
                        raise ValueError('Source alignment changed')
                    if np.any(valid & np.ma.getmaskarray(expected)) or not np.array_equal(data.data[valid], expected.data[valid]):
                        raise ValueError('Source values changed')
                    if ds.crs != storage_crs(original.crs) or ds.res != original.res or ds.tags(ns='IMAGE_STRUCTURE').get('LAYOUT') != 'COG':
                        raise ValueError('Native grid or COG layout changed')
                    if compound and (ds.tags().get('SOURCE_CRS_WKT')!=original.crs.to_wkt() or ds.tags().get('CRS_STORAGE_POLICY')!=CRS_POLICY):
                        raise ValueError('Exact source compound CRS metadata changed')
                    if source.get('publisher_crs_metadata') and any(ds.tags().get(key)!=value for key,value in original.tags().items() if key=='SOURCE_EMBEDDED_CRS_WKT' or key.startswith('PUBLISHER_CRS_')):
                        raise ValueError('Publisher CRS correction provenance changed')
    if expected_ids != set(result['outputs']): raise ValueError('Output set differs from planned windows')
    report=coverage(root,plan,result)
    stored=run_directory(root,plan)/'non-vic-coverage.json'
    if not stored.exists() or fingerprint(load(stored)) != fingerprint(report): raise ValueError('Coverage report differs from verified rasters')
    for state in STATES:
        path=state_directory(root,plan,state)/'catalog.json'
        if not path.exists() or fingerprint(load(path))!=fingerprint(state_package(plan,result,report,state)):
            raise ValueError('Jurisdiction package differs from verified manifest')
    return {'status': 'complete' if report['properties']['archive_completion'] else 'verified_rasters',
            'plan_sha256': fingerprint(plan), 'outputs': len(result['outputs']),
            'maximum_geodesic_distance_m':maximum_distance,'numeric_distance_tolerance_m':0.1,
            'archive_completion':report['properties']['archive_completion']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['discover','archive-index','shoreline','plan','acquire','process','verify','status'])
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--plan', type=Path, default=Path(DEFAULT_PLAN))
    parser.add_argument('--catalog', type=Path)
    parser.add_argument('--coastline', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--state',choices=STATES)
    parser.add_argument('--bbox',nargs=4,type=float)
    parser.add_argument('--geometry-field')
    parser.add_argument('--asset-id')
    parser.add_argument('--reserve-gib',type=float,help='Explicit per-run reserve override; 0 waives the historic 100 GiB reserve, retaining the write margin')
    args = parser.parse_args(); root = args.root.resolve()
    if args.reserve_gib is not None:
        if not math.isfinite(args.reserve_gib) or args.reserve_gib<0:parser.error('reserve-gib must be finite and nonnegative')
        RESERVE_OVERRIDE.set(int(args.reserve_gib*1024**3))
    if args.command == 'discover': result = discover(root)
    elif args.command == 'archive-index':
        if not args.asset_id or not args.output:parser.error('archive-index requires --asset-id and --output')
        manifest=load(root/'datasets/ocean/acquisition-manifest.json')
        matches=[a for source in manifest['sources'] for a in source['assets'] if a['id']==args.asset_id]
        if len(matches)!=1 or not matches[0].get('bytes') or not matches[0].get('etag'):
            raise ValueError('One source with a pinned archive length and ETag is required')
        from scripts.ocean_coastal_members import archive_index
        with lock(root):result=archive_index(root,matches[0],guard)
    elif args.command == 'shoreline':
        if not args.state or not args.bbox or not args.geometry_field or not args.output:
            parser.error('shoreline requires --state, --bbox, --geometry-field and --output')
        from scripts.ocean_coastal_sources import shoreline
        with lock(root): result=shoreline(root,args.state,args.bbox,args.geometry_field,guard)
    elif args.command == 'plan':
        if not args.catalog or not args.coastline: parser.error('plan requires --catalog and --coastline')
        result = make_plan(root, load(args.catalog), args.coastline.resolve())
        result['run_id']='coastal-'+fingerprint(result)[:16]
    elif args.command == 'status' and not (root/args.plan).exists():
        result=readiness(root)
    else:
        plan = load(root / args.plan)
        if not isinstance(plan.get('sources'),list): raise ValueError('Reviewed source list is required')
        for source in plan['sources']: review_source(source)
        if args.command == 'status': result = capacity(root, plan)
        else:
            with (lock(root) if args.command=='acquire' else processing_lock(root,plan)):
                result = acquire(root, plan) if args.command == 'acquire' else process(root, plan) if args.command == 'process' else verify(root, plan)
                if args.command=='verify': acq.save(run_directory(root,plan)/'non-vic-verification.json',result)
    if args.output: acq.save(root / args.output, result)
    print(json.dumps(result, indent=2))


if __name__ == '__main__': main()
