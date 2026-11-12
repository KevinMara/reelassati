#!/usr/bin/env python3
"""Inspect immutable catalog bytes in the foreground. No model/network calls.

Visual contact sheets retain measured timestamps, sounds retain playable
samples plus full-file measurements, and LUTs retain their actual color curve.
The sidecar is keyed by the original media digest. Labels are never evidence.
"""
from __future__ import annotations
import argparse, array, base64, hashlib, io, json, math, re, shutil, subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image, ImageDraw


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''): h.update(block)
    return h.hexdigest()


def run(ffmpeg, args):
    return subprocess.run([ffmpeg, '-hide_banner', '-v', 'error', '-nostdin',
                           '-threads', '1', '-filter_threads', '1', *args],
                          check=True, capture_output=True, timeout=300).stdout


def blob(data, mime):
    return {'data': base64.b64encode(data).decode(), 'sha256': hashlib.sha256(data).hexdigest(),
            'contentType': mime, 'bytes': len(data)}


def visual_evidence(path, item, ffmpeg):
    width, height = int(item['width']), int(item['height'])
    frame_w, frame_h = 240, 160
    if item['kind'] == 'image':
        frames = [Image.open(path).convert('RGBA')]; times = [0.0]
    else:
        duration = item['duration']
        count = min(30, max(6, math.ceil(duration * 3)))
        # Decode once; showinfo gives actual selected source presentation times.
        # Seeking near the container's duration can yield no final frame.
        decoder = ['-c:v', 'libvpx-vp9'] if item.get('alpha') else []
        command=[ffmpeg,'-hide_banner','-v','info','-nostdin','-threads','1','-filter_threads','1',*decoder,'-i',str(path),
                 '-an','-vf',f"select='isnan(prev_selected_t)+gte(t-prev_selected_t,{duration/count})',scale=240:160:force_original_aspect_ratio=decrease,pad=240:160:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba,showinfo",
                 '-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgba','-']
        result=subprocess.run(command,check=True,capture_output=True,timeout=300)
        times=[float(v) for v in re.findall(r'\bpts_time:([\d.eE+-]+)',result.stderr.decode('utf-8',errors='replace'))]
        size=frame_w*frame_h*4
        frames=[Image.frombytes('RGBA',(frame_w,frame_h),result.stdout[i:i+size]) for i in range(0,len(result.stdout),size)]
        if not frames or len(times)!=len(frames): raise ValueError('Frame timestamps do not match decoded frames')
    cols = min(5, len(frames)); rows = math.ceil(len(frames) / cols)
    sheet = Image.new('RGB', (cols * frame_w, rows * (frame_h + 20)), '#161922')
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(frames):
        frame.thumbnail((frame_w - 4, frame_h - 4))
        x, y = (index % cols) * frame_w, (index // cols) * (frame_h + 20)
        for cy in range(0, frame_h, 16):
            for cx in range(0, frame_w, 16):
                draw.rectangle((x+cx, y+cy, x+cx+15, y+cy+15), fill='#444a55' if (cx//16+cy//16)%2 else '#292e37')
        sheet.paste(frame, (x+(frame_w-frame.width)//2, y+(frame_h-frame.height)//2), frame)
        draw.text((x+6, y+frame_h+3), f'{times[index]:.2f}s' if item['kind']=='video' else 'Actual image', fill='white')
    out=io.BytesIO(); sheet.save(out, 'JPEG', quality=82)
    return {**blob(out.getvalue(), 'image/jpeg'), 'width': sheet.width, 'height': sheet.height,
            'columns': cols, 'frameTimes': times, 'sourceWidth': width, 'sourceHeight': height,
            'coverage': 'sampled-motion' if item['kind']=='video' else 'complete-image'}


def audio_evidence(path, item, ffmpeg):
    # Measure the complete decoded sound, not merely its selected preview.
    raw = run(ffmpeg, ['-i', str(path), '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'])
    pcm = array.array('f', raw)
    if not pcm: raise ValueError('No decoded audio')
    peak=max(abs(v) for v in pcm); rms=math.sqrt(sum(v*v for v in pcm)/len(pcm))
    windows=[math.sqrt(sum(v*v for v in pcm[i:i+400])/len(pcm[i:i+400])) for i in range(0,len(pcm),400)]
    threshold=max(.003, max(windows, default=0)*.12)
    active=[i for i,v in enumerate(windows) if v>=threshold]
    onsets=[round(i*.05,3) for i,v in enumerate(windows) if v>=threshold and (i==0 or v>max(threshold,windows[i-1])*1.8)]
    duration=len(pcm)/8000
    ranges=[(0,duration)] if duration<=30 else [(0,10),(max(10,duration/2-5),max(10,duration/2-5)+10),(duration-10,duration)]
    # One MP3 with explicit source segment mapping, no implied full coverage.
    filters=[]
    for i,(a,b) in enumerate(ranges): filters.append(f'[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[s{i}]')
    filters.append(''.join(f'[s{i}]' for i in range(len(ranges)))+f'concat=n={len(ranges)}:v=0:a=1[out]')
    sample=run(ffmpeg,['-i',str(path),'-filter_complex',';'.join(filters),'-map','[out]','-ac','1','-ar','24000','-c:a','libmp3lame','-b:a','48k','-f','mp3','-'])
    cursor=0; segments=[]
    for a,b in ranges:
        segments.append({'sourceStart':round(a,4),'sourceEnd':round(b,4),'sampleStart':round(cursor,4)}); cursor+=b-a
    return {**blob(sample,'audio/mpeg'),'segments':segments,'coverage':'complete-audio' if duration<=30 else 'sampled-audio',
            'measured':{'duration':round(duration,4),'peakDb':round(20*math.log10(max(peak,1e-8)),2),
                        'rmsDb':round(20*math.log10(max(rms,1e-8)),2),
                        'activeStart':round(active[0]*.05,3) if active else None,
                        'activeEnd':round(min(duration,(active[-1]+1)*.05),3) if active else None,
                        'onsets':onsets[:128],
                        'envelope':[round(max(windows[int(i*len(windows)/64):int((i+1)*len(windows)/64)],default=0),5) for i in range(64)]}}


def lut_evidence(path):
    data=[]; size=0; low=[0.,0.,0.]; high=[1.,1.,1.]
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        fields=line.split('#',1)[0].strip().split()
        if not fields: continue
        if fields[0]=='LUT_3D_SIZE': size=int(fields[1])
        elif fields[0]=='DOMAIN_MIN': low=list(map(float,fields[1:]))
        elif fields[0]=='DOMAIN_MAX': high=list(map(float,fields[1:]))
        elif fields[0]=='TITLE': continue
        else: data.append(tuple(map(float,fields)))
    if not 2<=size<=64 or len(data)!=size**3: raise ValueError('Invalid LUT grid')
    def sample(rgb):
        coord=[max(0,min(1,(rgb[i]-low[i])/(high[i]-low[i])))*(size-1) for i in range(3)]
        lo=list(map(math.floor,coord)); hi=[min(size-1,n+1) for n in lo]; frac=[coord[i]-lo[i] for i in range(3)]
        out=[0.,0.,0.]
        for b in range(2):
            for g in range(2):
                for r in range(2):
                    w=(frac[0] if r else 1-frac[0])*(frac[1] if g else 1-frac[1])*(frac[2] if b else 1-frac[2])
                    value=data[(hi[2] if b else lo[2])*size*size+(hi[1] if g else lo[1])*size+(hi[0] if r else lo[0])]
                    for c in range(3): out[c]+=value[c]*w
        return [round(max(0,min(1,v)),5) for v in out]
    colors=[[.72,.48,.35],[.40,.25,.18],[.94,.75,.60],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[0,1,1],[1,0,1]]
    return {'neutralCurve':[sample([i/16]*3) for i in range(17)],
            'colorSamples':[{'input':c,'output':sample(c)} for c in colors],
            'clippedSamples':sum(any(v<0 or v>1 for v in row) for row in data),'gridSamples':len(data),
            'coverage':'measured-lut','domainMin':low,'domainMax':high}


def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--manifest',type=Path,required=True)
    parser.add_argument('--root',type=Path,required=True); parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--ffmpeg',default=shutil.which('ffmpeg')); parser.add_argument('--kind',choices=['all','video','image','audio','lut'],default='all')
    parser.add_argument('--limit',type=int); parser.add_argument('--workers',type=int,default=1); args=parser.parse_args()
    if not 1 <= args.workers <= 8: raise ValueError('Choose one to eight local processing workers')
    if not args.ffmpeg: raise ValueError('FFmpeg is required')
    manifest=json.loads(args.manifest.read_text(encoding='utf-8-sig')); files={}
    for folder in args.root.glob('Shared*'):
        for path in (folder/'media').glob('*'): files.setdefault(path.name,path)
    args.output.mkdir(parents=True,exist_ok=True); selected=[i for i in manifest['items'] if args.kind=='all' or i['kind']==args.kind]
    if args.limit: selected=selected[:args.limit]
    complete=0; failures=[]
    def prepare(item):
        target=args.output/(item['id']+'.json')
        try:
            if target.exists():
                existing=json.loads(target.read_text())
                if existing.get('mediaSha256')==item['media']['sha256'] and existing.get('schemaVersion')==1:
                    return None
            source=files[Path(item['media']['file']).name]
            if source.stat().st_size!=item['media']['bytes'] or digest(source)!=item['media']['sha256']: raise ValueError('Source digest mismatch')
            record={'schemaVersion':1,'catalogId':item['id'],'mediaSha256':item['media']['sha256'],'kind':item['kind'],'duration':item['duration']}
            if item['kind'] in ['image','video']: record['visual']=visual_evidence(source,item,args.ffmpeg)
            elif item['kind']=='audio': record['audio']=audio_evidence(source,item,args.ffmpeg)
            else: record['lut']=lut_evidence(source)
            temp=target.with_suffix('.tmp'); temp.write_text(json.dumps(record,separators=(',',':')),encoding='utf-8');temp.replace(target)
            return None
        except Exception as exc: return {'id':item['id'],'error':type(exc).__name__}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures=[pool.submit(prepare,item) for item in selected]
        for i,future in enumerate(as_completed(futures)):
            failure=future.result()
            if failure: failures.append(failure)
            else: complete+=1
            if (i+1)%25==0 or i+1==len(selected): print(json.dumps({'processed':i+1,'total':len(selected),'complete':complete,'failed':len(failures)}),flush=True)
    summary={'schemaVersion':1,'total':len(selected),'complete':complete,'failures':failures}
    (args.output/f'summary-{args.kind}.json').write_text(json.dumps(summary,indent=2)); print(json.dumps(summary),flush=True)
    if failures: raise SystemExit(1)


if __name__=='__main__': main()
