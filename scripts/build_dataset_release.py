"""Package generated map data as an immutable, Git LFS backed runtime release.

Run build-static first. This copies its materialized products without changing
their numeric values, source metadata, or attribution. The input build and its
source inventory remain available for reconstruction.
"""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import tempfile


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode()


def safe_path(value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("Invalid release file path")
    path = Path(value)
    if path.is_absolute() or any(p in ("", ".", "..") for p in value.split("/")):
        raise ValueError("Invalid release file path")
    return path


def read_release_file(root, manifest, name):
    meta = manifest["files"][name]
    body = (root / "files" / safe_path(meta["storage"]["path"])).read_bytes()
    if len(body) != meta["storage"]["bytes"] or hashlib.sha256(body).hexdigest() != meta["storage"]["hash"]:
        raise ValueError("Materialize intact release metadata: " + name)
    decoded = gzip.decompress(body) if meta["storage"]["encoding"] == "gzip" else body
    if hashlib.sha256(decoded).hexdigest() != meta["hash"] or len(decoded) != meta["bytes"]:
        raise ValueError("Release metadata checksum mismatch: " + name)
    return decoded


def extend_release(baseline, candidate, destination):
    """Retain published coastal/vector assets while replacing generated map data."""
    baseline, candidate, destination = map(Path, (baseline, candidate, destination))
    old, new = [json.loads((p / "manifest.json").read_text()) for p in (baseline, candidate)]
    explore = "data/explore-contours/"
    previous = json.loads(read_release_file(baseline, old, explore + "manifest.json"))
    proposed = json.loads(read_release_file(candidate, new, explore + "manifest.json"))
    if previous["sources"][:len(proposed["sources"])] != proposed["sources"]:
        raise ValueError("Existing Explore sources changed; reconcile before extending")
    for name, meta in new["files"].items():
        if name.startswith(explore) and name != explore + "manifest.json":
            prior = old["files"].get(name, {})
            if (prior.get("hash"), prior.get("bytes")) != (meta["hash"], meta["bytes"]):
                raise ValueError("Existing vector archive changed: " + name)
    catalogs = [json.loads(read_release_file(p, m, "data/catalog.json")) for p, m in ((baseline, old), (candidate, new))]
    regions = [{r["id"]: r for r in c["regions"]} for c in catalogs]
    if regions[0].keys() != regions[1].keys():
        raise ValueError("Existing browsing regions changed")
    for key, region in regions[0].items():
        previous_ids = {r["id"] for r in region.get("rasters", [])}
        proposed_ids = {r["id"] for r in regions[1][key].get("rasters", [])}
        if not previous_ids <= proposed_ids:
            raise ValueError("Existing numeric raster removed: " + key)
    inherited = {name: meta for name, meta in old["files"].items()
                 if name.startswith(explore) or name not in new["files"]}
    files = {**inherited, **{name: meta for name, meta in new["files"].items() if not name.startswith(explore)}}
    downloads = json.loads(read_release_file(candidate, new, "data/downloads.json"))
    for name, meta in inherited.items():
        if name.startswith(explore):
            downloads["files"][name] = {k: meta[k] for k in ("hash", "bytes", "label")}
    downloads["revision"] = hashlib.sha256(encoded(downloads["files"])).hexdigest()
    for region in downloads["regions"].values():
        region["bytes"] = sum(downloads["files"][p]["bytes"] for p in region["files"])
    body = encoded(downloads)
    stored = gzip.compress(body, mtime=0)
    files["data/downloads.json"] = {"hash": hashlib.sha256(body).hexdigest(), "bytes": len(body),
        "label": "Download manifest", "storage": {"path": "data/downloads.json.gz", "encoding": "gzip",
        "hash": hashlib.sha256(stored).hexdigest(), "bytes": len(stored)}}
    manifest = {**old, **new, "files": files, "tileArchives": old["tileArchives"], "extends": old["id"]}
    del manifest["id"]
    manifest["id"] = hashlib.sha256(encoded(manifest)).hexdigest()
    target = destination / manifest["id"]
    # Each inherited object is already owned by the baseline release. Keep its
    # exact LFS identity rather than downloading/recompressing bulk coastal COGs.
    payloads = {}
    for name, meta in files.items():
        if name in inherited:
            payloads[name] = ("version https://git-lfs.github.com/spec/v1\n"
                              f"oid sha256:{meta['storage']['hash']}\nsize {meta['storage']['bytes']}\n").encode()
            source = baseline / "files" / safe_path(meta["storage"]["path"])
            with source.open("rb") as stream:
                prefix = stream.read(128)
                if prefix.startswith(b"version https://git-lfs.github.com/spec/v1"):
                    if prefix + stream.read() != payloads[name]:
                        raise ValueError("Inherited LFS identity differs: " + name)
                else:
                    digest = hashlib.sha256(prefix)
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        digest.update(chunk)
                    if source.stat().st_size != meta["storage"]["bytes"] or digest.hexdigest() != meta["storage"]["hash"]:
                        raise ValueError("Inherited release object is corrupt: " + name)
        elif name == "data/downloads.json":
            payloads[name] = stored
        else:
            payloads[name] = (candidate / "files" / safe_path(meta["storage"]["path"])).read_bytes()
    if target.exists():
        if (target / "manifest.json").read_bytes() != encoded(manifest):
            raise ValueError("Immutable extended release differs")
        for name, meta in files.items():
            actual = (target / "files" / safe_path(meta["storage"]["path"])).read_bytes()
            if actual != payloads[name] and hashlib.sha256(actual).hexdigest() != meta["storage"]["hash"]:
                raise ValueError("Existing extended release is corrupt: " + name)
        return manifest
    stage = destination / ("." + manifest["id"] + ".partial")
    stage.mkdir(parents=True, exist_ok=False)
    try:
        for name, meta in files.items():
            path = stage / "files" / safe_path(meta["storage"]["path"])
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payloads[name])
        (stage / "manifest.json").write_bytes(encoded(manifest))
        stage.rename(target)
    except BaseException:
        shutil.rmtree(stage)
        raise
    return manifest


def package(site, destination, baseline=None):
    if baseline is not None:
        with tempfile.TemporaryDirectory() as temp:
            candidate = package(site, temp)
            return extend_release(baseline, Path(temp) / candidate["id"], destination)
    site, destination = Path(site).resolve(), Path(destination).resolve()
    original = json.loads((site / "data/downloads.json").read_text())
    catalog = json.loads((site / "data/catalog.json").read_text())
    for region in catalog["regions"]:
        for raster in region.get("rasters", []):
            if raster.get("datum_verified") is not True or raster.get("units") != "m":
                raise ValueError("Numeric rasters require verified datum and metre units")
    files = {}
    generated = {}
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
    explore_path = "data/explore-contours/manifest.json"
    if not (site / explore_path).is_file():
        raise ValueError("Build Explore contour tiles before packaging the map release")
    explore = json.loads((site / explore_path).read_text())
    generated[explore_path] = (site / explore_path).read_bytes()
    archives = {}
    for source in explore["sources"]:
        template = source["tiles"][0]
        if not template.startswith("/data/explore-contours/") or not template.endswith("/{z}/{x}/{y}.pbf"):
            raise ValueError("Unexpected vector tile template")
        directory = safe_path(template.removesuffix("/{z}/{x}/{y}.pbf").lstrip("/"))
        groups = {}
        for path in sorted((site / directory).rglob("*.pbf")):
            z, x, y = path.relative_to(site / directory).parts
            if not z.isdigit() or not x.isdigit() or not y.removesuffix(".pbf").isdigit():
                raise ValueError("Unexpected vector tile path")
            body = path.read_bytes()
            groups.setdefault(z, {})[x + "/" + y.removesuffix(".pbf")] = {
                "data": base64.b64encode(body).decode(), "hash": hashlib.sha256(body).hexdigest(), "bytes": len(body)}
        if sum(len(g) for g in groups.values()) != source["tile_count"]:
            raise ValueError("Vector tile count differs from source manifest")
        for z, tiles in groups.items():
            name = (directory / (z + ".tiles.json")).as_posix()
            generated[name] = encoded({"version": 1, "tiles": tiles})
            archives[directory.name + "/" + z] = name
    for name, body in generated.items():
        files[name] = {"hash": hashlib.sha256(body).hexdigest(), "bytes": len(body), "label": "Explore contour tiles"}
    def read_body(name):
        return generated[name] if name in generated else (site / name).read_bytes()
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
        body = downloads if name == "data/downloads.json" else read_body(name)
        compressed = name.endswith((".json", ".geojson"))
        stored = gzip.compress(body, mtime=0) if compressed else body
        meta["storage"] = {"path": name + ".gz" if compressed else name,
                           "hash": hashlib.sha256(stored).hexdigest(), "bytes": len(stored),
                           "encoding": "gzip" if compressed else None}
    manifest = {"schemaVersion": 1, "files": files, "tileArchives": archives, "regions": len(catalog["regions"]),
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
            body = downloads if name == "data/downloads.json" else read_body(name)
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
    parser.add_argument("--baseline", type=Path, help="Retain published coastal and vector assets from this release directory")
    args = parser.parse_args()
    result = package(args.site, args.output, args.baseline)
    print(json.dumps({**{k: v for k, v in result.items() if k not in ("files", "tileArchives")}, "tileArchiveCount": len(result["tileArchives"])}))
