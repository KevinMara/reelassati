"""Compile static Premiere point-text into the same editable project used for export."""
import argparse
import copy
import gzip
import itertools
import json
import re
import zipfile
from functools import cache
from pathlib import Path
from PIL import ImageFont

from lib.premiere_title import digest, read_title

ROOT = Path(__file__).resolve().parents[1]


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
    used = {}
    # These Premiere graphics store each text layer in sequence coordinates.
    for component in title['components'][:-1]:
        values = component['values']
        runs = values['Source Text']['runs']
        if not runs:
            continue
        if len(runs) != 1:
            raise ValueError('Rich text needs separate style runs')
        run = runs[0]
        font = fonts.get(run['font'])
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
        if height >= width and not original_copy:
            # Retain the authored baselines while bringing small film credits
            # up to the editor's mobile readability threshold (width / 30).
            point_size = max(point_size, width / 29.5 * 100 / values['Scale'])
        doc.update(text=text, font=run['font'], size=point_size, fill=rgba(run['fill'] or [255]*3),
                   stroke=rgba(run['stroke'] or [0]*3), stroke_width=run['strokeWidth'],
                   apply_stroke=5 in run['fields'], apply_fill=True, space_before=0,
                   all_caps=False, justify={0:'Left',1:'Right',2:'Center'}[justify],
                   leading=run['size'] * 1.2 + values['Source Text']['lineSpacing'])
        comp['kind']['layers'].append(layer)
        controls.append({'key':f'text-{len(controls)+1}', 'type':'text', 'comp':1, 'layer':layer['id'],
                         'property':source['uid'], 'default':text, 'font':doc['font'],
                         'allCaps':False, 'fontSize':doc['size'] * values['Scale'] / 100,
                         'height':values['Scale'] * doc['size'], 'label':'Copy'})
    slots = {}
    for control in sorted(controls, key=lambda c: -c['height']):
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
        rgb = props['sourceText']['value']['v']['fill']
        color['value']['v'] = rgb
        props['effects']['children'].append(fill)
        value = '#' + ''.join(f'{round(n * 255):02X}' for n in rgb[:3])
        palettes.setdefault(value, []).append((control, layer, color))
    # First expose the face color of the headline, followed by its shadow or
    # the supporting lettering. Shared colors update every matching layer.
    ordered = sorted(palettes.items(), key=lambda kv:min(c['textSlot'] for c,_,_ in kv[1]))
    for slot, (value, bindings) in enumerate(ordered):
        for control, layer, color in bindings:
            controls.append({'type':'color','key':f'palette-{slot}', 'colorSlot':slot,
                             'label':['Lettering','Accent','Credits'][min(slot,2)],
                             'displayLabel':['Lettering','Accent','Credits'][min(slot,2)],
                             'comp':1,'layer':layer['id'],'property':color['uid'],'default':value})
    project['next_id'] = next(ids)
    return {'project':project,'main':1}, list(used.values()), controls


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--original-copy', action='store_true', help='retain original lettering for reference comparisons')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    with zipfile.ZipFile(args.archive) as purchase:
        for path in purchase.namelist():
            if not path.lower().endswith('.mogrt') or Path(path).name.startswith('._'):
                continue
            package = purchase.read(path)
            try:
                title = read_title(package)
                scene, fonts, controls = make_scene(title,args.original_copy)
            except ValueError:
                continue
            identifier = 'poster-' + title['source'][:12]
            data = json.dumps(scene,ensure_ascii=False,separators=(',',':')).encode()
            (args.output / (identifier + '.bin')).write_bytes(gzip.compress(data,mtime=0))
            results.append({'id':identifier,'title':title['name'], 'sourceSha256':title['source'],
                            'graphicSha256':title['graphic'],'packageSha256':title['package'],
                            'sha256':digest(data),'compWidth':title['width'],'compHeight':title['height'],
                            'duration':title['duration'],'fonts':fonts,'controls':controls})
    (args.output / 'posters.json').write_text(json.dumps(results,indent=2), encoding='utf8')
    print(f'Wrote {len(results)} candidate scenes for picture verification')


if __name__ == '__main__':
    main()
