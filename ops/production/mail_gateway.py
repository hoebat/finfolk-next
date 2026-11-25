"""Private application-email transport to Postfix; no application authorization logic.

SQLite records queue acceptance, not inbox delivery. Uncertain sends are never
automatically repeated. Keep this database with the Postfix queue during restores.
"""
import hashlib
import hmac
import json
import os
import re
import smtplib
import sqlite3
from contextlib import contextmanager
from email.message import EmailMessage
from email.utils import formatdate
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

class Delivery:
    def __init__(self, path, send):
        self.path, self.send = path, send
        with self.db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS receipt (key TEXT PRIMARY KEY, hash TEXT NOT NULL, state TEXT NOT NULL, id TEXT NOT NULL)')

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.path, timeout=10)
        try:
            with db:
                yield db
        finally:
            db.close()

    def deliver(self, key, value):
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,200}', key):
            return 400, {'error': 'Invalid delivery key'}
        if not isinstance(value, dict) or set(value) != {'to', 'title', 'url'}:
            return 400, {'error': 'Invalid message'}
        to, title, url = (value[k] for k in ('to', 'title', 'url'))
        if not all(isinstance(v, str) for v in (to, title, url)):
            return 400, {'error': 'Invalid message'}
        if not re.fullmatch(r'[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+', to) or len(to)>254 or not 1<=len(title)<=500:
            return 400, {'error': 'Invalid message'}
        link = urlsplit(url)
        if link.scheme != 'https' or link.netloc != 'finfolk.com.au' or link.path != '/events/invitation' or len(url)>4096:
            return 400, {'error': 'Invalid invitation URL'}
        digest = hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()
        receipt = 'smtp-' + hashlib.sha256(key.encode()).hexdigest()
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            old = db.execute('SELECT hash,state,id FROM receipt WHERE key=?', (key,)).fetchone()
            if old:
                if old[0] != digest:
                    return 409, {'error': 'Delivery key conflict'}
                if old[1] == 'queued':
                    return 200, {'id': old[2]}
                if old[1] != 'retryable':
                    return 409, {'error': 'Delivery needs reconciliation'}
                db.execute("UPDATE receipt SET state='processing' WHERE key=?", (key,))
            else:
                db.execute('INSERT INTO receipt VALUES(?,?,?,?)', (key, digest, 'processing', receipt))
        message = EmailMessage()
        message['From'] = 'FinFolk <noreply@finfolk.com.au>'
        message['To'] = to
        message['Subject'] = 'FinFolk invitation: ' + re.sub(r'[\r\n]', ' ', title)[:180]
        message['Date'] = formatdate(localtime=False)
        message['Message-ID'] = '<' + receipt + '@mail.finfolk.com.au>'
        message.set_content('You have been invited to '+title+'.\n\nView your invitation:\n'+url+'\n\nIf you were not expecting this invitation, you can ignore this email.')
        state = 'queued'
        try:
            self.send(message)
        except (smtplib.SMTPConnectError, smtplib.SMTPRecipientsRefused, smtplib.SMTPSenderRefused, smtplib.SMTPDataError):
            state = 'retryable'
        except Exception:
            state = 'uncertain'
        with self.db() as db:
            db.execute('UPDATE receipt SET state=? WHERE key=?', (state, key))
        return (200, {'id': receipt}) if state == 'queued' else (503, {'error': 'Mail submission unavailable'})

def submit(message):
    with smtplib.SMTP(os.environ.get('SMTP_HOST', 'postfix'), 587, timeout=8) as smtp:
        smtp.send_message(message, from_addr='noreply@finfolk.com.au', to_addrs=[message['To']])

def main():
    token = Path(os.environ['MAIL_GATEWAY_TOKEN_FILE']).read_text().strip()
    if len(token)<32:
        raise RuntimeError('A production gateway token is required')
    delivery = Delivery(os.environ.get('MAIL_RECEIPTS_DB', '/data/receipts.sqlite'), submit)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # No recipient, credentials or invitation tokens in request logs.

        def respond(self, status, value):
            data = json.dumps(value).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            self.respond(200 if self.path=='/health' else 404, {'ready': self.path=='/health'})

        def do_POST(self):
            self.connection.settimeout(10)
            self.close_connection = True
            if self.path != '/v1/send':
                return self.respond(404, {'error': 'Not found'})
            if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer '+token):
                return self.respond(401, {'error': 'Unauthorized'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0<length<=16384:
                    return self.respond(413, {'error': 'Invalid request size'})
                value = json.loads(self.rfile.read(length))
                status, result = delivery.deliver(self.headers.get('Idempotency-Key', ''), value)
            except (ValueError, UnicodeError):
                return self.respond(400, {'error': 'Invalid request'})
            except Exception:
                return self.respond(503, {'error': 'Mail service unavailable'})
            self.respond(status, result)
    ThreadingHTTPServer(('0.0.0.0', 8080), Handler).serve_forever()

if __name__ == '__main__':
    main()
