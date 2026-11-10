"""Reconcile nationwide coastal review and acquire metered reference evidence.

Jurisdiction bounding boxes are retrieval envelopes, never ownership evidence.
Reference snapshots stay unapproved until certainty and boundaries are reviewed.
"""
import argparse
import hashlib
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlsplit, unquote

from scripts import ocean_acquisition as acquisition
from scripts import ocean_coastal as coastal
from scripts.ocean_coastal_sources import shoreline, fetch_json

ORDER = ('SA', 'JBT', 'NSW', 'QLD', 'WA', 'NT', 'TAS')
ENVELOPES = {'SA': [128.9,-39,141.1,-25.9], 'JBT':[150.55,-35.25,150.85,-34.95],
             'NSW':[140.9,-37.6,154,-28], 'QLD':[137.9,-29.2,154.5,-9],
             'WA':[112,-36,129.1,-13], 'NT':[128.9,-26.1,138.1,-10],
             'TAS':[143,-44.5,149,-39]}


def reconcile(discovery, records, root):
    """Use verified local receipts to repair stale discovery acquisition states."""
    acquired = {}
    for record in records:
        for row in record.get('acquisitions', []):
            if row.get('state') == 'acquired' and row.get('sha256') and row.get('parts'):
                parts = row['parts']
                if all(coastal.safe(root, p['path']).is_file() and
                       coastal.safe(root, p['path']).stat().st_size == p['bytes'] for p in parts):
                    acquired[row['id']] = row
    rows = []
    for original in discovery['candidates']:
        row = dict(original)
        if row['id'] in acquired:
            source = acquired[row['id']]
            row.update(acquisition_state='acquired', acquisition_sha256=source['sha256'],
                       acquisition_evidence='registered_parts_size_checked; checksum verification remains separate')
        # A title is a lead, never native resolution evidence.
        row['review_state'] = 'needs_native_header_footprint_and_reference_review'
        rows.append(row)
    seen={r['id'] for r in rows}
    for ident,source in sorted(acquired.items()):
        if ident in seen or not source.get('url'):continue
        rows.append({'id':ident,'url':source['url'],'filename':source.get('filename',Path(urlsplit(source['url']).path).name),
            'title':source.get('filename',ident),'bytes':source.get('bytes'),'acquisition_state':'acquired',
            'acquisition_sha256':source['sha256'],'declared_resolution_values_m':[],
            'acquisition_evidence':'registered_parts_size_checked; checksum verification remains separate',
            'review_state':'needs_native_header_footprint_and_reference_review','resolution_header_verified':False})
    return {**discovery, 'candidates': rows,
            'acquisition_counts': dict(Counter(r['acquisition_state'] for r in rows)),
            'inventory_review_complete': False}


def inventory(root):
    records = [acquisition.load(p) for p in sorted((root/'datasets/ocean/records').glob('*.json'))]
    result = reconcile(coastal.discover(root), records, root)
    publisher=root/'datasets/ocean/coastal/nationwide/ausseabed-publisher.json'
    if publisher.exists():
        indexed={r['url']:r for r in result['candidates']}
        for feature in acquisition.load(publisher)['features']:
            props=feature['properties'];url=props.get('DATA_URL','')
            parsed=urlsplit(url)
            if parsed.scheme!='https' or parsed.username or parsed.password:continue
            if url not in indexed:
                title=props['NAME']
                row={'id':hashlib.sha256(url.encode()).hexdigest()[:24],'url':url,
                     'title':title,'filename':Path(unquote(parsed.path)).name,
                     'acquisition_state':'pending','bytes':None,'metadata_url':props.get('META_URL'),
                     'licence_lead':props.get('LEGAL_CONSTRAINTS'),
                     'declared_resolution_values_m':[float(v) for v in re.findall(r'(?<![\d.])(\d+(?:\.\d+)?)\s*m\b',title,re.I)],
                     'review_state':'needs_native_header_footprint_and_reference_review',
                     'resolution_header_verified':False,'bounds_are_valid_coverage':False}
                result['candidates'].append(row);indexed[url]=row
            indexed[url].setdefault('publisher_feature_ids',[]).append(feature['id'])
            indexed[url].setdefault('publisher_access_evidence',[]).append({
                'feature_id':feature['id'],'status':props.get('PRODUCT_STATUS'),'embargo':props.get('EMBARGO')})
        result['publisher_snapshot_sha256']=coastal.digest(publisher)
        result['unique_sources']=len(result['candidates'])
        result['acquisition_counts']=dict(Counter(r['acquisition_state'] for r in result['candidates']))
    result.update(updated_at=datetime.now(timezone.utc).isoformat(),
                  policy={'states':list(ORDER), 'preferred_resolution_m':1, 'fallback_max_resolution_m':5,
                          'distance_m':500, 'reserve_bytes':0, 'transfer_limit_bytes':acquisition.LIMIT,
                          'external_territories':False, 'numeric_depth_sampling':False})
    result['remaining_transfer_bytes'] = acquisition.LIMIT-acquisition.load(root/'.cache/ocean-acquisition/ledger.json')['charged_bytes']
    acquisition.save(root/'datasets/ocean/coastal/nationwide-inventory.json', result)
    return result


def references(root, states=ORDER):
    """Checkpoint each jurisdiction independently; preserve failures for resumption."""
    directory = root/'datasets/ocean/coastal/nationwide'
    for state in states:
        target = directory/(state+'-shoreline-original.geojson')
        receipt = directory/(state+'-reference.json')
        if target.exists() and receipt.exists():
            saved = acquisition.load(receipt)
            if saved.get('status') == 'retrieved' and coastal.digest(target) == saved['sha256']:
                print('Reused reference', state, flush=True)
                continue
            if saved.get('status') == 'retrieved':
                raise ValueError('Stored shoreline checksum changed: '+state)
        try:
            with coastal.lock(root):
                data = shoreline(root,state,ENVELOPES[state],'geom',coastal.guard,
                                 page_size=20,response_limit=32*1024**2)
                data['properties']['jurisdiction_assignment_verified'] = False
                acquisition.save(target, data)
            acquisition.save(receipt, {'state':state,'status':'retrieved','sha256':coastal.digest(target),
                'features':len(data['features']),'ownership_review':'pending; envelope overlaps adjacent jurisdictions',
                'certainty_review':'pending','path':str(target.relative_to(root))})
            print('Retrieved reference',state,len(data['features']),flush=True)
        except (ValueError, OSError, InterruptedError) as error:
            acquisition.save(receipt, {'state':state,'status':'blocked','reason':str(error)})
            print('Reference blocked',state,str(error),flush=True)
            if isinstance(error, InterruptedError):raise


def publishers(root):
    """Freeze full publisher metadata with exact paging and raw-response hashes."""
    folder=root/'datasets/ocean/coastal/nationwide'
    raw=root/'datasets/raw/ocean/publisher-metadata'
    with coastal.lock(root):
        endpoint='https://warehouse.ausseabed.gov.au/geoserver/ows'
        features=[];seen=set();pages=[];total=None
        while total is None or len(features)<total:
            params={'service':'WFS','version':'2.0.0','request':'GetFeature',
                    'typeNames':'ausseabed:MARINEDATAREGISTER_ACQUISITIONS_INDEX',
                    'count':5000,'startIndex':len(features),'outputFormat':'application/json',
                    'propertyName':'NAME,DATA_URL,META_URL,PRODUCT_STATUS,EMBARGO,START_DATE,END_DATE,LEGAL_CONSTRAINTS,USER_CONSTRAINTS,CUSTODIAN',
                    'sortBy':'NAME'}
            url=endpoint+'?'+urlencode(params)
            data,sha=fetch_json(root,url,coastal.guard,limit=16*1024**2,archive_directory=raw)
            matched=data.get('numberMatched',data.get('totalFeatures'))
            if not isinstance(matched,int) or total is not None and matched!=total:
                raise ValueError('Publisher survey count missing or changed')
            total=matched;batch=data.get('features',[])
            if total>5000:raise ValueError('Publisher exceeds bounded snapshot size; stable unique paging key review required')
            if not batch and len(features)<total:raise ValueError('Incomplete national survey page')
            for feature in batch:
                if not feature.get('id') or feature['id'] in seen:raise ValueError('Duplicate survey ID')
                seen.add(feature['id'])
            features.extend(batch);pages.append({'url':url,'sha256':sha,'count':len(batch)})
            print('National publisher metadata',len(features),'/',total,flush=True)
        if len(features)!=total:raise ValueError('National survey count exceeded')
        acquisition.save(folder/'ausseabed-publisher.json',{'features':features,'pages':pages,
            'publisher_rows':total,'metadata_retrieval_complete':True,'native_qualification_complete':False})
        endpoint='https://services-ap1.arcgis.com/ypkPEy1AmwPKGNNv/ArcGIS/rest/services/State/FeatureServer'
        data,sha=fetch_json(root,endpoint+'?f=json',coastal.guard,archive_directory=raw)
        if 'error' in data or not data.get('layers'):raise ValueError('State boundary service unavailable')
        acquisition.save(folder/'jurisdiction-service.json',{'url':endpoint,'sha256':sha,'data':data})
        for layer in data['layers']:
            url=endpoint+'/'+str(layer['id'])+'?f=json'
            schema,h=fetch_json(root,url,coastal.guard,archive_directory=raw)
            acquisition.save(folder/('jurisdiction-layer-'+str(layer['id'])+'.json'),{'url':url,'sha256':h,'data':schema})


def boundaries(root):
    folder=root/'datasets/ocean/coastal/nationwide'
    raw=root/'datasets/raw/ocean/publisher-metadata'
    schema=acquisition.load(folder/'jurisdiction-layer-11.json')['data']
    endpoint=acquisition.load(folder/'jurisdiction-service.json')['url']+'/11'
    field=schema['objectIdField']
    with coastal.lock(root):
        data,h=fetch_json(root,endpoint+'/query?'+urlencode({'where':'1=1','returnIdsOnly':'true','f':'json'}),coastal.guard,archive_directory=raw)
        ids=data.get('objectIds')
        if not isinstance(ids,list) or not ids:raise ValueError('Boundary object IDs missing')
        features=[];pages=[]
        def retrieve(batch_ids):
            url=endpoint+'/query?'+urlencode({'objectIds':','.join(map(str,batch_ids)),'outFields':'*','returnGeometry':'true','outSR':4326,'f':'geojson'})
            key=hashlib.sha256((coastal.fingerprint(schema)+url).encode()).hexdigest()
            cached=folder/'boundary-pages'/(key+'.json')
            legacy=folder/'boundary-pages'/(hashlib.sha256(url.encode()).hexdigest()+'.json')
            if not cached.exists() and legacy.exists():cached=legacy
            if cached.exists():
                entry=acquisition.load(cached);path=coastal.safe(root,entry['path'])
                if coastal.digest(path)!=entry['sha256']:raise ValueError('Boundary page checksum changed')
                page=acquisition.load(path);sha=entry['sha256']
            else:
                page,sha=fetch_json(root,url,coastal.guard,limit=64*1024**2,archive_directory=raw)
            batch=page.get('features',[])
            unique={}
            for feature in batch:
                ident=feature['properties'][field]
                if ident in unique and unique[ident]!=feature:raise ValueError('Conflicting boundary features')
                unique[ident]=feature
            if page.get('exceededTransferLimit') or set(unique)!=set(batch_ids):
                if len(batch_ids)==1:raise ValueError('Incomplete single-object boundary response')
                middle=len(batch_ids)//2
                retrieve(batch_ids[:middle]);retrieve(batch_ids[middle:]);return
            acquisition.save(cached,{'path':str((raw/(sha+'.json')).relative_to(root)),'sha256':sha})
            features.extend(unique.values());pages.append({'url':url,'sha256':sha})
            print('Jurisdiction polygons',len(features),'/',len(ids),flush=True)
        for start in range(0,len(ids),100):retrieve(sorted(ids)[start:start+100])
        acquisition.save(folder/'jurisdiction-boundaries-original.geojson',{'type':'FeatureCollection','features':features,
            'properties':{'source_url':endpoint,'licence':schema.get('copyrightText'), 'schema_sha256':coastal.fingerprint(schema),'pages':pages,'review_state':'requires_jurisdiction_name_and_geometry_review'}})
        print('Retrieved official jurisdiction polygons',dict(Counter(f['properties'].get('state_abbrev') for f in features)),flush=True)


def wa_inventory(root):
    """Retrieve all custodian rows; string spacing remains a discovery lead."""
    endpoint='https://services6.arcgis.com/67Ks15nDmWoIbK8b/arcgis/rest/services/Survey_index_linkedbagfiles/FeatureServer/0'
    raw=root/'datasets/raw/ocean/publisher-metadata'
    with coastal.lock(root):
        schema,h=fetch_json(root,endpoint+'?f=json',coastal.guard,archive_directory=raw)
        field=schema['objectIdField']
        data,ids_hash=fetch_json(root,endpoint+'/query?'+urlencode({'where':'1=1','returnIdsOnly':'true','f':'json'}),coastal.guard,archive_directory=raw)
        ids=data['objectIds'];rows=[];pages=[]
        for start in range(0,len(ids),200):
            batch_ids=sorted(ids)[start:start+200]
            url=endpoint+'/query?'+urlencode({'objectIds':','.join(map(str,batch_ids)),'outFields':'*','returnGeometry':'false','f':'json'})
            page,sha=fetch_json(root,url,coastal.guard,archive_directory=raw)
            batch=[f['attributes'] for f in page.get('features',[])]
            if page.get('exceededTransferLimit') or len(batch)!=len(batch_ids) or {r[field] for r in batch}!=set(batch_ids):
                raise ValueError('Incomplete WA custodian inventory')
            rows.extend(batch);pages.append({'url':url,'sha256':sha})
        acquisition.save(root/'datasets/ocean/coastal/nationwide/wa-publisher.json',{
            'source_url':endpoint,'schema_sha256':h,'ids_sha256':ids_hash,'rows':rows,'pages':pages,
            'metadata_retrieval_complete':True,'native_qualification_complete':False})
        print('WA custodian rows retrieved',len(rows),flush=True)


def review_references(root):
    """Create explicit partial references from good-certainty, owned segments."""
    from shapely.geometry import shape, box, mapping
    from shapely.ops import unary_union
    folder=root/'datasets/ocean/coastal/nationwide'
    boundary_path=folder/'jurisdiction-boundaries-original.geojson'
    boundaries=acquisition.load(boundary_path)
    for state in ORDER:
        source=folder/(state+'-shoreline-original.geojson')
        original=acquisition.load(source);polygons=[];invalid=[]
        for feature in boundaries['features']:
            props=feature['properties'];code=props.get('state_abbrev')
            if code!=('OT' if state=='JBT' else state):continue
            geom=shape(feature['geometry'])
            if state=='JBT' and not geom.intersects(box(*ENVELOPES[state])):continue
            if geom.is_empty or not geom.is_valid:
                invalid.append(props.get('objectid'));continue
            polygons.append(geom)
        if not polygons:raise ValueError('No valid jurisdiction geometry: '+state)
        jurisdiction=unary_union(polygons);features=[];excluded=[]
        for feature in original['features']:
            if feature['properties'].get('certainty')!='good':
                excluded.append({'id':feature['id'],'reason':'shoreline certainty is not good'});continue
            clipped=shape(feature['geometry']).intersection(jurisdiction)
            lines=[]
            def append_lines(geom):
                if geom.is_empty:return
                if geom.geom_type=='LineString' and geom.length>0:lines.append(geom)
                elif hasattr(geom,'geoms'):
                    for part in geom.geoms:append_lines(part)
            append_lines(clipped)
            if not lines:
                excluded.append({'id':feature['id'],'reason':'no owned line segment in jurisdiction polygon'});continue
            features.append({**feature,'geometry':mapping(unary_union(lines)),
                             'properties':{**feature['properties'],'state':state}})
        if not features:raise ValueError('No reviewed shoreline segments: '+state)
        properties={**original['properties'],'review_state':'reviewed_good_certainty_jurisdiction_clipped',
            'jurisdiction_assignment_verified':True,'source_sha256':coastal.digest(source),
            'jurisdiction_reference':{'path':str(boundary_path.relative_to(root)),'sha256':coastal.digest(boundary_path)},
            'excluded_features':excluded,'invalid_boundary_objects':invalid,
            'coverage_review':{state:{'complete':False,'reason':'Whole-jurisdiction completeness and reference gaps remain under review'}}}
        acquisition.save(folder/(state+'-shoreline-reviewed.geojson'),{'type':'FeatureCollection','features':features,'properties':properties})
        print('Reviewed owned good-certainty reference',state,len(features),'excluded',len(excluded),'invalid boundaries',len(invalid),flush=True)


def rescreen(root, state):
    """Expand existing originals; create a fresh immutable run, never replace one."""
    import copy
    from rasterio.warp import transform_bounds
    from shapely.geometry import box, mapping
    filename={'SA':'sa-kangaroo-catalog.json','NSW':'nsw-bondi-catalog.json'}[state]
    catalog=copy.deepcopy(acquisition.load(root/'datasets/ocean/coastal'/filename))
    if state=='NSW':
        for source in catalog['sources']:
            with coastal.raster(root,source) as ds:
                source['footprint']=mapping(box(*transform_bounds(ds.crs,4326,*ds.bounds)))
            source['footprint_kind']='complete native grid extent; valid coastal mask checked independently'
    coast=root/'datasets/ocean/coastal/nationwide'/(state+'-shoreline-reviewed.geojson')
    plan=coastal.make_plan(root,catalog,coast)
    plan['run_id']='nationwide-'+state.lower()+'-'+coastal.fingerprint(plan)[:16]
    path=root/'datasets/ocean/coastal/nationwide'/(plan['run_id']+'-plan.json')
    acquisition.save(path,plan)
    with coastal.processing_lock(root,plan):
        coastal.process(root,plan)
        receipt=coastal.verify(root,plan)
        acquisition.save(coastal.run_directory(root,plan)/'non-vic-verification.json',receipt)
    print('Existing original rescreen verified',state,receipt,flush=True)


def wa_footprints(root):
    """Collect conservative discovery geometry for unrestricted fine-grid rows."""
    from shapely.geometry import shape, box
    folder=root/'datasets/ocean/coastal/nationwide'
    inventory=acquisition.load(folder/'wa-publisher.json')
    eligible=[]
    for row in inventory['rows']:
        try:spacing=float(row.get('GridSize_m'))
        except (ValueError,TypeError):continue
        if 0<spacing<=1 and str(row.get('DataRestri')).upper()=='NO' and str(row.get('Survey_download')).lower().endswith('.bag'):
            eligible.append(row)
    schema_path=root/'datasets/ocean/provenance/wa-survey-schema.json'
    # The refreshed custodian endpoint uses this explicitly checked ID field.
    field='OBJECTID_12';endpoint=inventory['source_url'];features=[];pages=[]
    with coastal.lock(root):
        def retrieve(ids):
            params={'objectIds':','.join(map(str,ids)),'outFields':'*','returnGeometry':'true',
                    'outSR':4326,'maxAllowableOffset':0.00001,'geometryPrecision':5,'f':'geojson'}
            url=endpoint+'/query?'+urlencode(params)
            page,sha=fetch_json(root,url,coastal.guard,limit=32*1024**2,archive_directory=root/'datasets/raw/ocean/publisher-metadata')
            batch=page.get('features',[])
            if page.get('exceededTransferLimit') or len(batch)!=len(ids) or {f['properties'][field] for f in batch}!=set(ids):
                if len(ids)==1:raise ValueError('Missing WA discovery footprint')
                middle=len(ids)//2;retrieve(ids[:middle]);retrieve(ids[middle:]);return
            features.extend(batch);pages.append({'url':url,'sha256':sha})
            print('WA fine-grid discovery geometry',len(features),'/',len(eligible),flush=True)
        ids=sorted(r[field] for r in eligible)
        for start in range(0,len(ids),50):retrieve(ids[start:start+50])
    coast=acquisition.load(folder/'WA-shoreline-reviewed.geojson')
    from shapely.strtree import STRtree
    lines=[shape(f['geometry']) for f in coast['features']];tree=STRtree(lines)
    leads=[]
    for feature in features:
        geometry=feature.get('geometry')
        if not geometry:continue
        geom=shape(geometry)
        if geom.is_empty:continue
        w,s,e,n=geom.bounds
        # About 2 km: deliberately wider than the final 500 m mask and the
        # 1 m discovery simplification. This never establishes valid coverage.
        search=box(w-.02,s-.02,e+.02,n+.02)
        if len(tree.query(search,predicate='intersects')):
            leads.append(feature)
    acquisition.save(folder/'wa-fine-coastal-leads.geojson',{'type':'FeatureCollection','features':leads,
        'properties':{'publisher_rows_checked':len(eligible),'candidate_footprints':len(features),
            'pages':pages,'source_url':endpoint,'native_headers_verified':False,
            'screening_geometry_only':True,'simplification_degrees':0.00001,
            'screening_envelope_margin_degrees':0.02,'valid_coastal_coverage_verified':False}})
    print('WA near-coast fine-grid leads',len(leads),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['inventory','references','publishers','boundaries','wa-inventory','review-references','rescreen','wa-footprints'])
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--state',choices=ORDER)
    args=parser.parse_args();root=args.root.resolve();coastal.RESERVE_OVERRIDE.set(0)
    if args.command=='inventory':
        result=inventory(root);print(result['acquisition_counts'],result['remaining_transfer_bytes'],flush=True)
    elif args.command=='references':references(root,[args.state] if args.state else ORDER)
    elif args.command=='publishers':publishers(root)
    elif args.command=='boundaries':boundaries(root)
    elif args.command=='wa-inventory':wa_inventory(root)
    elif args.command=='review-references':review_references(root)
    elif args.command=='wa-footprints':wa_footprints(root)
    else:
        if args.state not in ('NSW','SA'):parser.error('rescreen currently supports NSW and SA originals')
        rescreen(root,args.state)


if __name__=='__main__':main()
