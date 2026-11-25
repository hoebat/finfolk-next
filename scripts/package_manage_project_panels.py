"""Install the project-panel extension over the pinned local app.manage package.

Local Maven only. --build-frontend regenerates the DSL-authored optional workspace.
"""
import argparse
import subprocess
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

parser = argparse.ArgumentParser()
parser.add_argument('--base-version', default='4.1.9-web-pipeline.9')
parser.add_argument('--version', default='4.1.9-environment-flags.1')
parser.add_argument('--build-frontend', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
repository = Path.home() / '.m2/repository/xyz/zcaudate/app.manage'
source, output = repository / args.base_version, repository / args.version
if source == output:
    raise SystemExit('Use a distinct extension package version')
patches = {'app/manage/' + name + '.clj': (root / 'ref/foundation/src/app/manage' / (name + '.clj')).read_bytes()
           for name in ['server', 'ui', 'workspace', 'panels', 'environments']}
patches['assets/app.manage/environments/controller.mjs'] = (root / 'ref/foundation/resources/assets/app.manage/environments/controller.mjs').read_bytes()
pom = (source / f'app.manage-{args.base_version}.pom').read_text().replace(
    f'<version>{args.base_version}</version>', f'<version>{args.version}</version>')
output.mkdir(parents=True, exist_ok=True)

def package(frontend=None):
    with ZipFile(source / f'app.manage-{args.base_version}.jar') as original:
        contents = {e.filename: original.read(e.filename) for e in original.infolist()}
    # Retain the previously built workspace while replacing server sources.
    existing = output / f'app.manage-{args.version}.jar'
    if existing.exists():
        with ZipFile(existing) as previous:
            contents.update({e.filename: previous.read(e.filename) for e in previous.infolist()
                             if e.filename.startswith('assets/app.manage/next/')})
    contents.update(patches)
    if frontend:
        prefix = 'assets/app.manage/next/'
        contents = {k: v for k, v in contents.items() if not k.startswith(prefix) or k.startswith(prefix + 'monaco/') or k.startswith(prefix + 'licenses/')}
        contents.update({prefix + str(p.relative_to(frontend)): p.read_bytes() for p in frontend.rglob('*') if p.is_file()})
        names = sorted(k[len(prefix):] for k in contents if k.startswith(prefix))
        import json
        contents[prefix + 'manifest.edn'] = ('[' + ' '.join(json.dumps(p) for p in names) + ']\n').encode()
    temporary = output / f'app.manage-{args.version}.jar.tmp'
    with ZipFile(temporary, 'w', ZIP_DEFLATED) as archive:
        for name, content in contents.items():
            archive.writestr(name, content)
    temporary.replace(output / f'app.manage-{args.version}.jar')
    (output / f'app.manage-{args.version}.pom').write_text(pom)

package()
if args.build_frontend:
    directory = root / '.cache/app-manage-project-panels'
    subprocess.run(['lein', 'run', '-m', 'app.manage.frontend', str(directory)], cwd=root, check=True)
    subprocess.run(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=directory, check=True)
    subprocess.run(['npm', 'run', 'build'], cwd=directory, check=True)
    package(directory / 'out')
print(f'Installed local app.manage {args.version}')
