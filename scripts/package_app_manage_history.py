"""Install the history extension from the pinned package plus committed source overlays.
No remote publication. The baseline package must already be installed locally.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import xml.etree.ElementTree as ET
root = Path(__file__).resolve().parents[1]
base_version = '4.1.8'
version = '4.1.9-history.1'
repository = Path.home() / '.m2/repository/xyz/zcaudate/app.manage'
base = repository / base_version
output = repository / version
output.mkdir(parents=True, exist_ok=True)
overlay = root / 'resources/build/app-manage'
sources = overlay / 'src'
replacements = {str(p.relative_to(sources)): p.read_bytes() for p in (sources / 'app/manage').rglob('*.clj')}
replacements['app/manage.clj'] = (sources / 'app/manage.clj').read_bytes()
replacements.update({str(p.relative_to(overlay / 'resources')): p.read_bytes()
                     for p in (overlay / 'resources').rglob('*') if p.is_file()})
with ZipFile(base / f'app.manage-{base_version}.jar') as original, ZipFile(output / f'app.manage-{version}.jar.tmp', 'w', ZIP_DEFLATED) as target:
    for item in original.infolist():
        if item.filename not in replacements and not item.filename.startswith('META-INF/maven/'):
            target.writestr(item, original.read(item.filename))
    for path, content in replacements.items():
        target.writestr(path, content)
(output / f'app.manage-{version}.jar.tmp').replace(output / f'app.manage-{version}.jar')
pom = ET.parse(base / f'app.manage-{base_version}.pom')
ns = {'m': 'http://maven.apache.org/POM/4.0.0'}
ET.register_namespace('', ns['m'])
pom.getroot().find('m:version', ns).text = version
deps = pom.getroot().find('m:dependencies', ns)
dep = ET.SubElement(deps, '{%s}dependency' % ns['m'])
for key, value in [('groupId', 'org.xerial'), ('artifactId', 'sqlite-jdbc'), ('version', '3.36.0.3')]:
    ET.SubElement(dep, '{%s}%s' % (ns['m'], key)).text = value
pom.write(output / f'app.manage-{version}.pom.tmp', encoding='utf-8', xml_declaration=True)
(output / f'app.manage-{version}.pom.tmp').replace(output / f'app.manage-{version}.pom')
print(f'Installed local app.manage {version}')
