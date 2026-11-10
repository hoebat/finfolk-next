import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock

import numpy as np
from rasterio.io import MemoryFile
from rasterio.transform import from_origin

from scripts import ocean_acquisition as a
from scripts.ocean_ga_batch import select, eligible_header, run


class GABatchTests(unittest.TestCase):
    url='https://files.ausseabed.gov.au/survey/fixture.zip'
    def feature(self,**extra):
        return {'properties':{'DATA_URL':self.url,'NAME':'Sydney Harbour Bathymetry 2m',
                'EMBARGO':'No','PRODUCT_STATUS':'PUBLISHED','LEGAL_CONSTRAINTS':'Creative Commons - Attribution 4.0 International',
                'candidate_states':['NSW'],**extra}}

    def test_selection_requires_official_public_bathymetric_scope(self):
        self.assertEqual(select([self.feature()],self.url)[1],['NSW'])
        for extra in [{'EMBARGO':'Yes'},{'PRODUCT_STATUS':'PROCESSED'},
                      {'NAME':'Elizabeth and Middleton Reef Bathymetry 5m'},
                      {'NAME':'Bathymetry backscatter'},{'candidate_states':['VIC']},
                      {'LEGAL_CONSTRAINTS':'Restricted'}]:
            with self.assertRaises(ValueError):select([self.feature(**extra)],self.url)

    def test_header_requires_native_height_not_uncertainty_or_unspecified_role(self):
        with MemoryFile() as memory:
            with memory.open(driver='GTiff',width=2,height=2,count=1,dtype='float32',crs=32756,
                             transform=from_origin(330000,6250000,2,2)) as ds:
                ds.write(np.ones((2,2),dtype='float32'),1)
                self.assertFalse(eligible_header(ds,'bathymetry.tif'))
                ds.update_tags(1,Band_Direction='Height')
                self.assertTrue(eligible_header(ds,'bathymetry.tif'))
                self.assertFalse(eligible_header(ds,'uncertainty.tif'))

    def test_budget_preflight_prevents_download_and_does_not_register_an_original(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'.cache/ocean-acquisition').mkdir(parents=True)
            a.save(root/'datasets/ocean/coastal/nationwide/ga-fine-coastal-leads.geojson',{'features':[self.feature()]})
            response=Mock();response.headers={'Content-Length':'100','ETag':'"pinned"'}
            response.__enter__=Mock(return_value=response);response.__exit__=Mock(return_value=False)
            with patch('scripts.ocean_ga_batch.a.request',return_value=response),patch('scripts.ocean_ga_batch.c.capacity',return_value={'budget_shortfall_bytes':1,'storage_shortfall_bytes':0}),patch('scripts.ocean_ga_batch.c.acquire') as acquire:
                with self.assertRaisesRegex(InterruptedError,'remaining budget'):run(root,self.url)
                acquire.assert_not_called()
            self.assertFalse((root/'datasets/ocean/records/ausseabed-local-surveys.json').exists())


if __name__=='__main__':unittest.main()
