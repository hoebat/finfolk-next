import contextlib
import importlib.util
import io
import json
from pathlib import Path
import smtplib
import tempfile
import unittest
from unittest.mock import patch, MagicMock

spec = importlib.util.spec_from_file_location('activate_resend', Path(__file__).with_name('activate_resend.py'))
relay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(relay)


class RelayActivation(unittest.TestCase):
    def test_rejected_credentials_never_change_deployment(self):
        smtp = MagicMock()
        smtp.__enter__.return_value.login.side_effect = smtplib.SMTPAuthenticationError(535, b'rejected')
        stdin = MagicMock(buffer=io.BytesIO(b're_' + b'x' * 32))
        with patch.object(relay.sys, 'stdin', stdin), patch.object(relay.smtplib, 'SMTP_SSL', return_value=smtp), patch.object(relay, 'write_private') as write:
            with self.assertRaises(smtplib.SMTPAuthenticationError):
                relay.activate()
            write.assert_not_called()

    def test_success_preserves_auth_and_queue_without_restart(self):
        self.exercise(False)

    def test_failed_recreation_restores_previous_inputs_and_secret(self):
        self.exercise(True)

    def exercise(self, fail):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            secret = root / 'secrets' / 'resend-smtp-token'
            secret.parent.mkdir()
            secret.write_bytes(b'previous-secret')
            files = [root / 'compose.production.json', root / 'compose.mail.json']
            config = {'services': {'auth': {'environment': {'GOTRUE_SMTP_HOST': 'postfix'}}, 'postfix': {'environment': {}, 'volumes': ['queue:/var/spool/postfix']}}}
            original = json.dumps(config).encode()
            for file in files:
                file.write_bytes(original)
            (root / '.env').write_text('EXAMPLE=preserved\n')
            commands = []

            def run(*args):
                commands.append(args)
                if fail and len(commands) == 2:
                    raise RuntimeError('Simulated recreation failure')
                return b''

            stdin = MagicMock(buffer=io.BytesIO(b're_' + b'x' * 32))
            # All filesystem paths, including the backup root, stay in the fixture.
            real_path = Path
            def fixture_path(value):
                if value == '/var/backups/finfolk-supabase':
                    return root / 'backups'
                return real_path(value)

            with patch.object(relay, 'RELEASE', root), patch.object(relay, 'FILES', files), patch.object(relay, 'SECRET', secret), patch.object(relay, 'Path', side_effect=fixture_path), patch.object(relay.sys, 'stdin', stdin), patch.object(relay.smtplib, 'SMTP_SSL'), patch.object(relay, 'run', side_effect=run), contextlib.redirect_stdout(io.StringIO()):
                if fail:
                    with self.assertRaises(RuntimeError):
                        relay.activate()
                    self.assertEqual(secret.read_bytes(), b'previous-secret')
                    for file in files:
                        self.assertEqual(file.read_bytes(), original)
                else:
                    relay.activate()
                    for file in files:
                        updated = json.loads(file.read_bytes())
                        self.assertEqual(updated['services']['auth'], config['services']['auth'])
                        self.assertEqual(updated['services']['postfix']['volumes'], config['services']['postfix']['volumes'])
                        self.assertNotIn('RELAYHOST_PASSWORD', updated['services']['postfix']['environment'])
                    self.assertEqual(secret.stat().st_mode & 0o777, 0o600)
                for command in commands:
                    if 'up' in command:
                        self.assertEqual(command[-4:], ('up', '-d', '--no-deps', 'postfix'))


if __name__ == '__main__':
    unittest.main()
