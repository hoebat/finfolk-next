import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.ocean_audit_storage import compact, digest


class AuditStorageTests(unittest.TestCase):
    @unittest.skipUnless(sys.platform=='darwin','macOS transparent compression')
    def test_exact_bytes_round_trip_and_idempotent_compaction(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'audit.json';body=b'{"retained":"original"}\n'*65536;path.write_bytes(body)
            before=digest(path);saved=compact(path,minimum_bytes=0)
            self.assertGreater(saved,0);self.assertEqual(path.read_bytes(),body)
            self.assertEqual(digest(path),before);self.assertEqual(compact(path,minimum_bytes=0),0)

    def test_mismatched_copy_never_replaces_original_and_cleans_temporary_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'audit.json';body=b'original'*8192;path.write_bytes(body)
            def wrong_copy(args,**options):Path(args[-1]).write_bytes(b'wrong')
            with patch('scripts.ocean_audit_storage.sys.platform','darwin'),patch('scripts.ocean_audit_storage.shutil.which',return_value='ditto'),patch('scripts.ocean_audit_storage.subprocess.run',side_effect=wrong_copy):
                with self.assertRaisesRegex(ValueError,'changed logical bytes'):compact(path,minimum_bytes=0)
            self.assertEqual(path.read_bytes(),body);self.assertEqual(list(Path(directory).iterdir()),[path])


if __name__=='__main__':unittest.main()
