"""Reject blank Unicode slots in imported legacy fonts before caption rendering."""
from pathlib import Path
import json
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parents[1]
path = ROOT/'contracts/editor-font-metrics.json'
metrics = json.loads(path.read_text(encoding='utf8'))
faces = json.loads((ROOT/'contracts/editor-font-data.json').read_text(encoding='utf8'))
report = []
for face in faces:
    if not face.get('sourceMember'): continue
    font = TTFont(ROOT/('public'+face['url']))
    glyphs, bounds = font.getGlyphSet(), {}
    unsupported = []
    for code, name in font.getBestCmap().items():
        if chr(code).isspace(): continue
        if name not in bounds:
            pen = BoundsPen(glyphs)
            glyphs[name].draw(pen)
            bounds[name] = pen.bounds
        if name == '.notdef' or bounds[name] is None:
            unsupported.append(chr(code))
    # The distributed Gypsy Curse demo maps several non-ASCII slots to an
    # author's badge, not the advertised letter/punctuation. The actual export
    # review confirmed ASCII lettering only. Do not present badges as captions.
    if face['id'] == 'gypsycurse':
        unsupported.extend(chr(code) for code in font.getBestCmap() if code > 126)
    metrics[face['id']]['unsupportedCharacters'] = ''.join(sorted(set(unsupported)))
    report.append({'id':face['id'], 'unsupported':len(set(unsupported))})
path.write_text(json.dumps(metrics, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf8')
print(json.dumps(report))
