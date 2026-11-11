#!/usr/bin/env python3
"""Inspect purchased ZIPs and stage explicitly selected, verified media locally.

No network, provider, upload or archive-wide extraction is performed. Inventory
and source provenance stay in the private index; public labels are explicit.
Run with --help or a subcommand's --help for usage.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tempfile
import zipfile


MEDIA = {
    ".mp4": ("video", "video/mp4"), ".mov": ("video", "video/quicktime"),
    ".webm": ("video", "video/webm"), ".avi": ("video", "video/x-msvideo"),
    ".wav": ("audio", "audio/wav"), ".mp3": ("audio", "audio/mpeg"),
    ".ogg": ("audio", "audio/ogg"), ".flac": ("audio", "audio/flac"),
    ".m4a": ("audio", "audio/mp4"), ".aac": ("audio", "audio/aac"),
    ".png": ("image", "image/png"), ".jpg": ("image", "image/jpeg"),
    ".jpeg": ("image", "image/jpeg"), ".webp": ("image", "image/webp"),
    ".cube": ("lut", "application/octet-stream"),
}
TEMPLATES = {".aep", ".aepx", ".prproj", ".mogrt", ".prfpset", ".drfx", ".drp", ".drt", ".setting", ".fcpxml", ".moti", ".motn", ".motr"}
FORMATS = "mov,matroska,webm,wav,mp3,ogg,flac,aac,avi,image2,png_pipe,jpeg_pipe,webp_pipe"
FORBIDDEN_BRAND = re.compile(r"four[\s_-]*editors", re.IGNORECASE)


def digest_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as stream:
        temp = Path(stream.name)
        json.dump(data, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    try:
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def safe_member(info: zipfile.ZipInfo) -> str:
    name = info.filename.replace("\\", "/")
    parts = name.rstrip("/").split("/")
    if (not name or name.startswith("/") or any(p in {"", ".", ".."} for p in parts)
            or any(ord(c) < 32 for c in name) or re.match(r"^[a-zA-Z]:", name)
            or stat.S_ISLNK(info.external_attr >> 16) or info.flag_bits & 1):
        raise ValueError("Unsafe, encrypted or ambiguous archive member")
    return name


def scan(archive: Path, supplier: str, rights_basis: str) -> dict:
    if archive.suffix.lower() != ".zip":
        raise ValueError("Only ZIP inventory is supported; other archives remain uninspected")
    entries, excluded, seen = [], [], set()
    with zipfile.ZipFile(archive) as bundle:
        for info in bundle.infolist():
            name = safe_member(info)
            if name in seen:
                raise ValueError("Duplicate archive member names cannot be selected unambiguously")
            seen.add(name)
            if info.is_dir():
                continue
            part = PurePosixPath(name)
            extension = part.suffix.lower().strip()
            if "__MACOSX" in part.parts or part.name.startswith("._") or part.name == ".DS_Store":
                excluded.append({"sourcePath": name, "reason": "filesystem-metadata", "bytes": info.file_size})
                continue
            kind = MEDIA.get(extension, ("editor-template" if extension in TEMPLATES else "other", ""))[0]
            entries.append({
                "sourcePath": name, "extension": extension, "kind": kind,
                **({"archiveMember": info.filename} if name != info.filename else {}),
                "bytes": info.file_size, "compressedBytes": info.compress_size,
                "crc32": f"{info.CRC:08x}", "verification": {"state": "uninspected"},
            })
    return {
        "schemaVersion": 1, "visibility": "private-source-index",
        "source": {"supplier": supplier, "rightsBasis": rights_basis,
                   "archiveName": archive.name, "archiveBytes": archive.stat().st_size,
                   "archiveSha256": digest_file(archive)},
        "entries": entries, "excluded": excluded,
    }


def extract_member(bundle: zipfile.ZipFile, entry: dict, destination: Path, maximum: int) -> str:
    info = bundle.getinfo(entry.get("archiveMember", entry["sourcePath"]))
    if safe_member(info) != entry["sourcePath"] or f"{info.CRC:08x}" != entry["crc32"]:
        raise ValueError("Archive member identity changed")
    if info.file_size != entry["bytes"] or info.file_size > maximum:
        raise ValueError("Member size changed or exceeds the explicit extraction limit")
    digest, size = hashlib.sha256(), 0
    # Destination is an owned temporary/hash filename, never a name from the ZIP.
    with bundle.open(info) as source, destination.open("xb") as target:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            size += len(block)
            if size > maximum or size > info.file_size:
                raise ValueError("Expanded member exceeds declared/allowed size")
            target.write(block)
            digest.update(block)
    if size != info.file_size:
        raise ValueError("Incomplete archive member")
    return digest.hexdigest()


def inspect_cube(path: Path) -> dict:
    dimensions, size, samples = None, None, 0
    domains = {"DOMAIN_MIN": [0.0, 0.0, 0.0], "DOMAIN_MAX": [1.0, 1.0, 1.0]}
    declared = set()
    with path.open("r", encoding="utf-8-sig") as stream:
        for raw in stream:
            line = raw.split("#", 1)[0].strip()
            if not line:
                continue
            fields = line.split()
            key = fields[0]
            if key == "TITLE":
                continue
            if key in {"LUT_1D_SIZE", "LUT_3D_SIZE"}:
                if size is not None or len(fields) != 2:
                    raise ValueError("Ambiguous CUBE table declaration")
                dimensions = 1 if key == "LUT_1D_SIZE" else 3
                size = int(fields[1])
                if not 2 <= size <= (65536 if dimensions == 1 else 128):
                    raise ValueError("CUBE grid is outside supported validation bounds")
            elif key in domains:
                if key in declared or len(fields) != 4:
                    raise ValueError("Invalid CUBE domain")
                domains[key] = [float(value) for value in fields[1:]]
                declared.add(key)
            else:
                if size is None or len(fields) != 3:
                    raise ValueError("Invalid CUBE data or unsupported directive")
                if not all(math.isfinite(float(value)) for value in fields):
                    raise ValueError("Non-finite CUBE sample")
                samples += 1
                if samples > size ** dimensions:
                    raise ValueError("Too many CUBE samples")
    if size is None or samples != size ** dimensions:
        raise ValueError("Incomplete CUBE table")
    if not all(math.isfinite(a) and math.isfinite(b) and a < b
               for a, b in zip(domains["DOMAIN_MIN"], domains["DOMAIN_MAX"])):
        raise ValueError("Invalid CUBE domain range")
    return {"dimensions": dimensions, "size": size, "samples": samples, **domains}


def inspect_media(path: Path, kind: str, timeout: int) -> dict:
    common = ["-v", "error", "-protocol_whitelist", "file", "-format_whitelist", FORMATS]
    result = subprocess.run([
        "ffprobe", *common, "-show_entries",
        "format=duration,format_name:stream=codec_type,codec_name,pix_fmt,width,height,r_frame_rate,sample_rate,channels,duration",
        "-of", "json", str(path),
    ], check=True, capture_output=True, text=True, timeout=timeout)
    probe = json.loads(result.stdout)
    streams = probe.get("streams", [])
    expected = "audio" if kind == "audio" else "video"
    if not any(stream.get("codec_type") == expected for stream in streams):
        raise ValueError("Media does not contain the claimed stream type")
    raw_duration = probe.get("format", {}).get("duration")
    duration = float(raw_duration) if raw_duration is not None else None
    if kind != "image" and (duration is None or not math.isfinite(duration) or duration <= 0):
        raise ValueError("Media duration is missing or invalid")
    subprocess.run([
        "ffmpeg", "-nostdin", "-xerror", "-threads", "1", "-filter_threads", "1", *common, "-i", str(path), "-map", "0:v?", "-map", "0:a?",
        "-f", "null", "-",
    ], check=True, capture_output=True, timeout=timeout)
    return {"duration": duration, "format": probe.get("format", {}).get("format_name"), "streams": streams}


def selected(index: dict, paths: list[str]) -> list[dict]:
    if not paths or len(set(paths)) != len(paths):
        raise ValueError("Select unique, exact member paths explicitly")
    by_path = {entry["sourcePath"]: entry for entry in index["entries"]}
    if any(path not in by_path for path in paths):
        raise ValueError("Selected member is not in this private index")
    return [by_path[path] for path in paths]


def verify_archive(archive: Path, index: dict) -> None:
    if index.get("visibility") != "private-source-index" or digest_file(archive) != index["source"]["archiveSha256"]:
        raise ValueError("Archive does not match the private index")


def probe_entries(archive: Path, index: dict, entries: list[dict], maximum: int, timeout: int) -> None:
    verify_archive(archive, index)
    with zipfile.ZipFile(archive) as bundle, tempfile.TemporaryDirectory(prefix="licensed-media-probe-") as root:
        for entry in entries:
            if entry["extension"] not in MEDIA:
                raise ValueError("This format needs a separate converter; it is not playable catalog media")
            path = Path(root) / ("sample" + entry["extension"])
            try:
                digest = extract_member(bundle, entry, path, maximum)
                metadata = inspect_cube(path) if entry["kind"] == "lut" else inspect_media(path, entry["kind"], timeout)
                entry["sha256"] = digest
                entry["technical"] = metadata
                entry["verification"] = {"state": "cube-validated" if entry["kind"] == "lut" else "decoded"}
            finally:
                path.unlink(missing_ok=True)


def stage_entry(archive: Path, index: dict, entry: dict, root: Path, label: str, maximum: int) -> dict:
    if not index["source"].get("rightsBasis", "").strip():
        raise ValueError("The private source record must contain the confirmed rights basis")
    if not label.strip() or len(label) > 80 or FORBIDDEN_BRAND.search(label) or any(ord(c) < 32 for c in label):
        raise ValueError("Provide a neutral public label of 1-80 characters")
    if entry["verification"]["state"] not in {"decoded", "cube-validated"}:
        raise ValueError("Probe and validate this exact member before staging")
    verify_archive(archive, index)
    root.mkdir(parents=True, exist_ok=True)
    root = root.resolve()
    relative = "media/" + entry["sha256"] + entry["extension"]
    target = root / relative
    target.parent.mkdir(exist_ok=True)
    if not target.resolve().is_relative_to(root) or target.parent.is_symlink():
        raise ValueError("Staging path escapes its destination")
    if target.exists():
        if digest_file(target) != entry["sha256"]:
            raise ValueError("An existing staged object has different bytes")
    else:
        with zipfile.ZipFile(archive) as bundle, tempfile.TemporaryDirectory(prefix="licensed-media-stage-") as temp:
            candidate = Path(temp) / ("sample" + entry["extension"])
            if extract_member(bundle, entry, candidate, maximum) != entry["sha256"]:
                raise ValueError("Member bytes changed after validation")
            with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as staged:
                staged_path = Path(staged.name)
            try:
                shutil.copyfile(candidate, staged_path)
                staged_path.replace(target)
            finally:
                staged_path.unlink(missing_ok=True)
    return {"id": "licensed-" + entry["sha256"][:24], "label": label.strip(),
            "kind": entry["kind"], "mime": MEDIA[entry["extension"]][1], "bytes": entry["bytes"],
            "sha256": entry["sha256"], "file": relative, "technical": entry["technical"],
            "rights": "platform-licensed", "availability": "local-staged"}


def validate_public(root: Path, manifest: dict) -> None:
    if set(manifest) != {"schemaVersion", "items"} or manifest.get("schemaVersion") != 1 or not isinstance(manifest.get("items"), list):
        raise ValueError("Unsupported public manifest")
    seen = set()
    root = root.resolve()
    allowed = {"id", "label", "kind", "mime", "bytes", "sha256", "file", "technical", "rights", "availability"}
    for item in manifest["items"]:
        if set(item) != allowed or item["id"] in seen or FORBIDDEN_BRAND.search(item["label"]):
            raise ValueError("Public manifest has duplicate, private or branded fields")
        seen.add(item["id"])
        if not re.fullmatch(r"media/[a-f0-9]{64}\.[a-z0-9]+", item["file"]):
            raise ValueError("Invalid public media path")
        path = root / item["file"]
        if not path.resolve().is_relative_to(root) or path.is_symlink() or not path.is_file():
            raise ValueError("Public object is missing or escapes staging")
        if path.stat().st_size != item["bytes"] or digest_file(path) != item["sha256"]:
            raise ValueError("Public media bytes do not match the manifest")
        if item["id"] != "licensed-" + item["sha256"][:24] or item["rights"] != "platform-licensed" or item["availability"] != "local-staged":
            raise ValueError("Public media identity or readiness is invalid")
        if not isinstance(item["label"], str) or not 1 <= len(item["label"].strip()) <= 80:
            raise ValueError("Public label is missing or too long")
        kind, mime = MEDIA.get(path.suffix.lower(), (None, None))
        if item["kind"] != kind or item["mime"] != mime:
            raise ValueError("Public media format does not match its file")
        technical = item["technical"]
        if kind == "lut":
            if technical != inspect_cube(path):
                raise ValueError("Public LUT details differ from the validated table")
        else:
            if set(technical) != {"duration", "format", "streams"} or not re.fullmatch(r"[a-z0-9_,]+", str(technical["format"])):
                raise ValueError("Private or unsupported technical fields in public catalog")
            duration = technical["duration"]
            if duration is not None and (not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0):
                raise ValueError("Invalid public media duration")
            if kind != "image" and duration is None:
                raise ValueError("Timed media requires its measured duration")
            stream_fields = {"codec_type", "codec_name", "pix_fmt", "width", "height", "r_frame_rate", "sample_rate", "channels", "duration"}
            streams = technical["streams"]
            if not isinstance(streams, list) or not streams:
                raise ValueError("Public media has no measured streams")
            for stream in streams:
                if not set(stream).issubset(stream_fields) or any(not re.fullmatch(r"[a-zA-Z0-9_./-]+", str(value)) for value in stream.values()):
                    raise ValueError("Private or unsupported stream fields in public catalog")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    scan_parser = commands.add_parser("scan", help="Inventory ZIP entries without extraction; write a PRIVATE source index")
    scan_parser.add_argument("archive", type=Path)
    scan_parser.add_argument("--index", required=True, type=Path)
    scan_parser.add_argument("--supplier", required=True)
    scan_parser.add_argument("--rights-basis", default="")
    for command in ("probe", "stage"):
        sub = commands.add_parser(command, help="Validate selected source members" if command == "probe" else "Stage one validated member with a neutral public label")
        sub.add_argument("archive", type=Path)
        sub.add_argument("--index", required=True, type=Path)
        sub.add_argument("--entry", required=True, action="append")
        sub.add_argument("--max-entry-bytes", type=int, default=256 * 1024 * 1024)
        if command == "probe":
            sub.add_argument("--timeout", type=int, default=60)
        else:
            sub.add_argument("--output", required=True, type=Path)
            sub.add_argument("--label", required=True)
    validate = commands.add_parser("validate", help="Check every local-staged catalog object's path, digest and public fields")
    validate.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.command == "scan":
        index = scan(args.archive, args.supplier, args.rights_basis)
        write_json(args.index, index)
        print(json.dumps({"indexed": len(index["entries"]), "excluded": len(index["excluded"]), "kinds": dict(Counter(e["kind"] for e in index["entries"]))}))
    elif args.command == "validate":
        manifest = json.loads((args.output / "catalog.json").read_text(encoding="utf-8"))
        validate_public(args.output, manifest)
        print(json.dumps({"validatedLocalObjects": len(manifest["items"]), "uploaded": False}))
    else:
        index = json.loads(args.index.read_text(encoding="utf-8"))
        entries = selected(index, args.entry)
        if args.command == "probe":
            probe_entries(args.archive, index, entries, args.max_entry_bytes, args.timeout)
            write_json(args.index, index)
            print(json.dumps({"validatedSelectedMembers": len(entries)}))
        else:
            if len(entries) != 1:
                parser.error("Stage one explicit member and label per invocation")
            item = stage_entry(args.archive, index, entries[0], args.output, args.label, args.max_entry_bytes)
            manifest_path = args.output / "catalog.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"schemaVersion": 1, "items": []}
            manifest["items"] = [old for old in manifest["items"] if old["id"] != item["id"]] + [item]
            validate_public(args.output, manifest)
            write_json(manifest_path, manifest)
            print(json.dumps({"staged": item["id"], "uploaded": False}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, zipfile.BadZipFile, subprocess.SubprocessError) as error:
        raise SystemExit(f"Catalog operation failed: {type(error).__name__}: {error}") from None
