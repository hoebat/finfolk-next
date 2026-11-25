import importlib.util
import json
import pathlib
import tempfile
import unittest
import yaml

spec = importlib.util.spec_from_file_location('prepare', pathlib.Path(__file__).with_name('prepare.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ProductionBundle(unittest.TestCase):
    def test_private_services_and_explicit_public_routes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            source = root / 'source'
            source.mkdir()
            upstream = {'services': {name: {
                'image': 'example:1', 'container_name': name,
                'ports': ['0.0.0.0:5432:5432'],
                'depends_on': {'db': {'condition': 'service_healthy'}, 'realtime': {'condition': 'service_started'}},
                'environment': {}, 'volumes': ['./volumes/db/data:/var/lib/postgresql/data:Z'],
            } for name in module.KEEP | {'storage', 'realtime', 'supavisor'}}}
            (source / 'docker-compose.yml').write_text(yaml.safe_dump(upstream))
            target = root / 'release'
            module.prepare(source, target)
            config = json.loads((target / 'compose.production.json').read_text())
            self.assertEqual(set(config['services']), module.KEEP | {'postfix'})
            for name, service in config['services'].items():
                self.assertNotIn('container_name', service)
                self.assertNotIn('realtime', service.get('depends_on', {}))
                if name != 'studio':
                    self.assertNotIn('ports', service)
            self.assertEqual(config['services']['studio']['ports'], ['127.0.0.1:55433:3000'])
            self.assertEqual(config['services']['auth']['environment']['GOTRUE_SMTP_PORT'], '587')
            self.assertEqual(config['services']['auth']['environment']['GOTRUE_SMTP_PASS'], '')
            for provider in ['GOOGLE', 'GITHUB']:
                auth = config['services']['auth']['environment']
                self.assertEqual(auth[f'GOTRUE_EXTERNAL_{provider}_ENABLED'], '${' + provider + '_ENABLED:-false}')
                self.assertEqual(auth[f'GOTRUE_EXTERNAL_{provider}_REDIRECT_URI'], 'https://supabase.finfolk.com.au/auth/v1/callback')
            self.assertEqual(config['services']['postfix']['environment']['POSTFIX_smtpd_tls_security_level'], 'none')
            self.assertEqual(config['services']['postfix']['environment']['POSTFIX_smtp_tls_security_level'], 'may')
            self.assertNotIn('RELAYHOST', config['services']['postfix']['environment'])
            self.assertEqual(config['services']['postfix']['environment']['DKIM_SELECTOR'], 'finfolk202611')
            self.assertIn('mail-queue', config['volumes'])
            self.assertIn('/srv/finfolk/postgres:', config['services']['db']['volumes'][0])
            rule = config['services']['api-gw']['labels']['traefik.http.routers.finfolk-supabase.rule']
            self.assertIn('PathPrefix(`/auth/v1/`)', rule)
            self.assertNotIn('PathPrefix(`/`)', rule)
            with self.assertRaises(SystemExit):
                module.prepare(source, target)

if __name__ == '__main__':
    unittest.main()
