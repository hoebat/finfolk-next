"""Package generated map data as an immutable, Git LFS backed runtime release.

Run build-static first. This copies its materialized products without changing
their numeric values, source metadata, or attribution. The input build and its
source inventory remain available for reconstruction.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode()


def safe_path(value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("Invalid release file path")
    path = Path(value)
    if path.is_absolute() or any(p in ("", ".", "..") for p in value.split("/")):
        raise ValueError("Invalid release file path")
    return path


def package(site, destination):
    site, destination = Path(site).resolve(), Path(destination).resolve()
    original = json.loads((site / "data/downloads.json").read_text())
    catalog = json.loads((site / "data/catalog.json").read_text())
    for region in catalog["regions"]:
        for raster in region.get("rasters", []):
            if raster.get("datum_verified") is not True or raster.get("units") != "m":
                raise ValueError("Numeric rasters require verified datum and metre units")
    files = {}
    for name, meta in sorted(original["files"].items()):
        safe_path(name)
        if not (name.startswith("data/") or name in ("beaches.json", "guides.json", "social.json")):
            continue
        body = (site / name).read_bytes()
        digest = hashlib.sha256(body).hexdigest()
        if body.startswith(b"version https://git-lfs.github.com/spec/v1"):
            raise ValueError("Unresolved Git LFS pointer: " + name)
        if digest != meta["hash"] or len(body) != meta["bytes"]:
            raise ValueError("Build checksum mismatch: " + name)
        files[name] = {"hash": digest, "bytes": len(body), "label": meta.get("label", name)}
    for region in catalog["regions"]:
        refs = [region.get("contour_file"), *region.get("tiles", {}).values()]
        for raster in region.get("rasters", []):
            refs.extend(raster["grid"]["chunks"].values())
        if any(name and name not in files for name in refs):
            raise ValueError("Catalog references a missing release file")
    packages = {}
    for key, region in original["regions"].items():
        paths = [p for p in region["files"] if p in files]
        packages[key] = {**region, "files": paths, "bytes": sum(files[p]["bytes"] for p in paths)}
    downloads = encoded({**original, "files": files, "regions": packages})
    files["data/downloads.json"] = {"hash": hashlib.sha256(downloads).hexdigest(), "bytes": len(downloads), "label": "Download manifest"}
    # HTTP gzip keeps large GeoJSON transfers small. The browser verifies the
    # original decoded bytes; pre-compressed numeric chunks retain their encoding.
    for name, meta in files.items():
        body = downloads if name == "data/downloads.json" else (site / name).read_bytes()
        compressed = name.endswith((".json", ".geojson"))
        stored = gzip.compress(body, mtime=0) if compressed else body
        meta["storage"] = {"path": name + ".gz" if compressed else name,
                           "hash": hashlib.sha256(stored).hexdigest(), "bytes": len(stored),
                           "encoding": "gzip" if compressed else None}
    manifest = {"schemaVersion": 1, "files": files, "regions": len(catalog["regions"]),
                "rasterCount": sum(len(r.get("rasters", [])) for r in catalog["regions"]),
                "contourRegions": sum(bool((r.get("contours") or {}).get("count")) for r in catalog["regions"]),
                "sourceBuiltAt": catalog["built_at"], "storage": "Git LFS"}
    release = hashlib.sha256(encoded(manifest)).hexdigest()
    manifest["id"] = release
    target = destination / release
    if target.exists():
        if (target / "manifest.json").read_bytes() != encoded(manifest):
            raise ValueError("Immutable release already exists with different metadata")
        for name, meta in files.items():
            if hashlib.sha256((target / "files" / meta["storage"]["path"]).read_bytes()).hexdigest() != meta["storage"]["hash"]:
                raise ValueError("Existing immutable release file is corrupt")
        return manifest
    stage = destination / ("." + release + ".partial")
    if stage.exists():
        raise ValueError("Incomplete release staging exists; inspect before retrying")
    stage.mkdir(parents=True)
    try:
        for name, meta in files.items():
            path = stage / "files" / meta["storage"]["path"]
            path.parent.mkdir(parents=True, exist_ok=True)
            body = downloads if name == "data/downloads.json" else (site / name).read_bytes()
            path.write_bytes(gzip.compress(body, mtime=0) if meta["storage"]["encoding"] else body)
        (stage / "manifest.json").write_bytes(encoded(manifest))
        stage.rename(target)
    except BaseException:
        shutil.rmtree(stage)
        raise
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("datasets/runtime/releases"))
    args = parser.parse_args()
    result = package(args.site, args.output)
    print(json.dumps({k: v for k, v in result.items() if k != "files"}))
