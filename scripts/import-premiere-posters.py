"""Compile static Premiere point-text into the same editable project used for export."""
import argparse
import gzip
import json
import zipfile
from pathlib import Path
from lib.premiere_title import digest, read_title
from lib.point_title_scene import make_scene


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--title', help='select packages by title substring')
    parser.add_argument('--original-copy', action='store_true', help='retain original lettering for reference comparisons')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    with zipfile.ZipFile(args.archive) as purchase:
        for path in purchase.namelist():
            if not path.lower().endswith('.mogrt') or Path(path).name.startswith('._'):
                continue
            if args.title and args.title.casefold() not in Path(path).stem.casefold():
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
