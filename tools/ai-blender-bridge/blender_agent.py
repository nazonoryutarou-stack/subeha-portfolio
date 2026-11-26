"""Run from Blender's Python Console using the one-liner printed by bridge_server.

IMPORTANT: only allowlisted JSON operators execute. All generated content is
isolated in a Blender scene named 'AI Bridge Studio'; other scenes untouched.
"""
import bpy
import json
import math
import os
import tempfile
import time
import traceback
import urllib.request
from mathutils import Vector

BASE_URL = "http://127.0.0.1:8765"
STUDIO = "AI Bridge Studio"


def request(path, payload=None, timeout=5):
    url = BASE_URL + path + ("&" if "?" in path else "?") + "token=" + BRIDGE_TOKEN
    if payload is None:
        req = urllib.request.Request(url, headers={"Cache-Control": "no-store"})
    else:
        req = urllib.request.Request(url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                                     headers={"Content-Type": "application/json; charset=utf-8"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read(524288).decode("utf-8"))


def vector(v, default, length=3):
    if not isinstance(v, (tuple, list)) or len(v) != length:
        v = default
    xs = [float(x) for x in v]
    if not all(math.isfinite(x) and abs(x) <= 100000 for x in xs):
        raise ValueError("non-finite or out-of-range vector")
    return xs


def number(v, default, lo=-100000, hi=100000):
    n = float(default if v is None else v)
    if not math.isfinite(n) or not lo <= n <= hi:
        raise ValueError("parameter out of permitted range")
    return n


def name_of(step, default="AI Object"):
    name = str(step.get("name", default))[:90]
    if not name:
        name = default
    return name


def studio():
    s = bpy.data.scenes.get(STUDIO)
    if s is None:
        s = bpy.data.scenes.new(STUDIO)
        s.render.resolution_x = 760
        s.render.resolution_y = 530
        s.render.resolution_percentage = 100
    window = bpy.context.window
    if window is not None and window.scene != s:
        window.scene = s
    return s


def reset():
    s = studio()
    # Only objects in the dedicated studio are deleted, never other scenes.
    for obj in list(s.objects):
        if obj.users == 1:
            bpy.data.objects.remove(obj, do_unlink=True)
        else:
            for coll in list(obj.users_collection):
                if coll in s.collection.children_recursive or coll == s.collection:
                    coll.objects.unlink(obj)
    return s


def relocate_object(obj, s):
    for coll in list(obj.users_collection):
        coll.objects.unlink(obj)
    s.collection.objects.link(obj)
    obj.name = obj.name[:90]
    return obj


def apply_material(obj, info):
    if not isinstance(info, dict):
        return
    key = str(info.get("name", obj.name+" mat"))[:75]
    mat = bpy.data.materials.get("AIB_"+key)
    if mat is None:
        mat = bpy.data.materials.new("AIB_"+key)
    rgba = vector(info.get("color", [.58,.58,.58,1]), [.58,.58,.58,1], 4)
    rgba = [max(0., min(1., c)) for c in rgba]
    metallic = number(info.get("metallic", 0), 0, 0, 1)
    roughness = number(info.get("roughness", .62), .62, .02, 1)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
    if obj.data is not None and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def orient_to(obj, target):
    direction = Vector(target) - obj.location
    if direction.length < .0001:
        return
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def make_mesh_object(name, vertices, faces, material=None):
    scene = studio()
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    apply_material(obj, material)
    return obj


def create_box(step):
    size = vector(step.get("size"), [1, 1, 1])
    if min(size) <= .001 or max(size) > 1000:
        raise ValueError("box dimensions invalid")
    sx, sy, sz = (v * .5 for v in size)
    verts = [[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],
             [-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]]
    faces = [[3,2,1,0],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
    obj = make_mesh_object(name_of(step,"AI Box"), verts, faces, step.get("material"))
    obj.location = vector(step.get("location"), [0,0,0])
    bevel = number(step.get("bevel", 0), 0, 0, .5)
    if bevel:
        mod = obj.modifiers.new(name="Beveled edges", type="BEVEL")
        mod.width = min(bevel, min(size)*.3)
        mod.segments = 2
        if hasattr(mod, "affect"):
            mod.affect = "EDGES"
    return obj


def create_cylinder(step):
    radius = number(step.get("radius", .5), .5, .001, 100)
    depth = number(step.get("depth", 1), 1, .001, 1000)
    segs = int(number(step.get("vertices", 32), 32, 6, 96))
    vertices = []
    for z in (-depth/2,depth/2):
        for k in range(segs):
            a = 2*math.pi*k/segs
            vertices.append([radius*math.cos(a),radius*math.sin(a),z])
    faces = [list(range(segs-1,-1,-1)),list(range(segs,2*segs))]
    faces += [[k,(k+1)%segs,(k+1)%segs+segs,k+segs] for k in range(segs)]
    obj = make_mesh_object(name_of(step,"AI Cylinder"),vertices,faces,step.get("material"))
    obj.location = vector(step.get("location"), [0,0,0])
    return obj


def create_sphere(step):
    radius = number(step.get("radius", .5), .5, .001, 100)
    segments, rings = 24, 12
    vertices = [[0,0,radius]]
    for j in range(1,rings):
        phi = math.pi*j/rings
        for k in range(segments):
            theta = 2*math.pi*k/segments
            vertices.append([radius*math.sin(phi)*math.cos(theta),radius*math.sin(phi)*math.sin(theta),radius*math.cos(phi)])
    bottom = len(vertices)
    vertices.append([0,0,-radius])
    faces = [[0,1+k,1+(k+1)%segments] for k in range(segments)]
    for j in range(rings-2):
        a=1+j*segments
        b=1+(j+1)*segments
        faces += [[a+k,b+k,b+(k+1)%segments,a+(k+1)%segments] for k in range(segments)]
    faces += [[bottom,1+(rings-2)*segments+(k+1)%segments,1+(rings-2)*segments+k] for k in range(segments)]
    obj = make_mesh_object(name_of(step,"AI Sphere"),vertices,faces,step.get("material"))
    obj.location = vector(step.get("location"), [0,0,0])
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def create_mesh(step):
    s = studio()
    verts = step.get("vertices", [])
    faces = step.get("faces", [])
    if not (3 <= len(verts) <= 12000) or not (1 <= len(faces) <= 16000):
        raise ValueError("mesh exceeds size limits")
    xyz = [vector(v, [0,0,0]) for v in verts]
    clean_faces = []
    for face in faces:
        if not isinstance(face, list) or len(face) not in (3, 4) or any(not isinstance(i,int) or i<0 or i>=len(xyz) for i in face):
            raise ValueError("invalid face topology")
        clean_faces.append(face)
    mesh = bpy.data.meshes.new(name_of(step,"AI Mesh")+" mesh")
    mesh.from_pydata(xyz, [], clean_faces)
    mesh.update()
    obj = bpy.data.objects.new(name_of(step,"AI Mesh"),mesh)
    s.collection.objects.link(obj)
    obj.location = vector(step.get("location", [0,0,0]), [0,0,0])
    apply_material(obj, step.get("material"))
    return obj


def create_light(step):
    s = studio()
    typ = str(step.get("type", "AREA")).upper()
    if typ not in {"AREA", "POINT", "SUN", "SPOT"}:
        raise ValueError("unsupported light type")
    light = bpy.data.lights.new(name_of(step,"AI Light"), type=typ)
    light.energy = number(step.get("energy", 600), 600, 0, 30000)
    light.color = vector(step.get("color", [1,1,1]), [1,1,1])
    if typ == "AREA":
        light.shape = "DISK"
        light.size = number(step.get("size", 3), 3, .01, 100)
    obj = bpy.data.objects.new(name_of(step,"AI Light"), light)
    s.collection.objects.link(obj)
    obj.location = vector(step.get("location", [1,-2,5]), [1,-2,5])
    orient_to(obj, vector(step.get("target", [0,0,0]),[0,0,0]))
    return obj


def create_camera(step):
    s = studio()
    camera = bpy.data.cameras.new(name_of(step,"AI Camera"))
    camera.lens = number(step.get("lens", 38),38, 15, 250)
    obj = bpy.data.objects.new(name_of(step,"AI Camera"),camera)
    s.collection.objects.link(obj)
    obj.location = vector(step.get("location", [7,-9,5]), [7,-9,5])
    orient_to(obj, vector(step.get("target", [0,0,0]), [0,0,0]))
    s.camera = obj
    return obj


def set_world(step):
    s = studio()
    if s.world is None:
        s.world = bpy.data.worlds.new("AI Studio Atmosphere")
    # Don't mutate a World shared with the user's other scenes.
    if s.world.users > 1:
        s.world = s.world.copy()
    world = s.world
    world.use_nodes = True
    n = world.node_tree.nodes.get("Background")
    if n:
        n.inputs["Color"].default_value = vector(step.get("color", [.2,.2,.2]), [.2,.2,.2]) + [1]
        n.inputs["Strength"].default_value = number(step.get("strength", .5), .5, 0, 5)


def set_render(step):
    s = studio()
    s.render.resolution_x = int(number(step.get("width", 760), 760, 64, 1920))
    s.render.resolution_y = int(number(step.get("height", 530), 530, 64, 1920))
    s.render.resolution_percentage = 100
    # Prefer Eevee; the Android build's list of engines may vary.
    engines = {item.identifier for item in s.render.bl_rna.properties["engine"].enum_items}
    for k in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        if k in engines:
            s.render.engine = k
            break


def submit_artifact(path, jid, label=None):
    if not path or not os.path.isfile(path):
        raise RuntimeError("artifact file missing")
    size = os.stat(path).st_size
    if size <= 0 or size > 20*1024*1024:
        raise RuntimeError("artifact empty or exceeded 20 MB")
    safe_id = "".join(c for c in str(jid) if c.isalnum() or c in "-_.")[:40]
    suffix = "".join(c for c in str(label or "") if c.isalnum() or c in "-_")[:30]
    ext = os.path.splitext(path)[1]
    name = safe_id + ("_" + suffix if suffix else "") + ext
    with open(path, "rb") as f:
        payload = f.read()
    req = urllib.request.Request(BASE_URL+"/artifact?token="+BRIDGE_TOKEN+"&name="+name,
                                 data=payload, headers={"Content-Type":"application/octet-stream"}, method="POST")
    with urllib.request.urlopen(req, timeout=40) as res:
        data = json.loads(res.read().decode())
    if data.get("ok") is not True:
        raise RuntimeError("artifact upload was not acknowledged")
    return data.get("filename")


def render_named(step, jid):
    set_render(step)
    s = studio()
    camera_name = step.get("camera")
    if camera_name is not None:
        if not isinstance(camera_name, str) or len(camera_name) > 90:
            raise ValueError("invalid camera name")
        camera_obj = s.objects.get(camera_name)
        if camera_obj is None or camera_obj.type != "CAMERA":
            raise ValueError("camera not found: " + camera_name)
        s.camera = camera_obj
    if s.camera is None:
        raise RuntimeError("render requires a camera")
    dest = os.path.join(bpy.app.tempdir or tempfile.gettempdir(), "ai_bridge_preview.png")
    s.render.filepath = dest
    s.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True, scene=s.name)
    return submit_artifact(dest, jid, step.get("label"))


def restore_saved_scene(step):
    """Recover a trusted previously uploaded .blend without opening/replacing UI file."""
    from urllib.parse import quote
    name = step.get("filename")
    if (not isinstance(name, str) or not name.endswith(".blend") or
        len(name) > 120 or name.startswith(".") or ".." in name or
        any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
            for c in name)):
        raise ValueError("unsafe restore filename")
    url = BASE_URL + "/output/" + quote(name) + "?token=" + BRIDGE_TOKEN
    tmpdir = tempfile.mkdtemp(prefix="ai_bridge_restore_")
    filepath = os.path.join(tmpdir, "source.blend")
    try:
        with urllib.request.urlopen(url, timeout=20) as reply:
            size = 0
            with open(filepath, "wb") as out:
                while True:
                    chunk = reply.read(262144)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > 20 * 1024 * 1024:
                        raise ValueError("restore file exceeds 20 MB")
                    out.write(chunk)
        if size < 64 or open(filepath, "rb").read(7) != b"BLENDER":
            raise ValueError("invalid Blender file")
        with bpy.data.libraries.load(filepath, link=False) as (source, target):
            names = [n for n in source.objects if n.startswith("KWC_") or n.startswith("九龍城_")]
            if not names:
                raise ValueError("saved file contains no Kowloon objects")
            target.objects = names
        recovered = [obj for obj in target.objects if obj is not None]
        if len(recovered) < 100:
            raise ValueError("incomplete saved Kowloon scene")
        s = reset()
        for obj in recovered:
            s.collection.objects.link(obj)
            if obj.type == "CAMERA" and obj.name.startswith("九龍城_"):
                s.camera = obj
        if s.camera is None:
            raise RuntimeError("restored scene has no camera")
        return len(recovered)
    finally:
        try:
            os.unlink(filepath)
            os.rmdir(tmpdir)
        except OSError:
            pass


def save_named(step, jid):
    dest = os.path.join(bpy.app.tempdir or tempfile.gettempdir(), "ai_bridge_scene.blend")
    bpy.ops.wm.save_as_mainfile(filepath=dest, check_existing=False, compress=True)
    return submit_artifact(dest, jid, step.get("label"))


def run_one(job):
    jid = job["id"]
    started = time.monotonic()
    step_no = -1
    try:
        for step_no, step in enumerate(job["steps"]):
            op = step["op"]
            if op == "reset": reset()
            elif op == "box": create_box(step)
            elif op == "cylinder": create_cylinder(step)
            elif op == "sphere": create_sphere(step)
            elif op == "mesh": create_mesh(step)
            elif op == "light": create_light(step)
            elif op == "camera": create_camera(step)
            elif op == "world": set_world(step)
            elif op == "material":
                obj = studio().objects.get(str(step.get("object", "")))
                if obj is None: raise ValueError("material target not found")
                apply_material(obj, step.get("material", {}))
            elif op == "render_settings": set_render(step)
            elif op == "render": render_named(step, jid)
            elif op == "restore": restore_saved_scene(step)
            elif op == "save": save_named(step, jid)
            elif op == "status":
                print("[AI Bridge] status",len(studio().objects),"objects; Blender",bpy.app.version_string)
            else:
                raise ValueError("operation not allowlisted")
        return {"id":jid,"ok":True,"message":"Scene created successfully","step":step_no+1,
                "elapsed":round(time.monotonic()-started,2),"object_count":len(studio().objects)}
    except Exception as exc:
        traceback.print_exc()
        return {"id":jid,"ok":False,"message":type(exc).__name__+": "+str(exc)[:200],
                "step":step_no,"elapsed":round(time.monotonic()-started,2),"object_count":len(studio().objects)}


def ai_bridge_tick():
    try:
        reply = request("/next",timeout=3)
        job = reply.get("job")
        if job:
            print("[AI Bridge] Starting job",job.get("id"))
            result = run_one(job)
            print("[AI Bridge]",result)
            request("/result",result,timeout=8)
    except Exception as exc:
        if time.monotonic()-globals().get("_LAST_BRIDGE_ERROR",0)>25:
            print("[AI Bridge] Waiting for Termux connection:",type(exc).__name__,exc)
            globals()["_LAST_BRIDGE_ERROR"] = time.monotonic()
    return 2.5


old_tick = bpy.app.driver_namespace.get("ai_blender_bridge_tick")
if old_tick and bpy.app.timers.is_registered(old_tick):
    bpy.app.timers.unregister(old_tick)
bpy.app.driver_namespace["ai_blender_bridge_tick"] = ai_bridge_tick
bpy.app.timers.register(ai_bridge_tick, first_interval=.8, persistent=True)
print("[AI Bridge] ACTIVE. Keep Blender in foreground. Commands arrive from local Termux relay.")