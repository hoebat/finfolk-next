"""Package the authored preview-group patch over the installed app.manage baseline.

Retains the baseline dependency graph and bundled frontend. Installs locally only.
"""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

parser = argparse.ArgumentParser()
parser.add_argument('--base-version', default='4.1.9-web-pipeline.8')
parser.add_argument('--version', default='4.1.9-preview-groups.1')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
repository = Path.home() / '.m2/repository/xyz/zcaudate/app.manage'
source = repository / args.base_version
output = repository / args.version
if source == output:
    raise SystemExit('Use a distinct version for the preview grouping patch')
patches = {name: (root / 'ref/foundation' / path).read_bytes() for name, path in {
    'app/manage/server.clj': 'src/app/manage/server.clj',
    'app/manage/ui.clj': 'src/app/manage/ui.clj',
    'assets/app.manage/manager.css': 'resources/assets/app.manage/manager.css',
}.items()}
pom = (source / f'app.manage-{args.base_version}.pom').read_text()
pom = pom.replace(f'<version>{args.base_version}</version>', f'<version>{args.version}</version>')
output.mkdir(parents=True, exist_ok=True)
with ZipFile(source / f'app.manage-{args.base_version}.jar') as original:
    with ZipFile(output / f'app.manage-{args.version}.jar', 'w', ZIP_DEFLATED) as package:
        for entry in original.infolist():
            if entry.filename not in patches:
                package.writestr(entry, original.read(entry.filename))
        for name, data in patches.items():
            package.writestr(name, data)
(output / f'app.manage-{args.version}.pom').write_text(pom)
print(f'Installed local app.manage {args.version}')
