from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.ocean_nationwide_index import build, a, c


class IndexTests(unittest.TestCase):
    def fixture(self,root,run_id,path,parts='original'):
        source={'id':'nsw-original','states':['NSW'],'parts':[{'identity':parts}]}
        plan={'run_id':run_id,'sources':[source]};signature=c.fingerprint(plan)
        a.save(root/path,plan);directory=c.run_directory(root,plan)
        a.save(directory/'non-vic-results.json',{'plan_sha256':signature,'state':'processed','outputs':{}})
        a.save(directory/'non-vic-verification.json',{'plan_sha256':signature,'status':'verified_rasters','maximum_geodesic_distance_m':0})
        gap={'type':'Feature','geometry':{'type':'Polygon','coordinates':[[[150,-35],[151,-35],[151,-34],[150,-35]]]},
             'properties':{'state':'NSW','tier':'gap'}}
        a.save(directory/'non-vic-coverage.json',{'properties':{'plan_sha256':signature},'features':[gap]})

    def test_verified_full_rescreen_preserves_history_and_rebuild_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);base=root/'datasets/ocean/coastal';old='datasets/ocean/coastal/old-plan.json'
            self.fixture(root,'nsw-bondi-5m-20261110',old)
            self.fixture(root,'nationwide-nsw-test','datasets/ocean/coastal/nationwide/nationwide-nsw-test-plan.json')
            a.save(base/'non-vic-archive-index.json',{'runs':[{'plan':old}]})
            def combine(root,*args):
                result={'states':{'NSW':{'verified_cogs':0},'VIC':{'verified_cogs':512}}}
                a.save(base/'archive-index.json',result);return result
            with patch('scripts.ocean_nationwide_index.combine',side_effect=combine) as refresh:
                first=build(root);second=build(root)
                self.assertEqual(first,second);self.assertEqual(refresh.call_count,1)
            index=a.load(base/'non-vic-archive-index.json')
            self.assertEqual([r['run_id'] for r in index['runs']],['nationwide-nsw-test'])
            self.assertEqual([r['run_id'] for r in index['historical_runs']],['nsw-bondi-5m-20261110'])
            self.assertFalse(index['archive_completion'])
            self.assertEqual(index['states']['NSW']['preferred_unique_area_km2'],0)
            self.assertEqual(a.load(base/'non-vic-archive-coverage.geojson')['features'],[])

    def test_rescreen_cannot_replace_a_different_original(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);base=root/'datasets/ocean/coastal';old='datasets/ocean/coastal/old-plan.json'
            self.fixture(root,'nsw-bondi-5m-20261110',old)
            self.fixture(root,'nationwide-nsw-test','datasets/ocean/coastal/nationwide/nationwide-nsw-test-plan.json',parts='different')
            a.save(base/'non-vic-archive-index.json',{'runs':[{'plan':old}]})
            before=(base/'non-vic-archive-index.json').read_bytes()
            with patch('scripts.ocean_nationwide_index.combine') as refresh:
                with self.assertRaisesRegex(ValueError,'original identity changed'):build(root)
                refresh.assert_not_called()
            self.assertEqual((base/'non-vic-archive-index.json').read_bytes(),before)


if __name__=='__main__':unittest.main()
