"""Build static editor faces from pinned, official Google Fonts sources.

Downloads are only performed with --download. Checked-in manifest pins source
commit, source bytes, output bytes, exact faces and metric data. Font binaries
retain their original copyright/license tables. No OS font installation.
"""
from pathlib import Path
import argparse, hashlib, io, json, urllib.request, urllib.parse
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
SPECS = [
 ('montserrat','Montserrat[wght].ttf', [('thin',100),('light',300),('black',900)]),
 ('montserrat','Montserrat-Italic[wght].ttf', [('extrabold-italic',800),('black-italic',900)]),
 ('roboto','Roboto[wdth,wght].ttf', [('light',300),('medium',500),('bold',700),('black',900)]),
 ('roboto','Roboto-Italic[wdth,wght].ttf', [('light-italic',300)]),
 ('robotoslab','RobotoSlab[wght].ttf', [('bold',700)]),
 ('opensans','OpenSans[wdth,wght].ttf', [('regular',400),('bold',700)]),
 ('bebasneue','BebasNeue-Regular.ttf', [('regular',400)]),
 ('greatvibes','GreatVibes-Regular.ttf', [('regular',400)]),
 ('kanit','Kanit-SemiBold.ttf', [('semibold',600)]),
 ('staatliches','Staatliches-Regular.ttf', [('regular',400)]),
 ('modak','Modak-Regular.ttf', [('regular',400)]),
]
def sha(data): return hashlib.sha256(data).hexdigest()
def read_url(url):
    with urllib.request.urlopen(url, timeout=60) as response: return response.read()
def name(font, which): return font['name'].getDebugName(which) or ''

def build(download, family_filter=None):
    manifest_path = ROOT/'public/fonts/editor-fonts.json'
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else None
    if not download:
        if not old: raise ValueError('No manifest; explicit --download required')
        for face in old['faces']:
            if sha((ROOT/'public'/face['url'].lstrip('/')).read_bytes()) != face['sha256']:
                raise ValueError('Font hash mismatch: '+face['id'])
        print('Verified '+str(len(old['faces']))+' pinned font faces')
        return
    commit = old['sourceCommit'] if old else json.loads(read_url('https://api.github.com/repos/google/fonts/commits/main'))['sha']
    base = 'https://raw.githubusercontent.com/google/fonts/'+commit+'/'
    dest = ROOT/'public/fonts/native'; dest.mkdir(parents=True,exist_ok=True)
    # Preserve explicitly imported original faces when refreshing Google sources.
    specs = [s for s in SPECS if family_filter is None or s[0] == family_filter]
    replace = {family+'-'+variant for family, _, variants in specs for variant, _ in variants}
    imported = [f for f in (old or {}).get('faces',[]) if f['id'] not in replace]
    manifest = {'sourceCommit':commit,'faces':imported}
    old_metrics = json.loads((ROOT/'contracts/editor-font-metrics.json').read_text(encoding='utf8')) if imported else {}
    metrics = {f['id']:old_metrics[f['id']] for f in imported}
    for family, filename, faces in specs:
        license_dir, license_name = ('apache', 'LICENSE.txt') if family == 'robotoslab' else ('ofl', 'OFL.txt')
        family_url = base + license_dir + '/' + family + '/'
        url = family_url + urllib.parse.quote(filename)
        data = read_url(url)
        license_path = dest/(family+'-'+license_name)
        if not license_path.exists(): license_path.write_bytes(read_url(family_url+license_name))
        if family == 'robotoslab':
            (dest/'robotoslab-COPYRIGHT.txt').write_bytes(read_url(family_url+'COPYRIGHT.txt'))
        for variant, weight in faces:
            font = TTFont(io.BytesIO(data))
            font.recalcTimestamp = False
            original_family = name(font,16) or name(font,1)
            if 'fvar' in font:
                axes = {a.axisTag:a.defaultValue for a in font['fvar'].axes}; axes['wght']=weight
                font = instantiateVariableFont(font,axes,inplace=False,updateFontNames=True)
            face_id = family+'-'+variant
            output = dest/(face_id+'.ttf'); font.save(output)
            binary = output.read_bytes()
            family_name = name(font,1)
            label = original_family+' '+variant.replace('-',' ').title()
            units=font['head'].unitsPerEm
            cmap=font.getBestCmap(); advances={chr(c):round(font['hmtx'][g][0]/units,6) for c,g in cmap.items()}
            os2=font['OS/2']; metrics[face_id]={'height':(os2.usWinAscent+os2.usWinDescent)/units,'ascent':os2.usWinAscent/units,'descent':os2.usWinDescent/units,'advances':advances}
            manifest['faces'].append({'id':face_id,'label':label,'family':family_name,'postscript':name(font,6),'weight':weight,'bold':bool(font['OS/2'].fsSelection & 32),'italic':bool(font['OS/2'].fsSelection & 1),'url':'/fonts/native/'+output.name,'sha256':sha(binary),'source':url,'sourceSha256':sha(data),'license':'/fonts/native/'+license_path.name})
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    (ROOT/'contracts/editor-font-metrics.json').write_text(json.dumps(metrics,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    (ROOT/'contracts/editor-font-data.json').write_text(json.dumps(manifest['faces'],indent=2)+'\n')
    print('Prepared '+str(len(manifest['faces']))+' static faces from '+commit)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--download',action='store_true')
    parser.add_argument('--family', choices=sorted({f[0] for f in SPECS}))
    args = parser.parse_args()
    build(args.download, args.family)
