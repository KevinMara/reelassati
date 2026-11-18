"""Import explicitly selected, downloaded font data without installing it.

The input JSON lists archive, source URL and optional PostScript names. Original
bytes, license files and source checksums are preserved. Nothing is executed and
archive paths are never used as extraction destinations.
"""
from pathlib import Path
import argparse, hashlib, io, json, re, zipfile
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
def sha(data): return hashlib.sha256(data).hexdigest()
def slug(value): return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')
def names(font, key): return font['name'].getDebugName(key) or ''

def import_fonts(spec_path):
    manifest_path = ROOT/'public/fonts/editor-fonts.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    metrics_path = ROOT/'contracts/editor-font-metrics.json'
    metrics = json.loads(metrics_path.read_text(encoding='utf8'))
    dest = ROOT/'public/fonts/native'
    added = []
    for spec in json.loads(Path(spec_path).read_text(encoding='utf8')):
        archive = Path(spec['archive']).read_bytes()
        with zipfile.ZipFile(io.BytesIO(archive)) as z:
            # Prefer OpenType when a download supplies the same face twice.
            members = sorted(z.infolist(), key=lambda f: (Path(f.filename).suffix.lower() != '.otf', f.filename))
            seen = set()
            for member in members:
                ext = Path(member.filename).suffix.lower()
                if ext not in ('.otf', '.ttf') or '__MACOSX' in member.filename:
                    continue
                if member.file_size > 16*1024*1024:
                    raise ValueError('Font exceeds import size limit')
                data = z.read(member)
                font = TTFont(io.BytesIO(data), lazy=False)
                ps = names(font,6)
                if not ps or ps in seen: continue
                seen.add(ps)
                if spec.get('postscript') and ps not in spec['postscript']: continue
                face_id = slug(ps)
                existing = next((f for f in manifest['faces'] if f['id'] == face_id), None)
                if existing:
                    if sha(data) not in (existing['sha256'], existing.get('originalSha256')):
                        raise ValueError('Conflicting face: '+face_id)
                    continue
                if 'fvar' in font:
                    raise ValueError('Explicit static instancing required: '+ps)
                cmap = font.getBestCmap()
                if not cmap or 'OS/2' not in font: raise ValueError('Incomplete font: '+ps)
                output = dest/(face_id+ext)
                output.write_bytes(data)
                license_data = ['Source: '+spec['source'], 'Archive SHA256: '+sha(archive), 'Member: '+member.filename]
                for record in z.infolist():
                    if record.file_size < 1024*1024 and Path(record.filename).suffix.lower() in ('.txt','.md') and '__MACOSX' not in record.filename:
                        license_data.extend(['\n--- '+record.filename+' ---',z.read(record).decode('utf8',errors='replace')])
                for key in (0,13,14):
                    if names(font,key): license_data.append(names(font,key))
                license_path = dest/(face_id+'-source.txt')
                license_path.write_text('\n'.join(license_data)+'\n',encoding='utf8')
                units = font['head'].unitsPerEm
                os2 = font['OS/2']
                metrics[face_id] = {
                    'height':(os2.usWinAscent+os2.usWinDescent)/units,
                    'ascent':os2.usWinAscent/units,'descent':os2.usWinDescent/units,
                    'advances':{chr(c):round(font['hmtx'][g][0]/units,6) for c,g in cmap.items()},
                }
                manifest['faces'].append({
                    'id':face_id,'label':names(font,4) or ps,'family':names(font,1),
                    'postscript':ps,'weight':os2.usWeightClass,
                    'bold':bool(os2.fsSelection & 32),'italic':bool(os2.fsSelection & 1),
                    'url':'/fonts/native/'+output.name,'sha256':sha(data),
                    'source':spec['source'],'sourceSha256':sha(archive),
                    'sourceMember':member.filename,'license':'/fonts/native/'+license_path.name,
                })
                added.append(face_id)
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
    (ROOT/'contracts/editor-font-data.json').write_text(json.dumps(manifest['faces'],indent=2)+'\n',encoding='utf8')
    metrics_path.write_text(json.dumps(metrics,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    print(json.dumps({'added':added,'total':len(manifest['faces'])}))

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('spec')
    import_fonts(parser.parse_args().spec)
