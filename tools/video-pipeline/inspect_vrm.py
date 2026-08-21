import json, struct, sys
from pathlib import Path

p = Path(sys.argv[1] if len(sys.argv) > 1 else 'Subeha.vrm')
b = p.read_bytes()
if b[:4] != b'glTF':
    raise SystemExit('not GLB/VRM')
_, version, length = struct.unpack_from('<4sII', b, 0)
off = 12
json_chunk = None
while off + 8 <= len(b):
    chunk_len, chunk_type = struct.unpack_from('<II', b, off)
    off += 8
    chunk = b[off:off+chunk_len]
    off += chunk_len
    if chunk_type == 0x4E4F534A:
        json_chunk = chunk.rstrip(b' \t\r\n\x00')
        break
if json_chunk is None:
    raise SystemExit('no JSON chunk')
g = json.loads(json_chunk.decode('utf-8'))
exts = g.get('extensionsUsed', [])
vrm = (g.get('extensions') or {}).get('VRMC_vrm') or {}
expr = (vrm.get('expressions') or {})
preset = expr.get('preset') or {}
custom = expr.get('custom') or {}
meshes = g.get('meshes') or []
morph_names = []
for mi,m in enumerate(meshes):
    extras = m.get('extras') or {}
    names = extras.get('targetNames') or []
    for n in names:
        morph_names.append(str(n))
report = {
  'file': p.name,
  'bytes': len(b),
  'glbVersion': version,
  'extensionsUsed': exts,
  'vrmSpecVersion': vrm.get('specVersion'),
  'expressionPresetKeys': sorted(preset.keys()),
  'expressionCustomKeys': sorted(custom.keys()),
  'hasNativeVisemes': all(k in preset for k in ['aa','ih','ou','ee','oh']),
  'morphTargetNamesSample': morph_names[:200],
  'morphTargetCount': len(morph_names),
}
print(json.dumps(report, ensure_ascii=False, indent=2))
Path('vrm-inspection.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
if not report['hasNativeVisemes']:
    raise SystemExit('FAIL: missing native aa/ih/ou/ee/oh expressions')
