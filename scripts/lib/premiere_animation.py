"""Translate source-timed Premiere titles with straight authored animation curves."""

import base64
import gzip
import io
import json
import math
import xml.etree.ElementTree as ET
import zipfile

from .premiere_title import text_document, rectangle_path, solid_appearance, digest
from .point_title_scene import make_scene, nodes, horizontal_scale

TICKS = 254016000000


def parameter_value(raw):
    if raw in ("true", "false"):
        return raw == "true"
    return [float(n) for n in raw.split(":")] if ":" in raw else float(raw)


def linear_keys(encoded, origin):
    keys = [r.split(",") for r in encoded.split(";") if r]
    result = []
    for i, k in enumerate(keys):
        t, val = int(k[0]), parameter_value(k[1])
        if k[2:4] != ["0", "0"] or len(k) not in (8, 14):
            raise ValueError("Unsupported keyframe interpolation")
        if i:
            p = keys[i - 1]
            pv = parameter_value(p[1])
            dt = (t - int(p[0])) / TICKS
            if dt <= 0:
                raise ValueError("Unordered Premiere keys")
            if isinstance(val, list):
                if k[8:10] != ["5", "4"] or p[8:10] != ["5", "4"] or len(val) != 2:
                    raise ValueError("Unsupported Premiere spatial keys")
                delta = [b - a for a, b in zip(pv, val)]
                for sign, tangent in [(1, p[12:14]), (-1, k[10:12])]:
                    # A bowed path cannot be represented by a straight segment.
                    x, y = [sign * float(v) for v in tangent]
                    dot = delta[0] * x + delta[1] * y
                    if (
                        abs(delta[0] * y - delta[1] * x) > 1e-7
                        or dot < -1e-8
                        or dot > sum(d * d for d in delta)
                    ):
                        raise ValueError("Curved Premiere spatial path")
                speed = math.dist(val, pv) / dt
            else:
                speed = (val - pv) / dt
            if not all(
                math.isclose(float(v), speed, abs_tol=1e-7, rel_tol=1e-5)
                for v in (p[6], k[4])
            ):
                raise ValueError("Nonlinear Premiere temporal interpolation")
        result.append((t - origin, val))
    return result


def read_animated_title(package):
    with zipfile.ZipFile(io.BytesIO(package)) as outer:
        definition = json.loads(outer.read("definition.json"))
        graphic = outer.read("project.prgraphic")
    with zipfile.ZipFile(io.BytesIO(graphic)) as inner:
        (project,) = [inner.read(n) for n in inner.namelist() if n.endswith(".prproj")]
    xml = ET.fromstring(gzip.decompress(project))
    objects = {e.get("ObjectID"): e for e in xml if e.get("ObjectID")}
    blobs = {
        e.get("BinaryHash"): e.text
        for e in xml.iter()
        if e.get("Encoding") == "base64" and (e.text or "").strip()
    }
    (item,) = xml.findall("VideoClipTrackItem")
    sub = objects[item.find("./ClipTrackItem/SubClip").get("ObjectRef")]
    clip = objects[sub.find("Clip").get("ObjectRef")]
    origin = int(clip.findtext("Clip/InPoint"))
    length = int(clip.findtext("Clip/OutPoint")) - origin
    if item.findtext("PixelAspectRatio") != "1,1" or set(
        el.text for el in xml.iter("VideoFrameRate")
    ) != {"8475667200"}:
        raise ValueError("Unsupported Premiere sequence clock or pixel aspect")
    if length != int(item.findtext(".//TrackItem/End")) - int(
        item.findtext(".//TrackItem/Start")
    ):
        raise ValueError("Retime needs a source clock")
    w, h = map(int, item.findtext("FrameRect").split(",")[2:])
    chain = objects[item.find(".//ComponentOwner/Components").get("ObjectRef")]
    components = []
    outer_scale = 1.0
    for link in chain.findall("ComponentChain/Components/Component"):
        cmp = objects[link.get("ObjectRef")]
        kind = cmp.findtext("MatchName")
        if cmp.findtext("Component/Bypass") == "true":
            continue
        if kind not in ["AE.ADBE Text", "AE.ADBE Shape", "AE.ADBE Motion"]:
            raise ValueError("Unsupported effect " + str(kind))
        values = {}
        curves = {}
        for i, param in enumerate(cmp.findall("Component/Params/Param")):
            node = objects[param.get("ObjectRef")]
            key = (node.findtext("Name") or "").strip() or f"param{i}"
            if key in ("Appearance", "Path", "Source Text"):
                value = node.find(".//StartKeyframeValue")
                raw = base64.b64decode(
                    (value.text or "").strip() or blobs[value.get("BinaryHash")]
                )
                values[key] = {
                    "Appearance": solid_appearance,
                    "Path": rectangle_path,
                    "Source Text": text_document,
                }[key](raw)
            elif start := node.findtext(".//StartKeyframe"):
                values[key] = parameter_value(start.split(",")[1])
            if keys := node.findtext(".//Keyframes"):
                if key not in ("Scale", "Position", "Opacity"):
                    raise ValueError("Unsupported animated control " + key)
                curves[key] = linear_keys(keys, origin)
                if key == "Scale":
                    values[key] = max(v for _, v in curves[key])
            elif node.findtext(".//IsTimeVarying") == "true":
                raise ValueError("Missing animated control data")
        if kind == "AE.ADBE Motion":
            if (
                components
                or curves
                or values["Position"] != [0.5, 0.5]
                or values["Anchor Point"] != [0.5, 0.5]
                or values["Rotation"]
                or not values["param3"]
                or values.get("Anti-flicker Filter")
            ):
                raise ValueError("Unsupported sequence motion")
            outer_scale = values["Scale"] / 100
        else:
            components.append(dict(kind=kind, values=values, curves=curves))
    return dict(
        name=definition["capsuleName"],
        width=w,
        height=h,
        duration=length / TICKS,
        components=[*components, dict(kind="Clip")],
        globalScale=outer_scale,
        source=digest(project),
        graphic=digest(graphic),
        package=digest(package),
    )


def make_animated_scene(title, original=False):
    scene, fonts, controls = make_scene(title, original)
    layers = iter(scene["project"]["items"]["1"]["kind"]["layers"])
    w, h = title["width"], title["height"]
    scale = title["globalScale"]

    def pos(x, y):
        return [w / 2 + (x * w - w / 2) * scale, h / 2 + (y * h - h / 2) * scale, 0]

    for cmp in title["components"][:-1]:
        values = cmp["values"]
        curves = cmp["curves"]
        text = values.get("Source Text")
        if text and len(text["runs"]) != 1:
            raise ValueError("Animated mixed-style line needs separate bindings")
        n = (
            2
            if text and text["runs"][0]["applyStroke"] and text["runs"][0]["applyFill"]
            else 1
        )
        for _ in range(n):
            layer = next(layers)
            props = {p["match"]: p for p in nodes(layer["props"])}
            for name, target, convert_value in [
                ("Position", "position", lambda v: pos(*v)),
                (
                    "Scale",
                    "scale",
                    lambda v: [
                        (v if values.get("param5", True) else horizontal_scale(values))
                        * scale,
                        v * scale,
                        100,
                    ],
                ),
                ("Opacity", "opacity", lambda v: v),
            ]:
                prop = props[target]
                prop["value"]["v"] = convert_value(values[name])
                if name not in curves:
                    continue
                prop["keys"] = [
                    dict(
                        time=t,
                        value=dict(t=prop["value"]["t"], v=convert_value(v)),
                        in_interp="Linear",
                        out_interp="Linear",
                        in_ease=[],
                        out_ease=[],
                        continuous=False,
                        auto_bezier=False,
                        spatial_in=[0, 0, 0],
                        spatial_out=[0, 0, 0],
                        spatial_auto=False,
                        spatial_continuous=False,
                        roving=False,
                    )
                    for t, v in curves[name]
                ]
                prop["value"] = prop["keys"][0]["value"].copy()
    if next(layers, None):
        raise ValueError("Unmatched scene layer")
    for control in controls:
        if control["type"] == "text":
            control["fontSize"] *= scale
    return scene, fonts, controls
