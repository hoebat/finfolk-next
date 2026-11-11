import unittest

from pyproj import Transformer
from shapely.geometry import LineString, mapping
from shapely.ops import transform

from scripts.plan_vcdem_coastal_tiles import ARCHIVE_URL, select, tile_footprint


class CoastalTilePlanTests(unittest.TestCase):
    def setUp(self):
        self.member = {
            'name': 'VicCoastDEM2021_250cm/Tiled_NoBlend/Z55/VCDEM_GDA2020z55_250cm_Gaps_e2999_n5760.asc',
            'compressed_bytes': 10, 'uncompressed_bytes': 100,
            'local_header_offset': 1000, 'crc32': 123, 'compression': 8,
        }

    def coastline(self, gap):
        _, tile = tile_footprint(self.member)
        x = tile.bounds[2] + gap
        y = tile.centroid.y
        geographic = transform(Transformer.from_crs(7855, 4326, always_xy=True).transform,
                              LineString([(x, y - 100), (x, y + 100)]))
        return {'features': [{'properties': {'FEATURE_TYPE_CODE': 'coast'},
                              'geometry': mapping(geographic)}]}

    def plan(self, coast, members=None):
        return select({'url': ARCHIVE_URL, 'entries': members or [self.member]}, coast)

    def test_metric_distance_selects_near_tile_and_rejects_far_tile(self):
        self.assertEqual(self.plan(self.coastline(499))['tile_count'], 1)
        self.assertEqual(self.plan(self.coastline(501))['tile_count'], 0)

    def test_selects_only_one_product_variant(self):
        blend = {**self.member, 'name': self.member['name'].replace('Tiled_NoBlend', 'Tiled_Blend')}
        plan = self.plan(self.coastline(0), [self.member, blend])
        self.assertEqual(plan['tile_count'], 1)
        self.assertEqual(plan['compressed_member_bytes'], 10)

    def test_rejects_incomplete_coastline(self):
        coast = {**self.coastline(0), 'exceededTransferLimit': True}
        with self.assertRaises(ValueError):
            self.plan(coast)

    def test_native_header_footprint_uses_north_edge_and_fractional_origin(self):
        _, tile = tile_footprint(self.member)
        self.assertAlmostEqual(tile.bounds[0], 299999.6147534847)
        self.assertAlmostEqual(tile.bounds[1], 5755000.107296828)
        self.assertAlmostEqual(tile.bounds[3], 5760000.107296828)


if __name__ == '__main__':
    unittest.main()
