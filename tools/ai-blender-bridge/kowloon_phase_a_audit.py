#!/usr/bin/env python3
"""Read-only coverage and geometry audit for Kowloon Blender Bridge jobs.

Audits *submitted commands*, not whether Android Blender executed them.
No history deletion, reset, rendering, GitHub Actions or invented geometry.
"""
import argparse
import json
import math
from collections import Counter
from pathlib import Path

def inspect(job):
    parts = job.get("source_parts", [])
    commands = job.get("steps", [])
    seen = Counter()
    errors = []
    warnings = []
    geometry = Counter()
    bounds_min = [math.inf] * 3
    bounds_max = [-math.inf] * 3
    categories = Counter()
    for index, step in enumerate(commands):
        if step.get("op") != "mesh":
            continue
        verts = step.get("vertices", [])
        faces = step.get("faces", [])
        geometry["mesh_commands"] += 1
        geometry["vertices_in_commands"] += len(verts)
        geometry["faces_in_commands"] += len(faces)
        categories[step.get("name", "(unnamed)")] += 1
        if len(verts) > 12000 or len(faces) > 16000:
            errors.append(f"mesh step {index}: exceeds per-command limits")
        for vi, xyz in enumerate(verts):
            if (not isinstance(xyz, list) or len(xyz) != 3 or
                    not all(isinstance(v, (int, float)) and math.isfinite(v) for v in xyz)):
                errors.append(f"mesh step {index}: invalid vertex {vi}")
                continue
            for ax in range(3):
                bounds_min[ax] = min(bounds_min[ax], xyz[ax])
                bounds_max[ax] = max(bounds_max[ax], xyz[ax])
        for fi, face in enumerate(faces):
            if (not isinstance(face, list) or len(face) not in (3, 4) or
                    len(set(face)) != len(face) or
                    any(type(k) is not int or k < 0 or k >= len(verts) for k in face)):
                errors.append(f"mesh step {index}: invalid face {fi}")
        for entry in step.get("source_ranges", []):
            if not isinstance(entry, list) or len(entry) != 3:
                errors.append(f"mesh step {index}: invalid source range")
                continue
            part_index, start, count = entry
            if (type(part_index) is not int or not 0 <= part_index < len(parts)
                    or type(start) is not int or type(count) is not int
                    or start < 0 or count <= 0 or start + count > len(faces)):
                errors.append(f"mesh step {index}: out-of-range evidence reference {entry}")
            else:
                seen[part_index] += 1
    if geometry["mesh_commands"] == 0:
        errors.append("job has no meshes")
    unmapped = [i for i in range(len(parts)) if not seen[i]]
    duplicated = [i for i in range(len(parts)) if seen[i] > 1]
    if unmapped:
        errors.append(f"{len(unmapped)} source parts are not referenced")
    if duplicated:
        warnings.append(f"{len(duplicated)} source parts referenced multiple times; review intent")
    metadata = job.get("evidence_status", "")
    if not metadata:
        warnings.append("missing evidence status")
    has_completed_save = any(s.get("op") == "save" and s.get("label") == "completed-kowloon"
                             for s in commands)
    if not has_completed_save:
        warnings.append("no completed-kowloon save step; do not run destructive updates")
    metadata_report = {
        "project": job.get("project"),
        "job_id": job.get("id"),
        "model_revision": job.get("model_revision"),
        "source_file": job.get("source_file"),
        "source_sha256": job.get("source_sha256"),
        "evidence_status_verbatim": metadata,
    }
    result = {
        "scope": "static job audit; not Blender execution proof or historical verification",
        "metadata": metadata_report,
        "counts": {
            "steps": len(commands),
            "source_parts": len(parts),
            "source_parts_referenced": len(seen),
            "source_ranges": sum(seen.values()),
            **geometry,
        },
        "bounds_blender_coordinates": None if geometry["mesh_commands"] == 0 else {
            "min": bounds_min, "max": bounds_max,
        },
        "mesh_command_categories": dict(categories),
        "completed_save_present": has_completed_save,
        "historical_coverage": {
            "total_mapped_plots_stated_in_job": 234 if "234区画" in metadata else None,
            "north_plots_with_storey_records_stated_in_job": 19 if "北部19棟" in metadata else None,
            "plots_with_unknown_height_stated_in_job": 215 if "215区画" in metadata else None,
            "verified_building_envelopes": None,
            "verified_interior_spaces": None,
            "verified_connections_and_openings": None,
            "note": "Numbers are transcribed from job metadata, not independently established.",
        },
        "fire_simulation_readiness": {
            "watertight_compartments": "NOT_VERIFIED",
            "connected_stair_and_corridor_network": "NOT_VERIFIED",
            "material_properties": "NOT_VERIFIED",
            "ventilation_openings": "NOT_VERIFIED",
            "suitable_for_quantitative_fire_simulation": False,
        },
        "errors": errors,
        "warnings": warnings,
        "passed_static_checks": not errors,
    }
    return result

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("job", type=Path, help="JSON job to inspect; never mutates this file")
    ap.add_argument("--out", type=Path, help="optional report file")
    args = ap.parse_args()
    report = inspect(json.loads(args.job.read_text(encoding="utf-8")))
    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(output + "\n", encoding="utf-8")
    print(output)
    raise SystemExit(0 if report["passed_static_checks"] else 1)

if __name__ == "__main__":
    main()
