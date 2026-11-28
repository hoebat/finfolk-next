#!/usr/bin/env python3
"""Rehearse/publish researched pages through the existing audited native admin RPC.
No credentials in arguments. Requires an operator's SSH access to the DB host.
Default is rollback. Publication requires a verified encrypted-backup receipt.
Existing identities (including owned/archived/edited pages) are always skipped.
"""
import argparse, hashlib, json, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def payload(records):
    seen_names, seen_hosts, seen_keys, result = set(), set(), set(), []
    from urllib.parse import urlparse
    publication = ROOT/'config/directory-businesses-publication.json'
    published = {p['key']:p['id'] for p in json.loads(publication.read_text())['pages']} if publication.exists() else {}
    for row in records:
        doc = row['document']
        name = re.sub('[^a-z0-9]', '', doc['name'].lower())
        host = urlparse(doc['website']).hostname.removeprefix('www.')
        if row['ownership'] != 'unclaimed' or not doc['sources'] or name in seen_names or host in seen_hosts or row['key'] in seen_keys:
            raise ValueError('Batch must contain unique, sourced, unclaimed pages')
        seen_names.add(name); seen_hosts.add(host); seen_keys.add(row['key'])
        result.append({'key':row['key'], 'publishedId':published.get(row['key']), 'name':name, 'host':host, 'document':doc,
                       'notes':f"Research batch: au-businesses-2026-11-28/{row['key']}. Official sources reviewed {row['researchedAt']}. {row['research']['notes']}"})
    return result

def sync_sql(records, apply=False):
    data=json.dumps(payload(records),ensure_ascii=True).replace("'", "''")
    return '''BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';
-- Remember whether older pooled connections need to adopt a new search path.
SELECT set_config('business_sync.refresh_runtime',(NOT coalesce((SELECT 'search_path=pg_catalog, extensions, public'=ANY(rolconfig) FROM pg_roles WHERE rolname='finfolk_api_runtime'),false))::text,false);
-- Runtime bootstrap: native generated insert helpers use the installed UUID extension.
GRANT USAGE ON SCHEMA extensions TO finfolk_api_runtime;
GRANT EXECUTE ON FUNCTION extensions.uuid_generate_v4() TO finfolk_api_runtime;
ALTER ROLE finfolk_api_runtime SET search_path TO pg_catalog,extensions,public;
SELECT pg_advisory_xact_lock(hashtext('finfolk:business-directory-sync'));
SELECT set_config('business_sync.actor',(SELECT r.user_id::text FROM finfolk."UserRole" r JOIN finfolk."User" u ON u.id=r.user_id WHERE r.role='admin' AND NOT u.deleted AND u.email_verified ORDER BY r.user_id LIMIT 1),true);
SET LOCAL ROLE finfolk_api_runtime;
SET LOCAL search_path=pg_catalog,extensions,public;
CREATE TEMP TABLE business_sync_results(pass integer, key text, id text, action text) ON COMMIT DROP;
DO $sync$ DECLARE item jsonb; existing jsonb; found jsonb; result jsonb; pass integer; actor uuid:=nullif(current_setting('business_sync.actor'),'')::uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'A verified existing administrator is required'; END IF;
 FOR pass IN 1..2 LOOP
 FOR item IN SELECT value FROM jsonb_array_elements('''+"'"+data+"'"+'''::jsonb) LOOP
 existing:=finfolk_rpc.native_directory_admin(actor,true,'{}'::jsonb);
 SELECT value INTO found FROM jsonb_array_elements(existing->'listings') WHERE
 value->>'id'=item->>'publishedId' OR
 value->>'notes' LIKE '%au-businesses-2026-11-28/'||(item->>'key')||'.%' OR
 regexp_replace(lower(value->'document'->>'name'),'[^a-z0-9]','','g')=item->>'name' OR
 regexp_replace(lower(split_part(regexp_replace(coalesce(value->'document'->>'website',''),'^https?://','','i'),'/',1)),'^www\\.','')=item->>'host' LIMIT 1;
 IF found IS NOT NULL THEN INSERT INTO business_sync_results VALUES(pass,item->>'key',found->>'id','preserved');
 ELSE
 result:=finfolk_rpc.native_directory_admin_save(actor,true,jsonb_build_object('document',item->'document','status','published','notes',item->>'notes','outreach','Not contacted'));
 INSERT INTO business_sync_results VALUES(pass,item->>'key',result->>'id','created');
 END IF;
 END LOOP; END LOOP;
 IF EXISTS(SELECT 1 FROM business_sync_results r WHERE r.pass=2 AND r.action<>'preserved') THEN RAISE EXCEPTION 'Sync is not idempotent'; END IF;
END $sync$;
SELECT json_build_object('pages',(SELECT json_agg(row_to_json(r)) FROM business_sync_results r),'apply', '''+('true' if apply else 'false')+''');
'''+('COMMIT; SELECT json_build_object(\'idleRuntimeConnectionsRefreshed\',count(*)) FROM (SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE current_setting(\'business_sync.refresh_runtime\')=\'true\' AND usename=\'finfolk_api_runtime\' AND state=\'idle\') refreshed;' if apply else 'ROLLBACK;')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--host',required=True);p.add_argument('--container',default='finfolk-supabase-db-1')
    p.add_argument('--apply',action='store_true');p.add_argument('--backup-receipt',type=Path);p.add_argument('--receipt',type=Path,required=True)
    a=p.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]*(?:@[A-Za-z0-9][A-Za-z0-9.-]*)?',a.host) or not re.fullmatch(r'[A-Za-z0-9][\w-]*',a.container):p.error('Invalid SSH host or container')
    if a.apply:
        if not a.backup_receipt:p.error('--apply requires --backup-receipt')
        receipt=json.loads(a.backup_receipt.read_text())
        if not all(receipt.get(k) is True for k in ['passed','encrypted','decryptionVerified','offServer']):p.error('Verified off-server backup required')
        backup=a.backup_receipt.parent/'preinstall-backup.tar.cms'
        if hashlib.sha256(backup.read_bytes()).hexdigest()!=receipt['sha256']:p.error('Backup hash changed')
    records=json.loads((ROOT/'config/directory-businesses-australia.json').read_text())['records']
    r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10',a.host,f'docker exec -i {a.container} psql -X -U supabase_admin -d postgres -qAt -v ON_ERROR_STOP=1'],input=sync_sql(records,a.apply),text=True,capture_output=True)
    if r.returncode:raise SystemExit('Native business sync rolled back: '+r.stderr[:1000])
    receipts=[json.loads(line) for line in r.stdout.splitlines() if line.startswith('{')]
    out=next(value for value in receipts if 'pages' in value)
    for value in receipts:
        if 'idleRuntimeConnectionsRefreshed' in value:out.update(value)
    out.update(passed=True,batchSha256=hashlib.sha256(json.dumps(records,sort_keys=True).encode()).hexdigest(),existingPagesPreserved=True)
    a.receipt.parent.mkdir(parents=True,exist_ok=True);a.receipt.write_text(json.dumps(out,indent=2)+'\n')
    print(json.dumps({'passed':True,'published':a.apply,'created':sum(x['pass']==1 and x['action']=='created' for x in out['pages']),'preserved':sum(x['pass']==1 and x['action']=='preserved' for x in out['pages']),'idempotent':True}))
if __name__=='__main__':main()
