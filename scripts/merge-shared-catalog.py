#!/usr/bin/env python3
"""Merge completed local batches without duplicating media bytes on disk.

Pass already imported/frozen batches first: their immutable public metadata wins
for identical content IDs. Source aliases remain in the private provenance files.
The destination contains hard links plus one public catalog.json, never archives.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""): value.update(chunk)
    return value.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folders", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve(); output.mkdir(parents=True, exist_ok=True)
    records, files, aliases = {}, {}, 0
    for folder in args.folders:
        root = folder.resolve()
        manifest = json.loads((root / "catalog.json").read_text(encoding="utf-8"))
        if set(manifest) != {"schemaVersion", "items"} or manifest["schemaVersion"] != 1: raise ValueError("Invalid batch manifest")
        for item in manifest["items"]:
            if item["id"] in records: aliases += 1; continue
            records[item["id"]] = item
            for obj in [item["media"], item.get("poster")]:
                if not obj or obj["file"] in files: continue
                source = (root / obj["file"]).resolve()
                target = output / obj["file"]
                if not source.is_relative_to(root) or not target.resolve().is_relative_to(output): raise ValueError("Catalog object path escapes its folder")
                if source.stat().st_size != obj["bytes"] or digest(source) != obj["sha256"]: raise ValueError("Catalog object failed integrity verification")
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    if target.stat().st_size != obj["bytes"] or digest(target) != obj["sha256"]: raise ValueError("Existing merged object has different bytes")
                else:
                    # Fail clearly on different volumes rather than silently copying GB.
                    os.link(source, target)
                files[obj["file"]] = obj
    temporary = output / "catalog.json.tmp"
    temporary.write_text(json.dumps({"schemaVersion":1,"items":list(records.values())},indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    temporary.replace(output / "catalog.json")
    print(json.dumps({"items":len(records),"objects":len(files),"duplicateSourceRecords":aliases,"bytes":sum(item["bytes"] for item in files.values()),"additionalMediaBytesOnDisk":0,"uploaded":False}))


if __name__ == "__main__": main()
