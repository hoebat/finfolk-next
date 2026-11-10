"""Publishable native coastal COGs and independently attributed map contours.

Contours are derived reference-elevation isolines, never tide-adjusted depths.
Their native COGs remain byte-for-byte unchanged. Missing cells are not bridged.
"""
import argparse
import gzip
import hashlib
import html
import json
import os
from pathlib import Path
from urllib.parse import unquote, urlparse

import contourpy
import numpy as np
import rasterio
from pyproj import Transformer

from scripts import ocean_acquisition as acquisition
from scripts import ocean_coastal as coastal
from scripts.ocean_coastal_archive import save_coverage

LEVELS=[2,4,5,6,8,10,12,14,15,16,18,20,25,30,35,40,45,50,60,70,80,90,100,150,200,250,300,400,500,750,1000]


def contour_features(ds, metadata, levels=LEVELS):
    """Linear iso-elevation contours at native pixel centres; no resampling."""
    if ds.width<2 or ds.height<2:return []
    values=ds.read(1,masked=True)
    valid=~np.ma.getmaskarray(values)&np.isfinite(values.data)
    if not valid.any():return []
    # BAG elevation is positive above datum by specification; other included
    # products explicitly carry Height/elevation values. Retain the signed
    # source elevation as well as the UI's positive reference-depth convention.
    depth=-values.data
    minimum=float(depth[valid].min());maximum=float(depth[valid].max())
    chosen=[float(level) for level in levels if minimum<=level<=maximum]
    if not chosen:return []
    generator=contourpy.contour_generator(x=np.arange(ds.width)+.5,y=np.arange(ds.height)+.5,
                                        z=np.ma.array(depth,mask=~valid),corner_mask=False,
                                        name='serial',line_type='Separate')
    project=Transformer.from_crs(ds.crs,4326,always_xy=True)
    a,b,c,d,e,f=ds.transform[:6];features=[]
    for level in chosen:
        for line in generator.lines(level):
            x=a*line[:,0]+b*line[:,1]+c;y=d*line[:,0]+e*line[:,1]+f
            lon,lat=project.transform(x,y)
            coordinates=np.column_stack((lon,lat))
            if not np.isfinite(coordinates).all():raise ValueError('Invalid contour coordinates')
            features.append({'type':'Feature','geometry':{'type':'LineString','coordinates':coordinates.tolist()},
                             'properties':{**metadata,'depth_m':level,'source_elevation_m':-level,
                                           'derivation':'native-grid iso-elevation contour'}})
    return features


def collect(root):
    index=acquisition.load(root/'datasets/ocean/coastal/archive-index.json');sources={}
    for relative,checksum in index.get('inputs',{}).items():
        if coastal.digest(coastal.safe(root,relative))!=checksum:raise ValueError('Combined archive input changed')
    for run in index['runs']:
        if run['states']==['VIC']:
            manifest=acquisition.load(root/run['manifest']);ident='vcdem-2021-500m'
            sources[ident]={'metadata':{'id':ident,'title':'Victorian Coastal DEM 2021/2022 · 2.5 m',
                'states':['VIC'],'resolution_m':2.5,'datum':'Unverified source vertical reference',
                'survey_date':'2021/2022','licence':manifest['licence'],'attribution':manifest['attribution'],
                'upstream_url':manifest['source_url'],'verification':run},
                'rasters':[v['output'] for v in manifest['assets'].values() if v['output']['state']=='acquired']}
            continue
        if run['status']!='verified_rasters':raise ValueError('A non-Victorian run is not verified')
        plan=acquisition.load(root/run['plan']);receipt=acquisition.load(root/run['receipt'])
        if receipt['plan_sha256']!=coastal.fingerprint(plan):raise ValueError('Verified plan changed')
        results=acquisition.load(coastal.run_directory(root,plan)/'non-vic-results.json')
        for source in plan['sources']:
            rows=[v for v in results['outputs'].values() if v['source']==source['id'] and not v.get('empty')]
            if not rows:continue
            ident=source['id']
            if ident in sources:raise ValueError('Duplicate source in published archive')
            name=source.get('member') or unquote(urlparse(source.get('source_url','')).path.split('/')[-1]) or ident
            sources[ident]={'metadata':{'id':ident,'title':name.replace('_',' '),
                'states':source['states'],'resolution_m':source['resolution_m'],
                'datum':'Source reference; unverified vertical reconciliation',
                'source_vertical_reference':source['vertical_datum'],'source_sign_metadata':source['sign'],
                'survey_date':source['survey_date'],'licence':source['licence'],'attribution':source['attribution'],
                'upstream_url':source.get('publisher_metadata_url') or source.get('source_url',''),
                'verification':run},'rasters':rows}
    return index,sources


def export(root, output, origin, prior_sources=None):
    index,sources=collect(root);release='coastal-'+coastal.digest(root/'datasets/ocean/coastal/archive-index.json')[:16]
    prefix='coastal/'+release;folder=output/prefix;folder.mkdir(parents=True,exist_ok=True)
    work=output.parent/'contours';work.mkdir(parents=True,exist_ok=True)
    public=[];total=0
    prior_sources={v['id']:v for v in (prior_sources or [])}
    for ident,entry in sources.items():
        meta=entry['metadata'];key='coastal-'+ident;meta.update(id=key,kind='survey',
            source_url=origin+'/'+prefix+'/sources/'+key+'.html',
            limitation='Derived from native survey elevations relative to the source vertical reference. Vertical references are not harmonized; these lines are not tide-adjusted water depths.')
        properties={k:meta[k] for k in ['id','kind','title','datum','survey_date','licence','attribution','source_url','resolution_m']}
        properties['source_id']=properties.pop('id');properties['source_title']=properties.pop('title')
        previous=prior_sources.get(key)
        def stable_metadata(value):return {k:v for k,v in value.items() if k not in ('source_url','verification')}
        previous_metadata={k:previous[k] for k in meta if k in previous} if previous else {}
        reuse=bool(previous and stable_metadata(previous_metadata)==stable_metadata(meta) and
                   sorted(v['sha256'] for v in previous['rasters'])==sorted(v['sha256'] for v in entry['rasters']))
        raster_rows=[];contour_paths=[];contour_count=0
        checkpoint=work/(key+'.json.gz');signature=coastal.fingerprint({'pipeline':1,'metadata':meta,'rasters':entry['rasters']})
        cached=None
        if not reuse and checkpoint.exists():
            with gzip.open(checkpoint,'rt') as stream:cached=json.load(stream)
            if cached.get('signature')!=signature:raise ValueError('Existing contour checkpoint belongs to different inputs')
        for row in entry['rasters']:
            source=coastal.safe(root,row['path']);checksum=coastal.digest(source)
            if checksum!=row['sha256']:raise ValueError('Native COG checksum changed')
            target=folder/'rasters'/(checksum+'.tif');target.parent.mkdir(parents=True,exist_ok=True)
            if target.exists():
                if coastal.digest(target)!=checksum:raise ValueError('Publication target checksum changed')
            else:os.link(source,target)
            if not reuse and cached is None:
                shard=work/key/(checksum+'.json.gz')
                shard_signature=coastal.fingerprint({'pipeline':2,'metadata':meta,'sha256':checksum})
                if shard.exists():
                    with gzip.open(shard,'rt') as stream:fragment=json.load(stream)
                    if fragment['signature']!=shard_signature:raise ValueError('Contour shard inputs changed')
                else:
                    with rasterio.open(source) as ds:features=contour_features(ds,{**properties,'raster_sha256':checksum})
                    fragment={'signature':shard_signature,'collection':{'type':'FeatureCollection','features':features}}
                    save_coverage(shard,fragment)
                contour_paths.append(str(shard));contour_count+=len(fragment['collection']['features'])
            raster_rows.append({**row,'archive_path':row['path'],'url':origin+'/'+str(target.relative_to(output)),
                                'path':str(target.relative_to(output))})
            total+=1
            if total%32==0:print('Exported native COGs:',total,flush=True)
        if cached is not None:
            contour_paths=[str(checkpoint)];contour_count=len(cached['collection']['features'])
        if reuse:contour_count=previous['contour_count']
        descriptor={**meta,'rasters':raster_rows,'contour_count':contour_count}
        acquisition.save(folder/'sources'/(key+'.json'),descriptor)
        links=''.join('<li><a href="'+html.escape(row['url'],quote=True)+'">Native COG '+str(n+1)+'</a> · SHA256 '+row['sha256']+'</li>' for n,row in enumerate(raster_rows))
        document='<!doctype html><html lang="en"><meta charset="utf-8"><title>'+html.escape(meta['title'])+'</title><h1>'+html.escape(meta['title'])+'</h1><p>'+html.escape(meta['limitation'])+'</p><p>Vertical reference: '+html.escape(str(meta.get('source_vertical_reference',meta['datum'])))+'</p><p>'+html.escape(meta['licence'])+' · '+html.escape(meta['attribution'])+'</p><a href="'+html.escape(meta['upstream_url'],quote=True)+'">Original publisher</a><ul>'+links+'</ul></html>'
        (folder/'sources'/(key+'.html')).write_text(document)
        public.append({'id':key,'metadata':meta,'contours':contour_paths,'rasters':raster_rows,'reuse_contours':reuse})
        print('Prepared',key,len(raster_rows),'COGs;',descriptor['contour_count'],'native contours',flush=True)
    if total!=sum(v['verified_cogs'] for v in index['states'].values()):raise ValueError('Published native COG count differs from combined archive')
    coverage_source=coastal.safe(root,index['coverage']['path'])
    if coastal.digest(coverage_source)!=index['coverage']['sha256']:raise ValueError('Combined coverage checksum changed')
    coverage_target=folder/'coverage.geojson.gz'
    if not coverage_target.exists():os.link(coverage_source,coverage_target)
    if coastal.digest(coverage_target)!=index['coverage']['sha256']:raise ValueError('Published coverage checksum changed')
    published_coverage={**index['coverage'],'archive_path':index['coverage']['path'],
                        'path':str(coverage_target.relative_to(output)),'url':origin+'/'+str(coverage_target.relative_to(output))}
    index={**index,'coverage':published_coverage}
    catalog={'version':1,'release':release,'native_cog_count':total,'coverage':published_coverage,'archive':index,'sources':[{**v['metadata'],'catalog_url':origin+'/'+prefix+'/sources/'+v['id']+'.json','raster_count':len(v['rasters'])} for v in public]}
    acquisition.save(folder/'catalog.json',catalog);acquisition.save(output/'coastal/latest.json',{'release':release,'catalog_url':origin+'/'+prefix+'/catalog.json'})
    (output/'_headers').write_text('/coastal/*\n  Access-Control-Allow-Origin: *\n  Access-Control-Expose-Headers: Content-Length, Content-Range, ETag\n  Cache-Control: public, max-age=31536000, immutable\n/coastal/latest.json\n  Cache-Control: no-cache\n')
    (output/'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>FinFolk coastal data</title><h1>FinFolk coastal data</h1><p>'+str(total)+' native coastal COGs, with original source references and licences.</p><ul>'+''.join('<li><a href="'+html.escape(v['metadata']['source_url'],quote=True)+'">'+html.escape(v['metadata']['title'])+'</a></li>' for v in public)+'</ul></html>')
    plan={'release':release,'origin':origin,'prefix':prefix,'sources':public,'native_cog_count':total}
    acquisition.save(output.parent/'publication-plan.json',plan)
    return plan


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--origin',default='https://finfolk-datasets.netlify.app')
    parser.add_argument('--prior-sources',type=Path,help='Verified previous source descriptor JSON array; unchanged contour layers are reused')
    args=parser.parse_args();export(Path(__file__).resolve().parents[1],args.output.resolve(),args.origin.rstrip('/'),
                                  acquisition.load(args.prior_sources) if args.prior_sources else None)
