import io
import re
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import Mock,patch

from scripts import ocean_coastal as c
from scripts import ocean_coastal_members as m


class MemberTests(unittest.TestCase):
    def setUp(self):
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup);self.root=Path(temp.name)
        self.native=b'original numeric raster bytes\n'*100
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w',compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('native/depth.tif',self.native)
            info=archive.getinfo('native/depth.tif')
        self.archive=stream.getvalue()
        self.descriptor={'kind':'zip_member','name':info.filename,'local_header_offset':info.header_offset,
                         'compression':info.compress_type,'compressed_bytes':info.compress_size,
                         'uncompressed_bytes':info.file_size,'crc32':info.CRC}
        self.source={'id':'member','url':'https://example.org/big.zip','bytes':len(self.archive),'etag':'pinned','retrieval':self.descriptor}
        self.identity=c.source_identity(self.source)
        self.dest=self.root/'raw/original.bin'
        self.ledger=self.root/'.cache/ocean-acquisition/ledger.json'
        c.acq.save(self.ledger,{'charged_bytes':0,'received_bytes':0})
        self.guard=Mock();self.network_bytes=0

    def response(self,url,headers):
        match=re.fullmatch(r'bytes=(\d+)-(\d+)',headers['Range'])
        start,end=map(int,match.groups());self.network_bytes+=end-start+1
        result=io.BytesIO(self.archive[start:end+1]);result.status=206
        result.headers={'Content-Range':f'bytes {start}-{end}/{len(self.archive)}','ETag':'pinned'}
        return result

    def test_only_selected_compressed_member_is_retained_and_crc_verified(self):
        with patch.object(m.acq,'request',side_effect=self.response) as request:
            m.acquire_member(self.root,self.source,self.dest,self.identity,self.guard)
            first=request.call_count
            m.acquire_member(self.root,self.source,self.dest,self.identity,self.guard)
            self.assertEqual(request.call_count,first)
        self.assertEqual(m.inflate_member(self.dest,self.descriptor),self.native)
        self.assertEqual(self.dest.stat().st_size,self.descriptor['compressed_bytes'])
        self.assertEqual(c.acq.load(self.ledger)['charged_bytes'],self.network_bytes)
        self.assertLess(self.network_bytes,len(self.archive))
        self.assertTrue(c.acq.load(self.dest.with_suffix('.identity.json'))['crc_verified'])

    def test_bad_crc_and_uncompressed_size_fail(self):
        with patch.object(m.acq,'request',side_effect=self.response):
            m.acquire_member(self.root,self.source,self.dest,self.identity,self.guard)
        for changed in [{'crc32':0},{'uncompressed_bytes':len(self.native)-1}]:
            with self.assertRaises(ValueError):m.inflate_member(self.dest,{**self.descriptor,**changed})

    def test_whole_archive_response_is_rejected_without_charge(self):
        result=io.BytesIO(self.archive);result.status=200;result.headers={}
        with patch.object(m.acq,'request',return_value=result):
            with self.assertRaisesRegex(ValueError,'Exact ZIP range'):m.acquire_member(self.root,self.source,self.dest,self.identity,self.guard)
        self.assertEqual(c.acq.load(self.ledger)['charged_bytes'],0)
        self.assertFalse(self.dest.exists())

    def test_index_and_header_disagreement_stops_before_payload(self):
        changed={**self.source,'retrieval':{**self.descriptor,'name':'wrong.tif'}}
        with patch.object(m.acq,'request',side_effect=self.response):
            with self.assertRaisesRegex(ValueError,'name differs'):m.acquire_member(self.root,changed,self.dest,c.source_identity(changed),self.guard)
        self.assertFalse(self.dest.exists())

    def test_member_capacity_does_not_require_full_parent_archive(self):
        source={**self.source,'bytes':50_000_000_000,'output_bytes_estimate':1000,'scratch_bytes_estimate':1000}
        result=c.capacity(self.root,{'sources':[source]})
        self.assertEqual(result['planned_transfer_bytes'],self.descriptor['compressed_bytes']+m.HEADER_ALLOWANCE)

    def test_unsafe_and_oversized_members_are_rejected(self):
        for change in [{'name':'../escape.tif'},{'uncompressed_bytes':m.MAX_NATIVE+1},{'compression':99}]:
            with self.assertRaises(ValueError):m.validate_descriptor({**self.descriptor,**change})

    def test_remote_zip_index_preserves_member_provenance_without_qualifying_grid(self):
        with patch.object(m.acq,'request',side_effect=self.response):
            result=m.archive_index(self.root,self.source,self.guard)
        self.assertEqual(len(result['members']),1)
        member=result['members'][0]
        self.assertEqual(member['crc32'],self.descriptor['crc32'])
        self.assertEqual(member['local_header_offset'],self.descriptor['local_header_offset'])
        self.assertTrue(member['member_adapter_supported'])
        self.assertFalse(member['numeric_grid_verified'])
        self.assertEqual(result['archive']['etag'],'pinned')
        self.assertEqual(c.acq.load(self.ledger)['charged_bytes'],self.network_bytes)

    def test_index_storage_stop_prevents_network(self):
        self.guard.side_effect=InterruptedError
        with patch.object(m.acq,'request') as request:
            with self.assertRaises(InterruptedError):m.archive_index(self.root,self.source,self.guard)
            request.assert_not_called()


if __name__=='__main__':unittest.main()
