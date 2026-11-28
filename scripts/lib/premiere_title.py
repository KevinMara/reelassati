"""Read point-text layers from Premiere-authored motion graphics packages."""
import base64
import gzip
import hashlib
import io
import json
import struct
import xml.etree.ElementTree as ET
import zipfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


def text_document(data):
    """Decode Premiere's 0x11223344 point-text envelope and per-run styles."""
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
        return [data[channels[i]] if i in channels else 0 for i in range(3)]

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
        if kind != 'AE.ADBE Text' and name != 'Clip':
            raise ValueError(f"Requires effect {kind or name}")
        values = {}
        for index, param in enumerate(component.findall('./Component/Params/Param')):
            node = objects[param.get('ObjectRef')]
            if node.findtext('.//IsTimeVarying') == 'true' or node.findtext('.//Keyframes'):
                raise ValueError("Animated parameter requires a time sampler")
            key = node.findtext('Name') or f'param{index}'
            if key == 'Source Text':
                value = node.find('.//StartKeyframeValue')
                values[key] = text_document(base64.b64decode(value.text or blobs[value.get('BinaryHash')]))
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

