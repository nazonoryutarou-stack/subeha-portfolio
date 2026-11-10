# SUBEHA CUT engine integration — verified boundaries

The user wants all discovered GitHub video technologies brought together. This directory is a **catalog and portable adapter contract**, not a false claim that other projects' source was merged or that their separate runtime starts inside the PWA.

- **Active:** SUBEHA CUT PWA (Canvas2D, WebAudio, WebGL OBJ CG). Its `.subecut` backup now includes OBJ model files.
- **ClearCut (MIT):** viable native-Android reference/possible backend, but requires an Android Studio / Gradle build and a compatible media project importer. No native APK is built here.
- **ActionCut:** source license missing at audit; documented, **do not copy** until permission/license confirmed.
- **Open Video Editor (GPL-3.0):** reference only; combining its code into a differently licensed app creates GPL distribution obligations. No code copied.
- **LTX Desktop (Apache-2.0):** separate high-resource desktop AI generation. Does not run in a phone PWA; no GPU service or cloud API is connected. Model weights may have separate terms.
- **Videoleap Flow Rebuild:** UI/onboarding research project, not official Videoleap editor source. No assets copied.

`engine-plan.mjs` serializes a renderer-neutral timeline and reports unavailable conversion features. It is usable for writing a future Kotlin/Media3 bridge. **It does not transcode media.**

## 3D CG currently active

In the editor choose **3D CG** → **OBJファイルを読み込む** (or the built-in demo), set material/rotation/camera/light, optionally keyframe, then use ordinary playback and export. 3D layers render locally with WebGL into the same Canvas as video and subtitles. Material textures `.mtl` and skeletal rigs are not supported. OBJ input capped at 12MB/45,000 triangles; drawing buffer max edge 900px. Android heat and long videos require device testing.

References:
- https://github.com/SysAdminDoc/ClearCut
- https://github.com/naveenneog/ActionCut
- https://github.com/devhyper/open-video-editor
- https://github.com/Lightricks/LTX-Desktop
- https://github.com/eddieatadapty/videoleap-flow-rebuild
