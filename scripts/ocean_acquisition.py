"""Resumable, budgeted native ocean archive acquisition; no DB access."""
import hashlib
import json
import os
import re
import shutil
import time
import zipfile
import fcntl
import threading
import tempfile
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError
try:
    from ocean_catalog import load, save, digest, safe
except ImportError:
    from scripts.ocean_catalog import load, save, digest, safe

# Transfers share one durable budget. Serializing state writes also prevents
# simultaneous completions from losing a source's acquisition manifest.
STATE_LOCK=threading.RLock()


def save(path, value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    with STATE_LOCK:
        with tempfile.NamedTemporaryFile(mode='w',dir=path.parent,prefix=path.name+'.',suffix='.tmp',delete=False) as f:
            json.dump(value,f,indent=2,ensure_ascii=False,allow_nan=False);f.write('\n');f.flush();os.fsync(f.fileno());temp=Path(f.name)
        os.replace(temp,path)


LIMIT=100_000_000_000
RESERVE=100*1024**3
PART=1024**3
BLOCK=8*1024**2
AGENT='FinFolkOceanArchive/1.0 (public bathymetry research)'


def request(url,headers=None,method=None):
    u=urlsplit(url)
    if u.scheme!='https' or u.username or u.password:
        raise ValueError('Credential-free HTTPS required')
    r=urlopen(Request(url,headers={'User-Agent':AGENT,'Accept-Encoding':'identity',**(headers or {})},method=method),timeout=20 if method=='HEAD' else 180)
    if urlsplit(r.url).scheme!='https':
        r.close();raise ValueError('Insecure redirect')
    return r


def probe(url):
    """Signed public download redirects may authorize GET while rejecting HEAD."""
    try:
        with request(url,method='HEAD') as r:
            if 'text/html' in r.headers.get('Content-Type',''):raise ValueError('Download is a landing page')
            return {'bytes':int(r.headers['Content-Length']) if r.headers.get('Content-Length') else None,'etag':r.headers.get('ETag'),'last_modified':r.headers.get('Last-Modified')}
    except HTTPError as e:
        if e.code not in [403,405]:raise
    with request(url,headers={'Range':'bytes=0-0'}) as r:
        if 'text/html' in r.headers.get('Content-Type',''):raise ValueError('Download is a landing page')
        extent=r.headers.get('Content-Range','')
        if r.status==206:
            match=re.fullmatch(r'bytes 0-\d+/(\d+)',extent)
            if not match:raise ValueError('Invalid probe Content-Range')
            size=int(match.group(1))
        elif r.status==200:size=int(r.headers['Content-Length']) if r.headers.get('Content-Length') else None
        else:raise ValueError('Invalid download probe response')
        # Headers establish size; close immediately without reading a large body.
        return {'bytes':size,'etag':r.headers.get('ETag'),'last_modified':r.headers.get('Last-Modified')}


def metadata(url):
    with request(url) as r:
        b=r.read(3*1024**2+1)
        if len(b)>3*1024**2:raise ValueError('Metadata exceeds limit')
        return b.decode('utf-8','replace')


def group_download_urls(urls):
    groups={}
    for url in urls:
        parsed=urlsplit(url);match=re.search(r'/resource/([a-fA-F0-9-]{36})/download/([^/]+)$',parsed.path)
        key=('nsw-resource',match.group(1),match.group(2)) if parsed.hostname and parsed.hostname.endswith('.nsw.gov.au') and match else ('url',url)
        groups.setdefault(key,[]).append(url)
    result=[]
    for variants in groups.values():
        variants.sort(key=lambda u:(urlsplit(u).hostname!='datasets.seed.nsw.gov.au',u))
        result.append((variants[0],variants[1:]))
    return sorted(result)


def excluded_depth_format(url):
    return Path(unquote(urlsplit(url).path).strip()).suffix.lower() in {'.ecw','.pdf','.m4v','.mp4','.mov','.jpg','.jpeg','.png','.gif'}


def discover(root):
    sources=list(sorted((root/'datasets/ocean/records').glob('*.json')))
    snapshot=load(root/'resources/atlas/snapshot.json')
    oldpath=root/'datasets/ocean/acquisition-manifest.json'
    previous=load(oldpath)['sources'] if oldpath.exists() else []
    old={a['url']:a for s in previous for a in s['assets']}
    manifest={'schema_version':1,'created_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'limit_bytes':LIMIT,'sources':[]}
    for path in sources:
        record=load(path)
        if record['review']['acquisition_status']!='discovered' and not record.get('acquisitions'):continue
        ident=record['id'];urls={a['url'] for s in previous if s['id']==record['id'] for a in s['assets']};evidence=[];errors=[]
        try:
            if ident=='imas-eez-composite':
                base='https://data.imas.utas.edu.au/attachments/69e9ac91-babe-47ed-8c37-0ef08f29338a/bathymetry/'
                text=metadata(base);save(root/'datasets/ocean/provenance'/f'{ident}.json',{'url':base,'content':text});evidence.append({'url':base,'sha256':hashlib.sha256(text.encode()).hexdigest()})
                urls.update(urljoin(base,x) for x in re.findall(r'href=["\']([^"\']+\.tif)["\']',text,re.I))
            else:
                text=metadata(record['source_url']);save(root/'datasets/ocean/provenance'/f'{ident}.json',{'url':record['source_url'],'retrieved_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'content':text});evidence.append({'url':record['source_url'],'sha256':hashlib.sha256(text.encode()).hexdigest()})
                for link in re.findall(r'(?:href|src)=["\']([^"\']+)["\']',text,re.I):
                    link=urljoin(record['source_url'],link.replace('&amp;','&'))
                    if re.search(r'\.(zip|tif|tiff|bag|nc)(?:\?|$)',link,re.I):urls.add(link)
                # Public collection index supplies exact native archive links and per-survey licences.
                if ident in ['ausseabed-local-surveys','wa-bathymetry-surveys']:
                    rows=[s for s in snapshot['surveys'] if s.get('download_url') and 'attribution' in (s.get('licence') or '').lower() and 'bathymetry' in s['name'].lower() and 'backscatter' not in s['name'].lower()]
                    if ident=='wa-bathymetry-surveys':rows=[s for s in rows if s.get('custodian') and ('transport' in s['custodian'].lower())]
                    urls.update(s['download_url'] for s in rows if s['download_url'].startswith('https://files.ausseabed.gov.au/'))
        except Exception as e:errors.append(type(e).__name__+': '+str(e)[:180])
        # Stable public native depth packages, confirmed by their publisher metadata.
        fixed={'ausbathytopo-2026':['https://files.ausseabed.gov.au/survey/AusBathyTopo_Australia_2026_250m.zip'],
               'northern-australia-2018':['https://files.ausseabed.gov.au/survey/North%20Australia%20Bathymetry%202018%2030m.zip'],
               'gbr-2020':['https://files.ausseabed.gov.au/survey/Great%20Barrier%20Reef%20Bathymetry%202020%2030m.zip']}
        urls.update(fixed.get(ident,[]))
        if ident=='nsw-combined-bathymetry':
            try:
                api='https://datasets.seed.nsw.gov.au/api/3/action/package_show?id=nsw-bathymetry-sourced-from-multibeam-and-marine-lidar-surveys'
                package=json.loads(metadata(api))
                if not package.get('success'):raise ValueError('SEED package lookup failed')
                data=package['result']
                urls.update(r['url'] for r in data.get('resources',[]) if r.get('format','').upper()=='ZIP')
                evidence.append({'url':api,'licence':data.get('license_title'),'resources':[{'name':r.get('name'),'url':r['url'],'format':r.get('format')} for r in data.get('resources',[])]})
            except Exception as e:errors.append('SEED index: '+str(e)[:180])
        if ident=='vcdem-2021':
            try:
                portal='https://datashare.maps.vic.gov.au/search?md=8ea2cdd5-864d-4c66-8e03-55a9d31d8329'
                page=metadata(portal)
                api=re.search(r"var OPENDATASOFT_API_URL\s*=\s*'([^']+)'",page).group(1)
                key=re.search(r"var OPENDATASOFT_API_KEY\s*=\s*'([^']+)'",page).group(1)
                params={'dataset':'datashare-metadata','q':'uuid=8ea2cdd5-864d-4c66-8e03-55a9d31d8329','rows':10,'apikey':key}
                data=json.loads(metadata(urljoin(api,'/api/records/1.0/search/')+'?'+urlencode(params)))
                fields=[r['fields'] for r in data.get('records',[]) if r['fields'].get('uuid')=='8ea2cdd5-864d-4c66-8e03-55a9d31d8329']
                if len(fields)!=1:raise ValueError('VCDEM publisher record is ambiguous or missing')
                field=fields[0]
                if field.get('can_order_dataset')!='ALL-USERS':raise ValueError('VCDEM source is not publicly orderable')
                urls.update(re.findall(r'https://[^\s]+\.zip',field.get('download_url','')))
                evidence.append({'url':portal,'publisher_uuid':field['uuid'],'download_url':field.get('download_url'),'can_order_dataset':field.get('can_order_dataset')})
            except Exception as e:errors.append('VCDEM portal: '+str(e)[:180])
        if ident=='wa-bathymetry-surveys':
            try:
                base='https://services6.arcgis.com/67Ks15nDmWoIbK8b/arcgis/rest/services/Survey_index_linkedbagfiles/FeatureServer/0/query'
                offset=0
                while True:
                    params={'where':"DataRestri='NO'",'outFields':'SurveyID,Survey_download,BAG_FILE,DataRestri,VertDatTyp','returnGeometry':'false','resultOffset':offset,'resultRecordCount':500,'orderByFields':'OBJECTID_12','f':'json'}
                    batch=json.loads(metadata(base+'?'+urlencode(params)))
                    if batch.get('error'):raise ValueError('WA index query failed')
                    features=batch.get('features',[])
                    if not features and batch.get('exceededTransferLimit'):raise ValueError('WA paging incomplete')
                    for f in features:
                        a=f['attributes'];url=a.get('Survey_download')
                        if url and url.startswith('https://'):urls.add(url)
                    evidence.append({'url':base,'page_offset':offset,'survey_attributes':[f['attributes'] for f in features]})
                    offset+=len(features)
                    if not batch.get('exceededTransferLimit'):break
            except Exception as e:errors.append('WA index: '+str(e)[:180])
        if ident in ['ausseabed-local-surveys','wa-bathymetry-surveys']:
            rows=[s for s in snapshot['surveys'] if s.get('download_url') and 'attribution' in (s.get('licence') or '').lower() and 'bathymetry' in s['name'].lower() and 'backscatter' not in s['name'].lower()]
            if ident=='wa-bathymetry-surveys':rows=[s for s in rows if 'transport' in (s.get('custodian') or '').lower()]
            urls.update(s['download_url'] for s in rows if s['download_url'].startswith('https://files.ausseabed.gov.au/'))
            evidence.extend({'url':r['metadata_url'],'licence':r['licence'],'name':r['name']} for r in rows)
        assets=[]
        excluded=[{'url':url,'reason':'Presentation/imagery/video format; outside native depth-data scope.'} for url in sorted(urls) if excluded_depth_format(url)]
        for url,aliases in group_download_urls({u for u in urls if not excluded_depth_format(u)}):
            if any(w in unquote(url).lower() for w in ['derivative','hillshade','backscatter','pointcloud']):continue
            if 'slope' in unquote(url).lower() and 'bathy' not in unquote(url).lower():continue
            asset={'id':hashlib.sha256(url.encode()).hexdigest()[:24],'url':url,'filename':Path(unquote(urlsplit(url).path)).name,'state':'pending','bytes':None,'licence_evidence':record.get('licence_url',record['source_url']),'aliases':aliases}
            try:
                if len(urls)>50 and url not in old:raise LookupError('Size pending preflight')
                asset.update(probe(url))
            except LookupError:pass
            except Exception as e:asset.update(state='blocked',reason=str(e)[:180])
            if url in old and old[url].get('bytes') and old[url]['state']!='blocked':asset={**old[url]}
            assets.append(asset)
        # Metadata alone does not prove acquisition/redistribution rights. Known products are CC-BY;
        # publisher-specific portals without resolved product licences remain blocked.
        authorized=ident in {'ausbathytopo-2026','gbr-2020','northern-australia-2018','imas-eez-composite','ausseabed-local-surveys','wa-bathymetry-surveys','vcdem-2021','nsw-combined-bathymetry'}
        row={'id':ident,'assets':assets,'evidence':evidence,'redistribution_reviewed':authorized,'blockers':errors,'excluded_resources':excluded}
        if not assets:row['blockers'].append('No direct native depth download resolved; publisher access/download index requires further discovery.')
        if not authorized:row['blockers'].append('Per-product licence requires verification before archive acquisition.')
        manifest['sources'].append(row)
        save(root/'.cache/ocean-acquisition/manifest-progress.json',manifest)
    save(root/'datasets/ocean/acquisition-manifest.json',manifest)
    return {'sources':len(manifest['sources']),'assets':sum(len(s['assets']) for s in manifest['sources'])}


def parts_for(directory):return sorted(directory.glob('*.bin'))


def verify_asset(root,a):
    h=hashlib.sha256();total=0
    for p in a['parts']:
        path=safe(root,p['path'])
        if path.stat().st_size!=p['bytes'] or digest(path)!=p['sha256']:raise ValueError('Part checksum mismatch')
        with path.open('rb') as f:
            for b in iter(lambda:f.read(BLOCK),b''):h.update(b);total+=len(b)
    if total!=a['bytes'] or h.hexdigest()!=a['sha256']:raise ValueError('Original checksum mismatch')


def acquire_one(root,source,asset,ledger):
    directory=root/'.cache/ocean-acquisition/partial'/asset['id'];directory.mkdir(parents=True,exist_ok=True)
    resume=directory/'resume.json';prior=load(resume) if resume.exists() else {}
    validator=asset.get('etag') or asset.get('last_modified')
    files=parts_for(directory)
    existing=sum(p.stat().st_size for p in files)
    malformed=any(p.name!=f'{i:06d}.bin' or p.stat().st_size>PART or (i<len(files)-1 and p.stat().st_size!=PART) for i,p in enumerate(files))
    if malformed or (asset['bytes'] is not None and existing>asset['bytes']):
        quarantine=root/'.cache/ocean-acquisition/quarantine'/f"{asset['id']}-{time.time_ns()}";quarantine.parent.mkdir(parents=True,exist_ok=True);os.replace(directory,quarantine);directory.mkdir();existing=0;prior={};resume=directory/'resume.json'
    if existing and (not validator or prior.get('validator')!=validator):
        for p in parts_for(directory):p.unlink()
        existing=0
    save(resume,{'validator':validator})
    if existing and existing==asset['bytes']:
        asset['state']='acquired';return publish(root,source,asset,directory)
    headers={'Range':f'bytes={existing}-','If-Range':validator} if existing else {}
    with request(asset['url'],headers) as r:
        if existing and (r.status!=206 or not r.headers.get('Content-Range','').startswith(f'bytes {existing}-')):
            raise ValueError('Server cannot resume safely')
        if 'text/html' in r.headers.get('Content-Type',''):raise ValueError('HTML response is not depth data')
        actual_validator=r.headers.get('ETag') or r.headers.get('Last-Modified')
        if validator and actual_validator and validator!=actual_validator:raise ValueError('Source changed since discovery')
        offset=existing
        while True:
            with STATE_LOCK:
                if (root/'.cache/ocean-acquisition/stop-request.json').exists():asset['state']='pending';break
                remaining=LIMIT-ledger['charged_bytes']
                if remaining<=0:asset['state']='deferred_budget';break
                if shutil.disk_usage(root).free<RESERVE+BLOCK:asset['state']='deferred_disk';break
                n=min(BLOCK,remaining,PART-offset%PART)
                # Reserve before reading so crashes cannot undercount transfers.
                ledger['charged_bytes']+=n;save(root/'.cache/ocean-acquisition/ledger.json',ledger)
            b=r.read(n)
            with STATE_LOCK:
                ledger['charged_bytes']-=n-len(b);ledger['received_bytes']+=len(b);save(root/'.cache/ocean-acquisition/ledger.json',ledger)
            if not b:
                if asset['bytes'] is not None and offset!=asset['bytes']:raise ValueError('Truncated source')
                asset['state']='acquired';break
            path=directory/f'{offset//PART:06d}.bin'
            if (path.stat().st_size if path.exists() else 0)!=offset%PART:raise ValueError('Partial chunk offset mismatch')
            with path.open('ab') as f:f.write(b)
            offset+=len(b)
            if asset['bytes'] is not None and offset==asset['bytes']:
                asset['state']='acquired';break
            if offset%(256*1024**2)<BLOCK:print(source['id'],asset['filename'],offset,'bytes',flush=True)
    if asset['state']!='acquired':return
    return publish(root,source,asset,directory)


def publish(root,source,asset,directory):
    h=hashlib.sha256();parts=[];dest=root/'datasets/raw/ocean'/source['id']/asset['id'];dest.mkdir(parents=True,exist_ok=True)
    for path in parts_for(directory):
        with path.open('rb') as f:
            for b in iter(lambda:f.read(BLOCK),b''):h.update(b)
        target=dest/path.name;os.replace(path,target)
        parts.append({'path':target.relative_to(root).as_posix(),'bytes':target.stat().st_size,'sha256':digest(target)})
    result={**asset,'bytes':sum(p['bytes'] for p in parts),'sha256':h.hexdigest(),'parts':parts,'acquired_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'numeric_validation':'pending'}
    verify_asset(root,result)
    with STATE_LOCK:
        recordpath=root/'datasets/ocean/records'/f"{source['id']}.json";record=load(recordpath)
        record.setdefault('acquisitions',[])
        if not any(a['id']==result['id'] for a in record['acquisitions']):record['acquisitions'].append(result)
        record['review']['acquisition_status']='partial';save(recordpath,record)
    asset.update(state='acquired',sha256=result['sha256'])


def other_runners(root):
    """Detect pre-lock legacy processes as well as current lock-aware runners."""
    listing=subprocess.check_output(['ps','-axo','pid=,command='],text=True)
    found=[]
    for line in listing.splitlines():
        fields=line.strip().split(None,1)
        if len(fields)!=2:continue
        pid=int(fields[0]);command=fields[1]
        if pid==os.getpid() or not Path(command.split()[0]).name.lower().startswith('python'):continue
        if not re.search(r'(?:^|\s)(?:\S*/)?ocean_catalog\.py\s+acquire(?:\s|$)',command):continue
        try:
            cwd=subprocess.check_output(['lsof','-a','-p',str(pid),'-d','cwd','-Fn'],text=True,stderr=subprocess.DEVNULL)
            if any(line=='n'+str(root.resolve()) for line in cwd.splitlines()):found.append(pid)
        except subprocess.CalledProcessError:
            # A process may have exited between ps and lsof. No restart or kill
            # follows from an observation failure; the filesystem lock remains.
            pass
    return found


def acquire(root):
    lockpath=root/'.cache/ocean-acquisition/run.lock';lockpath.parent.mkdir(parents=True,exist_ok=True)
    with lockpath.open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        others=other_runners(root)
        if others:raise RuntimeError('Other acquisition runners for this worktree: '+str(others))
        ledgerpath=root/'.cache/ocean-acquisition/ledger.json'
        checkpoint=root/'datasets/ocean/checkpoint.json'
        if checkpoint.exists() and (not ledgerpath.exists() or load(ledgerpath)['charged_bytes']<load(checkpoint)['ledger']['charged_bytes']):
            raise RuntimeError('Restore the portable ocean checkpoint before acquisition; never reset the batch budget')
        receipt={'pid':os.getpid(),'started_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'initial_ledger':load(ledgerpath) if ledgerpath.exists() else None,'state':'running'}
        receiptpath=root/'.cache/ocean-acquisition/runs'/f"{os.getpid()}-{time.time_ns()}.json"
        save(receiptpath,receipt)
        try:
            result=run_acquire(root);receipt['state']='finished';return result
        except BaseException as e:
            receipt['state']='interrupted';receipt['error_type']=type(e).__name__;raise
        finally:
            receipt['final_ledger']=load(ledgerpath) if ledgerpath.exists() else None
            save(receiptpath,receipt)


def run_acquire(root):
    path=root/'datasets/ocean/acquisition-manifest.json';manifest=load(path)
    ledgerpath=root/'.cache/ocean-acquisition/ledger.json'
    ledger=load(ledgerpath) if ledgerpath.exists() else {'charged_bytes':0,'received_bytes':0}
    sources=manifest['sources']
    # One source product first, then round-robin; smallest known core products first.
    queues=[]
    for s in sources:
        if s['redistribution_reviewed']:
            assets=sorted((a for a in s['assets'] if a['state'] not in ['blocked','acquired','alias','excluded']),key=lambda a:(a['bytes'] is None,a['bytes'] or 0,a['id']))
            # Shallow IMAS grid is the first core product regardless of deeper grid sizes.
            if s['id']=='imas-eez-composite':assets.sort(key=lambda a:(not a['filename'].startswith('01_'),a['bytes'] or 0))
            if assets:queues.append((s,assets))
    queues.sort(key=lambda pair:pair[1][0]['bytes'] or float('inf'))
    def transfer(s,a):
        if (root/'.cache/ocean-acquisition/stop-request.json').exists():return
        with STATE_LOCK:
            shared=next((x for p in (root/'datasets/ocean/records').glob('*.json') for x in load(p).get('acquisitions',[]) if x['url']==a['url']),None)
            if shared:
                rp=root/'datasets/ocean/records'/f"{s['id']}.json";r=load(rp);r.setdefault('acquisitions',[]);r['acquisitions']=[x for x in r['acquisitions'] if x['id']!=shared['id']]+[shared];save(rp,r);a.update(state='acquired',sha256=shared['sha256']);save(path,manifest);return
        if a['bytes'] is None:
            try:
                a.update(probe(a['url']))
            except Exception as e:
                with STATE_LOCK:a.update(state='blocked',reason=str(e));save(path,manifest)
                return
        partial=root/'.cache/ocean-acquisition/partial'/a['id']
        files=parts_for(partial)
        valid_parts=all(p.name==f'{i:06d}.bin' and p.stat().st_size<=PART and (i==len(files)-1 or p.stat().st_size==PART) for i,p in enumerate(files))
        size=sum(p.stat().st_size for p in files) if valid_parts else 0
        resume=partial/'resume.json'
        if not resume.exists() or load(resume).get('validator')!=(a.get('etag') or a.get('last_modified')):size=0
        with STATE_LOCK:
            if a['bytes'] and max(0,a['bytes']-size)>LIMIT-ledger['charged_bytes']:
                a['state']='deferred_budget';save(path,manifest);return
            a['state']='downloading';save(path,manifest)
        for attempt in range(3):
            try:acquire_one(root,s,a,ledger);break
            except Exception as e:
                with STATE_LOCK:
                    a['reason']=type(e).__name__+': '+str(e)[:180]
                    if attempt==2:a['state']='blocked'
                if attempt<2:time.sleep(attempt+1)
        with STATE_LOCK:save(path,manifest)

    with ThreadPoolExecutor(max_workers=4) as pool:
        while any(q for _,q in queues) and ledger['charged_bytes']<LIMIT and not (root/'.cache/ocean-acquisition/stop-request.json').exists():
            # One asset per source per round; duplicate URLs are postponed until
            # their first transfer finishes, then reuse its verified parts.
            wave=[];urls=set()
            for source,q in queues:
                if q and q[0]['url'] not in urls:
                    a=q.pop(0);wave.append((source,a));urls.add(a['url'])
            futures=[pool.submit(transfer,source,a) for source,a in wave]
            for f in futures:f.result()
    summary={'charged_bytes':ledger['charged_bytes'],'received_bytes':ledger['received_bytes'],'received_bytes_is_lower_bound':ledger.get('received_bytes_is_lower_bound',False),'stop_reason':'maintenance_requested' if (root/'.cache/ocean-acquisition/stop-request.json').exists() else 'budget_limit' if ledger['charged_bytes']>=LIMIT else 'disk_reserve' if any(a['state']=='deferred_disk' for s in sources for a in s['assets']) else 'eligible_queue_exhausted','sources':[{ 'id':s['id'],'acquired':sum(a['state']=='acquired' for a in s['assets']),'pending':sum(a['state'] not in ['acquired','blocked','alias','excluded'] for a in s['assets']),'blockers':s['blockers']+[a.get('reason','') for a in s['assets'] if a['state']=='blocked']} for s in sources]}
    save(root/'.cache/ocean-acquisition/report.json',summary);return summary


def verify(root):
    count=0
    for p in (root/'datasets/ocean/records').glob('*.json'):
        for a in load(p).get('acquisitions',[]):verify_asset(root,a);count+=1
    return {'verified_originals':count}


def materialize(root,ident):
    matches=list({(a['id'],a['sha256']):a for p in (root/'datasets/ocean/records').glob('*.json') for a in load(p).get('acquisitions',[]) if a['id']==ident}.values())
    if len(matches)!=1:raise ValueError('Unknown or ambiguous asset')
    a=matches[0];verify_asset(root,a)
    if shutil.disk_usage(root).free<RESERVE+a['bytes']:raise ValueError('Insufficient materialization space')
    target=root/'.cache/ocean-acquisition/materialized'/a['id']/Path(a['filename']).name;target.parent.mkdir(parents=True,exist_ok=True)
    with target.open('wb') as out:
        for p in a['parts']:
            with safe(root,p['path']).open('rb') as f:shutil.copyfileobj(f,out,BLOCK)
    if digest(target)!=a['sha256']:target.unlink();raise ValueError('Reconstruction mismatch')
    inspection={'status':'unverified'}
    try:
        if zipfile.is_zipfile(target):
            with zipfile.ZipFile(target) as z:
                inspection={'status':'container_inspected','native_members':[x.filename for x in z.infolist() if x.filename.lower().endswith(('.tif','.tiff','.bag','.nc','.asc'))], 'unpacked_bytes':sum(x.file_size for x in z.infolist())}
        else:
            import rasterio
            with rasterio.open(target) as ds:inspection={'status':'header_inspected','driver':ds.driver,'crs':str(ds.crs),'resolution':list(ds.res),'bands':ds.count,'types':list(ds.dtypes),'nodata':str(ds.nodata),'scales':list(ds.scales),'offsets':list(ds.offsets),'datum_verification':'not_inferred'}
    except Exception as e:inspection={'status':'unverified','reason':type(e).__name__}
    save(target.with_suffix(target.suffix+'.inspection.json'),inspection)
    return {'path':str(target),'sha256':a['sha256'],'inspection':inspection}


def status(root):
    manifest=load(root/'datasets/ocean/acquisition-manifest.json')
    lp=root/'.cache/ocean-acquisition/ledger.json';ledger=load(lp) if lp.exists() else {'charged_bytes':0,'received_bytes':0}
    rows=[]
    for s in manifest['sources']:
        rows.append({'id':s['id'],'states':{state:sum(a['state']==state for a in s['assets']) for state in sorted({a['state'] for a in s['assets']})},'blockers':s['blockers']+[a.get('reason','Unknown transfer failure') for a in s['assets'] if a['state']=='blocked'],'remaining_known_bytes':sum(a['bytes'] or 0 for a in s['assets'] if a['state']!='acquired'),'unknown_sizes':sum(a['bytes'] is None for a in s['assets'])})
    result={**ledger,'limit_bytes':LIMIT,'sources':rows}
    save(root/'.cache/ocean-acquisition/status.json',result);return result
