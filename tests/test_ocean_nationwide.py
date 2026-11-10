import json
from pathlib import Path
import tempfile
import unittest
import contextlib
import hashlib
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch

from scripts.ocean_nationwide import reconcile, references, boundaries


class NationwideTests(unittest.TestCase):
    def test_truncated_boundary_pages_are_split_and_exact_duplicates_audited(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folder=root/'datasets/ocean/coastal/nationwide';folder.mkdir(parents=True)
            (folder/'jurisdiction-service.json').write_text(json.dumps({'url':'https://example.test/FeatureServer'}))
            (folder/'jurisdiction-layer-11.json').write_text(json.dumps({'data':{'objectIdField':'objectid','copyrightText':'CC BY 4.0'}}))
            calls=[]
            def fetch(root,url,guard,**kwargs):
                query=parse_qs(urlsplit(url).query);ids=query.get('objectIds',[''])[0];calls.append(ids)
                feature=lambda i:{'type':'Feature','properties':{'objectid':i,'state_abbrev':'SA'},
                    'geometry':{'type':'Polygon','coordinates':[[[130,-33],[131,-33],[131,-32],[130,-33]]]}}
                value={'objectIds':[1,2]} if not ids else {'features':[feature(1),feature(1)] if ids=='1,2' else [feature(int(ids))]}
                body=json.dumps(value).encode();sha=hashlib.sha256(body).hexdigest();p=kwargs['archive_directory']/(sha+'.json');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(body)
                return value,sha
            with patch('scripts.ocean_nationwide.coastal.lock',return_value=contextlib.nullcontext()),patch('scripts.ocean_nationwide.fetch_json',side_effect=fetch):
                boundaries(root)
            result=json.loads((folder/'jurisdiction-boundaries-original.geojson').read_text())
            self.assertEqual([f['properties']['objectid'] for f in result['features']],[1,2])
            self.assertEqual(calls,['','1,2','1','2'])
            self.assertEqual(result['properties']['review_state'],'requires_jurisdiction_name_and_geometry_review')

    def test_reconcile_uses_registered_parts_without_promoting_science_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'part.bin').write_bytes(b'original')
            discovery={'candidates':[{'id':'one','acquisition_state':'deferred_disk'},
                                     {'id':'two','acquisition_state':'pending'}]}
            records=[{'acquisitions':[{'id':'one','state':'acquired','sha256':'a'*64,
                'parts':[{'path':'part.bin','bytes':8}]},
                {'id':'two','state':'acquired','sha256':'b'*64,
                 'parts':[{'path':'missing.bin','bytes':8}]}]}]
            result=reconcile(discovery,records,root)
            self.assertEqual(result['acquisition_counts'],{'acquired':1,'pending':1})
            self.assertEqual(result['candidates'][0]['acquisition_sha256'],'a'*64)
            self.assertEqual(result['candidates'][0]['review_state'],'needs_native_header_footprint_and_reference_review')
            self.assertFalse(result['inventory_review_complete'])
            self.assertEqual(discovery['candidates'][0]['acquisition_state'],'deferred_disk')

    def test_reference_resume_refuses_corruption_without_network_or_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folder=root/'datasets/ocean/coastal/nationwide';folder.mkdir(parents=True)
            target=folder/'SA-shoreline-original.geojson';target.write_text('changed')
            receipt=folder/'SA-reference.json';receipt.write_text(json.dumps({'status':'retrieved','sha256':'a'*64}))
            with patch('scripts.ocean_nationwide.shoreline') as fetch:
                with self.assertRaisesRegex(ValueError,'checksum changed'):references(root,['SA'])
                fetch.assert_not_called()
            self.assertEqual(target.read_text(),'changed')
            self.assertEqual(json.loads(receipt.read_text())['status'],'retrieved')


if __name__=='__main__':unittest.main()
