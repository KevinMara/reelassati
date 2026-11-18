"""Repackage a legacy static face without changing outlines or advances.

Some old fonts are accepted by FreeType but rejected by browser font decoders.
Rebuild only an explicitly selected face. Compare every glyph and Unicode map
before replacing it, and retain the original byte hash in the source manifest.
"""
import argparse, hashlib, io, json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.recordingPen import RecordingPen

ROOT = Path(__file__).resolve().parents[1]

def outlines(font):
    glyphs = font.getGlyphSet()
    result = {}
    for name in font.getGlyphOrder():
        pen = RecordingPen()
        glyphs[name].draw(pen)
        # TTGlyphPen removes a redundant final line to the start point.
        # closePath draws that exact segment, so canonicalize this equivalent
        # representation before comparing every original contour.
        commands, start = [], None
        for op, points in pen.value:
            if op == 'moveTo': start = points
            # Type2 encoding combines adjacent collinear line segments. Their
            # union is identical; retain reversals and every non-collinear point.
            if op == 'lineTo' and len(commands) >= 2 and commands[-1][0] == 'lineTo':
                previous = commands[-2][1][-1]
                middle, end = commands[-1][1][-1], points[-1]
                u = (middle[0]-previous[0], middle[1]-previous[1])
                v = (end[0]-middle[0], end[1]-middle[1])
                if u[0]*v[1] == u[1]*v[0] and u[0]*v[0]+u[1]*v[1] >= 0:
                    commands.pop()
            if op == 'closePath' and commands and commands[-1] == ('lineTo', start):
                commands.pop()
            commands.append((op, points))
        result[name] = commands
    return result

def repair(face_id):
    manifest_path = ROOT/'public/fonts/editor-fonts.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    face = next(f for f in manifest['faces'] if f['id'] == face_id)
    path = ROOT/('public'+face['url'])
    original = path.read_bytes()
    if hashlib.sha256(original).hexdigest() != face['sha256']:
        raise ValueError('Font bytes differ from manifest')
    f = TTFont(io.BytesIO(original))
    if 'fvar' in f or not ('glyf' in f or 'CFF ' in f):
        raise ValueError('Only static TrueType and CFF faces are supported')
    truetype = 'glyf' in f
    if truetype and any(f['glyf'][name].isComposite() for name in f.getGlyphOrder()):
        raise ValueError('Composite outlines require a separate parity check')
    b = FontBuilder(f['head'].unitsPerEm, isTTF=truetype)
    b.setupGlyphOrder(f.getGlyphOrder())
    b.setupCharacterMap(f.getBestCmap())
    glyph_set, glyphs = f.getGlyphSet(), {}
    for name in f.getGlyphOrder():
        pen = TTGlyphPen(glyph_set) if truetype else T2CharStringPen(
            f['hmtx'][name][0], glyph_set, roundTolerance=0)
        glyph_set[name].draw(pen)
        glyphs[name] = pen.glyph() if truetype else pen.getCharString(optimize=False)
    if truetype:
        b.setupGlyf(glyphs)
    else:
        b.setupCFF(f['name'].getDebugName(6), {
            'FullName': f['name'].getDebugName(4),
            'FamilyName': f['name'].getDebugName(1),
            'Notice': f['name'].getDebugName(0) or '',
        }, glyphs, {})
    b.setupHorizontalMetrics(f['hmtx'].metrics)
    h, o = f['hhea'], f['OS/2']
    b.setupHorizontalHeader(ascent=h.ascent, descent=h.descent, lineGap=h.lineGap)
    # Retain names, authorship and license strings; no font style is renamed.
    b.setupNameTable({i:f['name'].getDebugName(i) for i in range(26)
                      if f['name'].getDebugName(i)})
    b.setupOS2(sTypoAscender=o.sTypoAscender, sTypoDescender=o.sTypoDescender,
               sTypoLineGap=o.sTypoLineGap, usWinAscent=o.usWinAscent,
               usWinDescent=o.usWinDescent, usWeightClass=o.usWeightClass,
               fsType=o.fsType, fsSelection=o.fsSelection)
    b.setupPost(italicAngle=f['post'].italicAngle,
                underlinePosition=f['post'].underlinePosition,
                underlineThickness=f['post'].underlineThickness)
    # Reel explicitly disables kerning in both renderers. Preserve the table
    # anyway so this normalization does not silently discard author data.
    for table in ('kern', 'GPOS', 'GSUB'):
        if table in f: b.font[table] = f[table]
    buf = io.BytesIO()
    b.save(buf)
    rebuilt = buf.getvalue()
    check = TTFont(io.BytesIO(rebuilt))
    if (outlines(f) != outlines(check) or f.getBestCmap() != check.getBestCmap()
            or f['hmtx'].metrics != check['hmtx'].metrics):
        raise ValueError('Font reconstruction changed glyphs or advances')
    face['originalSha256'] = face.get('originalSha256', face['sha256'])
    face['sha256'] = hashlib.sha256(rebuilt).hexdigest()
    face['normalization'] = 'legacy-static-reencoding; all outline geometry, advances and Unicode mappings verified unchanged; legacy glyph hints removed'
    path.write_bytes(rebuilt)
    manifest_path.write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf8')
    (ROOT/'contracts/editor-font-data.json').write_text(json.dumps(manifest['faces'], indent=2)+'\n', encoding='utf8')
    print(json.dumps({'face':face_id, 'glyphsVerified':len(check.getGlyphOrder()),
                      'sha256':face['sha256']}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('face_id')
    repair(parser.parse_args().face_id)
