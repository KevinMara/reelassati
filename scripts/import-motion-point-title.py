"""Convert the verified two-line Motion speaker title into an editable scene."""
import argparse
import gzip
import hashlib
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

from lib.point_title_scene import make_scene, nodes


def clock(time):
    ticks, scale, valid, epoch = map(int, time.split())
    if scale <= 0 or (valid, epoch) != (1, 0):
        raise ValueError("Unsupported Motion time")
    return ticks / scale


def curve(channel):
    element = channel.find("curve")
    if element.get("type") != "1":
        raise ValueError("Expected a Bezier position curve")
    knots = []
    for point in element.findall("keypoint"):
        at, value = clock(point.findtext("time")), float(point.findtext("value"))
        knot = {"at": at, "value": value}
        for prefix, key in (("input", "left"), ("output", "right")):
            dt = point.findtext(prefix + "TangentTime")
            dv = point.findtext(prefix + "TangentValue")
            if dt is not None and dv is not None:
                knot[key] = [at + float(dt), value + float(dv)]
        knots.append(knot)
    return {"interpolation": "bezier", "knots": knots}


def convert(source, original):
    digest = hashlib.sha256(source).hexdigest()
    # Only this authored graph has been compared at every frame with its native movie.
    if digest != "051fcc1b64d3c4042b36697bb70500ff4e77db06d39b3acae1dbae413c5db7af":
        raise ValueError("No reference-calibrated layout for this Motion source")
    xml = ET.fromstring(source)
    settings = xml.find(".//sceneSettings")
    width, height, frames, fps = [int(settings.findtext(key)) for key in
                                   ("width", "height", "duration", "frameRate")]
    components, paths = [], []
    for layer in xml.findall(".//layer/scenenode"):
        style = layer.find("style")
        font = style.findtext(".//font")
        size = style.find("parameter[@name='Size']")
        text = layer.findtext(".//text") if original else (
            "Speaker role" if font == "Arial-Black" else "Studio name")
        run = {"font": font, "size": float(size.get("value")) if size is not None else 48,
               "text": text, "fill": [255, 255, 255], "stroke": None,
               "strokeWidth": 0, "applyStroke": False, "tracking": 0, "italic": False}
        components.append({"kind": "Text", "values": {
            "Source Text": {"runs": [run], "justify": 0, "lineSpacing": 0},
            "Position": [.5, .5], "Anchor Point": [0, 0], "Scale": 100,
            "Rotation": 0, "Opacity": 100}})
        position = layer.find(".//parameter[@name='Transform']/parameter[@name='Position']")
        paths.append({c.get("name"): curve(c) for c in position.findall("parameter")})
    duration = frames / fps
    scene, fonts, controls = make_scene({
        "width": width, "height": height, "duration": duration,
        "components": [*components, {"kind": "Clip"}]}, original_copy=True)
    sampler = Path(__file__).parent / "lib" / "motion-title-positions.mjs"
    samples = json.loads(subprocess.run(
        ["node", str(sampler)], input=json.dumps(dict(paths=paths, frames=frames, fps=fps)),
        text=True, check=True, capture_output=True).stdout)
    comp = scene["project"]["items"]["1"]
    comp["name"] = "Sliding speaker credit"
    comp["kind"]["frame_rate"] = {"num": fps, "den": 1}
    for layer, coordinates in zip(comp["kind"]["layers"], samples, strict=True):
        props = {p["match"]: p for p in nodes(layer["props"])}
        doc = props["sourceText"]["value"]["v"]
        if doc["font"] == "ClashDisplay-Medium":
            doc.update(h_scale=162, v_scale=119, small_caps=True)
        else:
            doc.update(h_scale=122)
        position = props["position"]
        position["keys"] = [{
            "time": round(i * 254016000000 / fps),
            "value": {"t": "Vec3", "v": [width / 2 + x, height / 2 - y, z]},
            "in_interp": "Linear", "out_interp": "Linear", "in_ease": [], "out_ease": [],
            "continuous": False, "auto_bezier": False, "spatial_in": [0, 0, 0],
            "spatial_out": [0, 0, 0], "spatial_auto": False, "spatial_continuous": False,
            "roving": False} for i, (x, y, z) in enumerate(coordinates)]
        position["value"] = position["keys"][0]["value"]
    return scene, dict(id="motion-" + digest[:12], sourceSha256=digest, fonts=fonts,
                       compWidth=width, compHeight=height, duration=duration, controls=controls)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--original-copy", action="store_true")
    args = parser.parse_args()
    scene, entry = convert(args.source.read_bytes(), args.original_copy)
    data = json.dumps(scene, ensure_ascii=False, separators=(",", ":")).encode()
    args.output.mkdir(parents=True, exist_ok=True)
    entry["sha256"] = hashlib.sha256(data).hexdigest()
    (args.output / (entry["id"] + ".bin")).write_bytes(gzip.compress(data, mtime=0))
    (args.output / "title.json").write_text(json.dumps(entry, indent=2), encoding="utf8")
