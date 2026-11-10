import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock,patch

from scripts import ocean_coastal_sources as s


class SourceTests(unittest.TestCase):
    def setUp(self):
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        self.root=Path(temp.name)
        self.ledger=self.root/'.cache/ocean-acquisition/ledger.json'
        s.acq.save(self.ledger,{'charged_bytes':0,'received_bytes':0})
        self.guard=Mock()
        self.feature={'type':'Feature','id':'shore.1','properties':{'year':2024,'certainty':'good'},
                      'geometry':{'type':'LineString','coordinates':[[150.5,-33.5],[150.6,-33.5]]}}

    def run_shoreline(self):
        return s.shoreline(self.root,'NSW',[150,-34,151,-33],'geom',self.guard,page_size=1)

    def test_complete_paging_retains_review_requirement_and_query_provenance(self):
        second={**self.feature,'id':'shore.2'}
        pages=[({'numberMatched':2,'features':[self.feature]},'a'),({'numberMatched':2,'features':[second]},'b')]
        with patch.object(s,'fetch_json',side_effect=pages) as fetch:
            result=self.run_shoreline()
        self.assertEqual(len(result['features']),2)
        self.assertIn('startIndex=1',fetch.call_args_list[1].args[1])
        self.assertEqual(result['features'][0]['properties']['state'],'NSW')
        self.assertFalse(result['properties']['coverage_review']['NSW']['complete'])
        self.assertEqual(result['properties']['pages'][1]['sha256'],'b')
        self.assertEqual(result['properties']['review_state'],'requires_certainty_and_jurisdiction_review')

    def test_duplicates_and_incomplete_or_changed_counts_fail(self):
        for second in [{'numberMatched':2,'features':[self.feature]},
                       {'numberMatched':2,'features':[]},
                       {'numberMatched':3,'features':[]}]:
            with patch.object(s,'fetch_json',side_effect=[({'numberMatched':2,'features':[self.feature]},'a'),(second,'b')]):
                with self.assertRaises(ValueError):self.run_shoreline()

    def test_wrong_year_crs_and_unknown_total_fail(self):
        for page in [{'numberMatched':'unknown','features':[]},
                     {'numberMatched':1,'features':[{**self.feature,'properties':{'year':2025}}]},
                     {'numberMatched':1,'features':[self.feature],'crs':{'properties':{'name':'EPSG:3577'}}}]:
            with patch.object(s,'fetch_json',return_value=(page,'hash')):
                with self.assertRaises(ValueError):self.run_shoreline()

    def test_fetch_charges_actual_body_bytes(self):
        body=json.dumps({'features':[]}).encode()
        with patch.object(s.acq,'request',return_value=io.BytesIO(body)),patch.object(s.acq,'BLOCK',8):
            value,sha=s.fetch_json(self.root,'https://example.org',self.guard)
        self.assertEqual(value,{'features':[]})
        ledger=s.acq.load(self.ledger)
        self.assertEqual(ledger['charged_bytes'],len(body))
        self.assertEqual(ledger['received_bytes'],len(body))
        self.assertEqual(len(sha),64)

    def test_failed_read_keeps_conservative_debit(self):
        response=io.BytesIO()
        with patch.object(response,'read',side_effect=TimeoutError),patch.object(s.acq,'request',return_value=response),patch.object(s.acq,'BLOCK',8):
            with self.assertRaises(TimeoutError):s.fetch_json(self.root,'https://example.org',self.guard)
        self.assertEqual(s.acq.load(self.ledger)['charged_bytes'],8)

    def test_stop_prevents_network_and_size_limit_is_charged(self):
        self.guard.side_effect=InterruptedError
        with patch.object(s.acq,'request') as request:
            with self.assertRaises(InterruptedError):s.fetch_json(self.root,'https://example.org',self.guard)
            request.assert_not_called()
        self.guard.side_effect=None
        with patch.object(s.acq,'request',return_value=io.BytesIO(b'12345')):
            with self.assertRaisesRegex(ValueError,'exceeds'):s.fetch_json(self.root,'https://example.org',self.guard,limit=4)
        self.assertEqual(s.acq.load(self.ledger)['charged_bytes'],5)

    def test_live_service_crs84_urn_is_accepted(self):
        page={'numberMatched':1,'features':[self.feature],'crs':{'properties':{'name':'urn:ogc:def:crs:CRS::84'}}}
        with patch.object(s,'fetch_json',return_value=(page,'hash')):
            result=self.run_shoreline()
        self.assertEqual(len(result['features']),1)

    def test_original_page_bytes_are_retained_with_matching_sha(self):
        body=b'{ "features": [] }\n'
        directory=self.root/'original-pages'
        with patch.object(s.acq,'request',return_value=io.BytesIO(body)):
            _,sha=s.fetch_json(self.root,'https://example.org',self.guard,archive_directory=directory)
        self.assertEqual((directory/(sha+'.json')).read_bytes(),body)

    def test_zero_length_publisher_feature_is_audited_without_breaking_paging(self):
        bad={**self.feature,'id':'shore.zero','geometry':{'type':'MultiLineString','coordinates':[[[148,-43],[148,-43]]]}}
        pages=[({'numberMatched':2,'features':[bad]},'bad'),({'numberMatched':2,'features':[self.feature]},'good')]
        with patch.object(s,'fetch_json',side_effect=pages) as fetch:
            result=self.run_shoreline()
        self.assertEqual(len(result['features']),1)
        self.assertEqual(result['properties']['publisher_feature_count'],2)
        self.assertEqual(result['properties']['excluded_invalid_features'][0]['id'],'shore.zero')
        self.assertIn('startIndex=1',fetch.call_args_list[1].args[1])


if __name__=='__main__':unittest.main()
