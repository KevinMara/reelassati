#!/usr/bin/env python3
"""Prepare a resumable, verified shared catalog locally from explicit private recipes.

No network, model, upload, scheduler or whole-archive extraction. The recipe maps
exact archive folders to reviewed public groups/compositing modes. Every source
remains in the private inventory; only successfully validated delivery objects
enter catalog.json. Run in the visible active request and observe completion.
"""
from __future__ import annotations
import argparse, array, hashlib, importlib.util, json, math, re, shutil, subprocess, tempfile, zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location("media_index", Path(__file__).with_name("licensed-media-index.py"))
media_index = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media_index)
MAXIMUM = 96 * 1024 * 1024


def design_name(source_path):
    path=Path(source_path)
    name=re.sub(r'\b(?:4k|1080p|2160p|hd)\b','',path.stem,flags=re.I).strip()
    # Aspect labels are prefixes only inside real aspect-export folders.
    # "Square Frame" and "Scribble Story" can be the actual design name.
    if any(re.fullmatch(r'(?:\d+\s*[x×]\s*\d+|story|vertical|square)',part,re.I) for part in path.parts[:-1]):
        name=re.sub(r'^(?:story|feed|vertical|square)[ _-]+','',name,flags=re.I)
    return name.strip().lower()

def run(args, timeout=300):
    if args[0] == "ffmpeg":
        # One decoder/filter/encoder thread keeps deterministic foreground
        # staging within this laptop's memory budget alongside the editor.
        args = list(args)
        for index in range(len(args) - 1):
            if args[index] == "-threads": args[index + 1] = "1"
        args = [args[0], "-xerror", "-threads", "1", "-filter_threads", "1", "-filter_complex_threads", "1", *args[1:-1], "-threads", "1", args[-1]]
    return subprocess.run(args, check=True, capture_output=True, timeout=timeout)

def waveform(path):
    pcm = run(["ffmpeg", "-v", "error", "-nostdin", "-i", str(path), "-vn", "-ac", "1", "-ar", "8000", "-f", "f32le", "-"]).stdout
    values = array.array("f", pcm)
    bins = [max((abs(v) for v in values[int(i * len(values) / 64):int((i + 1) * len(values) / 64)]), default=0) for i in range(64)]
    peak = max(bins, default=0)
    return [round(v / peak, 6) if peak else 0 for v in bins]


def alpha_frame_sequence(path, timeout, webm=False):
    args=["ffmpeg","-v","error","-nostdin"]
    if webm: args += ["-c:v","libvpx-vp9"]
    args += ["-i",str(path),"-map","0:v:0","-vf","alphaextract" if webm else "format=rgba,alphaextract","-fps_mode","passthrough","-f","framehash","-hash","sha256","-"]
    lines=run(args,timeout).stdout.decode("utf-8").splitlines()
    timing=[line for line in lines if line.startswith(("#tb ","#dimensions "))]
    frames=[tuple(part.strip() for part in line.split(',')) for line in lines if line and not line.startswith('#')]
    if not timing or not frames or any(len(frame)!=6 for frame in frames):
        raise ValueError("The alpha frame sequence could not be verified")
    return timing,frames

def object_record(path, output, mime):
    digest = media_index.digest_file(path)
    if path.stat().st_size > MAXIMUM:
        raise ValueError("Web derivative exceeds the upload limit; choose an explicit smaller derivative")
    extension = {"video/mp4":"mp4", "video/webm":"webm", "audio/wav":"wav", "audio/mpeg":"mp3", "image/png":"png", "image/jpeg":"jpg", "application/x-cube":"cube"}[mime]
    relative = f"media/{digest}.{extension}"
    target = output / relative
    if target.exists():
        if media_index.digest_file(target) != digest: raise ValueError("Existing staged object has different bytes")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
    return {"file":relative,"sha256":digest,"bytes":target.stat().st_size,"contentType":mime}

def prepare(entry, bundle, output, work, group, label, design_id, timeout):
    source = work / ("source" + entry["extension"])
    original_hash = media_index.extract_member(bundle, entry, source, 2 * 1024**3)
    kind = entry["kind"]
    provenance = {"sourcePath": entry["sourcePath"], "sourceSha256": original_hash, "transformation": "unchanged"}
    item = {"name":label,"group":group["name"],"designId":design_id,"kind":kind,"tags":group.get("tags",[]),"license":"platform-licensed","credits":0}
    if kind == "lut":
        technical = media_index.inspect_cube(source)
        if technical["dimensions"] != 3 or technical["size"] > 64: raise ValueError("This LUT grid is inventoried but not supported by the current preview/export runtime")
        target = work / "public.cube"
        # Preserve all numerical samples exactly; remove supplier comments/title.
        target.write_text("\n".join(line.split("#",1)[0].strip() for line in source.read_text(encoding="utf-8-sig").splitlines() if line.split("#",1)[0].strip() and not line.strip().startswith("TITLE")) + "\n",encoding="utf-8")
        if media_index.inspect_cube(target) != technical: raise ValueError("Sanitizing changed the LUT grid")
        item.update(duration=0,variant=f'{technical["dimensions"]}D · {technical["size"]}',lut={"dimension":technical["dimensions"],"size":technical["size"],"domainMin":technical["DOMAIN_MIN"],"domainMax":technical["DOMAIN_MAX"]})
        item["media"] = object_record(target,output,"application/x-cube")
        provenance["transformation"] = "Removed comments and TITLE only; numeric table and domains unchanged"
    else:
        technical = media_index.inspect_media(source,kind,timeout)
        target = source
        if kind == "audio":
            item["tags"]=[tag for tag in item["tags"] if tag!="overlay"]+["sound"]
            # Preserve browser-ready PCM WAV/MP3. Decode other audio to portable PCM.
            codec = next(s for s in technical["streams"] if s["codec_type"]=="audio")["codec_name"]
            if entry["extension"] != ".mp3" and not (entry["extension"]==".wav" and codec in {"pcm_s16le","pcm_s24le","pcm_s32le","pcm_f32le"}):
                target=work/"audio.wav";run(["ffmpeg","-v","error","-nostdin","-i",str(source),"-vn","-c:a","pcm_s16le",str(target)],timeout);provenance["transformation"]="Decoded to PCM16 WAV"
            if group.get("compactAudio") and source.stat().st_size > 1024 * 1024:
                target=work/"audio.mp3"
                run(["ffmpeg","-v","error","-nostdin","-i",str(source),"-vn","-c:a","libmp3lame","-b:a","320k",str(target)],timeout)
                technical=media_index.inspect_media(target,"audio",timeout)
                provenance["transformation"]="MP3 320 kbit/s web derivative; original retained in source archive"
            item.update(duration=technical["duration"],variant="Audio",waveform=waveform(target))
            item["media"]=object_record(target,output,"audio/mpeg" if target.suffix==".mp3" else "audio/wav")
        else:
            stream=next(s for s in technical["streams"] if s["codec_type"]=="video")
            if kind=="video" and (entry["extension"]!=".mp4" or stream["codec_name"]!="h264" or stream.get("pix_fmt")!="yuv420p" or entry["bytes"]>MAXIMUM):
                if stream.get("pix_fmt","").startswith(("argb","rgba","bgra","yuva","gbrap","abgr")):
                    target=work/"delivery.webm"
                    graph="[0:v]format=rgba,split[color][alpha];[alpha]alphaextract[mask];[color]format=yuv420p[color420];[color420][mask]alphamerge[out]"
                    encode=["ffmpeg","-v","error","-nostdin","-i",str(source),"-filter_complex",graph,"-map","[out]","-an","-c:v","libvpx-vp9","-pix_fmt","yuva420p","-lossless","1","-deadline","realtime","-cpu-used","8","-row-mt","1","-threads","1",str(target)]
                    run(encode,timeout)
                    # Realtime changes compression effort, not lossless pixels.
                    # Use the denser preset only if an object would exceed the
                    # delivery bound; every final derivative still gets the
                    # exact alpha comparison below.
                    if target.stat().st_size > MAXIMUM:
                        encode[encode.index("realtime")]="good"
                        encode[encode.index("-cpu-used")+1]="4"
                        run([encode[0],"-y",*encode[1:]],timeout)
                    # MOV/WebM timebase rounding can make the same -ss seek
                    # choose adjacent frames. Compare the complete decoded
                    # sequence by frame identity and normalized output clocks.
                    original=alpha_frame_sequence(source,timeout)
                    decoded=alpha_frame_sequence(target,timeout,True)
                    if original != decoded: raise ValueError("Alpha derivative differs from source transparency or frame timing")
                    provenance["alphaVerification"]={"method":"Every decoded 8-bit alpha frame: timing,dimensions,size and SHA256 equality","frames":len(original[1]),"sequenceSha256":hashlib.sha256(json.dumps(original,separators=(',',':')).encode()).hexdigest()}
                    item["alpha"]=True
                else:
                    target=work/"delivery.mp4"
                    run(["ffmpeg","-v","error","-nostdin","-i",str(source),"-map","0:v:0","-an","-c:v","libx264","-preset","fast","-crf","20","-pix_fmt","yuv420p","-movflags","+faststart",str(target)],timeout)
                technical=media_index.inspect_media(target,"video",timeout)
                stream=next(s for s in technical["streams"] if s["codec_type"]=="video")
                provenance["transformation"]="Lossless VP9 color+separate alpha planes; original dimensions; explicit libvpx-vp9 decoding" if item.get("alpha") else "H.264 CRF20 yuv420p web derivative; silent visual at original dimensions"
            item.update(duration=technical["duration"] if kind=="video" else 3,width=stream["width"],height=stream["height"],variant=f'{stream["width"]} × {stream["height"]}',blendMode=group["blendMode"])
            item["media"]=object_record(target,output,("video/webm" if item.get("alpha") else "video/mp4") if kind=="video" else "image/png" if target.suffix.lower()==".png" else "image/jpeg")
            poster=work/"poster.png"
            args=["ffmpeg","-v","error","-nostdin"]
            if kind=="video":args += ["-ss",str(max(0,technical["duration"]*0.5))]
            if item.get("alpha"):args += ["-c:v","libvpx-vp9"]
            run(args+["-i",str(target),"-frames:v","1","-vf","scale=320:320:force_original_aspect_ratio=decrease","-update","1",str(poster)],timeout)
            item["poster"]=object_record(poster,output,"image/png")
    if group.get("useSourceTags"):
        words=re.findall(r"[A-Za-z]{3,40}",entry["sourcePath"].split('/')[-1].rsplit('.',1)[0].lower())
        parent_words=re.findall(r"[A-Za-z]{3,40}",'/'.join(entry["sourcePath"].split('/')[2:-1]).lower())
        item["tags"]=list(dict.fromkeys(item["tags"]+[word for word in parent_words+words if word not in {"four","editors","sfx","wav","mp3","mp4","mov","png"}]))[:20]
    item["id"]="stock-"+item["media"]["sha256"][:24]
    entry.update(sha256=original_hash,technical=technical,verification={"state":"cube-validated" if kind=="lut" else "decoded"})
    provenance.update(catalogId=item["id"],publicMediaSha256=item["media"]["sha256"])
    return item,provenance

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recipe",type=Path);parser.add_argument("--output",required=True,type=Path);parser.add_argument("--private-report",required=True,type=Path);parser.add_argument("--timeout",type=int,default=300);parser.add_argument("--kinds",default="video,audio,image,lut")
    args=parser.parse_args(); recipe=json.loads(args.recipe.read_text(encoding="utf-8"));args.output.mkdir(parents=True,exist_ok=True)
    manifest_path=args.output/"catalog.json"
    manifest=json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"schemaVersion":1,"items":[]}
    report=json.loads(args.private_report.read_text(encoding="utf-8")) if args.private_report.exists() else {"visibility":"private-source-provenance","sources":[],"unavailable":[]}
    records={item["id"]:item for item in manifest["items"]};done={(row["archiveSha256"],row["sourcePath"]) for row in report["sources"]}
    kinds=set(args.kinds.split(","))
    for pack in recipe["archives"]:
        archive=Path(pack["archive"]);index_path=Path(pack["index"]);index=json.loads(index_path.read_text(encoding="utf-8"));media_index.verify_archive(archive,index)
        if not index["source"].get("rightsBasis"):raise ValueError("Private rights basis is required")
        count=0
        design_labels={}
        for candidate in index["entries"]:
            parts=candidate["sourcePath"].split('/')
            source_group=parts[1] if len(parts)>2 else "(root)"
            group=pack["groups"].get(source_group)
            if not group: continue
            design=design_name(candidate["sourcePath"])
            design_labels.setdefault(group["name"],set()).add(design)
        design_labels={group:{design:index+1 for index,design in enumerate(sorted(values))} for group,values in design_labels.items()}
        with zipfile.ZipFile(archive) as bundle:
            for entry in index["entries"]:
                parts=entry["sourcePath"].split('/');source_group=parts[1] if len(parts)>2 else "(root)";group=pack["groups"].get(source_group)
                key=(index["source"]["archiveSha256"],entry["sourcePath"])
                if not group or entry["kind"] not in kinds or key in done:continue
                if any(re.search(pattern,entry["sourcePath"],re.I) for pattern in group.get("exclude",[])):continue
                design=design_name(entry["sourcePath"])
                design_id="design-"+hashlib.sha256((group["name"]+design).encode()).hexdigest()[:24]
                label=f'{group["name"]} {design_labels[group["name"]][design]:03d}'
                if shutil.disk_usage(args.output).free < 1024**3 + entry["bytes"] * 2:
                    media_index.write_json(manifest_path,{"schemaVersion":1,"items":list(records.values())});media_index.write_json(args.private_report,report);media_index.write_json(index_path,index)
                    raise SystemExit("Preparation paused: insufficient free space for this source and derivative. Existing verified objects remain resumable.")
                try:
                    with tempfile.TemporaryDirectory(prefix="shared-catalog-") as temp:
                        item,provenance=prepare(entry,bundle,args.output,Path(temp),group,label,design_id,args.timeout)
                    if item["id"] not in records:records[item["id"]]=item
                    report["sources"].append({"archiveSha256":key[0],**provenance});done.add(key);count+=1
                    report["unavailable"]=[row for row in report["unavailable"] if (row["archiveSha256"],row["sourcePath"])!=key]
                except (ValueError,OSError,subprocess.SubprocessError) as error:
                    report["unavailable"]=[row for row in report["unavailable"] if (row["archiveSha256"],row["sourcePath"])!=key]
                    report["unavailable"].append({"archiveSha256":key[0],"sourcePath":entry["sourcePath"],"reason":str(error)[:500]})
                    print(json.dumps({"unavailable":entry["sourcePath"],"reason":str(error)[:200]}),flush=True)
                if count%10==0:
                    media_index.write_json(manifest_path,{"schemaVersion":1,"items":list(records.values())});media_index.write_json(args.private_report,report);media_index.write_json(index_path,index)
                    print(json.dumps({"preparedObjects":len(records),"sourceMembers":len(done),"unavailable":len(report["unavailable"])}),flush=True)
        media_index.write_json(manifest_path,{"schemaVersion":1,"items":list(records.values())});media_index.write_json(args.private_report,report);media_index.write_json(index_path,index)
    print(json.dumps({"preparedCatalogItems":len(records),"sourceMembers":len(done),"unavailable":len(report["unavailable"]),"uploaded":False}),flush=True)

if __name__=="__main__":main()
