"""Register verified batches, preserving historical releases and raster values."""
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import shape, mapping
from shapely.ops import unary_union, transform

from scripts import ocean_coastal as c
from scripts import ocean_acquisition as a
from scripts.ocean_coastal_archive import combine


def build(root):
    directory=root/'datasets/ocean/coastal'
    index_path=directory/'non-vic-archive-index.json';previous=a.load(index_path)
    paths={r['plan'] for r in previous['runs']+previous.get('historical_runs',[]) if r.get('plan')}
    for pattern in ['nationwide/*-plan.json','nationwide/plans/*.json']:
        paths.update(str(p.relative_to(root)) for p in directory.glob(pattern))
    verified=[];pending=[];inputs={}
    for name in sorted(paths):
        path=c.safe(root,name);plan=a.load(path);run=c.run_directory(root,plan)
        receipt_path=run/'non-vic-verification.json';result_path=run/'non-vic-results.json';coverage_path=run/'non-vic-coverage.json'
        if not all(p.exists() for p in [receipt_path,result_path,coverage_path]):
            pending.append({'run_id':plan['run_id'],'plan':name});continue
        receipt=a.load(receipt_path);result=a.load(result_path);coverage=a.load(coverage_path);signature=c.fingerprint(plan)
        if receipt.get('status') not in ('verified_rasters','complete') or receipt.get('plan_sha256')!=signature or result.get('plan_sha256')!=signature or result.get('state')!='processed' or coverage['properties'].get('plan_sha256')!=signature:
            raise ValueError('Run verification evidence disagrees: '+plan['run_id'])
        # Keep the complete gap audit on disk, but do not retain a repeated
        # whole-jurisdiction geometry in memory for every individual survey.
        coverage['features']=[f for f in coverage['features'] if f['properties']['tier'] in ('preferred','fallback')]
        for entry in result['outputs'].values():
            if not entry.get('empty') and c.digest(c.safe(root,entry['path']))!=entry['sha256']:raise ValueError('Verified COG changed')
        verified.append({'plan':plan,'path':name,'receipt':receipt,'receipt_path':str(receipt_path.relative_to(root)),
                         'result':result,'coverage':coverage})
        for p in [path,receipt_path,result_path,coverage_path]:inputs[str(p.relative_to(root))]=c.digest(p)
    # The complete native-grid rescreen deliberately replaces the old Bondi AOI
    # only after verification. The old plan, files and public release remain.
    full_nsw=[v for v in verified if v['plan']['run_id'].startswith('nationwide-nsw-')]
    historical=[]
    if full_nsw:
        old=[v for v in verified if v['plan']['run_id']=='nsw-bondi-5m-20261110']
        if old:
            before=old[0]['plan']['sources'][0];after=full_nsw[-1]['plan']['sources'][0]
            if before['id']!=after['id'] or before['parts']!=after['parts']:raise ValueError('NSW rescreen original identity changed')
            historical=old;verified=[v for v in verified if v not in old]
    tiers={s:{'preferred':[],'fallback':[]} for s in c.STATES};counts=defaultdict(set);runs=[];repairs=[]
    def row(v):
        outputs=[e for e in v['result']['outputs'].values() if not e.get('empty')]
        return {'run_id':v['plan']['run_id'],'plan':v['path'],'states':sorted({s for x in v['plan']['sources'] for s in x['states']}),
                'status':'verified_rasters','receipt':v['receipt_path'],'rasters':len(outputs),
                'valid_cells':sum(e['valid_cells'] for e in outputs),
                'maximum_geodesic_distance_m':v['receipt']['maximum_geodesic_distance_m']}
    for v in verified:
        runs.append(row(v))
        for entry in v['result']['outputs'].values():
            if not entry.get('empty'):
                for state in entry['states']:counts[state].add(entry['sha256'])
        for feature in v['coverage']['features']:
            p=feature['properties']
            if p['tier'] not in ('preferred','fallback'):continue
            geom=shape(feature['geometry'])
            if not geom.is_valid:
                repairs.append({'run':v['plan']['run_id'],'state':p['state'],'reason':'canonicalized derived coverage geometry; original per-run geometry retained'})
                geom=make_valid(geom)
            tiers[p['state']][p['tier']].append(geom)
    features=[];states={};project=Transformer.from_crs(4326,9473,always_xy=True).transform
    for state,groups in tiers.items():
        fine=unary_union(groups['preferred']);fallback=unary_union(groups['fallback']).difference(fine)
        states[state]={'verified_cogs':len(counts[state]),'preferred_unique_area_km2':transform(project,fine).area/1e6,
            'fallback_unique_area_km2':transform(project,fallback).area/1e6,
            'jurisdiction_inventory_complete':False,'shoreline_reference_complete':False}
        for tier,geom in [('preferred',fine),('fallback',fallback)]:
            if not geom.is_empty:features.append({'type':'Feature','geometry':mapping(geom),'properties':{'state':state,'tier':tier}})
    index={'schema_version':1,'runs':runs,'historical_runs':[row(v) for v in historical],
           'states':states,'inputs':inputs,'archive_completion':False,'coverage_geometry_repairs':repairs,
           'coverage_policy':'Spatial union of verified native-cell footprints; no value blending. Source inventories and full shoreline completeness remain under review.'}
    signature=c.fingerprint(index)
    a.save(directory/'nationwide/processing-progress.json',{'pending_runs':pending,'verified_runs':len(runs)})
    if previous.get('content_fingerprint')==signature:
        print('Verified archive unchanged',flush=True);return a.load(directory/'archive-index.json')
    index.update(content_fingerprint=signature,updated_at=datetime.now(timezone.utc).isoformat())
    a.save(index_path,index)
    a.save(directory/'non-vic-archive-coverage.geojson',{'type':'FeatureCollection','features':features,
        'properties':{'archive_completion':False,'coverage_policy':index['coverage_policy']}})
    result=combine(root,lambda message:print(message,flush=True))
    print('Verified combined archive',sum(v['verified_cogs'] for v in result['states'].values()),flush=True)
    return result


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);args=parser.parse_args()
    build(args.root.resolve())
