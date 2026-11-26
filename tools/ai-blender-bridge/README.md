# AI Blender Bridge v0.1 — Android + Termux

**Goal:** create a 3D scene in Android Blender by giving ChatGPT instructions. ChatGPT writes allowlisted JSON job files into the user's GitHub repository. Termux checks that file and the local Blender Python agent executes the job. No PC required, no Blender touchscreen editing required after initial setup. **This is an experimental prototype; actual Android execution has not been validated.**

## Before you start

- Install the unofficial full Blender-for-Android APK from the maintainer's [releases](https://github.com/Wanderson-Magalhaes/blender_for_android/releases). Version 5.3 was published November 11, 2026. Third-party experimental APK; weigh security and storage implications before installation.
- Termux needs Internet access. Blender needs a Python Console and Python network access to `127.0.0.1` (experimental/unverified). Android may suspend apps in the background.
- The bridge uses only local network, binds **127.0.0.1:8765**, generates a random private access token, and never uploads anything except when you explicitly ask Blender to `render` or `save` (those outputs transfer only to Termux). No cloud credentials needed.
- After setup the phone must be powered on, connected, Blender active (preferably foreground), and Termux server running. Files from GitHub are declarative JSON, not executable Python.

## Install from Termux

```sh
pkg install python curl -y
mkdir -p ~/ai-blender && cd ~/ai-blender
curl -fL -o bridge_server.py https://raw.githubusercontent.com/nazonoryutarou-stack/subeha-portfolio/main/tools/ai-blender-bridge/bridge_server.py
curl -fL -o blender_agent.py https://raw.githubusercontent.com/nazonoryutarou-stack/subeha-portfolio/main/tools/ai-blender-bridge/blender_agent.py
python bridge_server.py
```

On start, Termux prints both a local status URL and a **one-line Python command**. Copy that line into **Blender → Scripting → Python Console**, then hit Enter. You only need to do this once per Blender session (unless the app is reloaded or Android kills it). The bridge returns `ACTIVE` in the Blender Console. You can also visit the local status URL to trigger a local test. Remote tasks from GitHub are checked every 60 seconds and each job ID is executed only once per phone.

For an offline/diagnostic run, `python bridge_server.py --no-github` disables GitHub checks and the browser's local demo button still works.

## How to ask ChatGPT

Ask: **「Blenderの部屋に照明を増やせ」「九龍城の外観をモデル化して」**. When the GitHub connector is linked, ChatGPT can update `tools/ai-blender-bridge/jobs/current.json` with a *new unique ID* and a list of supported operations. The Termux app downloads the new job. The local Blender Python timer retrieves the job and constructs the scene.

The terminal status page shows last job, errors and output files. ChatGPT **cannot independently watch your phone's logs**; paste status output or share a screenshot when troubleshooting. Future integration could report job results to a private cloud account with explicit authorization.

## Kowloon reconstruction

The existing bridge can execute the evidence-led Kowloon OBJ meshes. See [KOWLOON_JA.md](KOWLOON_JA.md) for the room, city and rooftop jobs, their source records, and regeneration.

## Job schema

`{"id":"unique-job-id-001","steps":[{"op":"reset"},{"op":"box","name":"Wall","location":[0,0,1],"size":[3,0.2,2],"material":{"name":"Plaster","color":[0.8,0.7,0.6,1],"roughness":0.9}},{"op":"light","name":"Sun","type":"AREA","location":[1,-3,5],"target":[0,0,0],"energy":900},{"op":"camera","location":[4,-7,5],"target":[0,0,0]}]}`

Supported: `reset`, `box`, `cylinder`, `sphere`, `mesh`, `light`, `camera`, `material`, `world`, `render_settings`, `status`, optional `render` and `save`. All operations take place inside a separate `AI Bridge Studio` scene; `reset` does not delete your other scenes.

`render` can be slow and cause phone heat, and it outputs a `.png` to the local status server; `save` copies a `.blend` file. Outputs are restricted to 20 MB per file. **The bridge does not grant direct GUI access or make Blender's physics magically validated.**

## Security

Anyone with write access to the linked public GitHub repository can submit allowlisted scene-editing commands. The app only accepts named operations, not arbitrary Python execution. **Do not turn this bridge into an arbitrary-code executor or expose the loopback server to the public Internet.** Keep the access token private. For maximal safety, use `--no-github` and only trigger local tests.

## Troubleshooting

- If Blender Console can't connect: check that `python bridge_server.py` is still running in Termux; Android sometimes pauses background apps.
- If the Blender build cannot use local Python sockets: the bridge is not supported by that build. Paste the exact error into ChatGPT and we can adapt it.
- If no remote job arrives: wait up to 1–2 minutes, check Internet and GitHub status on local page.
- If exported file import fails: some Android ports have scoped-storage restrictions. This solution transfers via loopback HTTP instead of assuming shared folder access.
- If visual lag or overheating: do not request `render`, use simple models, and lower Blender viewport samples/quality.