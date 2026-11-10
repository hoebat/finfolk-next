"""Exact selected ZIP-member retrieval; retains publisher compressed bytes."""
import hashlib
import io
import os
import struct
import zlib
import zipfile
from pathlib import PurePosixPath
from scripts import ocean_acquisition as acq
from scripts.ocean_catalog import digest

HEADER_ALLOWANCE=131100
MAX_NATIVE=512*1024**2


class RemoteZipIndex(io.RawIOBase):
    """Seekable metadata reader; ZIP64 parsing is delegated to Python zipfile."""
    def __init__(self,root,source,guard):
        self.root,self.source,self.guard,self.pos=root,source,guard,0
    def readable(self):return True
    def seekable(self):return True
    def tell(self):return self.pos
    def seek(self,offset,whence=0):
        if whence not in (0,1,2):raise ValueError('Invalid seek origin')
        value=offset if whence==0 else self.pos+offset if whence==1 else self.source['bytes']+offset
        if value<0:raise ValueError('Negative ZIP index seek')
        self.pos=value;return value
    def read(self,size=-1):
        size=max(0,self.source['bytes']-self.pos) if size<0 else min(size,max(0,self.source['bytes']-self.pos))
        if size>64*1024**2:raise ValueError('ZIP directory exceeds metadata limit')
        parts=[]
        while size:
            n=min(size,acq.BLOCK)
            data=read_range(self.root,self.source,self.pos,self.pos+n-1,self.guard)
            parts.append(data);self.pos+=n;size-=n
        return b''.join(parts)


def archive_index(root,source,guard):
    entries=[];names=set()
    guard(root)
    with RemoteZipIndex(root,source,guard) as reader:
        with zipfile.ZipFile(reader) as archive:
            for info in archive.infolist():
                if info.is_dir():continue
                if info.filename in names:raise ValueError('Duplicate ZIP member name')
                names.add(info.filename)
                path=PurePosixPath(info.filename)
                if path.is_absolute() or '..' in path.parts or '\\' in info.filename:raise ValueError('Unsafe ZIP index member')
                descriptor={'kind':'zip_member','name':info.filename,'local_header_offset':info.header_offset,
                            'compressed_bytes':info.compress_size,'uncompressed_bytes':info.file_size,
                            'compression':info.compress_type,'crc32':info.CRC}
                try:validate_descriptor(descriptor);supported=not bool(info.flag_bits&1)
                except ValueError:supported=False
                entries.append({**descriptor,'member_adapter_supported':supported,'numeric_grid_verified':False})
    sha=hashlib.sha256(__import__('json').dumps(entries,sort_keys=True).encode()).hexdigest()
    return {'schema_version':1,'archive':{k:source[k] for k in ('id','url','bytes','etag')},
            'members':entries,'index_sha256':sha,'review_state':'native_grid_and_valid_coastal_coverage_unverified'}


def validate_descriptor(d):
    for key in ('name','local_header_offset','compressed_bytes','uncompressed_bytes','compression','crc32'):
        if key not in d: raise ValueError('Incomplete reviewed ZIP member descriptor')
    if not d['name'] or PurePosixPath(d['name']).is_absolute() or '..' in PurePosixPath(d['name']).parts or '\\' in d['name']:
        raise ValueError('Unsafe selected ZIP member')
    for key in ('local_header_offset','compressed_bytes','uncompressed_bytes','crc32'):
        if not isinstance(d[key],int) or isinstance(d[key],bool) or d[key]<0:
            raise ValueError('Invalid ZIP member extent or CRC')
    if d['compression'] not in (0,8) or not 0<d['uncompressed_bytes']<=MAX_NATIVE or not d['compressed_bytes'] or d['crc32']>0xffffffff:
        raise ValueError('Unsupported selected member format or native size')


def read_range(root,source,start,end,guard):
    if not 0<=start<=end<source['bytes']: raise ValueError('ZIP range exceeds archive')
    n=end-start+1;guard(root,n)
    ledger_path=root/'.cache/ocean-acquisition/ledger.json'
    ledger=acq.load(ledger_path)
    if ledger['charged_bytes']+n>acq.LIMIT: raise InterruptedError('Transfer budget reached')
    with acq.request(source['url'],{'Range':f'bytes={start}-{end}','If-Match':source['etag']}) as response:
        if response.status!=206 or response.headers.get('Content-Range')!=f"bytes {start}-{end}/{source['bytes']}" or response.headers.get('ETag')!=source['etag']:
            raise ValueError('Exact ZIP range or archive identity changed')
        ledger['charged_bytes']+=n;acq.save(ledger_path,ledger)
        data=response.read(n)
        ledger['charged_bytes']-=n-len(data);ledger['received_bytes']+=len(data);acq.save(ledger_path,ledger)
        if len(data)!=n: raise ValueError('Truncated ZIP range')
        return data


def inflate_member(path,d,guard=lambda:None):
    validate_descriptor(d)
    decoder=zlib.decompressobj(-15) if d['compression']==8 else None
    output=io.BytesIO();crc=0;size=0
    with path.open('rb') as stream:
        while True:
            chunk=stream.read(acq.BLOCK)
            if not chunk: break
            while chunk:
                guard()
                raw=decoder.decompress(chunk,acq.BLOCK) if decoder else chunk
                chunk=decoder.unconsumed_tail if decoder else b''
                size+=len(raw)
                if size>d['uncompressed_bytes']: raise ValueError('ZIP member exceeds reviewed native size')
                crc=zlib.crc32(raw,crc);output.write(raw)
    if decoder and (not decoder.eof or decoder.unused_data or decoder.unconsumed_tail):
        raise ValueError('Incomplete or trailing ZIP member data')
    if size!=d['uncompressed_bytes'] or crc!=d['crc32']:
        raise ValueError('ZIP member size or CRC failed')
    return output.getvalue()


def acquire_member(root,source,dest,identity,guard):
    d=source['retrieval'];validate_descriptor(d)
    receipt=dest.with_suffix('.identity.json')
    saved=acq.load(receipt) if receipt.exists() else {'identity':identity}
    if saved.get('identity')!=identity: raise ValueError('Selected member identity changed')
    if dest.exists():
        if digest(dest)!=saved.get('completed_sha256') or not saved.get('crc_verified'):
            raise ValueError('Completed member checksum failed')
        return
    partial=dest.with_suffix('.partial')
    offset=saved.get('partial_bytes',0);hasher=hashlib.sha256()
    if partial.exists():
        if partial.stat().st_size<offset: raise ValueError('Missing checkpointed member bytes')
        with partial.open('rb') as stream:
            left=offset
            while left:
                chunk=stream.read(min(acq.BLOCK,left));hasher.update(chunk);left-=len(chunk)
        if offset and hasher.hexdigest()!=saved.get('partial_sha256'):raise ValueError('Member prefix checksum failed')
        if partial.stat().st_size>offset:
            with partial.open('r+b') as stream:stream.truncate(offset)
    elif offset: raise ValueError('Missing member partial')
    start=d['local_header_offset']
    header=read_range(root,source,start,start+29,guard)
    fields=struct.unpack('<IHHHHHIIIHH',header)
    signature,_,flags,method,_,_,crc,compressed,native,name_length,extra_length=fields
    if signature!=0x04034b50 or flags&1 or method!=d['compression']:
        raise ValueError('Unexpected ZIP local header')
    if not flags&8 and (crc!=d['crc32'] or compressed!=d['compressed_bytes'] or native!=d['uncompressed_bytes']):
        raise ValueError('ZIP index and local header disagree')
    metadata=read_range(root,source,start+30,start+29+name_length+extra_length,guard)
    name=metadata[:name_length].decode('utf-8' if flags&0x800 else 'cp437')
    if name!=d['name']: raise ValueError('ZIP member name differs from reviewed index')
    payload=start+30+name_length+extra_length
    if payload+d['compressed_bytes']>source['bytes'] or offset>d['compressed_bytes']:
        raise ValueError('ZIP payload extent exceeds archive')
    dest.parent.mkdir(parents=True,exist_ok=True)
    acq.save(receipt,saved)
    while offset<d['compressed_bytes']:
        count=min(acq.BLOCK,d['compressed_bytes']-offset)
        data=read_range(root,source,payload+offset,payload+offset+count-1,guard)
        guard(root,len(data))
        with partial.open('ab') as out:out.write(data);out.flush();os.fsync(out.fileno())
        offset+=len(data);hasher.update(data)
        acq.save(receipt,{'identity':identity,'partial_bytes':offset,'partial_sha256':hasher.hexdigest()})
    inflate_member(partial,d,lambda:guard(root))
    actual=digest(partial)
    if d.get('compressed_sha256') and actual!=d['compressed_sha256']:
        raise ValueError('Compressed member checksum failed')
    acq.save(receipt,{'identity':identity,'completed_sha256':actual,'crc_verified':True})
    partial.replace(dest)
