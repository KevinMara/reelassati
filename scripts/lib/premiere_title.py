"""Read point-text layers from Premiere-authored motion graphics packages."""
import base64
import gzip
import hashlib
import io
import json
import struct
import xml.etree.ElementTree as ET
import zipfile


def legacy_json(data):
    if len(data) < 10 or int.from_bytes(data[:8], 'little') != len(data) - 8:
        raise ValueError("Invalid legacy graphics payload length")
    document = json.loads(data[8:].decode('utf-16le'))
    if document.get('mVersion') != 1:
        raise ValueError("Unknown legacy graphics version")
    return document


def legacy_color(value):
    if type(value) is not int or not 0 <= value <= 0xffffff:
        raise ValueError("Invalid Premiere RGB value")
    return [(value >> shift) & 255 for shift in (16, 8, 0)]


def legacy_text_document(data):
    para = legacy_json(data)['mTextParam']
    if any(para.get(k) for k in ('mShadowVisible', 'mBackFillVisible', 'mIsMask',
                                 'mIsVerticalText', 'mRTL', 'mWidth', 'mHeight')):
        raise ValueError("Legacy text needs additional layout or paint")
    style = para['mStyleSheet']
    text = style['mText'].encode('utf-16le')
    length = len(text) // 2
    # Indices address UTF-16 code units. A terminal insertion style belongs
    # to the typing caret and can even reference a missing font.
    changes = {}
    for key, field in style.items():
        if not isinstance(field, dict) or 'mParamValues' not in field:
            if key.startswith('mAdditionalStroke') and field:
                raise ValueError("Multiple Premiere text strokes")
            continue
        previous = -1
        for index, value in field['mParamValues']:
            if type(index) is not int or not previous < index <= length:
                raise ValueError("Invalid Premiere style range")
            previous = index
            if index < length:
                changes.setdefault(index, {})[key] = value
    active, runs = {}, []
    offsets = sorted({0, length, *changes})
    for start, end in zip(offsets, offsets[1:]):
        active.update(changes.get(start, {}))
        if any(active.get(k) for k in ('mFauxBold', 'mBaselineShift', 'mBaselineOption',
                                      'mCapsOption', 'mKerning', 'mUnderline', 'mTsumi')):
            raise ValueError("Legacy text needs additional shaping")
        run = dict(font=active['mFontName'], size=active['mFontSize'],
                   fill=legacy_color(active['mFillColor']), applyFill=active['mFillVisible'],
                   stroke=legacy_color(active['mStrokeColor']), applyStroke=active['mStrokeVisible'],
                   strokeWidth=active['mStrokeWidth'], tracking=active['mTracking'],
                   italic=active['mFauxItalic'])
        if run['applyStroke'] and not active.get('mFillOverStroke', True):
            raise ValueError("Unsupported Premiere paint order")
        piece = text[2*start:2*end].decode('utf-16le')
        if runs and all(runs[-1][k] == v for k, v in run.items()):
            runs[-1]['text'] += piece
        else:
            runs.append({**run, 'text': piece})
    return dict(runs=runs, justify=para['mAlignment'], lineSpacing=para['mLeading'])


def digest(data):
    return hashlib.sha256(data).hexdigest()


def rectangle_path(data):
    """Premiere v2 closed path with four straight, axis-aligned segments."""
    if len(data) != 121 or struct.unpack_from('<II', data) != (2, 4) or data[-1] != 1:
        raise ValueError('Shape requires a vector path renderer')
    points = []
    for offset in range(8, 120, 28):
        flag, x, y, lx, ly, rx, ry = struct.unpack_from('<I6f', data, offset)
        if flag or (lx, ly) != (x, y) or (rx, ry) != (x, y):
            raise ValueError('Shape has curved edges')
        points.append((x, y))
    xs, ys = sorted({p[0] for p in points}), sorted({p[1] for p in points})
    if (len(xs), len(ys)) != (2, 2) or len(set(points)) != 4 or any(
        a[0] != b[0] and a[1] != b[1] for a, b in zip(points, points[1:] + points[:1])
    ):
        raise ValueError('Shape is not a rectangle')
    return [xs[0], ys[0], xs[1] - xs[0], ys[1] - ys[0]]


def solid_appearance(data):
    if data[8:10] == b'{\x00':
        style = legacy_json(data)['mStyle']
        if (style.get('mIsMask') or style.get('mShadowVisible') or style.get('mStrokeVisible')
                or style.get('mAdditionalStrokes') or not style['mFillVisible']
                or style['mFillColorType'] != 0):
            raise ValueError("Unsupported legacy Premiere shape paint")
        return legacy_color(style['mFillColor'])
    # This appearance profile has a single flat fill and inactive stroke and
    # gradient settings. A changed paint mode needs its own interpretation.
    layout = bytearray(data)
    rgb = layout[403:406]
    layout[403:406] = bytes(3)
    if digest(layout) != 'af87524018c6573ed7da247a41add790cf4432f416b74cd829c518d010b70ecc':
        raise ValueError('Unsupported Premiere shape paint')
    return list(rgb)


def text_document(data):
    """Decode Premiere's 0x11223344 point-text envelope and per-run styles."""
    if data[8:10] == b'{\x00':
        return legacy_text_document(data)
    if data[8:12] != b'\x44\x33\x22\x11' or int.from_bytes(data[:8], 'little') != len(data) - 12:
        raise ValueError("Unsupported Premiere text encoding")

    def unpack(fmt, pos):
        if pos < 0 or pos + struct.calcsize(fmt) > len(data):
            raise ValueError("Invalid text offset")
        return struct.unpack_from(fmt, data, pos)[0]

    def pointer(pos):
        distance = unpack('<I', pos)
        if distance < 4 or pos + distance >= len(data):
            raise ValueError("Invalid text pointer")
        return pos + distance

    def table(pos):
        base = pos - unpack('<i', pos)
        length = unpack('<H', base)
        size = unpack('<H', base + 2)
        if length < 4 or length % 2 or base + length > len(data) or pos + size > len(data):
            raise ValueError("Invalid text table")
        fields = {}
        for index in range((length - 4) // 2):
            offset = unpack('<H', base + 4 + 2 * index)
            if offset:
                if offset < 4 or offset >= size:
                    raise ValueError("Invalid text field")
                fields[index] = pos + offset
        return fields

    def vector(field):
        pos = pointer(field)
        count = unpack('<I', pos)
        if count > (len(data) - pos - 4) // 4:
            raise ValueError("Invalid text vector")
        return [pointer(pos + 4 + 4 * i) for i in range(count)]

    def string(pos):
        count = unpack('<I', pos)
        if pos + count + 4 >= len(data) or data[pos + count + 4]:
            raise ValueError("Invalid text string")
        return data[pos + 4:pos + 4 + count].decode('utf-8')

    def color(field):
        channels = table(pointer(field))
        # Premiere omits channels at their default of 255. Explicit zeroes
        # are present in the table, including all three channels for black.
        return [data[channels[i]] if i in channels else 255 for i in range(3)]

    paragraph = table(pointer(table(pointer(12))[0]))
    fonts = [string(pos) for pos in vector(paragraph[1])]
    runs = []
    for pos in vector(paragraph[0]) if 0 in paragraph else []:
        run = table(pos)
        style = table(pointer(run[1])) if 1 in run else {}
        runs.append({
            'text': string(pointer(run[0])) if 0 in run else '',
            'font': fonts[unpack('<I', style[0])] if 0 in style else fonts[0],
            'size': unpack('<f', style[1]) if 1 in style else 100,
            'fill': color(style[2]) if 2 in style else None,
            'applyFill': bool(data[style[3]]) if 3 in style else True,
            'stroke': color(style[4]) if 4 in style else None,
            'applyStroke': bool(data[style[5]]) if 5 in style else False,
            'strokeWidth': unpack('<f', style[6]) if 6 in style else 1,
            'tracking': unpack('<f', style[8]) if 8 in style else 0,
            'italic': bool(unpack('<B', style[15])) if 15 in style else False,
            'fields': sorted(style),
        })
    return {'runs': runs, 'justify': unpack('<B', paragraph[4]) if 4 in paragraph else 0,
            'lineSpacing': unpack('<f', paragraph[6]) if 6 in paragraph else 0}


def read_title(package):
    """Follow the package's actual project, object references and shared blobs."""
    with zipfile.ZipFile(io.BytesIO(package)) as archive:
        definition = json.loads(archive.read('definition.json'))
        if definition.get('authorApp') != 'ppro':
            raise ValueError("Requires a Premiere-authored template")
        graphic = archive.read('project.prgraphic')
    with zipfile.ZipFile(io.BytesIO(graphic)) as archive:
        paths = [n for n in archive.namelist() if n.lower().endswith('.prproj')]
        if len(paths) != 1:
            raise ValueError("Expected one embedded project")
        project = archive.read(paths[0])
    xml = ET.fromstring(gzip.decompress(project))
    objects = {e.get('ObjectID'): e for e in xml if e.get('ObjectID')}
    blobs = {e.get('BinaryHash'): e.text for e in xml.iter()
             if e.get('Encoding') == 'base64' and (e.text or '').strip()}
    components = []
    for ref in xml.findall('./VideoComponentChain/ComponentChain/Components/Component'):
        component = objects[ref.get('ObjectRef')]
        name = component.findtext('./Component/DisplayName')
        kind = component.findtext('MatchName')
        if kind not in ('AE.ADBE Text', 'AE.ADBE Shape') and name != 'Clip':
            raise ValueError(f"Requires effect {kind or name}")
        values = {}
        for index, param in enumerate(component.findall('./Component/Params/Param')):
            node = objects[param.get('ObjectRef')]
            if node.findtext('.//IsTimeVarying') == 'true' or node.findtext('.//Keyframes'):
                raise ValueError("Animated parameter requires a time sampler")
            # Both uniform-scale and pinning can have the display name " ".
            # Preserve their independent values under their parameter slots.
            key = (node.findtext('Name') or '').strip() or f'param{index}'
            if key in ('Source Text', 'Path', 'Appearance'):
                value = node.find('.//StartKeyframeValue')
                payload = base64.b64decode(value.text or blobs[value.get('BinaryHash')])
                values[key] = {'Source Text': text_document, 'Path': rectangle_path,
                               'Appearance': solid_appearance}[key](payload)
            else:
                value = node.findtext('.//StartKeyframe')
                if value:
                    raw = value.split(',')[1]
                    values[key] = (raw == 'true' if raw in ('true','false') else
                                   [float(n) for n in raw.split(':')] if ':' in raw else float(raw))
        components.append({'kind': kind or name, 'values': values})
    track = xml.findall('VideoClipTrackItem')
    if len(track) != 1 or not components or components[-1]['kind'] != 'Clip':
        raise ValueError("Expected a single title clip")
    bounds = track[0].findtext('.//FrameRect')
    start, end = (int(track[0].findtext('.//' + key)) for key in ('Start','End'))
    return {'name': definition['capsuleName'], 'source': digest(project),
            'graphic': digest(graphic), 'package': digest(package),
            'width': int(bounds.split(',')[2]), 'height': int(bounds.split(',')[3]),
            'duration': (end - start) / 254016000000, 'components': components}

