#!/usr/bin/env python3
"""Run on the FinFolk server; read the Resend SMTP key exclusively from stdin.

Requires prior domain verification. Checks SMTP credentials before changing mail.
Does not submit email, change DNS, or restart Supabase services.
"""
import datetime
import json
import os
from pathlib import Path
import shutil
import smtplib
import ssl
import subprocess
import sys
import tempfile

RELEASE = Path('/opt/finfolk/releases/supabase-v0.8.4-1')
SECRET = Path('/srv/finfolk/secrets/resend-smtp-token')
FILES = [RELEASE / 'compose.production.json', RELEASE / 'compose.mail.json']
ENV = {
    'RELAYHOST': '[smtp.resend.com]:465',
    'RELAYHOST_USERNAME': 'resend',
    'RELAYHOST_PASSWORD_FILE': '/run/secrets/resend_smtp_token',
    'POSTFIX_smtp_tls_wrappermode': 'yes',
    'POSTFIX_smtp_tls_security_level': 'verify',
    'POSTFIX_smtp_tls_verify_cert_match': 'hostname',
    'POSTFIX_smtp_tls_CAfile': '/etc/ssl/certs/ca-certificates.crt',
    'POSTFIX_smtp_sasl_security_options': 'noanonymous',
    'POSTFIX_smtp_sasl_tls_security_options': 'noanonymous',
    'POSTFIX_smtp_fallback_relay': '',
}


def run(*args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        # Never echo resolved Compose inputs or SMTP credentials on error.
        raise RuntimeError(f'{args[0]} failed (exit {result.returncode}); inspect privately')
    return result.stdout


def write_private(path, data):
    descriptor, name = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(data)
        os.chmod(name, 0o600)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def activate():
    os.umask(0o077)
    token = sys.stdin.buffer.read(1025).strip()
    if not token.startswith(b're_') or len(token) < 20 or len(token) > 1024 or any(c <= 32 or c >= 127 for c in token):
        raise ValueError('Expected a single Resend API key on stdin')
    with smtplib.SMTP_SSL('smtp.resend.com', 465, timeout=30,
                          context=ssl.create_default_context()) as smtp:
        smtp.ehlo('mail.finfolk.com.au')
        smtp.login('resend', token.decode('ascii'))
    print('Resend SMTP authentication succeeded; no message submitted.', flush=True)

    original = {p: p.read_bytes() for p in FILES}
    updated = {}
    for path, raw in original.items():
        config = json.loads(raw)
        postfix = config['services']['postfix']
        if postfix.get('ports'):
            raise ValueError('Unexpected public SMTP port; refusing activation')
        env = postfix['environment']
        if env.get('RELAYHOST') not in (None, '', ENV['RELAYHOST']):
            raise ValueError('Unexpected existing relay; refusing to overwrite it')
        if env.get('RELAYHOST_PASSWORD'):
            raise ValueError('Unexpected inline SMTP password')
        env.update(ENV)
        secrets = postfix.setdefault('secrets', [])
        if 'resend_smtp_token' not in secrets:
            secrets.append('resend_smtp_token')
        config.setdefault('secrets', {})['resend_smtp_token'] = {'file': str(SECRET)}
        updated[path] = (json.dumps(config, indent=2) + '\n').encode()

    backup_root = Path('/var/backups/finfolk-supabase')
    backup_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = Path(tempfile.mkdtemp(prefix=f'resend-{stamp}-', dir=backup_root))
    for path, raw in original.items():
        write_private(backup / path.name, raw)
    shutil.copy2(RELEASE / '.env', backup / '.env')
    os.chmod(backup / '.env', 0o600)
    old_secret = SECRET.read_bytes() if SECRET.exists() else None
    if old_secret is not None:
        write_private(backup / 'resend-smtp-token', old_secret)
    SECRET.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(SECRET.parent, 0o700)
    compose = ['docker', 'compose', '--project-name', 'finfolk-supabase',
               '--project-directory', str(RELEASE), '--env-file', str(RELEASE / '.env')]
    for path in FILES:
        compose.extend(['-f', str(path)])
    try:
        write_private(SECRET, token + b'\n')
        for path, raw in updated.items():
            write_private(path, raw)
        run(*compose, 'config', '--quiet')
        run(*compose, 'up', '-d', '--no-deps', 'postfix')
    except Exception:
        for path, raw in original.items():
            write_private(path, raw)
        if old_secret is None:
            SECRET.unlink(missing_ok=True)
        else:
            write_private(SECRET, old_secret)
        run(*compose, 'up', '-d', '--no-deps', 'postfix')
        raise
    print(json.dumps({'relay_configured': True, 'backup': str(backup),
                      'message_sent': False, 'delivery_test_required': True}))


if __name__ == '__main__':
    try:
        activate()
    except Exception as error:
        print(f'Activation stopped: {type(error).__name__}. No credentials logged.', file=sys.stderr)
        sys.exit(1)
