"""Metric coastline geometry and independent geodesic checks.

The buffer uses local projections in one-degree cells. Verification separately
measures point-to-shoreline distances on the WGS84 ellipsoid; it does not reuse
the rasterizer's buffer mask.
"""
import math

import numpy as np
import shapely
from shapely.geometry import box, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree
from pyproj import Geod, Transformer


def local_crs(lon, lat):
    return f'+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m'


def coastal_band(features, extent=None):
    lines = [shape(f['geometry']) for f in features]
    if extent is not None:
        lines = [line.intersection(extent) for line in lines if line.intersects(extent)]
    lines = [line for line in lines if not line.is_empty]
    if not lines:
        return unary_union([])
    coast = unary_union(lines)
    west, south, east, north = coast.bounds
    pieces = []
    for x in range(math.floor(west), math.floor(east) + 1):
        for y in range(math.floor(south), math.floor(north) + 1):
            segment = coast.intersection(box(x, y, x+1, y+1))
            if segment.is_empty:
                continue
            metric = local_crs(x+.5, y+.5)
            forward = Transformer.from_crs(4326, metric, always_xy=True)
            back = Transformer.from_crs(metric, 4326, always_xy=True)
            pieces.append(transform(back.transform,
                                    transform(forward.transform, segment).buffer(500, quad_segs=128)))
    return unary_union(pieces)


def shoreline_distances(x, y, crs, features):
    """Measure supplied pixel centres against the shoreline in bounded batches."""
    geographic = Transformer.from_crs(crs, 4326, always_xy=True)
    lon, lat = geographic.transform(np.asarray(x), np.asarray(y))
    lines = [shape(f['geometry']) for f in features]
    geod = Geod(ellps='WGS84')
    measured = np.empty(len(lon), dtype='float64')
    for start in range(0, len(lon), 4096):
        a, b = lon[start:start+4096], lat[start:start+4096]
        extent = box(float(a.min())-.05, float(b.min())-.05,
                     float(a.max())+.05, float(b.max())+.05)
        nearby = [line.intersection(extent) for line in lines if line.intersects(extent)]
        if not nearby:
            raise ValueError('No shoreline near retained pixels')
        metric = local_crs(float(a.mean()), float(b.mean()))
        forward = Transformer.from_crs(4326, metric, always_xy=True)
        back = Transformer.from_crs(metric, 4326, always_xy=True)
        geometries = np.array([transform(forward.transform, line) for line in nearby], dtype=object)
        tree = STRtree(geometries)
        mx, my = forward.transform(a, b)
        points = shapely.points(mx, my)
        nearest = geometries[tree.nearest(points)]
        ends = shapely.get_point(shapely.shortest_line(points, nearest), -1)
        nx, ny = back.transform(shapely.get_x(ends), shapely.get_y(ends))
        _, _, distances = geod.inv(a, b, nx, ny)
        if not np.isfinite(distances).all():
            raise ValueError('Nonfinite shoreline distance')
        measured[start:start+len(a)] = distances
    return measured


def check_distances(x, y, crs, features, tolerance_m=0.1):
    """Check every supplied pixel centre independently of the projected buffer."""
    distances = shoreline_distances(x, y, crs, features)
    if np.any(distances > 500 + tolerance_m):
        raise ValueError('Retained pixel exceeds 500 m geodesic coastal distance')
    return float(distances.max()) if len(distances) else 0.0
