"""Inventory purchased native documents without executing templates or expressions.

Usage: python scripts/audit-native-packages.py --source DIR --output FILE
Only metadata and native documents are read. Media stays in its original archive.
Nested containers are bounded; every uninspected entry is reported explicitly.
"""
from pathlib import Path, PurePosixPath
from collections import Counter
import argparse, hashlib, io, json, re, zipfile, gzip
import xml.etree.ElementTree as ET

NATIVE = {'.setting', '.mogrt', '.moti', '.motr', '.moef', '.motn', '.aep', '.aepx', '.prproj', '.prgraphic', '.prfpset', '.drp'}
CONTAINER = {'.zip', '.drfx', '.mogrt', '.aegraphic', '.prgraphic', '.drp'}
FONT = {'.ttf', '.otf', '.woff', '.woff2', '.ttc'}
MAX_ENTRY = 256 * 1024 * 1024

def digest(data):
    return hashlib.sha256(data).hexdigest()

def xml_document(data):
    if data[:2] == b'\x1f\x8b':
        with gzip.GzipFile(fileobj=io.BytesIO(data)) as f:
            data = f.read(MAX_ENTRY + 1)
        if len(data) > MAX_ENTRY:
            raise ValueError('Expanded XML exceeds inspection limit')
    if re.search(br'<!ENTITY\s', data, re.I):
        raise ValueError('XML entity declarations are not accepted')
    return ET.fromstring(data)

def inventory(source):
    result = {'schema': 'reel-native-inventory-v1', 'documents': [], 'fontFiles': [], 'fontLists': [], 'uninspected': [], 'archives': []}
    def walk(z, origin, depth=0):
        for entry in z.infolist():
            path = PurePosixPath(entry.filename)
            if entry.is_dir() or '__MACOSX' in path.parts or path.name.startswith('._'):
                continue
            ext = path.suffix.lower().strip()
            full = origin + '!/' + entry.filename
            if ext not in NATIVE | CONTAINER | FONT and not (ext == '.txt' and 'font' in entry.filename.lower()):
                continue
            if entry.file_size > MAX_ENTRY or depth > 8:
                result['uninspected'].append({'path': full, 'reason': 'Inspection size/depth limit', 'bytes': entry.file_size})
                continue
            data = z.read(entry)
            row = {'path': full, 'sha256': digest(data), 'bytes': len(data), 'format': ext.lstrip('.')}
            if ext in FONT:
                result['fontFiles'].append(row)
            elif ext == '.txt':
                row['text'] = data.decode('utf-8-sig', errors='replace')
                result['fontLists'].append(row)
            if ext in NATIVE:
                row['conversion'] = 'not-admitted'
                try:
                    if ext == '.mogrt':
                        with zipfile.ZipFile(io.BytesIO(data)) as m:
                            definition = json.loads(m.read('definition.json'))
                            row['authorApp'] = definition.get('authorApp')
                            row['controls'] = definition.get('clientControls', [])
                            row['fonts'] = sorted(set(re.findall(r'"fontEditValue"\s*:\s*"([^"\n]+)"', json.dumps(definition))))
                            row['declaredFonts'] = definition.get('usedFontsLocalized', {})
                            row['declaredEffects'] = definition.get('usedEffects', [])
                            row['dependencies'] = [n for n in m.namelist() if n.endswith(('.aegraphic', '.aep', '.prgraphic'))]
                            row['previews'] = [n for n in m.namelist() if n.endswith(('.mp4', '.mov'))]
                    elif ext in {'.moti', '.motr', '.motn', '.moef', '.aepx', '.prproj', '.prfpset'}:
                        root = xml_document(data)
                        row['root'] = root.tag
                        row['operations'] = sorted(set(x.text for x in root.findall('.//factory/description') if x.text))
                        row['fonts'] = sorted(set(x.text for x in root.iter() if 'font' in x.tag.lower() and x.text and x.text.strip() and len(x.text) < 200))
                        row['expressions'] = sum(1 for x in root.iter() if 'expression' in x.tag.lower())
                        row['externalPaths'] = sorted(set(x.text for x in root.iter() if x.text and len(x.text) < 2000 and (x.text.startswith(('file:', '/Users/', '/Library/', 'C:', 'D:')))))
                    elif ext == '.setting':
                        text = data.decode('utf-8-sig')
                        row['operations'] = sorted(set(re.findall(r'=\s*([A-Za-z_][\w.]*)\s*\{', text)))
                        row['fonts'] = sorted(set(re.findall(r'Font\s*=\s*Input\s*\{\s*Value\s*=\s*"([^"]+)"', text)))
                        row['expressions'] = len(re.findall(r'\bExpression\s*=', text))
                    elif ext == '.aep':
                        row['container'] = data[:4].decode('ascii', errors='replace')
                        row['reason'] = 'After Effects binary project; editable controls are not its animation program'
                    elif ext == '.prgraphic':
                        row['signatureHex'] = data[:16].hex()
                        row['reason'] = 'Premiere graphic payload requires source-program decoding and render validation'
                except (ValueError, KeyError, ET.ParseError, zipfile.BadZipFile) as error:
                    row['inspectionError'] = str(error)
                    result['uninspected'].append({'path': full, 'reason': str(error)})
                result['documents'].append(row)
            if ext in CONTAINER:
                if zipfile.is_zipfile(io.BytesIO(data)):
                    with zipfile.ZipFile(io.BytesIO(data)) as nested:
                        walk(nested, full, depth + 1)
                else:
                    result['uninspected'].append({'path': full, 'reason': 'Container is not a ZIP archive'})

    for archive in sorted(source.iterdir()):
        if archive.suffix.lower() not in {'.zip', '.drfx'}:
            continue
        with zipfile.ZipFile(archive) as z:
            result['archives'].append({'name': archive.name, 'entries': len(z.infolist()), 'bytes': archive.stat().st_size})
            walk(z, archive.name)
    result['summary'] = {'formats': dict(Counter(d['format'] for d in result['documents'])), 'fontFiles': len(result['fontFiles']), 'uniqueDocuments': len(set(d['sha256'] for d in result['documents'])), 'uninspected': len(result['uninspected'])}
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = inventory(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result['summary']))
