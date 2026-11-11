import io
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor

import rasterio
from pyproj import Transformer
from shapely.geometry import LineString, Point, mapping
from shapely.ops import transform

from scripts import acquire_vcdem_coastal_tiles as coastal
from scripts.ocean_acquisition import save


class Response(io.BytesIO):
    status = 206
    headers = {'Content-Range': 'bytes 10-14/100', 'ETag': '"source"'}


class CoastalTransferTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.runner = object.__new__(coastal.Runner)
        self.runner.root = self.root
        self.runner.control = self.root / '.cache/ocean-coastal-tiles'
        self.runner.ledger_path = self.root / 'ledger.json'
        self.runner.ledger = {'charged_bytes': 20, 'received_bytes': 10}
        self.runner.identity = {'etag': '"source"', 'bytes': 100}
        self.runner.plan = {'source_url': 'https://example.org/archive.zip'}
        save(self.runner.ledger_path, self.runner.ledger)
        for name, value in [('BLOCK', 3), ('RESERVE', 0), ('LIMIT', 1000)]:
            mock = patch.object(coastal.acq, name, value)
            mock.start()
            self.addCleanup(mock.stop)

    def test_exact_range_charges_shared_ledger(self):
        with patch.object(coastal.acq, 'request', return_value=Response(b'abcde')):
            self.assertEqual(self.runner.read_range(10, 14), b'abcde')
        self.assertEqual(self.runner.ledger, {'charged_bytes': 25, 'received_bytes': 15})

    def test_full_download_response_is_rejected_without_body_read(self):
        response = Response(b'whole archive')
        response.status = 200
        with patch.object(coastal.acq, 'request', return_value=response):
            with self.assertRaisesRegex(ValueError, 'refusing full download'):
                self.runner.read_range(10, 14)
        self.assertEqual(self.runner.ledger['charged_bytes'], 20)

    def test_failed_read_keeps_conservative_budget_debit(self):
        response = Response()
        with patch.object(response, 'read', side_effect=TimeoutError), \
                patch.object(coastal.acq, 'request', return_value=response):
            with self.assertRaises(TimeoutError):
                self.runner.read_range(10, 14)
        self.assertEqual(self.runner.ledger['charged_bytes'], 23)
        self.assertEqual(self.runner.ledger['received_bytes'], 10)

    def test_member_crc_and_size_are_required(self):
        raw = b'numeric source grid'
        compressor = zlib.compressobj(wbits=-15)
        payload = compressor.compress(raw) + compressor.flush()
        member = {'uncompressed_bytes': len(raw), 'crc32': zlib.crc32(raw)}
        self.assertEqual(coastal.inflate(payload, member), raw)
        with self.assertRaises(ValueError):
            coastal.inflate(payload, {**member, 'crc32': 0})
        with self.assertRaises(ValueError):
            coastal.inflate(payload, {**member, 'uncompressed_bytes': len(raw) - 1})

    def test_concurrent_reads_preserve_all_ledger_charges(self):
        with patch.object(coastal.acq, 'request', side_effect=lambda *args: Response(b'abcde')):
            with ThreadPoolExecutor(max_workers=4) as pool:
                self.assertEqual(list(pool.map(lambda _: self.runner.read_range(10, 14), range(16))),
                                 [b'abcde'] * 16)
        self.assertEqual(self.runner.ledger, {'charged_bytes': 100, 'received_bytes': 90})

    def test_cog_values_stay_inside_metric_coastal_band(self):
        line = LineString([(300000, 5755000), (300050, 5755050)])
        geographic = transform(Transformer.from_crs(7855, 4326, always_xy=True).transform, line)
        coast = {'features': [{'geometry': mapping(geographic)}]}
        plan = {'source_url': coastal.ARCHIVE_URL, 'source_identity': self.runner.identity,
                'inputs': {'coastline': {'sha256': 'a' * 64}}, 'distance_from_coast_m': 10,
                'tile_count': 1}
        save(self.root / '.cache/ocean-acquisition/ledger.json', self.runner.ledger)
        runner = coastal.Runner(self.root, plan, coast)
        raw = ('ncols 20\nnrows 20\nxllcorner 300000\nyllcorner 5755000\n'
               'cellsize 2.5\nnodata_value -9999\n' + ('-1 ' * 20 + '\n') * 20).encode()
        member = {'horizontal_crs': 'EPSG:7855', 'name': 'synthetic.asc',
                  'nominal_bounds': [300000, 5755000, 300050, 5755050]}
        with patch.object(runner, 'check'):
            output = runner.crop('synthetic', raw, member)
        with rasterio.open(self.root / output['path']) as source:
            values = source.read(1)
            rows, cols = (values != source.nodata).nonzero()
            self.assertGreater(len(rows), 0)
            self.assertLess(len(rows), values.size)
            for row, col in zip(rows, cols):
                self.assertLessEqual(line.distance(Point(*source.xy(int(row), int(col)))), 10.0001)
            self.assertEqual(source.res, (2.5, 2.5))
            self.assertEqual(source.tags()['VERTICAL_DATUM'], 'unverified')

    def test_transient_retry_resumes_but_integrity_errors_stop(self):
        member = {'name': 'tile.asc'}
        with patch.object(self.runner, 'acquire', side_effect=[coastal.URLError('reset'), ('id', b'data', {})]) as acquire, \
                patch.object(self.runner, 'crop', return_value={'state': 'empty'}), \
                patch.object(self.runner, 'check'), patch.object(coastal.time, 'sleep'):
            self.assertEqual(self.runner.process(member), ('id', {'output': {'state': 'empty'}}))
            self.assertEqual(acquire.call_count, 2)
        with patch.object(self.runner, 'acquire', side_effect=ValueError('CRC mismatch')) as acquire:
            with self.assertRaisesRegex(ValueError, 'CRC mismatch'):
                self.runner.process(member)
            self.assertEqual(acquire.call_count, 1)


if __name__ == '__main__':
    unittest.main()
