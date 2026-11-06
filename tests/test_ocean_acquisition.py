import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import ocean_acquisition as acq

class Response(io.BytesIO):
    status=200
    headers={'ETag':'"v1"','Content-Type':'application/octet-stream'}

class AcquisitionTests(unittest.TestCase):
    def setUp(self):
        self.t=tempfile.TemporaryDirectory();self.addCleanup(self.t.cleanup);self.root=Path(self.t.name)
        acq.save(self.root/'datasets/ocean/records/test.json',{'id':'test','review':{},'acquisitions':[]})
        self.asset={'id':'a','url':'https://example.org/a.tif','filename':'a.tif','bytes':20,'etag':'"v1"','state':'pending'}
        self.ledger={'charged_bytes':0,'received_bytes':0}
        for name,value in [('PART',16),('BLOCK',8),('RESERVE',0),('LIMIT',100)]:
            p=patch.object(acq,name,value);p.start();self.addCleanup(p.stop)

    def test_chunks_reconstruct_and_detect_corruption(self):
        with patch.object(acq,'request',return_value=Response(b'a'*20)):
            acq.acquire_one(self.root,{'id':'test'},self.asset,self.ledger)
        self.assertEqual(self.ledger['received_bytes'],20)
        self.assertEqual(self.asset['state'],'acquired')
        r=acq.load(self.root/'datasets/ocean/records/test.json')['acquisitions'][0]
        self.assertEqual([p['bytes'] for p in r['parts']],[16,4])
        output=acq.materialize(self.root,'a');self.assertEqual(Path(output['path']).read_bytes(),b'a'*20)
        (self.root/r['parts'][0]['path']).write_bytes(b'bad')
        with self.assertRaises(ValueError):acq.verify(self.root)

    def test_budget_stop_and_truncation(self):
        with patch.object(acq,'LIMIT',8),patch.object(acq,'request',return_value=Response(b'a'*20)):
            acq.acquire_one(self.root,{'id':'test'},self.asset,self.ledger)
        self.assertEqual(self.asset['state'],'deferred_budget');self.assertEqual(self.ledger['charged_bytes'],8)
        with patch.object(acq,'request',return_value=Response(b'a'*20)):
            with self.assertRaisesRegex(ValueError,'resume'):acq.acquire_one(self.root,{'id':'test'},self.asset,self.ledger)

    def test_html_and_source_change(self):
        response=Response(b'<html>');response.headers={'Content-Type':'text/html'}
        with patch.object(acq,'request',return_value=response):
            with self.assertRaisesRegex(ValueError,'HTML'):acq.acquire_one(self.root,{'id':'test'},self.asset,self.ledger)
        response=Response(b'a'*20);response.headers={'ETag':'"v2"'}
        with patch.object(acq,'request',return_value=response):
            with self.assertRaisesRegex(ValueError,'changed'):acq.acquire_one(self.root,{'id':'test'},self.asset,self.ledger)

    def test_oversized_partial_is_quarantined_before_restart(self):
        directory=self.root/'.cache/ocean-acquisition/partial/a';directory.mkdir(parents=True)
        (directory/'000000.bin').write_bytes(b'x'*21)
        acq.save(directory/'resume.json',{'validator':'"v1"'})
        with patch.object(acq,'request',return_value=Response(b'a'*20)) as request:
            acq.acquire_one(self.root,{'id':'test'},self.asset,self.ledger)
        self.assertEqual(self.asset['state'],'acquired')
        self.assertEqual(request.call_args.args[1],{})
        self.assertEqual(len(list((self.root/'.cache/ocean-acquisition/quarantine').glob('*'))),1)

    def test_valid_partial_resumes_at_exact_offset(self):
        directory=self.root/'.cache/ocean-acquisition/partial/a';directory.mkdir(parents=True)
        (directory/'000000.bin').write_bytes(b'a'*8)
        acq.save(directory/'resume.json',{'validator':'"v1"'})
        response=Response(b'a'*12);response.status=206
        response.headers={'ETag':'"v1"','Content-Range':'bytes 8-19/20'}
        with patch.object(acq,'request',return_value=response):acq.acquire_one(self.root,{'id':'test'},self.asset,self.ledger)
        self.assertEqual(self.ledger['received_bytes'],12)
        self.assertEqual(Path(acq.materialize(self.root,'a')['path']).read_bytes(),b'a'*20)

    def test_four_transfers_share_one_budget_without_oversized_parts(self):
        from concurrent.futures import ThreadPoolExecutor
        import time
        class SlowResponse(Response):
            def read(self,n):
                time.sleep(.002)
                return super().read(n)
        assets=[{**self.asset,'id':ident,'url':f'https://example.org/{ident}.tif'} for ident in 'abcd']
        with patch.object(acq,'LIMIT',30),patch.object(acq,'request',side_effect=lambda *a,**k:SlowResponse(b'a'*20)):
            with ThreadPoolExecutor(max_workers=4) as pool:
                futures=[pool.submit(acq.acquire_one,self.root,{'id':'test'},a,self.ledger) for a in assets]
                for f in futures:f.result()
        self.assertLessEqual(self.ledger['charged_bytes'],30)
        self.assertEqual(self.ledger['received_bytes'],30)
        for p in self.root.rglob('*.bin'):self.assertLessEqual(p.stat().st_size,16)

    def test_victoria_public_portal_resolves_native_package_without_archiving_key(self):
        acq.save(self.root/'datasets/ocean/records/test.json',{'id':'test','review':{'acquisition_status':'partial'}})
        record={'schema_version':1,'id':'vcdem-2021','title':'VCDEM','source_url':'https://example.org/vcdem','review':{'acquisition_status':'discovered'}}
        acq.save(self.root/'datasets/ocean/records/vcdem-2021.json',record)
        acq.save(self.root/'resources/atlas/snapshot.json',{'surveys':[]})
        def metadata(url):
            if 'datashare.maps.vic.gov.au/search' in url:
                return "var OPENDATASOFT_API_URL = 'https://example.org'; var OPENDATASOFT_API_KEY = 'public-test-key';"
            if '/api/records/' in url:
                return acq.json.dumps({'records':[{'fields':{'uuid':'8ea2cdd5-864d-4c66-8e03-55a9d31d8329','can_order_dataset':'ALL-USERS','download_url':'https://example.org/native.zip (38Gb)'}}]})
            return '<html>Creative Commons Attribution</html>'
        response=Response(b'');response.headers={'Content-Length':'20','ETag':'"v1"','Content-Type':'application/zip'}
        with patch.object(acq,'metadata',side_effect=metadata),patch.object(acq,'request',return_value=response):acq.discover(self.root)
        manifest=acq.load(self.root/'datasets/ocean/acquisition-manifest.json')
        source=next(s for s in manifest['sources'] if s['id']=='vcdem-2021')
        self.assertEqual(source['assets'][0]['url'],'https://example.org/native.zip')
        self.assertTrue(source['redistribution_reviewed'])
        self.assertNotIn('public-test-key',acq.json.dumps(manifest))

    def test_signed_get_url_can_be_probed_when_head_is_forbidden(self):
        from urllib.error import HTTPError
        response=Response(b'not-read');response.status=206
        response.headers={'Content-Range':'bytes 0-0/1234','Content-Type':'application/zip','ETag':'"object"'}
        with patch.object(acq,'request',side_effect=[HTTPError('https://example.org/download',403,'Forbidden',{},None),response]) as request:
            result=acq.probe('https://example.org/download')
        self.assertEqual(result['bytes'],1234)
        self.assertEqual(request.call_args.kwargs['headers'],{'Range':'bytes=0-0'})

    def test_get_probe_rejects_invalid_range(self):
        from urllib.error import HTTPError
        response=Response(b'');response.status=206;response.headers={'Content-Range':'bytes 10-20/1234'}
        with patch.object(acq,'request',side_effect=[HTTPError('https://example.org/download',405,'No HEAD',{},None),response]):
            with self.assertRaisesRegex(ValueError,'Content-Range'):acq.probe('https://example.org/download')

    def test_legacy_runner_detection_ignores_shell_driver_and_other_worktree(self):
        listing='777 python scripts/ocean_catalog.py acquire\n888 /bin/bash -lc python scripts/ocean_catalog.py acquire\n999 python /other/scripts/ocean_catalog.py acquire\n'
        def command(args,**kwargs):
            if args[0]=='ps':return listing
            return 'p777\nn'+str(self.root.resolve())+'\n' if '777' in args else 'p999\nn/other/worktree\n'
        with patch.object(acq.subprocess,'check_output',side_effect=command):
            self.assertEqual(acq.other_runners(self.root),[777])

    def test_maintenance_stop_preserves_budget_and_requeues_asset(self):
        acq.save(self.root/'.cache/ocean-acquisition/stop-request.json',{'reason':'test'})
        with patch.object(acq,'request',return_value=Response(b'a'*20)):
            acq.acquire_one(self.root,{'id':'test'},self.asset,self.ledger)
        self.assertEqual(self.asset['state'],'pending')
        self.assertEqual(self.ledger['charged_bytes'],0)
        self.assertEqual(list(self.root.rglob('*.bin')),[])

    def test_nsw_mirror_links_are_one_product_and_non_depth_formats_excluded(self):
        resource='2ef6c816-04b1-4aa7-9f06-e727b9c0cdd9'
        seed=f'https://datasets.seed.nsw.gov.au/dataset/a/resource/{resource}/download/data.zip'
        old=f'https://www.planningportal.nsw.gov.au/opendata/dataset/b/resource/{resource}/download/data.zip'
        self.assertEqual(acq.group_download_urls({old,seed}),[(seed,[old])])
        for suffix in ['.pdf','.ecw','.m4v','.mp4']:
            self.assertTrue(acq.excluded_depth_format('https://example.org/file'+suffix))
        self.assertFalse(acq.excluded_depth_format('https://example.org/file.bag'))
