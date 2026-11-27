"""Executed inside Blender's Python runtime. Strict JSON config; no eval or remote scripts."""
import bpy
import json
import os
import sys
import traceback
from pathlib import Path

def run():
    argv = sys.argv[sys.argv.index("--") + 1:]
    if len(argv) != 3:
        raise ValueError("expected: -- input.blend output_dir job.json")
    source, out_dir, config_path = map(Path, argv)
    job = json.loads(config_path.read_text(encoding="utf-8"))
    if not source.is_file() or source.suffix.lower() != ".blend":
        raise ValueError("input Blender project missing")
    out_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.data.scenes.get(job.get("scene", "AI Bridge Studio"))
    if scene is None:
        raise ValueError("scene not found")
    if len(scene.objects) < 100:
        raise ValueError("source scene unexpectedly small; refusing output")
    if scene.camera is None:
        raise ValueError("scene has no camera")
    if bpy.context.window:
        bpy.context.window.scene = scene
    cfg = job["render"]
    width, height = int(cfg["width"]), int(cfg["height"])
    if not (64 <= width <= 3840 and 64 <= height <= 2160):
        raise ValueError("render dimensions out of range")
    engine = cfg.get("engine", "BLENDER_EEVEE_NEXT")
    available = {p.identifier for p in scene.render.bl_rna.properties["engine"].enum_items}
    if engine not in available:
        # Android scene is not necessarily compatible with the host engine.
        for fallback in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
            if fallback in available:
                engine = fallback
                break
        else:
            raise ValueError("no supported Blender render engine")
    scene.render.engine = engine
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.frame_set(int(cfg.get("frame", 1)))
    result = {
        "scene": scene.name,
        "objects": len(scene.objects),
        "render_engine": scene.render.engine,
        "outputs": []
    }
    if job.get("save_blend", True):
        target = out_dir / "kowloon-cloud.blend"
        bpy.ops.wm.save_as_mainfile(filepath=str(target), check_existing=False, compress=True)
        result["outputs"].append(target.name)
    image = out_dir / "preview.png"
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(image)
    bpy.ops.render.render(write_still=True, scene=scene.name)
    if not image.is_file() or image.stat().st_size < 100:
        raise RuntimeError("render did not produce an image")
    result["outputs"].append(image.name)
    if job.get("export_glb", False):
        out = out_dir / "kowloon-cloud.glb"
        # Export only when the operator exists; no decimation performed.
        if not hasattr(bpy.ops.export_scene, "gltf"):
            raise RuntimeError("GLB export is unavailable in this Blender installation")
        bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB")
        result["outputs"].append(out.name)
    (out_dir / "render-report.json").write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print("CLOUD_BLENDER_RESULT", json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    try:
        run()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
