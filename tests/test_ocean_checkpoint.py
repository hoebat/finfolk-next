import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import ocean_acquisition as acq, ocean_checkpoint as cp


class CheckpointTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.cache = self.root / '.cache/ocean-acquisition'
        acq.save(self.root / 'datasets/ocean/acquisition-manifest.json', {'sources': [{'assets': [
            {'id': 'asset', 'etag': 'v1', 'bytes': 20}]}]})
        acq.save(self.cache / 'ledger.json', {'charged_bytes': 50, 'received_bytes': 8})
        acq.save(self.cache / 'partial/asset/resume.json', {'validator': 'v1'})
        (self.cache / 'partial/asset/000000.bin').write_bytes(b'12345678')
        p = patch.object(acq, 'other_runners', return_value=[])
        p.start()
        self.addCleanup(p.stop)
        reserve = patch.object(acq, 'RESERVE', 0)
        reserve.start()
        self.addCleanup(reserve.stop)

    def test_round_trip_preserves_budget_and_pause(self):
        cp.export(self.root)
        (self.cache / 'ledger.json').unlink()
        (self.cache / 'partial/asset/000000.bin').unlink()
        result = cp.restore(self.root)
        self.assertEqual(result['charged_bytes'], 50)
        self.assertTrue(result['paused'])
        self.assertEqual((self.cache / 'partial/asset/000000.bin').read_bytes(), b'12345678')
        self.assertTrue((self.cache / 'stop-request.json').exists())

    def test_corrupt_payload_does_not_overwrite_existing_state(self):
        cp.export(self.root)
        payload = self.root / 'datasets/raw/ocean/_checkpoint/asset/000000.bin'
        payload.write_bytes(b'corrupt!')
        with self.assertRaisesRegex(ValueError, 'corrupt'):
            cp.restore(self.root)
        self.assertEqual(acq.load(self.cache / 'ledger.json')['charged_bytes'], 50)
        self.assertEqual((self.cache / 'partial/asset/000000.bin').read_bytes(), b'12345678')

    def test_missing_ledger_cannot_restart_full_budget(self):
        cp.export(self.root)
        (self.cache / 'ledger.json').unlink()
        with self.assertRaisesRegex(RuntimeError, 'Restore the portable'):
            acq.acquire(self.root)

    def test_restore_never_lowers_a_newer_ledger(self):
        cp.export(self.root)
        acq.save(self.cache / 'ledger.json', {'charged_bytes': 75, 'received_bytes': 9})
        self.assertEqual(cp.restore(self.root)['charged_bytes'], 75)

    def test_existing_newer_partial_is_preserved(self):
        cp.export(self.root)
        (self.cache / 'partial/asset/000000.bin').write_bytes(b'newer-data')
        with self.assertRaisesRegex(ValueError, 'refusing to overwrite'):
            cp.restore(self.root)
