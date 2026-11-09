import hashlib
import gzip
import json
from pathlib import Path
import tempfile
import unittest

from scripts.build_dataset_release import package, safe_path


class DatasetReleaseTest(unittest.TestCase):
    def fixture(self, root, rasters=None):
        site = root / "site"
        (site / "data/contours").mkdir(parents=True)
        catalog = {"built_at": "2026-11-10T00:00:00Z", "regions": [{"id": "pilot", "rasters": rasters or [],
                   "contour_file": "data/contours/pilot.geojson", "contours": {"count": 1}, "tiles": {}}]}
        bodies = {"data/catalog.json": json.dumps(catalog).encode(),
                  "data/contours/pilot.geojson": b'{"type":"FeatureCollection","features":[]}',
                  "guides.json": b'{}', "neon-config.json": b'{"apiUrl":"app-only"}'}
        files = {}
        for name, body in bodies.items():
            (site / name).write_bytes(body)
            files[name] = {"hash": hashlib.sha256(body).hexdigest(), "bytes": len(body)}
        (site / "data/downloads.json").write_text(json.dumps({"version": 1, "revision": "source", "files": files,
           "regions": {"pilot": {"name": "Pilot", "files": list(files), "bytes": sum(m["bytes"] for m in files.values())}}}))
        return site

    def test_release_round_trip_idempotence_and_region_closure(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            site = self.fixture(root)
            release = package(site, root / "out")
            target = root / "out" / release["id"]
            self.assertEqual(package(site, root / "out"), release)
            self.assertNotIn("neon-config.json", release["files"])
            for name, meta in release["files"].items():
                stored = (target / "files" / meta["storage"]["path"]).read_bytes()
                self.assertEqual(hashlib.sha256(stored).hexdigest(), meta["storage"]["hash"])
                body = gzip.decompress(stored) if meta["storage"]["encoding"] else stored
                self.assertEqual(hashlib.sha256(body).hexdigest(), meta["hash"])
                self.assertEqual(len(body), meta["bytes"])
                if name != "data/downloads.json":
                    self.assertEqual(body, (site / name).read_bytes())
            downloads = json.loads(gzip.decompress((target / "files/data/downloads.json.gz").read_bytes()))
            self.assertNotIn("neon-config.json", downloads["regions"]["pilot"]["files"])
            self.assertEqual(downloads["regions"]["pilot"]["bytes"], sum(downloads["files"][p]["bytes"] for p in downloads["regions"]["pilot"]["files"]))

    def test_tampered_build_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            site = self.fixture(root)
            (site / "guides.json").write_bytes(b'tampered')
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                package(site, root / "out")
            self.assertFalse((root / "out").exists())

    def test_unverified_raster_cannot_be_published(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            site = self.fixture(root, [{"datum_verified": False, "units": "m"}])
            with self.assertRaisesRegex(ValueError, "verified datum"):
                package(site, root / "out")

    def test_path_escape_is_rejected(self):
        for value in ["../secret", "/secret", "data/../secret", "data\\secret", "data//secret"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                safe_path(value)


if __name__ == "__main__":
    unittest.main()
