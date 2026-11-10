"""Include the completed Victorian package in the combined coastal archive.

This indexes existing data only. Non-Victorian acquisition scope is unchanged.
Victoria retains its original integrity and sampled-distance verification scope.
"""
import argparse
import copy
import gzip
import io
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import rasterio
from pyproj import Transformer
from shapely.geometry import mapping
from shapely.ops import transform, unary_union

from scripts import ocean_coastal as coastal
from scripts import ocean_acquisition as acquisition


def save_coverage(path, value):
    """Atomically write lossless, reproducible compressed GeoJSON."""
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as output:
            temporary=Path(output.name)
            with gzip.GzipFile(fileobj=output,mode='wb',filename='',mtime=0) as compressed:
                with io.TextIOWrapper(compressed,encoding='utf-8') as text:
                    json.dump(value,text,separators=(',',':'),allow_nan=False)
            output.flush();os.fsync(output.fileno())
        temporary.replace(path)
    finally:
        if temporary is not None:temporary.unlink(missing_ok=True)


def combine(root, progress=lambda message: None):
    directory=root/'datasets/ocean/coastal'
    base_path=directory/'non-vic-archive-index.json'
    base_coverage_path=directory/'non-vic-archive-coverage.geojson'
    index=copy.deepcopy(acquisition.load(base_path))
    coverage=copy.deepcopy(acquisition.load(base_coverage_path))
    if 'VIC' in index['states'] or any(f['properties']['state']=='VIC' for f in coverage['features']):
        raise ValueError('Expected the non-Victorian input index')
    manifest_path=directory/'vcdem-500m.json'
    manifest=acquisition.load(manifest_path)
    receipt_path=coastal.safe(root,manifest['verification_reference'])
    receipt=acquisition.load(receipt_path)
    if (manifest['state']!='complete' or receipt['status']!='verified' or
            receipt['plan_sha256']!=manifest['plan_sha256'] or
            receipt['tiles_verified']!=len(manifest['assets']) or
            manifest['tile_count']!=len(manifest['assets'])):
        raise ValueError('Victorian completion and verification evidence disagree')
    if manifest['cellsize_m']!=2.5 or manifest['distance_m']!=500:
        raise ValueError('Unexpected Victorian grid or coastal band')
    polygons=[];rasters=[];empty=0;cells=0
    for ident,asset in manifest['assets'].items():
        output=asset['output']
        if output['state']=='empty':
            empty+=1
            continue
        if output['state']!='acquired':raise ValueError('Victorian tile is incomplete')
        path=coastal.safe(root,output['path'])
        if path.stat().st_size!=output['bytes'] or coastal.digest(path)!=output['sha256']:
            raise ValueError('Victorian output checksum or size changed')
        with rasterio.open(path) as ds:
            if (ds.res!=(2.5,2.5) or ds.count!=1 or
                    ds.crs!=rasterio.crs.CRS.from_user_input(output['horizontal_crs']) or
                    ds.tags(ns='IMAGE_STRUCTURE').get('LAYOUT')!='COG' or
                    int((ds.read_masks(1)>0).sum())!=output['valid_cells']):
                raise ValueError('Victorian native grid, layout or valid-cell count changed')
            polygons.append(coastal.valid_geometry(ds))
        rasters.append({'id':ident,**output});cells+=output['valid_cells']
        if len(rasters)%64==0:progress(f'Checked {len(rasters)} Victorian COGs')
    if len(rasters)!=receipt['cog_count'] or empty!=receipt['empty_tiles']:
        raise ValueError('Victorian retained/empty tile counts disagree')
    progress('Combining Victorian valid-cell footprints')
    geometry=unary_union(polygons)
    area=Transformer.from_crs(4326,9473,always_xy=True)
    km2=transform(area.transform,geometry).area/1e6
    feature={'type':'Feature','geometry':mapping(geometry),'properties':{'state':'VIC','tier':'fallback','native_resolution_m':2.5}}
    coverage['features'].append(feature)
    index['states']['VIC']={'verified_cogs':len(rasters),'preferred_unique_area_km2':0.0,
                          'fallback_unique_area_km2':km2,'acquisition_status':'complete',
                          'acquisition_scope':'Selected VCDEM 2021/2022 unblended 2.5m grid within 500m of Vicmap coastline, both sides',
                          'jurisdiction_inventory_complete':False,'shoreline_reference_complete':False,
                          'datum_verified':manifest['datum_verified'],
                          'verification_level':'integrity_and_sampled_coastal_distance'}
    row={'run_id':'vcdem-2021-coastal-500m','states':['VIC'],'status':'verified',
         'acquisition_status':'complete','manifest':str(manifest_path.relative_to(root)),
         'receipt':str(receipt_path.relative_to(root)),'rasters':len(rasters),'empty_tiles':empty,
         'valid_cells':cells,'native_resolution_m':2.5,'tier':'fallback',
         'verification_level':'integrity_and_sampled_coastal_distance',
         'coastal_distance_samples':receipt['mask_distance_samples'],
         'scientific_datum_and_source_quality':receipt['scientific_datum_and_source_quality']}
    index['runs'].append(row)
    index['updated_at']=datetime.now(timezone.utc).isoformat()
    index['scope']='Combined Australian coastal archive, including completed Victoria'
    index['inputs']={str(path.relative_to(root)):coastal.digest(path) for path in
                     [base_path,base_coverage_path,manifest_path,receipt_path]}
    index['coverage_policy']+=' Victoria is completed 2.5m fallback coverage; its legacy distance checks were sampled, not full-cell checks.'
    coverage['properties']['coverage_policy']=index['coverage_policy']
    coverage_path=directory/'archive-coverage.geojson.gz'
    save_coverage(coverage_path,coverage)
    coverage_reference={'path':str(coverage_path.relative_to(root)),'format':'GeoJSON+gzip',
                        'sha256':coastal.digest(coverage_path)}
    index['coverage']=coverage_reference
    package={'schema_version':1,'state':'VIC','stage':'verified_legacy_package',
             'acquisition_status':'complete','source_manifest':row['manifest'],
             'verification':row,'licence':manifest['licence'],'attribution':manifest['attribution'],
             'distance_m':500,'band_sides':manifest['band_sides'],'rasters':rasters,
             'summary':index['states']['VIC'],
             'coverage':{**coverage_reference,'feature_filter':{'state':'VIC'}}}
    acquisition.save(root/'datasets/processed/coastal/VIC/catalog.json',package)
    acquisition.save(directory/'archive-index.json',index)
    return index


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    args=parser.parse_args()
    result=combine(args.root.resolve(),lambda message:print(message,flush=True))
    print(f"Combined archive: {sum(s['verified_cogs'] for s in result['states'].values())} COGs, including {result['states']['VIC']['verified_cogs']} Victorian COGs")


if __name__=='__main__':main()
