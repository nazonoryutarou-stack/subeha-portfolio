#!/usr/bin/env python3
"""Convert the evidence-led Kowloon OBJ export to existing Blender Bridge mesh commands."""
from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path

MAX_BYTES = 512_000
MAX_VERTICES = 12_000
MAX_FACES = 16_000
VIEWS = {
    "gallery": ("30_SW_gallery_extensions_with_facade_UNSCALED.obj", "九龍城西南角・上層帯材3段の可視面を追加"),
    "facade": ("25_SW_extended_galleries_two_view_UNSCALED.obj", "九龍城西南角・下層ギャラリーと張出しの接続部"),
    "no24": ("20_No24_seven_flats_SECTION.obj", "東頭村道24号の7住戸・水平断面"),
    "city": ("00_CITY_whole_area_WORKING.obj", "九龍城砦の全域・街路と区画"),
    "roofs": ("24A_No19_No3_roof_section_SMALL.obj", "信義里19号・長安里3号の屋上・小さい縮尺案"),
}


def obj_parts(path):
    """Read absolute or relative OBJ indices while retaining each named component."""
    vertices = []
    parts = []
    current = None
    for row in path.read_text(encoding="utf-8").splitlines():
        values = row.split()
        if not values or values[0].startswith("#"):
            continue
        kind = values[0]
        if kind == "o":
            current = {"name": " ".join(values[1:]), "vertices": [], "faces": [], "lookup": {}}
            parts.append(current)
        elif kind == "v":
            point = [float(value) for value in values[1:4]]
            if len(point) != 3 or not all(math.isfinite(v) for v in point):
                raise ValueError("Invalid OBJ vertex")
            vertices.append(point)
        elif kind == "f":
            if current is None:
                raise ValueError("Every source face needs an object name")
            face = []
            for token in values[1:]:
                value = int(token.split("/")[0])
                index = value - 1 if value > 0 else len(vertices) + value
                if not 0 <= index < len(vertices):
                    raise ValueError("OBJ index out of range")
                lookup = current["lookup"]
                if index not in lookup:
                    lookup[index] = len(current["vertices"])
                    current["vertices"].append(vertices[index])
                face.append(lookup[index])
            if len(face) not in (3, 4) or len(set(face)) != len(face):
                raise ValueError("Source faces must be triangles or quads")
            current["faces"].append(face)
    result = [{k: v for k, v in p.items() if k != "lookup"} for p in parts if p["faces"]]
    if not result:
        raise ValueError("Source model has no faces")
    return result


def compact_number(value, precision):
    rounded = round(value, precision)
    return int(rounded) if rounded == int(rounded) else rounded


def category(name):
    if name.startswith("PLAN_ONLY"):
        return "地図の区画・高さ未確定"
    if name.startswith(("PROV_UNSURVEYED", "DER_ROUTE_CUT")):
        return "北部19棟・階高は作業値"
    if name.startswith("MAP_STREET"):
        return "資料に基づく街路"
    if name.startswith("RF11"):
        return "写真から推定した西側の屋根と壁"
    if name.startswith("LOC12"):
        return "公文書地図と対応する番地"
    return "図面から採録した部材"


def mesh_commands(parts, origin, source_indices, merge=False):
    precision = 3 if merge else 6
    groups = defaultdict(list)
    for part in parts:
        groups[category(part["name"]) if merge else part["name"]].append(part)
    steps = []
    chunk_vertices = 600 if merge else MAX_VERTICES
    for group, members in groups.items():
        step = None
        for part in members:
            if len(part["vertices"]) > MAX_VERTICES or len(part["faces"]) > MAX_FACES:
                raise ValueError("Individual component exceeds the existing bridge limits")
            if (step is None or len(step["vertices"]) + len(part["vertices"]) > chunk_vertices
                    or len(step["faces"]) + len(part["faces"]) > MAX_FACES):
                step = {"op": "mesh", "name": "KWC_" + group, "vertices": [], "faces": [], "source_ranges": []}
                steps.append(step)
            vertex_offset = len(step["vertices"])
            face_offset = len(step["faces"])
            # Proper axis rotation, determinant +1: OBJ X/Y-up/Z -> Blender X/-Z/Y-up.
            for x, y, z in part["vertices"]:
                step["vertices"].append([compact_number(x-origin[0], precision), compact_number(-(z-origin[2]), precision), compact_number(y, precision)])
            step["faces"].extend([[i+vertex_offset for i in face] for face in part["faces"]])
            step["source_ranges"].append([source_indices[part["name"]], face_offset, len(part["faces"])])
    return steps


def evidence_table(records):
    columns = ["name", "source", "status", "note", "assumptions"]
    values = {key: [] for key in columns[1:]}
    rows = []
    for record in records:
        row = [record["name"]]
        for key in columns[1:]:
            value = record.get(key, [] if key == "assumptions" else "")
            if value not in values[key]:
                values[key].append(value)
            row.append(values[key].index(value))
        rows.append(row)
    return columns, values, rows


def build_job(root, view, job_id, render=False, save_before=False, save_after=False):
    filename, title = VIEWS[view]
    source = root / "model" / filename
    manifest = json.loads((root / "evidence" / "project_manifest.json").read_text(encoding="utf-8"))
    record = next(m for m in manifest["models"] if m["file"] == filename)
    parts = obj_parts(source)
    provenance = {m["name"]: m for m in record["parts"]}
    if set(provenance) != {p["name"] for p in parts}:
        raise ValueError("OBJ parts differ from the evidence manifest")
    points = [v for part in parts for v in part["vertices"]]
    lo = [min(v[i] for v in points) for i in range(3)]
    hi = [max(v[i] for v in points) for i in range(3)]
    origin = [(lo[0]+hi[0])/2, 0, (lo[2]+hi[2])/2]
    commands = mesh_commands(parts, origin, {p["name"]: i for i, p in enumerate(record["parts"])}, merge=view == "city")
    span = max(hi[i]-lo[i] for i in range(3))
    target = [0, 0, (lo[1]+hi[1])/2]
    camera = [span*.88, -span*1.15, target[2]+span*1.45]
    if view == "gallery":
        # Frame the actual mesh at the preview's3:2 aspect instead of placing
        # a camera at a fixed distance from the bounding-box size.
        dot = lambda a,b: sum(x*y for x,y in zip(a,b))
        normalise = lambda a: [x/math.sqrt(dot(a,a)) for x in a]
        eye = normalise([.72,-1.7,.7])
        right = normalise([-eye[1],eye[0],0])
        up = [eye[1]*right[2]-eye[2]*right[1],eye[2]*right[0]-eye[0]*right[2],eye[0]*right[1]-eye[1]*right[0]]
        coords = [[x-origin[0],-(z-origin[2]),y] for x,y,z in points]
        offsets = [[v[i]-target[i] for i in range(3)] for v in coords]
        tan_x = 36/(2*42);tan_y=tan_x*426/640
        distance = max(dot(v,eye)+max(abs(dot(v,right))/(tan_x*.83),abs(dot(v,up))/(tan_y*.83)) for v in offsets)
        camera = [target[i]+distance*eye[i] for i in range(3)]
    steps = [{"op": "reset"}, *commands,
             {"op": "camera", "name": "九龍城_確認カメラ", "location": camera, "target": target, "lens": 42},
             {"op": "light", "name": "九龍城_中立光", "type": "SUN", "location": [-span, -span, span*2], "target": target, "energy": 2.5},
             {"op": "world", "color": [.035, .035, .035] if view == "gallery" else [.68, .68, .68], "strength": .4 if view == "gallery" else .65},
             {"op": "render_settings", "width": 960, "height": 720}, {"op": "status"}]
    if save_before:
        steps.insert(0, {"op": "save", "label": "before-kowloon"})
    if save_after:
        steps.insert(-1, {"op": "save", "label": "completed-kowloon"})
    if render:
        steps.insert(-1, {"op": "render", "width": 640, "height": 426})
    status = {
        "gallery": "昼夜双方で読める上層帯材3段の面を追加。既存の面を延長する作業上の制約を含む。1段は照合差により保留。隠れた裏面・厚み・実寸・全域配置は未確定。",
        "facade": "昼夜の原写真から採録した外壁。4組の張出しの帯、下層7段の帯材、縦材39片。実寸・全域図への配置・隠れた内部は未確定。相対単位。",
        "no24": "公文書図面の7住戸。水平寸法の単位は仮定、断面の表示高は0.82m。階の標高と城砦内での室内の向きは未確定。",
        "city": "全域234区画、北部19棟の階数記録。北部の階高・通路の高さは作業値。215区画の高さは未確定。西側2面の屋根高は写真推定。",
        "roofs": "屋上の平面図と13本の階段投影線。屋根の標高は未確定。水平縮尺は面積注記からの小さい案、柵高は図記載の3.5ft。",
    }[view]
    columns, evidence, rows = evidence_table(record["parts"])
    job = {
        "id": job_id, "title": title, "project": "kowloon", "model_revision": manifest["version"],
        "source_file": filename, "render_requested": render, "save_before_reset": save_before, "save_after_build": save_after, "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "source_units": record["units"], "source_origin_OBJ": origin,
        "axis_rotation": [[1,0,0],[0,0,-1],[0,1,0]],
        "viewport_coordinate_precision": .001 if view == "city" else .000001,
        "viewport_coordinate_unit": "model_unit" if record["units"].startswith("RELATIVE") else "metre",
        "source_range_columns": ["source_part_index", "face_start", "face_count"],
        "evidence_status": status, "evidence_columns": columns, "evidence_values": evidence, "source_parts": rows,
        "steps": steps,
    }
    if not record["units"].startswith("RELATIVE"):
        job["viewport_coordinate_precision_m"] = job["viewport_coordinate_precision"]
    encoded = json.dumps(job, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    # The installed relay reserializes with spaces, and /next adds a wrapper.
    if len(json.dumps(job, ensure_ascii=False).encode()) > MAX_BYTES:
        raise ValueError("Job exceeds the installed bridge's 512000-byte budget")
    if len(steps) > 240 or sum(len(s.get("vertices", [])) for s in steps) > 100_000:
        raise ValueError("Job exceeds the installed bridge's scene budget")
    return job, encoded


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("root", type=Path, help="Unpacked Kowloon deliverable with model/ and evidence/")
    ap.add_argument("--view", choices=VIEWS, default="no24")
    ap.add_argument("--save-before", action="store_true", help="Save the current Blender project to the local relay before resetting its studio")
    ap.add_argument("--save-after", action="store_true", help="Save the completed studio to the local relay before optional rendering")
    ap.add_argument("--render", action="store_true", help="Also render a 640x426 PNG to the local relay")
    ap.add_argument("--id", required=True, help="New job ID for this model revision")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    if not (3 <= len(args.id) <= 80) or any(not c.isascii() or not (c.isalnum() or c in "-_.") for c in args.id):
        ap.error("id must contain 3–80 ASCII letters, digits, hyphens, underscores or periods")
    job, data = build_job(args.root, args.view, args.id, args.render, args.save_before, args.save_after)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(data+"\n", encoding="utf-8")
    print(json.dumps({"id": job["id"], "file": str(args.out), "bytes": len((data+"\n").encode()),
                      "components": len(job["source_parts"]), "mesh_commands": sum(s["op"] == "mesh" for s in job["steps"]),
                      "faces": sum(len(s.get("faces", [])) for s in job["steps"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()

