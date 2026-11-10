"""Bounded, budget-accounted publisher geometry retrieval."""
import hashlib
import json
import math
import re
import os
import tempfile
from urllib.parse import urlencode

from shapely.geometry import shape, box, mapping, MultiLineString
from scripts import ocean_acquisition as acq

DEA_WFS='https://geoserver.dea.ga.gov.au/geoserver/dea/wfs'


def fetch_bytes(root,url,guard,limit=4*1024**2,archive_directory=None,extension='.bin'):
    """Caller holds the shared acquisition lock; failed reads retain their debit."""
    if extension not in ('.bin','.json','.xml','.html'):raise ValueError('Unsupported metadata archive suffix')
    guard(root)
    ledger_path=root/'.cache/ocean-acquisition/ledger.json'
    ledger=acq.load(ledger_path)
    body=bytearray()
    with acq.request(url) as response:
        while True:
            allowance=acq.LIMIT-ledger['charged_bytes']
            if allowance<=0: raise InterruptedError('Transfer budget reached')
            n=min(acq.BLOCK,limit+1-len(body),allowance)
            guard(root,n)
            ledger['charged_bytes']+=n;acq.save(ledger_path,ledger)
            data=response.read(n)
            ledger['charged_bytes']-=n-len(data)
            ledger['received_bytes']+=len(data)
            acq.save(ledger_path,ledger)
            body.extend(data)
            if len(body)>limit: raise ValueError('Publisher metadata response exceeds limit')
            if not data: break
    sha=hashlib.sha256(body).hexdigest()
    if archive_directory is not None:
        guard(root,len(body))
        archive_directory.mkdir(parents=True,exist_ok=True)
        target=archive_directory/(sha+extension)
        if not target.exists():
            with tempfile.NamedTemporaryFile(dir=archive_directory,delete=False) as out:
                out.write(body);out.flush();os.fsync(out.fileno());temporary=out.name
            os.replace(temporary,target)
    return bytes(body),sha


def fetch_json(root,url,guard,limit=4*1024**2,archive_directory=None):
    body,sha=fetch_bytes(root,url,guard,limit,archive_directory,extension='.json')
    return json.loads(body),sha


def shoreline(root,state,bbox,geometry_field,guard,year=2024,page_size=500,response_limit=4*1024**2):
    if state not in ('NSW','QLD','SA','TAS','WA','NT','JBT'): raise ValueError('Excluded shoreline jurisdiction')
    if len(bbox)!=4 or not all(math.isfinite(v) for v in bbox) or not (-180<=bbox[0]<bbox[2]<=180 and -90<=bbox[1]<bbox[3]<=90):
        raise ValueError('Invalid geographic shoreline bounds')
    if not re.fullmatch('[A-Za-z_][A-Za-z0-9_]*',geometry_field): raise ValueError('Reviewed geometry field required')
    if year!=2024: raise ValueError('This adapter is pinned to finalized 2024; review a new release before changing year')
    if not 1<=page_size<=500: raise ValueError('Invalid page size')
    if isinstance(response_limit,bool) or not isinstance(response_limit,int) or not 1<=response_limit<=64*1024**2:
        raise ValueError('Invalid bounded shoreline response limit')
    features=[];seen=set();pages=[];total=None;excluded=[];cleanups=[]
    while total is None or len(seen)<total:
        params={'service':'WFS','version':'2.0.0','request':'GetFeature','typeNames':'dea:shorelines_annual',
                'outputFormat':'application/json','srsName':'urn:ogc:def:crs:OGC::CRS84',
                'count':page_size,'startIndex':len(seen),
                'CQL_FILTER':f"year={year} AND BBOX({geometry_field},{','.join(str(v) for v in bbox)},'EPSG:4326')"}
        url=DEA_WFS+'?'+urlencode(params)
        archive_directory=root/'datasets/raw/ocean/dea-coastlines-2024/pages'
        data,sha=fetch_json(root,url,guard,limit=response_limit,archive_directory=archive_directory)
        crs=data.get('crs',{}).get('properties',{}).get('name','CRS84').upper()
        if not ('CRS84' in crs or crs.endswith('CRS::84') or crs.endswith(':4326')):
            raise ValueError('Publisher ignored requested geographic CRS')
        matched=data.get('numberMatched',data.get('totalFeatures'))
        if not isinstance(matched,int) or isinstance(matched,bool) or matched<0: raise ValueError('Publisher did not establish result count')
        if total is not None and total!=matched: raise ValueError('Shoreline result count changed during paging')
        total=matched
        batch=data.get('features',[])
        if not batch and len(seen)<total: raise ValueError('Incomplete shoreline page set')
        for feature in batch:
            ident=feature.get('id')
            if not ident or ident in seen: raise ValueError('Duplicate or missing shoreline feature ID')
            seen.add(ident)
            props=feature.get('properties',{})
            geom=shape(feature['geometry'])
            if props.get('year')!=year or geom.geom_type not in ('LineString','MultiLineString'):
                raise ValueError('Unexpected shoreline year or geometry')
            lines=list(geom.geoms) if geom.geom_type=='MultiLineString' else [geom]
            valid=[line for line in lines if not line.is_empty and line.length>0]
            if any(not line.is_valid or not box(-180,-90,180,90).covers(line) for line in valid):
                raise ValueError('Invalid nondegenerate publisher shoreline geometry')
            if not valid:
                excluded.append({'id':ident,'reason':'Publisher feature contains no nonzero-length shoreline segments; original response retained'})
                continue
            if len(valid)!=len(lines):
                cleanups.append({'id':ident,'removed_zero_length_components':len(lines)-len(valid)})
                geom=MultiLineString(valid)
            props={**props,'state':state}
            features.append({**feature,'geometry':mapping(geom),'properties':props})
        page={'url':url,'sha256':sha,'features':len(batch)}
        original=archive_directory/(sha+'.json')
        if original.exists():page['raw_path']=original.relative_to(root).as_posix()
        pages.append(page)
        if len(seen)>total: raise ValueError('Shoreline count exceeds publisher total')
    return {'type':'FeatureCollection','features':features,'properties':{
        'authoritative':True,'source_url':DEA_WFS,'version':'DEA Coastlines 3.1.0 / finalized 2024',
        'licence':'CC BY 4.0','attribution':'Commonwealth of Australia (Geoscience Australia)',
        'query_bbox':bbox,'review_state':'requires_certainty_and_jurisdiction_review',
        'coverage_review':{state:{'complete':False,'reason':'AOI query does not establish complete jurisdiction shoreline'}},
        'pages':pages,'feature_count':len(features),'publisher_feature_count':total,
        'excluded_invalid_features':excluded,'geometry_cleanup':cleanups}}
