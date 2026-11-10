"""Acquire explicitly selected official coastal ZIP leads and retain native grids.

Unstated vertical units/sign always withhold derived contours and numeric depth.
Discovery ownership is only a lead; each state's crop uses its own shoreline.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
from pathlib import Path
import re
import zipfile

import rasterio
from rasterio.warp import transform_bounds
from shapely.geometry import box, mapping
from rasterio.windows import Window

from scripts import ocean_acquisition as a, ocean_coastal as c


def select(features, url):
    rows=[f['properties'] for f in features if f['properties'].get('DATA_URL')==url]
    if not rows:raise ValueError('URL is absent from the official coastal discovery screen')
    for row in rows:
        title=row.get('NAME','').lower()
        if 'bathymetry' not in title or any(word in title for word in ['backscatter','antarct','norfolk','middleton','elizabeth reef']):
            raise ValueError('Outside the bathymetric coastal selection')
        if row.get('EMBARGO')!='No' or row.get('PRODUCT_STATUS')!='PUBLISHED':
            raise ValueError('Source is not unembargoed and published')
        if 'Attribution 4.0' not in row.get('LEGAL_CONSTRAINTS',''):
            raise ValueError('Source licence requires review')
    if not url.startswith('https://files.ausseabed.gov.au/survey/') or not url.endswith('.zip'):
        raise ValueError('This adapter only accepts official GA survey ZIPs')
    states=sorted({s for row in rows for s in row['candidate_states']})
    if not states or set(states)-set(c.STATES):raise ValueError('Invalid candidate jurisdiction')
    return rows[0],states


def eligible_header(ds, member):
    if re.search(r'(uncert|backscatter|slope|hillshade|intensity)',member,re.I):return False
    return bool(ds.crs and ds.crs.to_epsg() and ds.count==1 and
                ds.dtypes[0] in ('float32','float64') and ds.scales==(1.0,) and
                ds.offsets==(0.0,) and 0<c.native_spacing(ds)<=5 and
                ds.tags(1).get('Band_Direction')=='Height')


def same_native_grid(left, right):
    """Only canonicalize exact grid/value/mask equivalents; archives retain both."""
    def signature(ds):
        return (ds.width,ds.height,ds.count,ds.dtypes,ds.crs,ds.transform,str(ds.nodata),
                ds.scales,ds.offsets,ds.units,ds.tags(1).get('Band_Direction'))
    if signature(left)!=signature(right):return False
    for row in range(0,left.height,128):
        for column in range(0,left.width,8192):
            window=Window(column,row,min(8192,left.width-column),min(128,left.height-row))
            if left.read(1,window=window).tobytes()!=right.read(1,window=window).tobytes():return False
            if left.read_masks(1,window=window).tobytes()!=right.read_masks(1,window=window).tobytes():return False
    return True


def retained_asset(root, url):
    """Verify registered originals before any new source request or allocation."""
    path=root/'datasets/ocean/records/ausseabed-local-surveys.json'
    if not path.exists():return None
    row=next((r for r in a.load(path).get('acquisitions',[]) if r.get('url')==url and r.get('state')=='acquired'),None)
    if not row:return None
    if not row.get('parts') or not row.get('sha256'):raise ValueError('Registered original lacks checksum evidence')
    whole=hashlib.sha256()
    for part in row['parts']:
        path=c.safe(root,part['path']);checksum=hashlib.sha256();size=0
        with path.open('rb') as stream:
            for data in iter(lambda:stream.read(a.BLOCK),b''):
                checksum.update(data);whole.update(data);size+=len(data)
        if size!=part['bytes'] or checksum.hexdigest()!=part['sha256']:raise ValueError('Registered source part changed')
    if whole.hexdigest()!=row['sha256']:raise ValueError('Registered source concatenation changed')
    return row


def run(root, url):
    directory=root/'datasets/ocean/coastal/nationwide'
    publisher,states=select(a.load(directory/'ga-fine-coastal-leads.geojson')['features'],url)
    ident=hashlib.sha256(url.encode()).hexdigest()[:24]
    # This lock is shared with every source/reference acquisition. Waiting here
    # never labels another runner's in-flight source as scientifically invalid.
    with (root/'.cache/ocean-acquisition/run.lock').open('a+') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        asset=retained_asset(root,url)
        if asset is None:
            with a.request(url,method='HEAD') as response:
                size=int(response.headers['Content-Length']);etag=response.headers['ETag']
            source={'id':ident,'url':url,'bytes':size,'etag':etag,
                    'output_bytes_estimate':size*8,'scratch_bytes_estimate':c.MEMORY_LIMIT}
            forecast=c.capacity(root,{'sources':[source]})
            if forecast['budget_shortfall_bytes'] or forecast['storage_shortfall_bytes']:
                raise InterruptedError('Acquisition exceeds remaining budget or actual disk capacity')
            c.acquire(root,{'sources':[source]})
            raw=root/'datasets/raw/ocean/coastal-nonvic'/ident/'original.bin';checksum=c.digest(raw)
            parts=c.catalog_parts(root,'ausseabed-local-surveys',ident,raw,checksum)
            record_path=root/'datasets/ocean/records/ausseabed-local-surveys.json';record=a.load(record_path)
            old=next((r for r in record.get('acquisitions',[]) if r['id']==ident),{})
            asset={**source,'parts':parts,'sha256':checksum,'state':'acquired','filename':Path(url).name,
                   'acquired_at':old.get('acquired_at',datetime.now(timezone.utc).isoformat()),
                   'publisher_access_evidence':publisher,'numeric_validation':'Native band/unit review pending'}
            record['acquisitions']=[r for r in record.get('acquisitions',[]) if r['id']!=ident]+[asset]
            a.save(record_path,record)
    with zipfile.ZipFile(c.JoinedParts([c.safe(root,p['path']) for p in asset['parts']])) as archive:
        bad=archive.testzip()
        if bad:raise ValueError('ZIP member CRC failed: '+bad)
        members=[n for n in archive.namelist() if n.lower().endswith(('.tif','.tiff'))]
    headers=[];plans=[];canonical_members=[]
    for member in members:
        candidate={**asset,'member':member}
        with c.raster(root,candidate) as ds:
            approved=eligible_header(ds,member)
            headers.append({'member':member,'crs':ds.crs.to_wkt() if ds.crs else None,
                            'resolution':ds.res,'tags':ds.tags(1),'units':ds.units,
                            'scales':ds.scales,'offsets':ds.offsets,'native_crop_eligible':approved})
            if not approved:continue
            duplicate=None
            for previous in canonical_members:
                with c.raster(root,{**asset,'member':previous}) as original:
                    if same_native_grid(ds,original):duplicate=previous;break
            if duplicate:
                headers[-1].update(duplicate_of=duplicate,canonicalization='Exact CRS, grid, stored pixel bytes and masks; both original members retained')
                continue
            spacing=c.native_spacing(ds);footprint=mapping(box(*transform_bounds(ds.crs,4326,*ds.bounds)))
            canonical_members.append(member)
        for state in states:
            source={**candidate,'id':ident+'-'+hashlib.sha256(member.encode()).hexdigest()[:8]+'-'+state.lower(),
                    'states':[state],'survey_derived':True,'resolution_m':spacing,'horizontal_crs_verified':True,
                    'footprint':footprint,'footprint_kind':'Native grid extent; final retained pixels checked independently',
                    'licence':publisher['LEGAL_CONSTRAINTS'],'attribution':publisher['CUSTODIAN'],
                    'vertical_datum':'Original source reference retained; vertical realization unverified',
                    'units':'Vertical band units require review; native stored values unchanged',
                    'sign':'Native Band_Direction=Height; no sign conversion',
                    'survey_date':publisher.get('START_DATE') or 'Unknown (not stated by publisher)',
                    'source_url':url,'publisher_metadata_url':publisher['META_URL'],
                    'contour_derivation_approved':False,
                    'contour_review_reason':'Native elevation sign/units and source vertical realization need explicit review'}
            catalog={'sources':[source],'inventory_review':{state:{'complete':False,'reason':'Selected official source; whole-jurisdiction inventory incomplete'}}}
            plan=c.make_plan(root,catalog,directory/(state+'-shoreline-reviewed.geojson'))
            plan['run_id']='ga-national-'+source['id']+'-'+c.fingerprint(plan)[:12]
            path=directory/'plans'/(plan['run_id']+'.json');a.save(path,plan)
            with c.processing_lock(root,plan):
                result=c.process(root,plan);receipt=c.verify(root,plan)
                a.save(c.run_directory(root,plan)/'non-vic-verification.json',receipt)
            plans.append({'plan':str(path.relative_to(root)),'rasters':sum(not r.get('empty') for r in result['outputs'].values()),'receipt':receipt})
            print('Native-only GA crop verified',state,member,plans[-1]['rasters'],flush=True)
    a.save(directory/'ga-native-headers'/(ident+'.json'),{'asset':asset,'zip_crc':'all_members_passed',
           'headers':headers,'plans':plans,'numeric_depth_approved':False})
    print('GA original retained',ident,'verified crop plans',len(plans),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',required=True)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);args=parser.parse_args()
    token=c.RESERVE_OVERRIDE.set(0)
    try:run(args.root.resolve(),args.url)
    finally:c.RESERVE_OVERRIDE.reset(token)
