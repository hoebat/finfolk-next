"""Verify the bounded real-data review without requiring bulk raw downloads."""
import gzip
import hashlib
import json
from pathlib import Path
import unittest
import zlib

import numpy as np
import rasterio
from rasterio.mask import mask
from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform

from depth_explorer.store import Store

ROOT = Path(__file__).resolve().parents[1]
PROVENANCE = ROOT / "datasets/ocean/provenance"
REVIEW = json.loads((PROVENANCE / "vcdem-popes-eye-review.json").read_text())


class VcdemReviewTests(unittest.TestCase):
    def test_publisher_metadata_round_trips_with_exact_member_checksums(self):
        directory = PROVENANCE / "vcdem-package-review"
        receipt = json.loads((directory / "source.json").read_text())
        prefix = (directory / receipt["geodatabase"]["compressed_file"]).read_bytes()
        self.assertEqual(hashlib.sha256(prefix).hexdigest(), receipt["geodatabase"]["sha256"])
        members = receipt["members"] + receipt["geodatabase"]["members"]
        self.assertEqual(len(members), 48)
        for entry in members:
            member = entry["member"]
            if "compressed_file" in entry:
                packed = (directory / entry["compressed_file"]).read_bytes()
            else:
                start = entry["data_offset"]
                packed = prefix[start:start + member["compressed_bytes"]]
            with self.subTest(member=member["name"]):
                self.assertEqual(hashlib.sha256(packed).hexdigest(), entry["compressed_sha256"])
                raw = zlib.decompress(packed, -15) if member["compression"] == 8 else packed
                self.assertEqual(len(raw), member["uncompressed_bytes"])
                self.assertEqual(zlib.crc32(raw), member["crc32"])
                self.assertEqual(hashlib.sha256(raw).hexdigest(), entry["uncompressed_sha256"])

    def test_registered_grid_retains_exact_native_values_and_inset_mask(self):
        meta = REVIEW["registration"]
        source = ROOT / REVIEW["source_cog"]["path"]
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), REVIEW["source_cog"]["sha256"])
        projection = Transformer.from_crs(REVIEW["footprint_crs"], 7855, always_xy=True)
        geometry = transform(projection.transform, shape(REVIEW["footprint"]["geometry"])).buffer(-REVIEW["inset_m"])
        with rasterio.open(source) as original, rasterio.open(ROOT / "datasets" / meta["file"]) as registered:
            expected, affine = mask(original, [mapping(geometry)], crop=True, filled=False)
            actual = registered.read(1, masked=True)
            self.assertEqual(registered.transform, affine)
            self.assertEqual((registered.crs.to_epsg(), registered.res), (7855, (2.5, 2.5)))
            np.testing.assert_array_equal(actual.mask, expected[0].mask)
            np.testing.assert_array_equal(actual.compressed(), expected.compressed())
            self.assertEqual(actual.count(), 6665)
            # Applying the same canonical mask again changes neither cells nor grid.
            repeated, repeated_affine = mask(registered, [mapping(geometry)], crop=True, filled=False)
            self.assertEqual(repeated_affine, affine)
            np.testing.assert_array_equal(repeated[0].mask, actual.mask)
            np.testing.assert_array_equal(repeated.compressed(), actual.compressed())

    def test_runtime_chunks_negate_every_cell_and_preserve_missing_values(self):
        root = ROOT / "datasets/runtime/releases" / REVIEW["runtime_release"]
        catalog = json.loads(gzip.decompress((root / "files/data/catalog.json.gz").read_bytes()))
        region = next(r for r in catalog["regions"] if r["id"] == "port-phillip")
        meta = region["rasters"][0]
        self.assertEqual((meta["review_id"], meta["datum_verified"], meta["units"]), (REVIEW["id"], True, "m"))
        grid = meta["grid"]
        self.assertEqual(len(grid["chunks"]), 1)
        values = np.frombuffer(gzip.decompress((root / "files" / grid["chunks"]["0/0"]).read_bytes()), dtype="<f4").reshape(256, 256)
        with rasterio.open(ROOT / "datasets" / REVIEW["registration"]["file"]) as source:
            original = source.read(1, masked=True)
            actual = values[:grid["height"], :grid["width"]]
            np.testing.assert_array_equal(np.isfinite(actual), ~original.mask)
            np.testing.assert_array_equal(actual[np.isfinite(actual)], -original.compressed())
            self.assertEqual(np.isfinite(values).sum(), 6665)
        example = REVIEW["verification"]["example"]
        store = Store(ROOT / "datasets")
        point = store.sample("port-phillip", example["longitude"], example["latitude"])
        self.assertEqual((point["status"], point["depth_m"]), ("depth", 7.75))
        self.assertEqual(store.sample("port-phillip", 144.8, -38)["status"], "no-data")


if __name__ == "__main__":
    unittest.main()
