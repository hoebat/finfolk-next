import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts.export_coastal_publication import export


class CoastalSourceReviewTests(unittest.TestCase):
    def test_unknown_native_units_publish_original_without_deriving_contours(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);native=root/'native.tif';native.write_bytes(b'unchanged native fixture')
            coverage=root/'coverage.gz';coverage.write_bytes(b'coverage evidence')
            checksum=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
            metadata={'id':'review','title':'Review pending','states':['JBT'],'resolution_m':2,
                      'datum':'Unverified','survey_date':'2008','licence':'CC BY 4.0','attribution':'GA',
                      'upstream_url':'https://example.test/original','contour_derivation_approved':False,
                      'contour_review_reason':'Vertical units are unstated'}
            index={'inputs':{},'states':{'JBT':{'verified_cogs':1}},'coverage':{'path':'coverage.gz','sha256':checksum(coverage)}}
            path=root/'datasets/ocean/coastal/archive-index.json';path.parent.mkdir(parents=True);path.write_text(json.dumps(index))
            sources={'review':{'metadata':metadata,'rasters':[{'path':'native.tif','sha256':checksum(native)}]}}
            with patch('scripts.export_coastal_publication.collect',return_value=(index,sources)):
                result=export(root,root/'publication/site','https://example.test/v1')
            source=result['sources'][0]
            self.assertEqual(source['contours'],[])
            self.assertEqual(source['rasters'][0]['sha256'],checksum(native))
            catalog=json.loads((root/'publication/site'/result['prefix']/'sources/coastal-review.json').read_text())
            self.assertEqual(catalog['contour_count'],0)
            self.assertFalse(catalog['contour_derivation_approved'])


if __name__=='__main__':unittest.main()
