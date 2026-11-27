#!/usr/bin/env python3
"""Single cloud Blender job. No GitHub Actions. No background billing by default.

Inputs:
  /workspace/inputs/kowloon-v13.blend  (copied once via provider's upload)
Outputs:
  /workspace/outputs/<job-id>/...     (on provider persistent volume)
Optional S3-compatible mirror:
  CLOUD_S3_BUCKET and AWS credential variables; CLOUD_S3_ENDPOINT_URL optional.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

JOB_URL = ("https://raw.githubusercontent.com/nazonoryutarou-stack/"
           "subeha-portfolio/main/tools/cloud-blender/jobs/current.json")
WORKSPACE = Path(os.getenv("CLOUD_WORKSPACE", "/workspace"))
ALLOWED_ENGINES = {"BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH", "BLENDER_CYCLES"}

def fetch_job():
    with urllib.request.urlopen(
        urllib.request.Request(JOB_URL, headers={"Cache-Control": "no-cache"}),
        timeout=20
    ) as res:
        data = res.read(32769)
    if len(data) > 32768:
        raise ValueError("job oversized")
    return json.loads(data)

def check_job(job):
    jid = job.get("id", "")
    filename = job.get("input", "")
    if not isinstance(jid, str) or not re.fullmatch(r"[A-Za-z0-9_-]{3,64}", jid):
        raise ValueError("invalid job id")
    if not isinstance(filename, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+[.]blend", filename):
        raise ValueError("invalid input filename")
    if filename.startswith(".") or ".." in filename:
        raise ValueError("unsafe input filename")
    if not isinstance(job.get("scene"), str) or len(job["scene"]) > 80:
        raise ValueError("invalid scene")
    cfg = job.get("render")
    if not isinstance(cfg, dict) or cfg.get("engine") not in ALLOWED_ENGINES:
        raise ValueError("invalid render config")
    if not isinstance(cfg.get("width"), int) or not isinstance(cfg.get("height"), int):
        raise ValueError("invalid render dimensions")
    if not 64 <= cfg["width"] <= 3840 or not 64 <= cfg["height"] <= 2160:
        raise ValueError("invalid render dimensions")
    if not isinstance(cfg.get("frame"), int) or not 1 <= cfg["frame"] <= 500000:
        raise ValueError("invalid frame")
    if type(job.get("save_blend")) is not bool or type(job.get("export_glb")) is not bool:
        raise ValueError("invalid output settings")
    return jid, filename

def upload_s3(files, jid):
    bucket = os.getenv("CLOUD_S3_BUCKET")
    if not bucket:
        print("Cloud S3 not configured: files retained in persistent output volume")
        return
    import boto3
    options = {}
    if os.getenv("CLOUD_S3_ENDPOINT_URL"):
        options["endpoint_url"] = os.environ["CLOUD_S3_ENDPOINT_URL"]
    client = boto3.client("s3", **options)
    for f in files:
        client.upload_file(str(f), bucket, f"kowloon/{jid}/{f.name}")
        print("Uploaded:", f"s3://{bucket}/kowloon/{jid}/{f.name}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="perform exactly one job and exit")
    args = parser.parse_args()
    job = fetch_job()
    jid, filename = check_job(job)
    source = WORKSPACE / "inputs" / filename
    if not source.is_file():
        raise SystemExit(f"Missing input file: {source}. Upload existing Kowloon .blend first.")
    out = WORKSPACE / "outputs" / jid
    if out.exists() and any(out.iterdir()):
        raise SystemExit(f"Refusing to overwrite existing output: {out}. Change job id.")
    out.mkdir(parents=True, exist_ok=True)
    jobfile = out / "job.json"
    jobfile.write_text(json.dumps(job, indent=2, ensure_ascii=False), encoding="utf-8")
    task = Path(__file__).resolve().parent / "blender_task.py"
    command = ["blender", "--background", "--factory-startup", "--python-exit-code", "1",
               "--python", str(task), "--", str(source), str(out), str(jobfile)]
    print("Executing:", " ".join(command))
    try:
        with (out / "blender.log").open("w", encoding="utf-8") as log:
            subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, check=True)
        # Publish finished deliverables only; keep logs and the job specification private.
        deliverables = ("preview.png", "kowloon-cloud.blend", "kowloon-cloud.glb", "render-report.json")
        upload_s3([out / name for name in deliverables if (out / name).is_file()], jid)
        print("COMPLETED:", str(out))
    except BaseException:
        print("FAILED; inspect log:", out / "blender.log", file=sys.stderr)
        raise

if __name__ == "__main__":
    main()
