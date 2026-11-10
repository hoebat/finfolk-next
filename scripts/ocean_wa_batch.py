"""Resume bounded WA batches admitted by current custodian access evidence.

Discovery footprints only rank candidates. Original BAG headers and native valid
cell masks establish raster eligibility; every retained cell is then verified.
"""
import argparse
import errno
from datetime import datetime, timezone
import hashlib
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit, urlunsplit

import rasterio
from rasterio.warp import transform_bounds
from shapely.geometry import box, mapping

from scripts import ocean_coastal as c
from scripts import ocean_acquisition as a


def candidates(features):
    unique={}
    for feature in features:
        p=feature['properties'];url=p.get('Survey_download','')
        try:spacing=float(p.get('GridSize_m'))
        except (ValueError,TypeError):continue
        if str(p.get('DataRestri')).upper()!='NO' or not 0<spacing<=1:continue
        if not url.startswith('https://dotazprdauegisextpubst01.blob.core.windows.net/transport-wa-public/bathymetry/rasters/') or not url.lower().endswith('.bag'):continue
        if any(ord(char)<32 for char in url):continue
        parsed=urlsplit(url)
        canonical=urlunsplit(parsed._replace(path=quote(parsed.path,safe='/:%+._-')))
        if canonical!=url:
            feature={**feature,'properties':{**p,'Survey_download':canonical,'publisher_url_original':url}}
            p=feature['properties'];url=canonical
        if url not in unique or (p.get('StartDate') or 0)>(unique[url]['properties'].get('StartDate') or 0):unique[url]=feature
    return sorted(unique.values(),key=lambda f:(-(f['properties'].get('StartDate') or 0),f['properties']['Survey_download']))


def spacing_allowed(spacing, allow_fallback=False):
    return spacing is not None and 0<spacing<=(5 if allow_fallback else 1)


def reusable_fallback(header):
    return bool(header.get('source_crs_wkt') and spacing_allowed(header.get('native_spacing_m'),True)
        and header.get('dtype') in ('float32','float64') and header.get('scales')
        and header['scales'][0]==1.0 and header.get('offsets') and header['offsets'][0]==0.0)


def prepare_queue(root):
    from shapely import make_valid
    from pyproj import Transformer
    from shapely.geometry import shape
    from shapely.ops import transform, unary_union
    directory=root/'datasets/ocean/coastal/nationwide'
    leads=directory/'wa-fine-coastal-leads.geojson';coast=directory/'WA-shoreline-reviewed.geojson'
    project=Transformer.from_crs(4326,9473,always_xy=True).transform
    lines=unary_union([shape(f['geometry']) for f in a.load(coast)['features']])
    # Simplification and projected buffering are ranking estimates only. Neither
    # is used for native masks, coverage claims or final distance verification.
    band=transform(project,lines).simplify(10).buffer(510)
    preferred=[shape(f['geometry']) for f in a.load(root/'datasets/ocean/coastal/non-vic-archive-coverage.geojson')['features']
               if f['properties']['state']=='WA' and f['properties']['tier']=='preferred']
    projected_preferred=transform(project,unary_union(preferred))
    repaired=not projected_preferred.is_valid
    # Reprojection can introduce touching-edge defects in raster footprints.
    # Repair only this disposable ranking estimate; source coverage is retained.
    band=band.difference(make_valid(projected_preferred) if repaired else projected_preferred)
    pin_path=directory/'wa-queue-pin-progress.json'
    inputs={'leads_sha256':c.digest(leads),'coast_sha256':c.digest(coast)}
    pin=a.load(pin_path) if pin_path.exists() else {'inputs':inputs,'sources':[],'blocked':[]}
    if pin['inputs']!=inputs:raise ValueError('Pinned queue checkpoint belongs to other inputs')
    entries=pin['sources'];blocked=pin['blocked'];queue=candidates(a.load(leads)['features'])
    seen={v['url'] for v in entries+blocked}
    with c.lock(root):
        for index,feature in enumerate(queue):
            p=feature['properties'];url=p['Survey_download']
            if url in seen:continue
            c.guard(root)
            try:
                with a.request(url,method='HEAD') as response:
                    size=int(response.headers['Content-Length']);etag=response.headers['ETag']
                    if size<=0 or not etag or 'text/html' in response.headers.get('Content-Type','').lower():raise ValueError('Unpinned or nonnumeric URL')
                projected=transform(project,shape(feature['geometry']))
                footprint_repaired=not projected.is_valid
                area=(make_valid(projected) if footprint_repaired else projected).intersection(band).area
                entries.append({'url':url,'bytes':size,'etag':etag,'estimated_new_coastal_area_m2':area,
                                'ranking_footprint_repaired':footprint_repaired,
                                'priority':area/size,'survey_start_ms':p.get('StartDate') or 0})
            except (OSError,ValueError) as error:
                blocked.append({'url':url,'reason':str(error)})
            if (index+1)%20==0:a.save(pin_path,pin);print('WA queue pinned',index+1,'/',len(queue),flush=True)
    entries.sort(key=lambda r:(-r['priority'],-r['survey_start_ms'],r['url']))
    a.save(directory/'wa-download-queue.json',{'inputs':{'leads_sha256':c.digest(leads),'coast_sha256':c.digest(coast)},
        'sources':entries,'blocked':blocked,'ranking':'estimated additional coastal coverage per source byte; newer date then URL break ties',
        'estimates_are_verified_coverage':False,'ranking_projection_geometry_repaired':repaired,
        'remaining_transfer_bytes':a.LIMIT-a.load(root/'.cache/ocean-acquisition/ledger.json')['charged_bytes']})
    print('WA pinned queue',len(entries),'sources',sum(r['bytes'] for r in entries),'bytes',len(blocked),'blocked',flush=True)


def run(root, limit, allow_fallback=False, reuse_only=False):
    if reuse_only and not allow_fallback:raise ValueError('Reuse-only fallback processing requires explicit fallback mode')
    directory=root/'datasets/ocean/coastal/nationwide'
    leads=directory/'wa-fine-coastal-leads.geojson';coast=directory/'WA-shoreline-reviewed.geojson'
    checkpoint=directory/'wa-batch-progress.json'
    identity={'leads_sha256':c.digest(leads),'coast_sha256':c.digest(coast),'pipeline':1}
    state=a.load(checkpoint) if checkpoint.exists() else {'inputs':identity,'assets':{}}
    if state['inputs']!=identity:raise ValueError('WA batch inputs changed; retain this checkpoint and review a new batch')
    if state.get('stop_reason'):
        state.setdefault('stop_history',[]).append({'reason':state.pop('stop_reason'),
            'resumed_at':datetime.now(timezone.utc).isoformat()})
    reusable=set()
    for ident,entry in state['assets'].items():
        if allow_fallback and entry.get('status')=='native_review_required' and entry.get('header'):
            header=a.load(c.safe(root,entry['header']))
            if reusable_fallback(header):
                entry.setdefault('native_review_history',[]).append({'header':entry['header'],'previous_status':'native_review_required'})
                entry.update(status='retry_pending',review_scope='Explicit native fallback <=5m; exact spacing retained, never labelled <=1m')
                reusable.add(ident)
        reason=entry.get('reason','')
        if entry.get('status')=='review_required' and ('[Errno 35]' in reason or
                reason=='Missing raster CRS' and (directory/'native-headers'/(ident+'.json')).exists() and
                a.load(directory/'native-headers'/(ident+'.json')).get('source_crs_wkt')):
            entry.setdefault('operational_history',[]).append(reason)
            entry.update(status='retry_pending',reason='Retry after operational driver/lock correction')
    record_path=root/'datasets/ocean/records/wa-bathymetry-surveys.json'
    queue=candidates(a.load(leads)['features']);completed=0
    ranking=directory/'wa-download-queue.json'
    if ranking.exists():
        ranked=a.load(ranking)
        if ranked['inputs']!={k:identity[k] for k in ('leads_sha256','coast_sha256')}:raise ValueError('Ranked queue belongs to different references')
        order={r['url']:i for i,r in enumerate(ranked['sources'])}
        queue=sorted([f for f in queue if f['properties']['Survey_download'] in order],key=lambda f:order[f['properties']['Survey_download']])
    if reusable:
        queue.sort(key=lambda feature:hashlib.sha256(feature['properties']['Survey_download'].encode()).hexdigest()[:24] not in reusable)
    if reuse_only:
        queue=[feature for feature in queue if hashlib.sha256(feature['properties']['Survey_download'].encode()).hexdigest()[:24] in reusable]
    published=set()
    for run in a.load(root/'datasets/ocean/coastal/archive-index.json')['runs']:
        if run.get('plan'):
            for source in a.load(root/run['plan'])['sources']:published.add(source['id'])
    for feature in queue:
        p=feature['properties'];url=p['Survey_download'];ident=hashlib.sha256(url.encode()).hexdigest()[:24]
        prior=state['assets'].get(ident,{})
        if ident in published or prior.get('status') in ('verified','empty','unavailable','access_blocked','native_review_required'):continue
        if completed>=limit:break
        print('WA candidate',completed+1,'/',limit,Path(url).name,flush=True)
        try:
            with c.lock(root):
                # Azure supports HEAD, so no unmetered range-body probe is used.
                with a.request(url,method='HEAD') as response:
                    size=int(response.headers['Content-Length']);etag=response.headers['ETag']
                    if 'text/html' in response.headers.get('Content-Type','').lower():raise ValueError('BAG URL returned HTML')
                source={'id':ident,'url':url,'bytes':size,'etag':etag,
                        'output_bytes_estimate':size*4,'scratch_bytes_estimate':c.MEMORY_LIMIT}
                forecast=c.capacity(root,{'sources':[source]})
                if reuse_only and forecast['planned_transfer_bytes']:
                    state['assets'][ident].update(status='retained_original_review_required',reason='Reuse-only mode refuses new source bytes',forecast=forecast)
                    a.save(checkpoint,state);continue
                if forecast['budget_shortfall_bytes'] or forecast['storage_shortfall_bytes']:
                    state['assets'][ident]={'status':'budget_blocked' if forecast['budget_shortfall_bytes'] else 'storage_blocked','forecast':forecast}
                    a.save(checkpoint,state);continue
                for attempt in range(3):
                    try:c.acquire(root,{'sources':[source]});break
                    except (TimeoutError,URLError) as error:
                        if isinstance(error,HTTPError) and error.code not in (429,500,502,503,504):raise
                        if attempt==2:raise
                        time.sleep(2**attempt)
                raw=root/'datasets/raw/ocean/coastal-nonvic'/ident/'original.bin';sha=c.digest(raw)
                parts=c.catalog_parts(root,'wa-bathymetry-surveys',ident,raw,sha) if size>1024**3 else [{'path':str(raw.relative_to(root)),'bytes':size,'sha256':sha}]
                record=a.load(record_path)
                old=next((v for v in record.get('acquisitions',[]) if v['id']==ident),{})
                row={**source,'state':'acquired','sha256':sha,'parts':parts,
                     'filename':Path(url).name,'acquired_at':old.get('acquired_at',datetime.now(timezone.utc).isoformat()),
                     'publisher_access_evidence':p,'numeric_validation':'original acquired; native coastal verification follows'}
                record['acquisitions']=[v for v in record.get('acquisitions',[]) if v['id']!=ident]+[row]
                a.save(record_path,record)
            with rasterio.open(raw,driver='BAG') as ds:
                spacing=c.native_spacing(ds) if ds.crs else None
                header={'source_crs_wkt':ds.crs.to_wkt() if ds.crs else None,'native_spacing_m':spacing,
                        'width':ds.width,'height':ds.height,'scales':ds.scales,'offsets':ds.offsets,
                        'dtype':ds.dtypes[0],'source_sha256':sha,'publisher':p}
                a.save(directory/'native-headers'/(ident+'.json'),header)
                if not ds.crs or not spacing_allowed(spacing,allow_fallback) or ds.dtypes[0] not in ('float32','float64') or ds.scales[0]!=1 or ds.offsets[0]!=0:
                    state['assets'][ident]={'status':'native_review_required','header':str((directory/'native-headers'/(ident+'.json')).relative_to(root))}
                    a.save(checkpoint,state);continue
                source={**source,'parts':parts,'format':'BAG','states':['WA'],'survey_derived':True,
                    'resolution_m':spacing,'horizontal_crs_verified':True,'native_crs':ds.crs.to_wkt(),
                    'footprint':mapping(box(*transform_bounds(ds.crs,4326,*ds.bounds))),
                    'footprint_kind':'native grid extent; valid coverage determined from native masks',
                    'licence':record['licence'],'attribution':'Government of Western Australia, Department of Transport',
                    'vertical_datum':'Original BAG source CRS retained without vertical reconciliation: '+ds.crs.to_wkt(),
                    'units':'metres (BAG elevation specification; no conversion)',
                    'sign':'BAG elevation values retained unchanged; vertical reconciliation unverified',
                    'survey_date':datetime.fromtimestamp(p['StartDate']/1000,timezone.utc).date().isoformat() if p.get('StartDate') is not None else 'Unknown (not stated by custodian)',
                    'source_url':url,'publisher_metadata_url':record['source_url']}
            catalog={'sources':[source],'inventory_review':{'WA':{'complete':False,'reason':'Bounded custodian batch; national source review remains incomplete'}}}
            plan=c.make_plan(root,catalog,coast);plan['run_id']='wa-national-'+ident+'-'+c.fingerprint(plan)[:12]
            plan_path=directory/'plans'/(plan['run_id']+'.json');a.save(plan_path,plan)
            with c.processing_lock(root,plan):
                result=c.process(root,plan);receipt=c.verify(root,plan)
                a.save(c.run_directory(root,plan)/'non-vic-verification.json',receipt)
                from scripts.ocean_audit_storage import compact_run
                compact_run(root,plan)
            rasters=sum(not v.get('empty') for v in result['outputs'].values())
            state['assets'][ident]={**state['assets'].get(ident,{}),'status':'verified' if rasters else 'empty','plan':str(plan_path.relative_to(root)),'rasters':rasters,'verification':receipt}
            a.save(checkpoint,state);completed+=1
            print('WA verified',ident,rasters,'COGs',flush=True)
        except HTTPError as error:
            status='unavailable' if error.code in (404,410) else 'access_blocked' if error.code in (401,403) else 'network_error'
            state['assets'][ident]={'status':status,'http_status':error.code};a.save(checkpoint,state)
        except InterruptedError as error:
            state['stop_reason']=str(error);a.save(checkpoint,state);print('Guarded stop',str(error),flush=True);break
        except BlockingIOError as error:
            state['stop_reason']='Another acquisition or processing runner holds the lock'
            a.save(checkpoint,state);print('Lock contention; batch stopped without reclassifying this source',flush=True);break
        except OSError as error:
            if error.errno==errno.ENOSPC:
                state['stop_reason']='Actual filesystem capacity exhausted; original and processing checkpoints retained'
                try:a.save(checkpoint,state)
                except OSError:pass
                print('Storage stop; source eligibility unchanged. Resume after reclaiming duplicate/audit storage.',flush=True)
                break
            state['assets'][ident]={'status':'retry_pending','operational_error':str(error)}
            a.save(checkpoint,state);print('WA operational failure retained for retry',ident,str(error),flush=True)
        except ValueError as error:
            import traceback
            traceback.print_exc()
            state['assets'][ident]={'status':'review_required','reason':str(error)};a.save(checkpoint,state);print('WA review required',ident,str(error),flush=True)
    print('WA batch checkpoint',checkpoint,'new completed',completed,flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--limit',type=int,default=12)
    parser.add_argument('--prepare-queue',action='store_true')
    parser.add_argument('--allow-fallback',action='store_true',help='Reuse eligible originals at their exact native spacing up to 5 m; preferred tier remains strictly <=1 m')
    parser.add_argument('--reuse-only',action='store_true',help='Only reconsider retained fallback candidates; refuse any forecast new source bytes')
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);args=parser.parse_args()
    if args.limit<1:parser.error('limit must be positive')
    if args.reuse_only and not args.allow_fallback:parser.error('--reuse-only requires --allow-fallback')
    token=c.RESERVE_OVERRIDE.set(0)
    try:
        if args.prepare_queue:prepare_queue(args.root.resolve())
        else:run(args.root.resolve(),args.limit,args.allow_fallback,args.reuse_only)
    finally:c.RESERVE_OVERRIDE.reset(token)
