import contextlib
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from scripts.ocean_wa_batch import candidates, run, c

URL='https://dotazprdauegisextpubst01.blob.core.windows.net/transport-wa-public/bathymetry/rasters/test.bag'


class BatchTests(unittest.TestCase):
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
            token=c.RESERVE_OVERRIDE.set(0)
            try:
                with patch('scripts.ocean_wa_batch.c.lock',return_value=contextlib.nullcontext()),patch('scripts.ocean_wa_batch.a.request',return_value=contextlib.nullcontext(SimpleNamespace(headers={'Content-Length':'10','ETag':'fixed'}))),patch('scripts.ocean_wa_batch.c.capacity',return_value=forecast),patch('scripts.ocean_wa_batch.c.acquire') as acquire:
                    run(root,1);acquire.assert_not_called()
            finally:c.RESERVE_OVERRIDE.reset(token)
            state=json.loads((folder/'wa-batch-progress.json').read_text())
            self.assertEqual([r['status'] for r in state['assets'].values()],['budget_blocked'])


if __name__=='__main__':unittest.main()
