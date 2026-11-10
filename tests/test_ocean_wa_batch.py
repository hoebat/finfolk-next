import contextlib
import errno
import hashlib
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from scripts.ocean_wa_batch import candidates, spacing_allowed, reusable_fallback, run, c

URL='https://dotazprdauegisextpubst01.blob.core.windows.net/transport-wa-public/bathymetry/rasters/test.bag'


class BatchTests(unittest.TestCase):
    def test_bag_uncertainty_band_does_not_block_reuse_of_the_elevation_band(self):
        header={'source_crs_wkt':'checked source CRS','native_spacing_m':1.003,'dtype':'float32','scales':[1.0,1.0],'offsets':[0.0,0.0]}
        self.assertTrue(reusable_fallback(header))
        self.assertTrue(reusable_fallback({**header,'scales':[1.0,0.5]}))
        for change in [{'source_crs_wkt':None},{'scales':[0.5,1.0]},{'offsets':[1.0,0.0]},{'native_spacing_m':5.1}]:
            self.assertFalse(reusable_fallback({**header,**change}))

    def test_reuse_only_refuses_any_new_source_transfer(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folder=root/'datasets/ocean/coastal/nationwide';folder.mkdir(parents=True)
            (folder/'wa-fine-coastal-leads.geojson').write_text(json.dumps({'features':[self.feature()]}))
            (folder/'WA-shoreline-reviewed.geojson').write_text('{}');(folder.parent/'archive-index.json').write_text('{"runs":[]}')
            ident=hashlib.sha256(URL.encode()).hexdigest()[:24];header=folder/'header.json'
            header.write_text(json.dumps({'source_crs_wkt':'checked','native_spacing_m':1.003,'dtype':'float32','scales':[1.0,1.0],'offsets':[0.0,0.0]}))
            checkpoint={'inputs':{'leads_sha256':c.digest(folder/'wa-fine-coastal-leads.geojson'),'coast_sha256':c.digest(folder/'WA-shoreline-reviewed.geojson'),'pipeline':1},'assets':{ident:{'status':'native_review_required','header':str(header.relative_to(root))}}}
            (folder/'wa-batch-progress.json').write_text(json.dumps(checkpoint))
            with patch('scripts.ocean_wa_batch.c.lock',return_value=contextlib.nullcontext()),patch('scripts.ocean_wa_batch.a.request',return_value=contextlib.nullcontext(SimpleNamespace(headers={'Content-Length':'10','ETag':'fixed'}))),patch('scripts.ocean_wa_batch.c.capacity',return_value={'planned_transfer_bytes':10,'budget_shortfall_bytes':0,'storage_shortfall_bytes':0}),patch('scripts.ocean_wa_batch.c.acquire') as acquire:
                run(root,1,allow_fallback=True,reuse_only=True);acquire.assert_not_called()
            state=json.loads((folder/'wa-batch-progress.json').read_text())
            self.assertEqual(state['assets'][ident]['status'],'retained_original_review_required')
            self.assertEqual(state['assets'][ident]['reason'],'Reuse-only mode refuses new source bytes')

    def test_exact_spacing_never_rounds_coarser_grids_into_the_preferred_tier(self):
        self.assertTrue(spacing_allowed(1))
        for spacing in [1.00009,1.00629,2.00447,5]:
            self.assertFalse(spacing_allowed(spacing))
            self.assertTrue(spacing_allowed(spacing,allow_fallback=True))
        for spacing in [None,0,-1,5.00001,float('nan')]:
            self.assertFalse(spacing_allowed(spacing,allow_fallback=True))

    def test_full_disk_stops_without_reclassifying_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folder=root/'datasets/ocean/coastal/nationwide';folder.mkdir(parents=True)
            (folder/'wa-fine-coastal-leads.geojson').write_text(json.dumps({'features':[self.feature()]}))
            (folder/'WA-shoreline-reviewed.geojson').write_text('{}')
            (folder.parent/'archive-index.json').write_text('{"runs":[]}')
            token=c.RESERVE_OVERRIDE.set(0)
            try:
                with patch('scripts.ocean_wa_batch.c.lock',return_value=contextlib.nullcontext()),patch('scripts.ocean_wa_batch.a.request',return_value=contextlib.nullcontext(SimpleNamespace(headers={'Content-Length':'10','ETag':'fixed'}))),patch('scripts.ocean_wa_batch.c.capacity',return_value={'budget_shortfall_bytes':0,'storage_shortfall_bytes':0}),patch('scripts.ocean_wa_batch.c.acquire',side_effect=OSError(errno.ENOSPC,'full disk')):
                    run(root,1)
            finally:c.RESERVE_OVERRIDE.reset(token)
            state=json.loads((folder/'wa-batch-progress.json').read_text())
            self.assertEqual(state['assets'],{})
            self.assertIn('filesystem capacity exhausted',state['stop_reason'])

    def feature(self,**changes):
        return {'type':'Feature','geometry':None,'properties':{'DataRestri':'NO','GridSize_m':'1.0','Survey_download':URL,'StartDate':1,**changes}}

    def test_custodian_restrictions_native_spacing_and_duplicate_urls(self):
        result=candidates([self.feature(),self.feature(StartDate=2),self.feature(DataRestri='YES'),
            self.feature(GridSize_m='5'),self.feature(Survey_download='https://example.test/not-bag.tif')])
        self.assertEqual(len(result),1);self.assertEqual(result[0]['properties']['StartDate'],2)

    def test_budget_preflight_never_downloads_or_marks_source_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folder=root/'datasets/ocean/coastal/nationwide';folder.mkdir(parents=True)
            (folder/'wa-fine-coastal-leads.geojson').write_text(json.dumps({'features':[self.feature()]}))
            (folder/'WA-shoreline-reviewed.geojson').write_text('{}')
            (folder.parent/'archive-index.json').write_text('{"runs":[]}')
            forecast={'budget_shortfall_bytes':1,'storage_shortfall_bytes':0}
            (folder/'wa-batch-progress.json').write_text(json.dumps({'inputs':{
                'leads_sha256':c.digest(folder/'wa-fine-coastal-leads.geojson'),
                'coast_sha256':c.digest(folder/'WA-shoreline-reviewed.geojson'),'pipeline':1},
                'assets':{},'stop_reason':'Previous lock contention'}))
            token=c.RESERVE_OVERRIDE.set(0)
            try:
                with patch('scripts.ocean_wa_batch.c.lock',return_value=contextlib.nullcontext()),patch('scripts.ocean_wa_batch.a.request',return_value=contextlib.nullcontext(SimpleNamespace(headers={'Content-Length':'10','ETag':'fixed'}))),patch('scripts.ocean_wa_batch.c.capacity',return_value=forecast),patch('scripts.ocean_wa_batch.c.acquire') as acquire:
                    run(root,1);acquire.assert_not_called()
            finally:c.RESERVE_OVERRIDE.reset(token)
            state=json.loads((folder/'wa-batch-progress.json').read_text())
            self.assertEqual([r['status'] for r in state['assets'].values()],['budget_blocked'])
            self.assertNotIn('stop_reason',state)
            self.assertEqual(state['stop_history'][0]['reason'],'Previous lock contention')


if __name__=='__main__':unittest.main()
