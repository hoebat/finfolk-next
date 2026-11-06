import json
import tempfile
import unittest
from pathlib import Path
from scripts.ocean_catalog import sync, validate, load, save, report, POINTER


class OceanCatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.raw = self.root/'datasets/raw/test/contours-one/original.geojson'
        self.processed = self.root/'datasets/processed/test/contours-one.geojson'
        data = {'type':'FeatureCollection','features':[{'type':'Feature','properties':{'depth_m':5},'geometry':{'type':'LineString','coordinates':[[145,-38],[145.01,-38]]}}]}
        save(self.raw, data); save(self.processed, data)
        save(self.root/'datasets/inventory.json', {'contours':{'test':{'file':'processed/test/contours-one.geojson','source_url':'https://example.org/survey','attribution':'Publisher','licence':'CC BY','datum':'unknown'}},'rasters':[]})
        save(self.root/'config/areas.json', {'areas':[{'id':'test'}]})
        save(self.root/'datasets/ocean/coverage-targets.json', {'regions':[{'id':'test','candidate_datasets':['test'],'priority':'high','blocker':'Missing raster','next_action':'Acquire raster'}]})
        sync(self.root)

    def test_sync_is_idempotent_and_preserves_reviews(self):
        p = self.root/'datasets/ocean/records/test.json'
        r = load(p); r['review']['next_action']='Contact custodian';save(p,r)
        before=p.read_bytes();sync(self.root);self.assertEqual(before,p.read_bytes())
        self.assertEqual(validate(self.root)['errors'],[])

    def test_corruption_missing_pointer_and_metadata_mode(self):
        self.processed.write_text('changed')
        self.assertIn('Corrupt asset', ' '.join(validate(self.root)['errors']))
        self.processed.write_bytes(POINTER+b'\noid sha256:fake\n')
        result=validate(self.root);self.assertEqual(len(result['unmaterialized_lfs']),1)
        self.assertEqual(validate(self.root,True)['errors'],[])
        self.processed.unlink();self.assertIn('Missing asset',' '.join(validate(self.root)['errors']))

    def test_paths_references_and_duplicate_identity(self):
        p=self.root/'datasets/ocean/records/test.json';r=load(p)
        r['observed']['assets'][0]['path']='../secret';save(p,r)
        self.assertIn('Unsafe asset',' '.join(validate(self.root,True)['errors']))
        save(p.with_name('duplicate.json'),r)
        self.assertIn('Duplicate dataset identity',validate(self.root,True)['errors'])
        save(self.root/'datasets/ocean/coverage-targets.json',{'regions':[{'id':'test','candidate_datasets':['absent']}]})
        self.assertIn('broken region/dataset reference',' '.join(validate(self.root,True)['errors']))

    def test_inventory_drift_and_report_gap(self):
        p=self.root/'datasets/inventory.json';r=load(p);r['updated_at']='new';save(p,r)
        self.assertIn('inventory drift',' '.join(validate(self.root,True)['errors']))
        sites=self.root/'sites.json';save(sites,{'beaches':[{'id':'beach','area_id':'test','point':[145,-38]}]})
        output=self.root/'report';report(self.root,sites,output);r=load(output/'report.json')
        self.assertEqual(r['regions'][0]['sites_with_numeric_cell'],0)
        self.assertEqual(r['sites'][0]['rasters'],[])
        self.assertTrue((output/'report.html').is_file())

    def test_native_raster_nodata_and_dryland_are_distinct(self):
        path=self.root/'datasets/processed/grid.asc'
        path.write_text('ncols 3\nnrows 1\nxllcorner 145\nyllcorner -38\ncellsize 0.01\nNODATA_value -9999\n5 -9999 -3\n')
        record=load(self.root/'datasets/ocean/records/test.json')
        record['observed']['packages'].append({'kind':'numeric_raster','region':'test','metadata':{'file':'processed/grid.asc','value_kind':'depth'}})
        save(self.root/'datasets/ocean/records/test.json',record)
        sites=self.root/'sites.json'
        save(sites,{'beaches':[{'id':str(i),'area_id':'test','point':[145.005+i*.01,-37.995]} for i in range(3)]})
        output=self.root/'report';report(self.root,sites,output)
        r=load(output/'report.json')
        self.assertEqual([s['rasters'][0]['status'] for s in r['sites']],['valid_cell','no_data','above_datum'])
        self.assertEqual(r['regions'][0]['sites_with_numeric_cell'],1)
