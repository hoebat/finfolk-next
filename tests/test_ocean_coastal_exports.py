import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock,patch

import numpy as np
import rasterio
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from scripts import ocean_coastal as c
from scripts import ocean_coastal_exports as e


class ExportTests(unittest.TestCase):
    def setUp(self):
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup);self.root=Path(temp.name)
        self.affine=from_origin(500000,7000000,1,1)
        self.values=np.arange(16,dtype='float32').reshape(4,4)
        with MemoryFile() as memory:
            with memory.open(driver='GTiff',width=4,height=4,count=1,dtype='float32',crs=32756,transform=self.affine,nodata=-9999) as ds:
                ds.write(self.values,1)
            self.body=memory.read()
        self.source={'id':'export','url':'https://example.org/coverage?bbox=reviewed','bytes':len(self.body),'etag':'pinned',
                     'retrieval':{'kind':'numeric_export','band_semantics':'elevation','publisher_evidence':'https://example.org/capabilities',
                                  'grid':{'width':4,'height':4,'crs':'EPSG:32756','dtype':'float32','transform':list(self.affine)[:6]}}}
        self.identity=c.source_identity(self.source)
        self.dest=self.root/'raw/original.bin'
        self.ledger=self.root/'.cache/ocean-acquisition/ledger.json'
        c.acq.save(self.ledger,{'charged_bytes':0,'received_bytes':0})
        self.guard=Mock()

    def response(self):
        response=io.BytesIO(self.body);response.status=200
        response.headers={'Content-Length':str(len(self.body)),'Content-Type':'image/tiff','ETag':'pinned'}
        return response

    def test_numeric_window_retains_exact_grid_values_and_accounts_bytes(self):
        with patch.object(e.acq,'request',return_value=self.response()) as request:
            e.acquire_export(self.root,self.source,self.dest,self.identity,self.guard)
            e.acquire_export(self.root,self.source,self.dest,self.identity,self.guard)
            self.assertEqual(request.call_count,1)
            self.assertNotIn('Range',request.call_args.args[1])
        self.assertEqual(self.dest.read_bytes(),self.body)
        self.assertEqual(c.acq.load(self.ledger)['charged_bytes'],len(self.body))
        with rasterio.open(self.dest) as ds:
            self.assertEqual(ds.transform,self.affine)
            np.testing.assert_array_equal(ds.read(1),self.values)

    def test_changed_length_is_rejected_before_body_read(self):
        response=self.response();response.headers['Content-Length']='100000000000'
        with patch.object(response,'read') as read,patch.object(e.acq,'request',return_value=response):
            with self.assertRaisesRegex(ValueError,'length'):e.acquire_export(self.root,self.source,self.dest,self.identity,self.guard)
            read.assert_not_called()
        self.assertEqual(c.acq.load(self.ledger)['charged_bytes'],0)
        self.assertFalse(self.dest.exists())

    def test_wrong_native_alignment_is_not_published(self):
        self.source['retrieval']['grid']['transform'][2]+=1
        with patch.object(e.acq,'request',return_value=self.response()):
            with self.assertRaisesRegex(ValueError,'alignment'):e.acquire_export(self.root,self.source,self.dest,self.identity,self.guard)
        self.assertFalse(self.dest.exists())
        self.assertEqual(c.acq.load(self.ledger)['charged_bytes'],len(self.body))

    def test_failure_keeps_conservative_network_debit(self):
        response=self.response()
        with patch.object(response,'read',side_effect=TimeoutError),patch.object(e.acq,'request',return_value=response),patch.object(e.acq,'BLOCK',8):
            with self.assertRaises(TimeoutError):e.acquire_export(self.root,self.source,self.dest,self.identity,self.guard)
        self.assertEqual(c.acq.load(self.ledger)['charged_bytes'],8)
        self.assertFalse(self.dest.exists())

    def test_document_response_is_not_numeric_data(self):
        response=self.response();response.headers['Content-Type']='text/html'
        with patch.object(e.acq,'request',return_value=response):
            with self.assertRaisesRegex(ValueError,'document'):e.acquire_export(self.root,self.source,self.dest,self.identity,self.guard)
        self.assertEqual(c.acq.load(self.ledger)['charged_bytes'],0)

    def test_budget_and_stop_prevent_request(self):
        c.acq.save(self.ledger,{'charged_bytes':c.acq.LIMIT,'received_bytes':0})
        with patch.object(e.acq,'request') as request:
            with self.assertRaises(InterruptedError):e.acquire_export(self.root,self.source,self.dest,self.identity,self.guard)
            request.assert_not_called()
        self.guard.side_effect=InterruptedError
        with patch.object(e.acq,'request') as request:
            with self.assertRaises(InterruptedError):e.acquire_export(self.root,self.source,self.dest,self.identity,self.guard)
            request.assert_not_called()


if __name__=='__main__':unittest.main()
