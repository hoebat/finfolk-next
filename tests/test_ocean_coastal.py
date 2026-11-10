import tempfile
import io
import zipfile
import unittest
import xml.etree.ElementTree as ET
import hashlib
from pathlib import Path
from unittest.mock import patch

import numpy as np
import rasterio
from rasterio.transform import from_origin
from pyproj import Transformer
from shapely.geometry import LineString, box, mapping
from shapely.ops import transform

from scripts import ocean_coastal as c


class CoastalTests(unittest.TestCase):
    def test_catalog_parts_roundtrip_reuse_and_conflict_preserve_original(self):
        path=self.root/'archive.bin';body=b'original survey bytes';path.write_bytes(body)
        checksum=c.digest(path)
        with patch.object(c.acq,'PART',8),patch.object(c,'guard'):
            parts=c.catalog_parts(self.root,'surveys','survey1',path,checksum)
            self.assertEqual([part['bytes'] for part in parts],[8,8,5])
            joined=c.JoinedParts([self.root/part['path'] for part in parts])
            self.assertEqual(joined.read(),body)
            self.assertEqual(c.catalog_parts(self.root,'surveys','survey1',path,checksum),parts)
            self.assertEqual(path.read_bytes(),body)
            conflict=self.root/parts[1]['path'];conflict.write_bytes(b'conflict')
            with self.assertRaisesRegex(ValueError,'conflicts'):
                c.catalog_parts(self.root,'surveys','survey1',path,checksum)
            self.assertEqual(conflict.read_bytes(),b'conflict')
            self.assertEqual(path.read_bytes(),body)
            self.assertEqual(sorted(p.name for p in conflict.parent.iterdir()),['000000.bin','000001.bin','000002.bin'])
            with self.assertRaisesRegex(ValueError,'Original checksum changed'):
                c.catalog_parts(self.root,'surveys','survey1',path,'0'*64)

    def test_publisher_crs_binding_preserves_native_values_masks_and_provenance(self):
        # Publisher ESRI-era datum spelling differs from GeoTIFF's canonical
        # EPSG spelling, although both identify the same horizontal CRS.
        srs=c.ProjectionCRS.from_epsg(7856).to_wkt('WKT1_GDAL').replace('Geocentric_Datum_of_Australia_2020','GDA2020').replace('GRS 1980','GRS_1980')
        body=ET.Element('PAMDataset');ET.SubElement(body,'SRS').text=srs
        xml=ET.tostring(body);path=self.root/'publisher.zip'
        with zipfile.ZipFile(path,'w') as archive:
            archive.write(self.root/'source.tif','source.tif')
            archive.writestr('source.aux.xml',xml)
        source={**self.source,'member':'source.tif','parts':[{'path':'publisher.zip','bytes':path.stat().st_size,'sha256':c.digest(path)}],
                'publisher_crs_metadata':{'member':'source.aux.xml','sha256':hashlib.sha256(xml).hexdigest(),'crs':'EPSG:7856'}}
        c.review_source(source)
        with c.raster(self.root,source) as ds:
            self.assertEqual(ds.crs.to_epsg(),7856)
            self.assertEqual(ds.transform,self.affine)
            data=ds.read(1,masked=True)
            np.testing.assert_array_equal(data.data,self.values)
            self.assertEqual(int(np.ma.getmaskarray(data).sum()),1)
            self.assertTrue(data.mask[0,0])
            self.assertEqual(c.ProjectionCRS(ds.tags()['SOURCE_EMBEDDED_CRS_WKT']).to_epsg(),32756)
            self.assertEqual(ds.tags()['PUBLISHER_CRS_METADATA_SHA256'],hashlib.sha256(xml).hexdigest())
        with rasterio.open(self.root/'source.tif') as original:
            self.assertEqual(original.crs.to_epsg(),32756)
        plan=c.make_plan(self.root,{'sources':[source]},self.coast)
        with patch.object(c,'guard'):
            result=c.process(self.root,plan)
            self.assertEqual(c.verify(self.root,plan)['status'],'verified_rasters')
        with rasterio.open(self.root/result['outputs']['test-0-0']['path']) as ds:
            self.assertEqual(ds.tags()['PUBLISHER_CRS_METADATA_MEMBER'],'source.aux.xml')
            self.assertEqual(c.ProjectionCRS(ds.tags()['SOURCE_EMBEDDED_CRS_WKT']).to_epsg(),32756)
        for changes,message in [({'sha256':'0'*64},'checksum'),({'crs':'EPSG:32755'},'reviewed CRS')]:
            broken={**source,'publisher_crs_metadata':{**source['publisher_crs_metadata'],**changes}}
            with self.assertRaisesRegex(ValueError,message):
                with c.raster(self.root,broken):pass
        with self.assertRaisesRegex(ValueError,'safe metadata member'):
            c.review_source({**source,'publisher_crs_metadata':{**source['publisher_crs_metadata'],'member':'../unsafe.xml'}})

    def test_compound_vertical_metadata_roundtrips_without_axis_normalization(self):
        with rasterio.open(self.root/'source.tif') as source:
            horizontal=source.crs.to_wkt()
        compound='COMPD_CS["Survey horizontal and local depth",'+horizontal+',VERT_CS["Local tide",VERT_DATUM["Unresolved local datum",2005],UNIT["metre",1],AXIS["Depth",DOWN]]]'
        vrt=ET.Element('VRTDataset',rasterXSize='20',rasterYSize='20')
        ET.SubElement(vrt,'SRS').text=compound
        ET.SubElement(vrt,'GeoTransform').text=','.join(map(str,self.affine.to_gdal()))
        band=ET.SubElement(vrt,'VRTRasterBand',dataType='Float32',band='1')
        ET.SubElement(band,'NoDataValue').text='-9999'
        simple=ET.SubElement(band,'SimpleSource')
        ET.SubElement(simple,'SourceFilename',relativeToVRT='1').text='source.tif'
        ET.SubElement(simple,'SourceBand').text='1'
        path=self.root/'compound.vrt';path.write_bytes(ET.tostring(vrt))
        source={**self.source,'parts':[{'path':'compound.vrt','bytes':path.stat().st_size,'sha256':c.digest(path)}]}
        plan=c.make_plan(self.root,{'sources':[source]},self.coast)
        with rasterio.open(path) as original:
            source_wkt=original.crs.to_wkt()
            self.assertEqual(c.ProjectionCRS.from_wkt(source_wkt).axis_info[-1].direction,'down')
            stored=c.storage_crs(original.crs)
            self.assertFalse(c.ProjectionCRS.from_wkt(stored.to_wkt()).is_compound)
            self.assertEqual(c.storage_crs(stored),stored)
        legacy={k:v for k,v in plan.items() if k!='crs_storage_policy'}
        with patch.object(c,'guard'):
            with self.assertRaisesRegex(ValueError,'Compound source requires'):
                c.process(self.root,legacy)
            result=c.process(self.root,plan)
            self.assertEqual(c.verify(self.root,plan)['status'],'verified_rasters')
        with rasterio.open(self.root/result['outputs']['test-0-0']['path']) as output:
            self.assertEqual(output.crs,stored)
            self.assertEqual(output.transform,self.affine)
            self.assertEqual(output.tags()['SOURCE_CRS_WKT'],source_wkt)
            reconstructed=c.ProjectionCRS.from_wkt(output.tags()['SOURCE_CRS_WKT'])
            self.assertEqual(reconstructed.axis_info[-1].direction,'down')
            self.assertEqual(output.tags()['CRS_STORAGE_POLICY'],c.CRS_POLICY)
            np.testing.assert_array_equal(output.read(1)[1:],self.values[1:])

    def test_processing_lock_releases_and_does_not_block_acquisition(self):
        with c.lock(self.root),c.processing_lock(self.root,self.plan):
            with self.assertRaises(BlockingIOError):
                with c.processing_lock(self.root,self.plan):
                    self.fail('Concurrent writes to the same run must be rejected')
        with self.assertRaisesRegex(RuntimeError,'restore'):
            with c.processing_lock(self.root,self.plan):
                raise RuntimeError('restore')
        with c.processing_lock(self.root,self.plan):
            pass

    def test_old_projected_only_plan_cannot_resume_as_geodesic_run(self):
        old={k:v for k,v in self.plan.items() if k!='mask_method'}
        for operation in [c.process,c.verify]:
            with self.assertRaisesRegex(ValueError,'new named run'):
                operation(self.root,old)

    def test_geodesic_refinement_removes_projected_buffer_overshoot(self):
        # Reduced from a real Keppel shoreline corner: GEOS buffer
        # simplification retains this centre about 500.24 m from the line.
        line=LineString([(150.97842804,-23.48741408),(150.97814957,-23.48762815),
                         (150.97809744,-23.48768066),(150.97785152,-23.48791454),
                         (150.97782567,-23.48794801),(150.97755335,-23.48820914),
                         (150.97754758,-23.48821527),(150.97739567,-23.48848417)])
        features=[{'geometry':mapping(line)}]
        band=c.coastal_band(features)
        lon,lat=150.97416731349693,-23.484938948664052
        affine=from_origin(lon-.0000005,lat+.0000005,.000001,.000001)
        data=np.ma.array([[12.5]],mask=[[False]],dtype='float32')
        self.assertTrue(rasterio.features.geometry_mask([mapping(band)],out_shape=(1,1),transform=affine,invert=True)[0,0])
        self.assertGreater(c.shoreline_distances([lon],[lat],4326,features)[0],500.1)
        self.assertFalse(c.retained_cells(data,affine,4326,band,features)[0,0])
        near=from_origin(150.978-.0000005,-23.4877+.0000005,.000001,.000001)
        self.assertTrue(c.retained_cells(data,near,4326,band,features)[0,0])
        self.assertEqual(float(data[0,0]),12.5)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        path = self.root/'source.tif'
        self.affine = from_origin(500000, 7000000, 1, 1)
        self.values = np.arange(400, dtype='float32').reshape(20,20)
        self.values[0,0] = -9999
        with rasterio.open(path,'w',driver='GTiff',width=20,height=20,count=1,dtype='float32',crs=32756,transform=self.affine,nodata=-9999) as out:
            out.write(self.values,1)
        tr = Transformer.from_crs(32756,4326,always_xy=True)
        line = transform(tr.transform,LineString([(500000,7000000),(500000,6999980)]))
        coast = {'type':'FeatureCollection','properties':{'authoritative':True,'source_url':'https://example.org/coast','version':'final'},'features':[{'type':'Feature','geometry':mapping(line),'properties':{}}]}
        self.coast = self.root/'coast.json';c.acq.save(self.coast,coast)
        footprint = transform(tr.transform,box(500000,6999980,500020,7000000))
        self.source = {'id':'test','states':['QLD'],'survey_derived':True,'resolution_m':1,
                       'horizontal_crs_verified':True,'footprint':mapping(footprint),'licence':'CC BY 4.0',
                       'attribution':'Test publisher','vertical_datum':'unknown','units':'m','sign':'up',
                       'survey_date':'2020','output_bytes_estimate':50000,
                       'parts':[{'path':'source.tif','bytes':path.stat().st_size,'sha256':c.digest(path)}]}
        self.plan = c.make_plan(self.root,{'sources':[self.source]},self.coast)

    def test_review_rejects_excluded_and_modelled_sources(self):
        for changes in [{'states':['VIC']},{'states':['NORFOLK']},{'survey_derived':False},
                        {'resolution_m':30},{'id':'../escape'},{'horizontal_crs_verified':False}]:
            with self.assertRaises(ValueError): c.review_source({**self.source,**changes})

    def test_generalized_coastline_rejected(self):
        c.acq.save(self.coast,{'type':'FeatureCollection','features':[]})
        with self.assertRaises(ValueError): c.make_plan(self.root,{'sources':[self.source]},self.coast)

    def test_joined_parts_supports_cross_chunk_seek(self):
        a=self.root/'a';b=self.root/'b';a.write_bytes(b'abc');b.write_bytes(b'def')
        stream=c.JoinedParts([a,b]);self.assertEqual(stream.read(4),b'abcd')
        stream.seek(-3,2);self.assertEqual(stream.read(),b'def')
        stream.seek(1);self.assertEqual(stream.read(3),b'bcd')

    def test_source_values_grid_and_resume(self):
        with patch.object(c,'guard'):
            result=c.process(self.root,self.plan)
            self.assertEqual(result['outputs']['test-0-0']['valid_cells'],399)
            self.assertEqual(c.verify(self.root,self.plan)['status'],'verified_rasters')
            path=self.root/result['outputs']['test-0-0']['path']
            first=c.digest(path)
            c.process(self.root,self.plan)
            self.assertEqual(c.digest(path),first)
            with rasterio.open(path) as ds:
                self.assertEqual(ds.transform,self.affine)
                self.assertEqual(ds.res,(1,1))
                np.testing.assert_array_equal(ds.read(1)[1:],self.values[1:])

    def test_missing_output_is_not_verified(self):
        with patch.object(c,'guard'): c.process(self.root,self.plan)
        path=self.root/'datasets/ocean/coastal/non-vic-results.json'
        result=c.load(path);result['outputs']={};c.acq.save(path,result)
        with self.assertRaisesRegex(ValueError,'Missing planned'): c.verify(self.root,self.plan)

    def test_capacity_blocks_storage_and_budget(self):
        c.acq.save(self.root/'.cache/ocean-acquisition/ledger.json',{'charged_bytes':c.acq.LIMIT})
        plan={**self.plan,'sources':[{**self.source,'parts':[],'bytes':100}]}
        with patch('shutil.disk_usage',return_value=type('Usage',(),{'free':c.acq.RESERVE})()):
            forecast=c.capacity(self.root,plan)
            self.assertGreater(forecast['storage_shortfall_bytes'],0)
            self.assertEqual(forecast['budget_shortfall_bytes'],100)
            with self.assertRaisesRegex(ValueError,'Capacity gate'): c.acquire(self.root,plan)

    def test_corrupt_source_prevents_processing(self):
        (self.root/'source.tif').write_bytes(b'corrupt')
        with patch.object(c,'guard'),self.assertRaisesRegex(ValueError,'checksum'):
            c.process(self.root,self.plan)

    def test_remote_acquisition_is_allowlisted_and_idempotent(self):
        source={**self.source,'parts':[],'bytes':3,'url':'https://example.org/depth','etag':'pinned'}
        plan={**self.plan,'sources':[source]}
        c.acq.save(self.root/'.cache/ocean-acquisition/ledger.json',{'charged_bytes':0,'received_bytes':0})
        bulk=self.root/'.cache/ocean-acquisition/stop-request.json';c.acq.save(bulk,{'reason':'keep stopped'})
        response=io.BytesIO(b'abc');response.status=206
        response.headers={'Content-Range':'bytes 0-2/3','ETag':'pinned'}
        with patch.object(c,'capacity',return_value={'storage_shortfall_bytes':0,'budget_shortfall_bytes':0}), \
             patch.object(c,'guard'),patch.object(c.acq,'request',return_value=response) as request:
            c.acquire(self.root,plan);c.acquire(self.root,plan)
            self.assertEqual(request.call_count,1)
        self.assertEqual(c.load(self.root/'.cache/ocean-acquisition/ledger.json')['charged_bytes'],3)
        self.assertEqual(c.load(bulk),{'reason':'keep stopped'})

    def test_full_http_response_does_not_charge_or_download(self):
        source={**self.source,'parts':[],'bytes':3,'url':'https://example.org/depth','etag':'pinned'}
        c.acq.save(self.root/'.cache/ocean-acquisition/ledger.json',{'charged_bytes':0,'received_bytes':0})
        response=io.BytesIO(b'abc');response.status=200;response.headers={}
        with patch.object(c,'capacity',return_value={'storage_shortfall_bytes':0,'budget_shortfall_bytes':0}), \
             patch.object(c,'guard'),patch.object(c.acq,'request',return_value=response):
            with self.assertRaisesRegex(ValueError,'exact range'): c.acquire(self.root,{**self.plan,'sources':[source]})
        self.assertEqual(c.load(self.root/'.cache/ocean-acquisition/ledger.json')['charged_bytes'],0)

    def test_false_empty_window_fails_verification(self):
        with patch.object(c,'guard'): c.process(self.root,self.plan)
        path=self.root/'datasets/ocean/coastal/non-vic-results.json'
        result=c.load(path);result['outputs']['test-0-0']={'empty':True,'source':'test'};c.acq.save(path,result)
        with self.assertRaisesRegex(ValueError,'Incorrect empty'): c.verify(self.root,self.plan)

    def test_coarse_fallback_only_fills_fine_gaps(self):
        tr=Transformer.from_crs(32756,4326,always_xy=True)
        fine={**self.source,'footprint':mapping(transform(tr.transform,box(500000,6999980,500010,7000000)))}
        path=self.root/'coarse.tif'
        with rasterio.open(path,'w',driver='GTiff',width=10,height=10,count=1,dtype='float32',crs=32756,
                           transform=from_origin(500000,7000000,2,2),nodata=-9999) as out:
            out.write(np.full((10,10),9,dtype='float32'),1)
        coarse={**self.source,'id':'coarse','resolution_m':2,'parts':[{'path':'coarse.tif','bytes':path.stat().st_size,'sha256':c.digest(path)}]}
        plan=c.make_plan(self.root,{'sources':[coarse,fine]},self.coast)
        with patch.object(c,'guard'): result=c.process(self.root,plan)
        self.assertLess(result['outputs']['coarse-0-0']['valid_cells'],100)
        self.assertGreater(result['outputs']['coarse-0-0']['valid_cells'],0)
        self.assertEqual(c.verify(self.root,plan)['status'],'verified_rasters')

    def test_chunked_zip_raster_reads_native_window_without_inflation(self):
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w',compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('nested/depth.tif',(self.root/'source.tif').read_bytes())
        data=stream.getvalue();middle=len(data)//2
        parts=[]
        for index,chunk in enumerate((data[:middle],data[middle:])):
            path=self.root/f'part{index}.bin';path.write_bytes(chunk);parts.append(path)
        with c.zip_raster(parts,'nested/depth.tif') as ds:
            self.assertEqual(ds.crs.to_epsg(),32756)
            np.testing.assert_array_equal(ds.read(1,window=rasterio.windows.Window(2,2,3,3)),self.values[2:5,2:5])

    def test_archive_member_cannot_escape(self):
        with self.assertRaisesRegex(ValueError,'Unsafe archive'):
            with c.zip_raster([self.root/'source.tif'],'../depth.tif'): pass

    def test_independent_distance_check_rejects_outside_band(self):
        coast=c.load(self.coast)
        with self.assertRaisesRegex(ValueError,'geodesic'):
            c.check_distances([500501],[6999990],32756,coast['features'])
        self.assertLess(c.check_distances([500499],[6999990],32756,coast['features']),500)

    def test_gap_report_needs_complete_reference_and_inventory(self):
        coast=c.load(self.coast)
        coast['features'][0]['properties']['state']='QLD'
        c.acq.save(self.coast,coast)
        catalog={'sources':[self.source],'inventory_review':{'QLD':{'complete':True,'reviewed_at':'2026-11-08','publisher_catalogs':['https://example.org/catalog']}}}
        plan=c.make_plan(self.root,catalog,self.coast)
        with patch.object(c,'guard'): c.process(self.root,plan)
        report=c.load(self.root/'datasets/ocean/coastal/non-vic-coverage.json')
        summary=report['properties']['jurisdictions']['QLD']
        self.assertGreater(summary['gap_area_km2'],0)
        self.assertFalse(summary['complete'])
        self.assertFalse(report['properties']['archive_completion'])
        self.assertTrue(any(f['properties']['tier']=='gap' for f in report['features']))

    def test_discovery_deduplicates_urls_without_promoting_bbox_or_title(self):
        asset={'id':'source','url':'https://example.org/data.zip','filename':'depth.zip','state':'pending','bytes':100}
        c.acq.save(self.root/'datasets/ocean/acquisition-manifest.json',{'sources':[{'id':'one','assets':[asset]},{'id':'two','assets':[{**asset,'state':'acquired'}]}]})
        c.acq.save(self.root/'resources/atlas/snapshot.json',{'surveys':[{'download_url':asset['url'],'name':'Bathymetry 1m 2020','bounds':[150,-34,151,-33],'metadata_url':'https://example.org/metadata'}]})
        report=c.discover(self.root)
        self.assertEqual(report['unique_sources'],1)
        row=report['candidates'][0]
        self.assertEqual(row['collections'],['one','two'])
        self.assertEqual(row['declared_resolution_values_m'],[1.0])
        self.assertEqual(row['acquisition_state'],'acquired')
        self.assertFalse(row['bounds_are_valid_coverage'])
        self.assertFalse(row['resolution_header_verified'])

    def test_complete_requires_all_jurisdiction_reviews_and_packages(self):
        coast=c.load(self.coast)
        feature=coast['features'][0]
        coast['features']=[{**feature,'properties':{'state':state}} for state in c.STATES]
        coast['properties']['coverage_review']={state:{'complete':True,'reviewed_at':'2026-11-08','jurisdiction_reference':'https://example.org/state'} for state in c.STATES}
        c.acq.save(self.coast,coast)
        catalog={'sources':[self.source],'inventory_review':{state:{'complete':True,'reviewed_at':'2026-11-08','publisher_catalogs':['https://example.org/catalog']} for state in c.STATES}}
        plan=c.make_plan(self.root,catalog,self.coast)
        with patch.object(c,'guard'):c.process(self.root,plan)
        self.assertEqual(c.verify(self.root,plan)['status'],'complete')
        package=self.root/'datasets/processed/coastal/WA/catalog.json'
        wa=c.load(package)
        self.assertEqual(wa['rasters'],[])
        self.assertGreater(wa['summary']['gap_area_km2'],0)
        wa['summary']['gap_area_km2']=0;c.acq.save(package,wa)
        with self.assertRaisesRegex(ValueError,'Jurisdiction package'):c.verify(self.root,plan)

    def test_unplanned_output_is_not_verified(self):
        with patch.object(c,'guard'):c.process(self.root,self.plan)
        path=self.root/'datasets/ocean/coastal/non-vic-results.json'
        result=c.load(path);result['outputs']['fake']={'source':'unknown','empty':True};c.acq.save(path,result)
        with self.assertRaisesRegex(ValueError,'unplanned source'):c.verify(self.root,self.plan)

    def interrupted_download(self):
        source={**self.source,'parts':[],'bytes':6,'url':'https://example.org/depth','etag':'pinned'}
        plan={**self.plan,'sources':[source]}
        c.acq.save(self.root/'.cache/ocean-acquisition/ledger.json',{'charged_bytes':0,'received_bytes':0})
        first=io.BytesIO(b'abc');first.status=206;first.headers={'ETag':'pinned','Content-Range':'bytes 0-2/6'}
        second=io.BytesIO();second.status=206;second.headers={'ETag':'pinned','Content-Range':'bytes 3-5/6'}
        with patch.object(c,'capacity',return_value={'storage_shortfall_bytes':0,'budget_shortfall_bytes':0}), \
             patch.object(c,'guard'),patch.object(c.acq,'BLOCK',3),patch.object(c.acq,'request',side_effect=[first,second]), \
             patch.object(second,'read',side_effect=TimeoutError):
            with self.assertRaises(TimeoutError):c.acquire(self.root,plan)
        return plan,self.root/'datasets/raw/ocean/coastal-nonvic/test/original.partial'

    def test_resume_checks_prefix_and_only_discards_uncommitted_tail(self):
        plan,partial=self.interrupted_download()
        with partial.open('ab') as out:out.write(b'uncommitted')
        response=io.BytesIO(b'def');response.status=206;response.headers={'ETag':'pinned','Content-Range':'bytes 3-5/6'}
        with patch.object(c,'capacity',return_value={'storage_shortfall_bytes':0,'budget_shortfall_bytes':0}), \
             patch.object(c,'guard'),patch.object(c.acq,'BLOCK',3),patch.object(c.acq,'request',return_value=response) as request:
            c.acquire(self.root,plan)
            self.assertEqual(request.call_args.args[1]['Range'],'bytes=3-5')
        self.assertEqual(partial.with_suffix('.bin').read_bytes(),b'abcdef')
        self.assertEqual(c.acq.load(self.root/'.cache/ocean-acquisition/ledger.json')['charged_bytes'],9)

    def test_corrupt_resumable_prefix_stops_before_network(self):
        plan,partial=self.interrupted_download();partial.write_bytes(b'bad')
        with patch.object(c,'capacity',return_value={'storage_shortfall_bytes':0,'budget_shortfall_bytes':0}), \
             patch.object(c,'guard'),patch.object(c.acq,'request') as request:
            with self.assertRaisesRegex(ValueError,'prefix checksum'):c.acquire(self.root,plan)
            request.assert_not_called()

    def test_user_reserve_override_is_local_and_keeps_write_margin(self):
        original=c.acq.RESERVE
        token=c.RESERVE_OVERRIDE.set(0)
        try:
            self.assertEqual(c.reserve_bytes(),0)
            with patch('shutil.disk_usage',return_value=type('Usage',(),{'free':c.MARGIN-1})()):
                with self.assertRaises(InterruptedError):c.guard(self.root)
            with patch('shutil.disk_usage',return_value=type('Usage',(),{'free':c.MARGIN+1})()):
                c.guard(self.root)
            self.assertEqual(c.acq.RESERVE,original)
        finally:c.RESERVE_OVERRIDE.reset(token)
        self.assertEqual(c.reserve_bytes(),original)

    def test_named_runs_keep_outputs_and_verification_independent(self):
        first={**self.plan,'run_id':'first'};second={**self.plan,'run_id':'second'}
        with patch.object(c,'guard'):
            a=c.process(self.root,first);b=c.process(self.root,second)
        self.assertNotEqual(a['outputs']['test-0-0']['path'],b['outputs']['test-0-0']['path'])
        self.assertEqual(c.verify(self.root,first)['status'],'verified_rasters')
        self.assertEqual(c.verify(self.root,second)['status'],'verified_rasters')
        with self.assertRaises(ValueError):c.run_directory(self.root,{'run_id':'../escape'})


if __name__=='__main__': unittest.main()
