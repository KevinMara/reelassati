"""Build editable compositor scenes from decoded point-text layers."""
import copy
import gzip
import itertools
import json
import re
from functools import cache
from pathlib import Path
from PIL import ImageFont

ROOT = Path(__file__).resolve().parents[2]


@cache
def schema_seed():
    catalog = json.loads((ROOT / 'contracts/native-graphics-data.json').read_text(encoding='utf8'))
    template = next(t for t in catalog if t['name'] == 'Stacked outline')
    scene = json.loads(gzip.decompress((ROOT / 'public' / template['url'][1:]).read_bytes()))
    project = scene['project']
    comp = next(item for item in project['items'].values()
                if any(l['source']['type'] == 'Text' for l in item['kind'].get('layers', [])))
    layer = next(l for l in comp['kind']['layers'] if l['source']['type'] == 'Text')
    fill = next(node for item in project['items'].values()
                for current in item['kind'].get('layers', []) for node in nodes(current['props'])
                if node.get('match') == 'ec.generate.fill')
    return project, comp, layer, fill


def nodes(group):
    yield group
    for child in group.get('children', []):
        yield from nodes(child)


def make_scene(title, original_copy=False):
    proto_project, proto_comp, proto_layer, proto_fill = schema_seed()
    width, height = title['width'], title['height']
    duration = title['duration']
    ticks = round(duration * 254016000000)
    comp = copy.deepcopy(proto_comp)
    comp.update(id=1, parent=None, name='Poster', comment='')
    comp['kind'].update(width=width, height=height, duration=ticks, work_area=[0,ticks],
                        frame_rate={'num': 30000, 'den': 1001}, layers=[], markers=[])
    project = {**proto_project, 'items': {'1': comp}}
    ids = itertools.count(2)
    controls = []
    fonts = {f['postscript']: f for f in json.loads((ROOT / 'public/fonts/editor-fonts.json').read_text(encoding='utf8'))['faces']}
    aliases = json.loads((ROOT / 'contracts/native-font-substitutions.json').read_text(encoding='utf8'))
    used = {}
    rectangles = []
    order = {}
    # These Premiere graphics store each text layer in sequence coordinates.
    for index, component in enumerate(title['components'][:-1]):
        values = component['values']
        if component['kind'] == 'AE.ADBE Shape':
            rectangles.append((index, values))
            continue
        runs = values['Source Text']['runs']
        if not runs:
            continue
        if len(runs) != 1:
            raise ValueError('Rich text needs separate style runs')
        run = runs[0]
        font = fonts.get(run['font']) or fonts.get(aliases.get(run['font']))
        if not font or run['size'] is None:
            raise ValueError('Missing source font or explicit point size')
        used[font['sha256']] = {k:font[k] for k in ('url','sha256')}
        text = run['text'].replace('\r','\n')
        if not original_copy:
            text = re.sub(r'\bFour(?:\s+Editors)?\b', 'STUDIO' if text.isupper() else 'Studio', text, flags=re.I).strip()
        layer = copy.deepcopy(proto_layer)
        layer.update(id=next(ids), name='Title layer', in_point=0, start_time=0, out_point=ticks)
        properties = layer['props']
        properties['name'] = 'Title layer'
        for p in nodes(properties):
            p['uid'] = next(ids)
            p.pop('keys', None)
            p.pop('expr', None)
            if p.get('match') in ('effects','animators','masks'):
                p['children'] = []
        props = {p['match']:p for p in nodes(properties)}
        x, y = values['Position']
        ax, ay = values['Anchor Point']
        uniform = values.get('param5', True)
        sx = values['Scale'] if uniform else values['Horizontal Scale']
        justify = values['Source Text']['justify']
        original_text = run['text']
        trailing = original_text[len(original_text.rstrip(' ')):]
        # Premiere counts trailing spaces in aligned point text. The runtime
        # aligns the ink run after discarding those spaces.
        if trailing and justify:
            face = ImageFont.truetype(str(ROOT / 'public' / font['url'][1:]), 1000)
            ax += face.getlength(trailing) * run['size'] / 1000 / width * (0.5 if justify == 2 else 1)
        transforms = {'position':[x*width, y*height, 0], 'anchor':[ax*width, ay*height, 0],
                      'scale':[sx,values['Scale'],100], 'rotation':values['Rotation'], 'opacity':values['Opacity']}
        for key, value in transforms.items():
            props[key]['value']['v'] = value
        source = props['sourceText']
        rgba = lambda c: [v/255 for v in c] + [1]
        doc = source['value']['v']
        point_size = run['size']
        if not original_copy:
            # Retain the authored baselines while bringing small film credits
            # up to the editor's mobile readability threshold for this aspect.
            point_size = max(point_size, min(width, height) / 29.5 * 100 / values['Scale'])
        doc.update(text=text, font=font['postscript'], size=point_size, fill=rgba(run['fill'] or [255]*3),
                   stroke=rgba(run['stroke'] or [255]*3), stroke_width=run['strokeWidth'],
                   tracking=run['tracking'], apply_stroke=False, apply_fill=True, space_before=0,
                   faux_italic=run['italic'], all_caps=False, justify={0:'Left',1:'Right',2:'Center'}[justify],
                   leading=run['size'] * 1.2 + values['Source Text']['lineSpacing'])
        if (run['font'], font['postscript']) == ('LaoMN-Bold', 'Roboto-Bold'):
            # Match the width, cap height and italic credit lines in the source poster.
            doc.update(h_scale=109, v_scale=91.5 if original_text.strip().isupper() else 94.5,
                       kerning='Metrics', ligatures=True)
        credit = original_text.isupper()
        if run['font'] == 'AwmUDemo':
            doc.update(kerning='Metrics', ligatures=True, h_scale=167, v_scale=147)
        if run['font'] == 'AwmUSlantDemo':
            doc.update(kerning='Metrics', ligatures=True, faux_italic=True, small_caps=True,
                       h_scale=148.5 if credit else 135.3, v_scale=110 if credit else 115.5)
        if run['font'] in ('AwmUDemo', 'AwmUSlantDemo'):
            # Match the ink baseline and side bearing of the missing faces across canvas sizes.
            dx, dy = ((-0.103, 0.176) if run['font'] == 'AwmUDemo' else
                      (0, 0.087) if credit else (0.013, 0.136))
            props['position']['value']['v'][0] += dx * run['size'] * sx / 100
            props['position']['value']['v'][1] += dy * run['size'] * values['Scale'] / 100
        if run['font'] == 'Brushwell':
            # Premiere uses the unadorned word endings. Enabling contextual alternates
            # adds a swash after each word and pushes the next word out of position.
            doc.update(opentype={**doc.get('opentype', {}), 'contextual_alternates': False})
        if run['font'] == 'RobotoSlab-Bold':
            # The pinned font revision has slightly wider advances than the source artwork.
            doc.update(kerning='Metrics', ligatures=True, h_scale=98.3)
        comp['kind']['layers'].append(layer)
        order[layer['id']] = index
        controls.append({'key':f'text-{len(controls)+1}', 'type':'text', 'comp':1, 'layer':layer['id'],
                         'property':source['uid'], 'default':text, 'font':doc['font'],
                         'allCaps':False, 'fontSize':doc['size'] * values['Scale'] * doc.get('v_scale', 100) / 10000,
                         'height':values['Scale'] * doc['size'], 'label':'Copy'})
        if run['applyStroke']:
            # The runtime fill effect recolors every opaque pixel on a layer.
            # Give Premiere's outline a linked text layer and its own color.
            outline = copy.deepcopy(layer)
            outline.update(id=next(ids), name='Letter outline')
            for p in nodes(outline['props']):
                p['uid'] = next(ids)
            outline_source = next(p for p in nodes(outline['props']) if p['match'] == 'sourceText')
            outline_doc = outline_source['value']['v']
            outline_doc.update(apply_fill=False, apply_stroke=True)
            # Premiere outlines the union of touching glyphs. Cover internal
            # stroke edges with the intact face in front of the outline.
            comp['kind']['layers'].append(outline)
            order[outline['id']] = index
            controls.append({**controls[-1], 'layer':outline['id'],
                             'property':outline_source['uid']})
    slots = {}
    layer_names = {layer['id']:layer['name'] for layer in comp['kind']['layers']}
    for control in sorted(controls, key=lambda c: (-c['height'], layer_names[c['layer']] == 'Letter outline')):
        # An offset duplicate is the shadow of the same title. Editing either
        # line must replace both runs, including when a saved project reopens.
        signature = (control['default'], control['font'], control['fontSize'])
        if signature in slots:
            control['key'], i = slots[signature]
            control['linkedCopy'] = True
        else:
            i = len(slots)
            slots[signature] = control['key'], i
        control['textSlot'] = i
        control['label'] = ['Headline','Supporting line'][i] if i < 2 else f'Credit {i-1}'
        control['displayLabel'] = control['label']
        del control['height']
    # Every editable fill is an actual runtime effect property. The extruded
    # headline retains an independently editable shadow color.
    palettes = {}
    for control, layer in zip(controls.copy(), comp['kind']['layers']):
        props = {p['match']:p for p in nodes(layer['props'])}
        fill = copy.deepcopy(proto_fill)
        for p in nodes(fill):
            p['uid'] = next(ids)
            p.pop('expr', None)
            p.pop('keys', None)
        color = next(p for p in fill['children'] if p['match'] == 'color')
        doc = props['sourceText']['value']['v']
        rgb = doc['fill' if doc['apply_fill'] else 'stroke']
        color['value']['v'] = rgb
        props['effects']['children'].append(fill)
        value = '#' + ''.join(f'{round(n * 255):02X}' for n in rgb[:3])
        palettes.setdefault(value, []).append((control, layer, color))
    for index, values in rectangles:
        left, top, rect_width, rect_height = values['Path']
        if not rect_width.is_integer() or not rect_height.is_integer() or not controls:
            raise ValueError('Unsupported rectangle dimensions or missing title')
        solid_id = next(ids)
        fill_rgb = values['Appearance']
        project['items'][str(solid_id)] = {
            'id': solid_id, 'name': 'Title rule', 'parent': None, 'label': 'None', 'comment': '',
            'kind': {'type': 'Solid', 'width': int(rect_width), 'height': int(rect_height),
                     'color': [n / 255 for n in fill_rgb], 'pixel_aspect': 1},
        }
        # Start with a clean title transform and editable fill, discard the text group.
        layer = copy.deepcopy(comp['kind']['layers'][0])
        layer.update(id=next(ids), name='Title rule', source={'type': 'Solid', 'item': solid_id})
        layer['props']['children'] = [p for p in layer['props']['children'] if p['match'] != 'text']
        props = {}
        for p in nodes(layer['props']):
            p['uid'] = next(ids)
            props[p.get('match')] = p
        x, y = values['Position']
        ax, ay = values['Anchor Point']
        # The path vertices live in Premiere layer space. Keep its original
        # anchor so non-uniform scale and rotation also move the rule correctly.
        transforms = {'position': [width*x, height*y, 0], 'anchor': [width*ax-left, height*ay-top, 0],
                      'scale': [values['Horizontal Scale'], values['Scale'], 100],
                      'rotation': values['Rotation'], 'opacity': values['Opacity']}
        for key, value in transforms.items():
            props[key]['value']['v'] = value
        color = next(p for p in props['ec.generate.fill']['children'] if p['match'] == 'color')
        color['value']['v'] = [n/255 for n in fill_rgb] + [1]
        value = '#' + ''.join(f'{v:02X}' for v in fill_rgb)
        palettes.setdefault(value, []).append(({'textSlot': len(slots)}, layer, color))
        comp['kind']['layers'].append(layer)
        order[layer['id']] = index
    comp['kind']['layers'].sort(key=lambda layer: order[layer['id']])
    # First expose the face color of the headline, followed by its shadow or
    # the supporting lettering. Shared colors update every matching layer.
    ordered = sorted(palettes.items(), key=lambda kv:min(
        (c['textSlot'], layer['name'] == 'Letter outline') for c,layer,_ in kv[1]))
    for slot, (value, bindings) in enumerate(ordered):
        for control, layer, color in bindings:
            controls.append({'type':'color','key':f'palette-{slot}', 'colorSlot':slot,
                             'label':['Lettering','Accent','Credits'][min(slot,2)],
                             'displayLabel':['Lettering','Accent','Credits'][min(slot,2)],
                             'comp':1,'layer':layer['id'],'property':color['uid'],'default':value})
    project['next_id'] = next(ids)
    return {'project':project,'main':1}, list(used.values()), controls
