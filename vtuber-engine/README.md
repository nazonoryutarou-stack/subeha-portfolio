# ブイチューバーエンジン

`Subeha.vrm`、Whisper、Remotion、字幕、話者ゲート、shot timeline、GitHub Actions、QCを一つの入口へまとめた動画制作パッケージ。

**v0.2.0** から `film-plan.json` を正面入口にし、動画ごとにReactコンポーネントやworkflowを組み直さず、shotを並べて映像を作れる。

## 原則

- 動画ごとの差分は `vtuber-engine/projects/<project>/` に閉じ込める。
- VRM描画・口パク・姿勢・字幕・話者安全・Whisper・QCは既存の `remotion/vrm-lipsync/` を共通エンジンとして再利用する。
- production VRMはリポジトリ直下の `Subeha.vrm`。
- 長尺原音はGitHubへ置かない。採用後の短尺実音声だけをprojectへ置く。
- 静止画・動画・生成動画は `assets/` に固定する。レンダーのたびに生成し直さない。
- `HOST` だけがVRM発話モーションを駆動する。`GUEST` / `UNKNOWN` は止める。
- 完成MP4だけでなくASR・QC・編集計画も残す。
- `film-plan.json` は人間/AIが編集する上位計画。既存Remotion経路へ渡す `edit-plan.json` は自動生成する。

## CLI

```bash
node vtuber-engine/bin/vtuber-engine.mjs doctor
node vtuber-engine/bin/vtuber-engine.mjs new <project>
node vtuber-engine/bin/vtuber-engine.mjs validate <project>
node vtuber-engine/bin/vtuber-engine.mjs plan <project>
node vtuber-engine/bin/vtuber-engine.mjs transcribe <project>
node vtuber-engine/bin/vtuber-engine.mjs render <project>
node vtuber-engine/bin/vtuber-engine.mjs list
```

### 新しい動画

```bash
node vtuber-engine/bin/vtuber-engine.mjs new mieru-wakaranai --template=ritual-pv
```

生成:

```text
vtuber-engine/projects/mieru-wakaranai/
├─ film-plan.json
├─ README.md
├─ source.m4a | source.wav | source.opus
├─ assets/
└─ out/
   └─ generated-edit-plan.json
```

## film-plan.json

時刻は **最終的な短尺source音声の先頭を0ms** とする。

```json
{
  "version": 1,
  "title": "見える。でも、分からない。",
  "sourceLabel": "祭祀技師 / observation log",
  "layout": {
    "width": 1280,
    "height": 720,
    "captionBottomPx": 34,
    "background": "#111318"
  },
  "captions": [
    {
      "startMs": 0,
      "endMs": 2100,
      "speaker": "HOST",
      "text": "見えることと、分かることは違う。"
    }
  ],
  "shots": [
    {"type": "black", "startMs": 0, "endMs": 500},
    {"type": "typography", "startMs": 500, "endMs": 1200, "text": "見える。≠ 分かる。"},
    {"type": "video", "startMs": 1200, "endMs": 1800, "asset": "workbench.mp4", "fit": "cover"},
    {"type": "vrm", "startMs": 1800, "endMs": 2100}
  ],
  "motion": {"profile": "calm", "notes": ""}
}
```

### shot type

- `vrm` - VRMをそのまま見せる。asset不要。
- `still` - `assets/` の静止画。`placement: fullscreen | panel`。
- `video` - `assets/` の動画。音声はミュートしてsource音声を優先する。
- `generated-video` - 生成済み動画を固定assetとして扱う。レンダー時にAPI再生成しない。
- `typography` - 文字だけの全画面shot。
- `black` - 完全な黒画面。

`still / video / generated-video` の `asset` は必ずprojectの `assets/` 配下を指定する。レンダー前にRemotionのpublic領域へ自動でstageされる。`../` などproject外参照は拒否する。

shotsは現在 **非重複** を前提にする。shotが存在しない時間はVRM表示へ戻る。

## 編集計画を確認する

```bash
node vtuber-engine/bin/vtuber-engine.mjs validate mieru-wakaranai
node vtuber-engine/bin/vtuber-engine.mjs plan mieru-wakaranai
```

`validate` は音声長、caption、HOST話者、shot時刻、asset pathを検査する。

`plan` は素材を固定し、次を生成する。

```text
vtuber-engine/projects/<project>/out/generated-edit-plan.json
```

このJSONから下は既存の実績あるレンダー経路を使う。

## render

```bash
node vtuber-engine/bin/vtuber-engine.mjs render mieru-wakaranai
```

```text
short source audio
→ film-plan validation
→ local asset staging
→ generated edit-plan
→ whisper.cpp timed ASR
→ audio SHA / duration lock
→ HOST / GUEST / UNKNOWN speaker gate
→ Remotion shot timeline
→ Three.js + Subeha.vrm
→ H.264 MP4
→ ffprobe structural QC
→ QC frames
```

出力:

```text
vtuber-engine/projects/<project>/out/
├─ <project>.mp4
├─ generated-edit-plan.json
└─ timed-asr/
```

## 互換性

`film-plan.json` がない既存projectでは、従来の `edit-plan.json` をそのまま `render` できる。

既存 `edit-plan.json` のschemaは `remotion/vrm-lipsync/assistant-plan.schema.json`。新しい上位schemaは `vtuber-engine/film-plan.schema.json`。

## GitHub Actions

`.github/workflows/vtuber-engine-render.yml` を一本だけ使う。

- push時: engineのdoctor + TypeScript check。`projects/current/` に完全なplanと音声がある場合だけrender。
- workflow_dispatch時: 指定projectを必ずvalidate/render。
- Artifact: MP4、ASR、film/edit plan、QC、生成project。

## 現在の役割分担

```text
人間 / ChatGPT / Astra
      ↓ 編集判断
film-plan.json
      ↓
ブイチューバーエンジン compiler
      ↓
generated-edit-plan.json
      ↓
whisper.cpp ── 時刻・監査
      ↓
Remotion ───── shot合成
      ↓
Three.js + Subeha.vrm
      ↓
ffprobe + QC
      ↓
MP4
```

## 次の拡張候補

- phoneme/viseme alignmentで `aa / ih / ou / ee / oh` を実際に使う
- BGM / SFX / ducking
- shot transition / grade
- diagram / webpage / screen recording shot
- Studio上でfilm-planを書き戻すinteractive editor
- Runway / Luma等をasset resolverとして接続する

## 名前

正式名称は **ブイチューバーエンジン**。

パッケージ識別子は当面 `vtuber-engine`。外部公開npm化は、複数動画でAPIが固まってから判断する。
