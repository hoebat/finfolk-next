"""Acquire a publisher's reviewed numeric geographic export as original bytes.

This route is only for an export whose numeric band, native grid, size and ETag
were established during review. Display services and guessed URLs do not qualify.
"""
import hashlib
import os

import numpy as np
import rasterio
from scripts import ocean_acquisition as acq
from scripts.ocean_catalog import digest


def check_grid(path, grid):
    with rasterio.open(path) as ds:
        if ds.driver!='GTiff' or ds.count!=1 or ds.dtypes[0] not in ('float32','float64'):
            raise ValueError('Export is not a single-band floating point numeric GeoTIFF')
        if (ds.width,ds.height)!=(grid['width'],grid['height']) or ds.dtypes[0]!=grid['dtype']:
            raise ValueError('Export dimensions or numeric type differ from reviewed window')
        if ds.crs!=rasterio.crs.CRS.from_user_input(grid['crs']):
            raise ValueError('Export CRS differs from reviewed window')
        if not np.allclose(list(ds.transform)[:6],grid['transform'],rtol=0,atol=1e-8):
            raise ValueError('Export alignment differs from reviewed native window')


def acquire_export(root,source,dest,identity,guard):
    descriptor=source['retrieval']
    receipt=dest.with_suffix('.identity.json')
    if receipt.exists() and acq.load(receipt).get('identity')!=identity:
        raise ValueError('Stored numeric export identity changed')
    if dest.exists():
        if not receipt.exists() or digest(dest)!=acq.load(receipt).get('completed_sha256'):
            raise ValueError('Completed export checksum mismatch')
        check_grid(dest,descriptor['grid'])
        return
    guard(root,source['bytes'])
    ledger_path=root/'.cache/ocean-acquisition/ledger.json'
    ledger=acq.load(ledger_path)
    if ledger['charged_bytes']+source['bytes']>acq.LIMIT:
        raise InterruptedError('Numeric export exceeds remaining transfer budget')
    dest.parent.mkdir(parents=True,exist_ok=True)
    partial=dest.with_suffix('.partial')
    acq.save(receipt,{'identity':identity})
    # A service that lacks range support must restart its unfinished export.
    # Earlier bytes stay charged; completed originals are never discarded.
    with acq.request(source['url'],{'If-Match':source['etag']}) as response:
        if response.status!=200 or response.headers.get('ETag')!=source['etag']:
            raise ValueError('Numeric export response identity changed')
        if response.headers.get('Content-Length')!=str(source['bytes']):
            raise ValueError('Numeric export length differs from reviewed window')
        if any(t in response.headers.get('Content-Type','').lower() for t in ('html','json','xml')):
            raise ValueError('Numeric export returned a document')
        remaining=source['bytes'];hasher=hashlib.sha256()
        with partial.open('wb') as out:
            while remaining:
                n=min(acq.BLOCK,remaining)
                guard(root,n)
                ledger['charged_bytes']+=n;acq.save(ledger_path,ledger)
                data=response.read(n)
                ledger['charged_bytes']-=n-len(data);ledger['received_bytes']+=len(data)
                acq.save(ledger_path,ledger)
                if not data: raise ValueError('Truncated numeric export')
                out.write(data);hasher.update(data);remaining-=len(data)
            out.flush();os.fsync(out.fileno())
    actual=hasher.hexdigest()
    if source.get('sha256') and actual!=source['sha256']: raise ValueError('Numeric export checksum failed')
    check_grid(partial,descriptor['grid'])
    acq.save(receipt,{'identity':identity,'completed_sha256':actual,'native_grid_verified':True})
    partial.replace(dest)
