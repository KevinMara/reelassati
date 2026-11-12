"""Pack verified catalog evidence for the foreground owner importer; no network/model calls."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
files = sorted(args.directory.glob("stock-*.json"))
if not files:
    raise SystemExit("No evidence records found.")
partial = args.output.with_suffix(args.output.suffix + ".partial")
with gzip.open(partial, "wt", encoding="utf-8", compresslevel=6) as stream:
    stream.write(json.dumps({"schema": "reelassati-catalog-evidence/v1", "count": len(files)}) + "\n")
    for path in files:
        packet = json.loads(path.read_text(encoding="utf-8"))
        if packet.get("catalogId") != path.stem or packet.get("schemaVersion") != 1:
            raise ValueError(f"Invalid packet identity: {path.name}")
        stream.write(json.dumps(packet, separators=(",", ":")) + "\n")
partial.replace(args.output)
with args.output.open("rb") as stream:
    digest = hashlib.file_digest(stream, "sha256").hexdigest()
print(json.dumps({"records": len(files), "bytes": args.output.stat().st_size, "sha256": digest, "file": str(args.output)}))
