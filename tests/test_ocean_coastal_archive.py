import tempfile
import gzip
import json
import unittest
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.transform import from_origin
from shapely.geometry import Point, shape

from scripts import ocean_coastal_archive as archive
from scripts import ocean_acquisition as acquisition
from scripts.ocean_catalog import digest


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        temporary=tempfile.TemporaryDirectory();self.addCleanup(temporary.cleanup)
        self.root=Path(temporary.name);self.directory=self.root/'datasets/ocean/coastal'
        self.base={'schema_version':1,'archive_completion':False,'runs':[{'run_id':'existing-nsw'}],
                   'states':{'NSW':{'verified_cogs':2}},'coverage_policy':'Original non-VIC policy.'}
        acquisition.save(self.directory/'non-vic-archive-index.json',self.base)
        acquisition.save(self.directory/'non-vic-archive-coverage.geojson',{'type':'FeatureCollection','features':[],'properties':{'archive_completion':False}})
        self.path=self.root/'vic.tif';self.affine=from_origin(500000,5800000,2.5,2.5)
        with rasterio.open(self.path,'w',driver='COG',width=2,height=2,count=1,dtype='float32',crs=7855,transform=self.affine,nodata=-9999) as ds:
            ds.write(np.array([[1,-9999],[2,3]],dtype='float32'),1)
        self.manifest={'state':'complete','tile_count':2,'plan_sha256':'a'*64,'cellsize_m':2.5,'distance_m':500,
                       'verification_reference':'receipt.json','datum_verified':False,'licence':'CC BY 4.0',
                       'attribution':'State of Victoria','band_sides':'both',
                       'assets':{'tile':{'output':{'state':'acquired','path':'vic.tif','bytes':self.path.stat().st_size,
                                                'sha256':digest(self.path),'valid_cells':3,'horizontal_crs':'EPSG:7855'}},
                                 'gap':{'output':{'state':'empty'}}}}
        acquisition.save(self.directory/'vcdem-500m.json',self.manifest)
        self.receipt={'status':'verified','plan_sha256':'a'*64,'tiles_verified':2,'cog_count':1,'empty_tiles':1,
                      'mask_distance_samples':3,'scientific_datum_and_source_quality':'unverified'}
        acquisition.save(self.root/'receipt.json',self.receipt)

    def test_completed_vic_is_fallback_with_valid_mask_and_original_verification_scope(self):
        original=(self.directory/'non-vic-archive-index.json').read_bytes();source=digest(self.path)
        result=archive.combine(self.root)
        self.assertEqual(result['states']['NSW'],self.base['states']['NSW'])
        vic=result['states']['VIC']
        self.assertEqual(vic['verified_cogs'],1)
        self.assertEqual(vic['acquisition_status'],'complete')
        self.assertEqual(vic['preferred_unique_area_km2'],0)
        self.assertGreater(vic['fallback_unique_area_km2'],18e-6)
        self.assertLess(vic['fallback_unique_area_km2'],20e-6)
        self.assertEqual(result['runs'][-1]['verification_level'],'integrity_and_sampled_coastal_distance')
        self.assertEqual(result['runs'][-1]['coastal_distance_samples'],3)
        self.assertFalse(vic['datum_verified'])
        compressed=self.root/result['coverage']['path']
        self.assertEqual(digest(compressed),result['coverage']['sha256'])
        with gzip.open(compressed,'rt') as stream:coverage=json.load(stream)
        geom=shape(coverage['features'][-1]['geometry'])
        project=Transformer.from_crs(7855,4326,always_xy=True)
        self.assertFalse(geom.covers(Point(*project.transform(500003.75,5799998.75))))
        self.assertTrue(geom.covers(Point(*project.transform(500001.25,5799998.75))))
        repeated=archive.combine(self.root)
        self.assertEqual(repeated['states'],result['states'])
        self.assertEqual(repeated['coverage']['sha256'],result['coverage']['sha256'])
        self.assertEqual((self.directory/'non-vic-archive-index.json').read_bytes(),original)
        self.assertEqual(digest(self.path),source)

    def test_mismatched_receipt_or_changed_payload_is_not_added(self):
        acquisition.save(self.root/'receipt.json',{**self.receipt,'plan_sha256':'b'*64})
        with self.assertRaisesRegex(ValueError,'evidence disagree'):archive.combine(self.root)
        self.assertFalse((self.directory/'archive-index.json').exists())
        acquisition.save(self.root/'receipt.json',self.receipt);self.path.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'checksum or size changed'):archive.combine(self.root)
        self.assertFalse((self.directory/'archive-index.json').exists())
        self.assertEqual(self.path.read_bytes(),b'changed')


if __name__=='__main__':unittest.main()
