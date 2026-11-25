#!/usr/bin/env python3
"""Prepare an isolated production bundle from the pinned Supabase docker directory.

Does not start services, install SQL, generate credentials or change DNS.
"""
import argparse
import json
import pathlib
import shutil
import yaml

RELEASE = 'self-hosted/v0.8.4'
KEEP = {'db', 'auth', 'rest', 'meta', 'studio', 'api-gw'}

def prepare(source, target):
    if target.exists():
        raise SystemExit('Destination already exists; prepare a new release directory.')
    config = yaml.safe_load((source / 'docker-compose.yml').read_text())
    missing = KEEP - config['services'].keys()
    if missing:
        raise SystemExit(f'Upstream service layout changed: {sorted(missing)}')
    shutil.copytree(source, target)
    services = {key: value for key, value in config['services'].items() if key in KEEP}
    for name, service in services.items():
        service.pop('container_name', None)
        service.pop('ports', None)
        service['networks'] = {'default': {}}
        dependencies = service.get('depends_on', {})
        if isinstance(dependencies, dict):
            service['depends_on'] = {k: v for k, v in dependencies.items() if k in KEEP}
        else:
            service['depends_on'] = [k for k in dependencies if k in KEEP]
        service['logging'] = {'driver': 'json-file', 'options': {'max-size': '10m', 'max-file': '5'}}
    services['api-gw']['networks']['default']['aliases'] = ['envoy', 'kong']
    services['api-gw']['networks']['finfolk_edge'] = {}
    services['api-gw']['labels'] = {
        'traefik.enable': 'true',
        'traefik.docker.network': 'finfolk_edge',
        'traefik.http.routers.finfolk-supabase.rule': 'Host(`supabase.finfolk.com.au`) && (PathPrefix(`/auth/v1/`) || PathPrefix(`/rest/v1/`))',
        'traefik.http.routers.finfolk-supabase.entrypoints': 'websecure',
        'traefik.http.routers.finfolk-supabase.tls.certresolver': 'letsencrypt',
        'traefik.http.services.finfolk-supabase.loadbalancer.server.port': '8000',
    }
    # Dashboard is available only through SSH port forwarding.
    services['studio']['ports'] = ['127.0.0.1:55433:3000']
    services['auth']['environment'].update({
        'GOTRUE_SMTP_HOST': 'postfix',
        'GOTRUE_SMTP_PORT': '587',
        'GOTRUE_SMTP_USER': '',
        'GOTRUE_SMTP_PASS': '',
        'GOTRUE_JWT_KEYS': '${JWT_KEYS:?Generate production asymmetric signing keys}',
        'GOTRUE_EXTERNAL_GOOGLE_ENABLED': '${GOOGLE_ENABLED:-false}',
        'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID': '${GOOGLE_CLIENT_ID:-}',
        'GOTRUE_EXTERNAL_GOOGLE_SECRET': '${GOOGLE_SECRET:-}',
        'GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI': 'https://supabase.finfolk.com.au/auth/v1/callback',
        'GOTRUE_EXTERNAL_GITHUB_ENABLED': '${GITHUB_ENABLED:-false}',
        'GOTRUE_EXTERNAL_GITHUB_CLIENT_ID': '${GITHUB_CLIENT_ID:-}',
        'GOTRUE_EXTERNAL_GITHUB_SECRET': '${GITHUB_SECRET:-}',
        'GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI': 'https://supabase.finfolk.com.au/auth/v1/callback',
    })
    services['postfix'] = {
        'image': '${POSTFIX_IMAGE:?Set a tested Postfix image digest}',
        'restart': 'unless-stopped',
        'networks': {'default': {}},
        'volumes': ['mail-queue:/var/spool/postfix', '/srv/finfolk/dkim:/etc/opendkim/keys'],
        'environment': {
            'ALLOWED_SENDER_DOMAINS': 'finfolk.com.au',
            'POSTFIX_smtp_tls_security_level': 'may',
            # Internal submission is private; GoTrue must not negotiate the image's self-signed certificate.
            'POSTFIX_smtpd_tls_security_level': 'none',
            'POSTFIX_smtp_tls_CAfile': '/etc/ssl/certs/ca-certificates.crt',
            'POSTFIX_myhostname': 'mail.finfolk.com.au',
            'POSTFIX_inet_protocols': 'ipv4',
            'DKIM_BACKEND': 'opendkim',
            'DKIM_SELECTOR': 'finfolk202611',
            'OPENDKIM_Socket': 'inet:8891@127.0.0.1',
            'POSTFIX_milter_default_action': 'tempfail',
        },
    }
    config.update(name='finfolk-supabase', services=services, networks={
        'default': {'name': 'finfolk_supabase'},
        'finfolk_edge': {'external': True},
    })
    config.setdefault('volumes', {})['mail-queue'] = {}
    # Data survives application release directory replacement.
    service = services['db']
    service['volumes'] = [v.replace('./volumes/db/data:', '/srv/finfolk/postgres:') for v in service['volumes']]
    (target / 'compose.production.json').write_text(json.dumps(config, indent=2) + '\n')
    (target / 'FINFOLK_UPSTREAM').write_text(RELEASE + '\n')
    print(f'Prepared {target}; services have NOT been started.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=pathlib.Path, help='Pinned upstream docker directory')
    parser.add_argument('target', type=pathlib.Path, help='New output directory')
    args = parser.parse_args()
    prepare(args.source, args.target)
