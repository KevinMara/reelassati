"""Build frame-addressable, lossless luma sheets from the authored Motion brush sources."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import tempfile
from urllib.parse import unquote
import xml.etree.ElementTree as ET
import zipfile

from PIL import Image

def seconds(value):
    numerator, denominator, _, _ = map(int, value.split())
    return numerator / denominator

def digest(data):
    return hashlib.sha256(data).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    destination = Path("public/native-mattes")
    destination.mkdir(exist_ok=True)
    catalog = {}
    with zipfile.ZipFile(args.archive) as archive, tempfile.TemporaryDirectory() as tmp:
        media = Path(tmp) / "source.mp4"
        for entry in sorted(archive.namelist()):
            if "/Brush/" not in entry or not entry.endswith(".motr") or "__MACOSX" in entry:
                continue
            xml = archive.read(entry)
            root = ET.fromstring(xml)
            layer = root.find(".//layer")
            images = layer.findall("scenenode")
            a, b = (v for v in images if v.get("name") in {"Transition A", "Transition B"})
            mask = a.find("mask")
            if mask is None or b.find("mask") is not None:
                raise ValueError("Unexpected mask topology")
            props = {x.get("name"): x.get("value") for x in mask.iter("parameter") if x.get("value")}
            wrap = props.get("Wrap Mode")
            if wrap not in (None, "2"):
                raise ValueError("Unsupported image-mask wrapping")
            if (props.get("Source Channel"), props.get("Mask Blend Mode"), props.get("Stretch")) != ("4","2","1"):
                raise ValueError("Unsupported mask controls")
            source = next(v for v in images if v.get("id") == props["Mask Source"])
            source_id = source.find(".//parameter[@name='Source Media']").get("value")
            clip = root.find(f".//clip[@id='{source_id}']")
            url = unquote(clip.findtext("relativeURL"))
            media_bytes = archive.read(str(PurePosixPath(entry).parent / url))
            if not media.exists():
                media.write_bytes(media_bytes)
                media_hash = digest(media_bytes)
            elif digest(media_bytes) != media_hash:
                raise ValueError("Unexpected matte movie")
            frame_count = int(root.findtext(".//sceneSettings/duration"))
            if frame_count != 120 or root.findtext(".//sceneSettings/NTSC") != "1" or root.findtext(".//sceneSettings/frameRate") != "30":
                raise ValueError("Unverified source frame clock")
            start = -seconds(source.find("timing").get("offset"))
            width, height = int(clip.findtext("missingWidth")), int(clip.findtext("missingHeight"))
            if (width,height)!=(1092,720):
                raise ValueError("Unexpected source dimensions")
            native_id = "ink-" + digest(xml)[:12]
            cols, rows = 3, 2
            command = ["ffmpeg","-v","error","-threads","2","-ss",str(start),"-i",str(media),"-map","0:v:0","-an",
                    "-vf","fps=30000/1001","-frames:v",str(frame_count),"-pix_fmt","gray","-f","rawvideo","pipe:1"]
            sheets = []
            with subprocess.Popen(command, stdout=subprocess.PIPE) as process:
                for offset in range(0, frame_count, cols*rows):
                    sheet = Image.new("L",(width*cols,height*rows))
                    for i in range(min(cols*rows,frame_count-offset)):
                        pixels = process.stdout.read(width*height)
                        if len(pixels)!=width*height:
                            raise ValueError("Missing source matte frame")
                        sheet.paste(Image.frombytes("L",(width,height),pixels),((i%cols)*width,(i//cols)*height))
                    buffer=io.BytesIO()
                    sheet.save(buffer,format="PNG",compress_level=6)
                    content=buffer.getvalue()
                    sha=digest(content)
                    (destination / (sha+".png")).write_bytes(content)
                    sheets.append(sha)
                if process.wait()!=0:
                    raise ValueError("Matte decode failed")
            catalog[native_id] = dict(sourceSha256=digest(xml), movieSha256=media_hash,
                sourceName=PurePosixPath(entry).stem, start=start, frames=frame_count, width=width, height=height,
                columns=cols, rows=rows, inverted=props.get("Invert Mask")=="1", sheets=sheets)
            if wrap == "2":
                catalog[native_id]["mirrorCanvas"] = [int(root.findtext(".//sceneSettings/" + k)) for k in ("width","height")]
            print(native_id,PurePosixPath(entry).stem,len(sheets),flush=True)
    Path("contracts/native-matte-data.json").write_text(json.dumps(catalog,indent=2)+"\n",encoding="utf-8")

if __name__ == "__main__":
    main()
