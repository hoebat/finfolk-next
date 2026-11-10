import hashlib
import base64
import gzip
import json
from pathlib import Path
import tempfile
import unittest

from scripts.build_dataset_release import package, safe_path, encoded


class DatasetReleaseTest(unittest.TestCase):
    def add_file(self, site, name, body):
        path = site / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        manifest = json.loads((site / "data/downloads.json").read_text())
        manifest["files"][name] = {"hash": hashlib.sha256(body).hexdigest(), "bytes": len(body), "label": name}
        (site / "data/downloads.json").write_bytes(encoded(manifest))

    def fixture(self, root, rasters=None):
        site = root / "site"
        (site / "data/contours").mkdir(parents=True)
        (site / "data/explore-contours").mkdir()
        (site / "data/explore-contours/manifest.json").write_text('{"version":1,"sources":[]}')
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

    def test_vector_tiles_pack_and_reconstruct_without_changes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            site = self.fixture(root)
            tile = site / "data/explore-contours/pilot/10/12/14.pbf"
            tile.parent.mkdir(parents=True)
            tile.write_bytes(b"\x1a\x04\x12\x02\x00\x01")
            (site / "data/explore-contours/manifest.json").write_text(json.dumps({"version": 1, "sources": [
                {"tiles": ["/data/explore-contours/pilot/{z}/{x}/{y}.pbf"], "tile_count": 1}]}))
            release = package(site, root / "out")
            self.assertEqual(release["tileArchives"], {"pilot/10": "data/explore-contours/pilot/10.tiles.json"})
            meta = release["files"][release["tileArchives"]["pilot/10"]]
            archive = json.loads(gzip.decompress((root / "out" / release["id"] / "files" / meta["storage"]["path"]).read_bytes()))
            entry = archive["tiles"]["12/14"]
            self.assertEqual(base64.b64decode(entry["data"]), tile.read_bytes())
            self.assertEqual(entry["hash"], hashlib.sha256(tile.read_bytes()).hexdigest())
            self.assertEqual(package(site, root / "out"), release)

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

    def test_extension_retains_coastal_objects_and_adds_numeric_chunks(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            old_site = self.fixture(root / "old")
            self.add_file(old_site, "data/coastal/native.tif", b"retained native source bytes")
            tile = old_site / "data/explore-contours/retained/10/12/14.pbf"
            tile.parent.mkdir(parents=True)
            tile.write_bytes(b"retained vector bytes")
            (old_site / "data/explore-contours/manifest.json").write_bytes(encoded({"version": 1,
                "sources": [{"id": "retained", "tiles": ["/data/explore-contours/retained/{z}/{x}/{y}.pbf"], "tile_count": 1}]}))
            old = package(old_site, root / "old-release")
            baseline = root / "old-release" / old["id"]
            # Model the extra fields added by the coastal publication packager.
            old.update(coastalRelease="coastal-retained", nativeCoastalCogCount=709)
            (baseline / "manifest.json").write_bytes(encoded(old))
            chunks = {"0/0": "data/rasters/verified/0.f32.gz"}
            site = self.fixture(root / "new", [{"id": "verified", "datum_verified": True,
                "units": "m", "grid": {"chunks": chunks}}])
            numeric = gzip.compress(b"exact float32 chunk bytes", mtime=0)
            self.add_file(site, chunks["0/0"], numeric)
            result = package(site, root / "out", baseline)
            target = root / "out" / result["id"]
            self.assertEqual(result["coastalRelease"], "coastal-retained")
            self.assertEqual(result["nativeCoastalCogCount"], 709)
            self.assertEqual(result["tileArchives"], old["tileArchives"])
            self.assertIn("retained/10", result["tileArchives"])
            self.assertEqual(result["files"]["data/coastal/native.tif"], old["files"]["data/coastal/native.tif"])
            inherited = result["files"]["data/coastal/native.tif"]["storage"]
            pointer = (target / "files" / inherited["path"]).read_text()
            self.assertEqual(pointer, f"version https://git-lfs.github.com/spec/v1\noid sha256:{inherited['hash']}\nsize {inherited['bytes']}\n")
            self.assertEqual((target / "files" / chunks["0/0"]).read_bytes(), numeric)
            self.assertEqual(result["rasterCount"], 1)
            self.assertEqual(package(site, root / "out", baseline), result)
            downloads = json.loads(gzip.decompress((target / "files/data/downloads.json.gz").read_bytes()))
            for name, meta in downloads["files"].items():
                self.assertEqual((meta["hash"], meta["bytes"]), (result["files"][name]["hash"], result["files"][name]["bytes"]))
            # Corrupting an inherited object must fail before another publication.
            (baseline / "files" / inherited["path"]).write_bytes(b"corrupted")
            with self.assertRaisesRegex(ValueError, "Inherited release object is corrupt"):
                package(site, root / "failed", baseline)
            self.assertFalse((root / "failed").exists())

    def test_extension_rejects_changed_vector_sources(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            sites = [self.fixture(root / key) for key in ("old", "new")]
            for site, ident in zip(sites, ("retained", "changed")):
                (site / "data/explore-contours/manifest.json").write_bytes(encoded({"version": 1,
                    "sources": [{"id": ident, "tiles": ["/data/explore-contours/pilot/{z}/{x}/{y}.pbf"], "tile_count": 0}]}))
            old = package(sites[0], root / "old-release")
            with self.assertRaisesRegex(ValueError, "Existing Explore sources changed"):
                package(sites[1], root / "out", root / "old-release" / old["id"])

    def test_extension_rejects_removing_an_existing_numeric_raster(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            old_site = self.fixture(root / "old", [{"id": "original", "datum_verified": True,
                "units": "m", "grid": {"chunks": {}}}])
            old = package(old_site, root / "old-release")
            site = self.fixture(root / "new")
            with self.assertRaisesRegex(ValueError, "Existing numeric raster removed"):
                package(site, root / "out", root / "old-release" / old["id"])


if __name__ == "__main__":
    unittest.main()
