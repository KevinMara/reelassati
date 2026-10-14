"""Offline checks for existing audio; never calls a hosted AI provider.

Usage: py -3.11 scripts/audio-quality-check.py INPUT... --output REPORT.json
Requires ffmpeg/ffprobe. Optional --transcribe uses an installed Whisper base
model and its existing cache. Signal/ASR metrics are not human listening scores.
"""
import argparse
import array
import json
import math
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("inputs", nargs="+")
parser.add_argument("--output", required=True)
parser.add_argument("--transcribe", action="store_true")
args = parser.parse_args()
model = None
if args.transcribe:
    import whisper
    import torch
    # Bound CPU contention while the local capacity test is running.
    torch.set_num_threads(2)
    model = whisper.load_model("base", device="cpu")

reports = []
for source in args.inputs:
    path = Path(source).resolve(strict=True)
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)
    ], text=True, encoding="utf-8"))
    stream = next(s for s in probe["streams"] if s["codec_type"] == "audio")
    decoded = subprocess.run([
        "ffmpeg", "-v", "error", "-xerror", "-i", str(path), "-map", "0:a:0",
        "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1"
    ], capture_output=True, check=True)
    samples = array.array("f")
    samples.frombytes(decoded.stdout)
    if sys.byteorder != "little":
        samples.byteswap()
    peak = max(abs(v) for v in samples)
    rms = math.sqrt(sum(v*v for v in samples)/len(samples))
    to_db = lambda value: 20*math.log10(value) if value > 0 else None
    loudness = subprocess.run([
        "ffmpeg", "-hide_banner", "-i", str(path), "-af", "loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json",
        "-f", "null", "-"
    ], capture_output=True, text=True, encoding="utf-8", check=True)
    stderr = loudness.stderr
    measured = json.loads(stderr[stderr.rfind("{"):stderr.rfind("}")+1])
    channels = int(stream["channels"])
    rate = int(stream["sample_rate"])
    window = rate//50*channels  # 20 ms frames; active > -50 dBFS.
    activity = [math.sqrt(sum(v*v for v in samples[i:i+window])/len(samples[i:i+window])) > 10**(-50/20)
                for i in range(0, len(samples), window)]
    active = [i for i,v in enumerate(activity) if v]
    finite = lambda value: float(value) if math.isfinite(float(value)) else None
    report = {
        "file": str(path), "bytes": path.stat().st_size,
        "codec": stream["codec_name"], "sampleRate": rate, "channels": channels,
        "durationSeconds": len(samples)/channels/rate,
        "decodePassed": True, "samplePeakDbfs": to_db(peak), "rmsDbfs": to_db(rms),
        "clippedSamples": sum(abs(v)>=1 for v in samples),
        "dcOffset": sum(samples)/len(samples),
        "crestFactorDb": to_db(peak/rms) if rms else None,
        "integratedLufs": finite(measured["input_i"]),
        "truePeakDbtp": finite(measured["input_tp"]),
        "loudnessRangeLu": finite(measured["input_lra"]),
        "activeFrameFractionAtMinus50Dbfs": len(active)/len(activity),
        "leadingQuietSeconds": active[0]*.02 if active else len(activity)*.02,
        "trailingQuietSeconds": (len(activity)-1-active[-1])*.02 if active else len(activity)*.02,
    }
    if channels == 2:
        left, right = samples[::2], samples[1::2]
        energy = sum(v*v for v in left)*sum(v*v for v in right)
        report["stereoCorrelation"] = sum(l*r for l,r in zip(left,right))/math.sqrt(energy) if energy else None
    if model:
        result = model.transcribe(str(path), fp16=False, verbose=False, temperature=0)
        report["offlineAsr"] = {"model":"Whisper base", "language":result["language"], "text":result["text"].strip(),
            "segments":[{"start":s["start"],"end":s["end"],"text":s["text"].strip()} for s in result["segments"]]}
    reports.append(report)
    print(json.dumps(report, ensure_ascii=True, allow_nan=False), flush=True)
destination = Path(args.output)
destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(json.dumps({"scope":"Offline signal/ASR checks, no subjective MOS or controlled same-text model ranking", "audio":reports},indent=2,ensure_ascii=True,allow_nan=False)+"\n",encoding="utf-8")
