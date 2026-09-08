"""Package the staged public site; run stage-arcade.mjs and checks first."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
output = root / "releases" / "arcade-neocities-candidate.zip"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for source in sorted((root / "public").rglob("*")):
        if not source.is_file():
            continue
        entry = ZipInfo(source.relative_to(root / "public").as_posix(), (2026, 9, 8, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, source.read_bytes())
print(output.relative_to(root))
