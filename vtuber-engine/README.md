# ブイチューバーエンジン

`Subeha.vrm`、Whisper、Remotion、字幕、話者ゲート、静止画合成、GitHub Actions、QCを一つの入口へまとめた動画制作パッケージ。

動画ごとにRemotionコンポーネントやGitHub Actions workflowを作り直さないことを目的にする。

## 原則

- 動画ごとの差分は `vtuber-engine/projects/<project>/` に閉じ込める。
- VRM描画・口パク・姿勢・字幕・話者安全・Whisper・QCは既存の `remotion/vrm-lipsync/` 実装を共通エンジンとして再利用する。
- production VRMはリポジトリ直下の `Subeha.vrm`。
- 長尺原音はGitHubへ置かない。採用後の短尺実音声だけをprojectへ置く。
- 生成素材は一度固定して `assets/` へ保存し、レンダーのたびに再生成しない。
- `HOST` だけがVRM発話モーションを駆動する。`GUEST` / `UNKNOWN` は止める。
- 完成MP4だけでなくASR・QC・編集計画も残す。

## 使い方

### 1. 環境検査

```bash
node vtuber-engine/bin/vtuber-engine.mjs doctor
```

Node、ffmpeg、ffprobe、production VRM、Remotion、Whisper bridge、QC、schemaをまとめて検査する。

### 2. 新しい動画

```bash
node vtuber-engine/bin/vtuber-engine.mjs new mieru-wakaranai
```

生成:

```text
vtuber-engine/projects/mieru-wakaranai/
├─ edit-plan.json
├─ README.md
├─ assets/
└─ out/
```

ここへ `source.m4a` / `source.wav` / `source.opus` のどれかを置く。

### 3. 文字起こしだけ

```bash
node vtuber-engine/bin/vtuber-engine.mjs transcribe mieru-wakaranai
```

### 4. 完成動画まで

```bash
node vtuber-engine/bin/vtuber-engine.mjs render mieru-wakaranai
```

内部では既存の正規経路を使う。

```text
short source audio
→ whisper.cpp timed ASR
→ edit-plan validation
→ audio SHA / duration lock
→ Remotion project
→ HOST-only envelope / speaker gate
→ Subeha.vrm
→ captions / visuals / background
→ H.264 MP4
→ ffprobe structural QC
→ QC frames
```

出力:

```text
vtuber-engine/projects/<project>/out/
├─ <project>.mp4
└─ timed-asr/
```

Remotion側のQC成果物も従来通り生成される。

## project contract

`edit-plan.json` は既存の `remotion/vrm-lipsync/assistant-plan.schema.json` を正本とする。

主な入力:

- `clip.startMs/endMs`
- `text.title/telop`
- `captions[]`
- `captions[].speaker = HOST | GUEST | UNKNOWN`
- `visualReferences[]`
- `motion.profile`
- `selection.reason/hook/summary`

## 現在の役割分担

```text
ChatGPT / Astra
    ↓ 編集判断
edit-plan.json
    ↓
ブイチューバーエンジン CLI
    ↓
whisper.cpp ── 時刻・監査
    ↓
Remotion ───── 合成
    ↓
Three.js + Subeha.vrm
    ↓
ffprobe + QC
    ↓
MP4
```

## 今後の拡張

次の拡張では、現在の `edit-plan.json` の上位互換として `film-plan.json` を導入し、shot単位で以下を扱えるようにする。

- `vrm`
- `video`
- `still`
- `typography`
- `diagram`
- `black`
- `webpage`
- `generated-video`

Runway / Luma等の生成APIは素材解決レイヤーとして追加し、RemotionやVRMの共通処理へ直接混ぜない。

## 名前

正式名称は **ブイチューバーエンジン**。

パッケージ識別子は当面 `vtuber-engine` とする。外部公開npm化は、複数動画でAPIが固まってから判断する。
