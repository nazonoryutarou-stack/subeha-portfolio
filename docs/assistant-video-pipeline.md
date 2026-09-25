# ChatGPT → Whisper → GitHub → VRM video pipeline

この動画制作系の正規ルートは、編集判断をChatGPT、音声の時間整列をローカルの `whisper.cpp`、最終動画生成をGitHub Actions / Remotionへ分担する。

有料OpenAI Transcription APIは使わない。WhisperはGitHub runner上でローカル実行し、API keyもOpenAI課金も不要。

## Canonical flow

```text
長尺配信音声をChatGPTへ渡す
→ ChatGPTが会話全体から面白い区間を選ぶ
→ 必要区間だけ短い source.m4a / source.wav / source.opus に切り出す
→ GitHub jobへ edit-plan.json + short audio + optional assets を置く
→ render:assistant
→ whisper.cpp が同じ短尺音声を自動文字起こし
→ timed-asr.json / .srt / .vtt / .meta.json を生成
→ assistant plan validation
→ HOST / GUEST / UNKNOWN の話者ゲート
→ HOST区間だけVRMの口・発話連動頭/胸モーションを許可
→ 字幕・画像・背景を合成
→ 構造QC + 目視QC
→ MP4 + Whisper transcript をArtifact出力
```

## Whisper policy

正規ASRは `remotion/vrm-lipsync/scripts/transcribe-source.mjs`。

- engine: open-source `whisper.cpp`
- installer/runtime: `@remotion/install-whisper-cpp`
- default model: `small`
- language: `ja`
- analysis audio: ffmpegで16kHz mono PCMへ変換
- token-level timestampsを取得
- 出力: `timed-asr.json`, `timed-asr.srt`, `timed-asr.vtt`, `timed-asr.meta.json`
- metaに元音声SHA-256、duration、model、whisper.cpp versionを保存
- GitHub Actionsではwhisper.cpp本体とmodelをcacheする

`render:assistant` はWhisperを前処理として自動実行する。ASRだけ欲しい場合はGitHub Actionsの `Assistant Whisper Transcription` を手動実行できる。

Base64へ変換した音声分割は正規経路では使用しない。入力は実音声ファイルのみ。

## Why this architecture

- 面白い箇所の判断は音量や単語頻度ではなく、ChatGPTが会話全体の文脈・オチ・キャラクター性から行う。
- Whisperは編集判断をしない。実音声に対する時刻付き文字起こしと監査レイヤーに限定する。
- 話者識別は発話内容・呼びかけ・応答関係・前後文脈も使う。曖昧な相槌や一語発話は `UNKNOWN` にする。
- `UNKNOWN` はVRM発話モーションを止めるため、ゲスト音声に誤って口が動くより安全。
- 長尺原音はGitHubへ置かない。採用区間だけ短い音声としてjobへ渡す。

## Edit plan contract

Schema:

`remotion/vrm-lipsync/assistant-plan.schema.json`

主要フィールド:

- `clip.startMs/endMs`: 元配信上の絶対時刻
- `text.title/telop`: 動画テキスト
- `captions[]`: 絶対時刻つき字幕
- `captions[].speaker`: `HOST | GUEST | UNKNOWN`
- `captions[].speakerConfidence`: 文脈上の推定確信度
- `captions[].speakerReason`: 必要なら根拠
- `visualReferences[]`: 任意の静止画素材
- `motion.profile`: `deadpan | calm | normal | energetic`
- `selection`: なぜこの区間を選んだか、フック、要約

`edit-plan.json` 自体には音声SHAや音声長を手書きしない。Whisper metaと `import-assistant-plan.mjs` が実音声からSHA-256とdurationを取得する。

## One-command render

```bash
cd remotion/vrm-lipsync
npm run render:assistant -- \
  --plan=../../jobs/assistant/current/edit-plan.json \
  --audio=../../jobs/assistant/current/source.m4a \
  --asr-output=out/timed-asr \
  --output=out/assistant-current.mp4
```

内部処理:

```text
exact source audio
→ local whisper.cpp timed ASR
→ ASR artifact validation
→ assistant plan validation
→ actual audio SHA/duration
→ Studio project生成
→ clip WAV生成
→ speaker-turns生成
→ HOST-only envelope
→ VRM検品
→ visual/background materialization
→ Remotion render
→ resolution/duration/A-V drift QC
→ QC frame extraction
```

## Speaker policy

- `HOST`: 配信者本人と十分に判断できる
- `GUEST`: 相手話者と十分に判断できる
- `UNKNOWN`: 相槌、短い声、重なり、曖昧な区間

レンダー時のアバター話者は常に `HOST`。`GUEST` と `UNKNOWN` は口パク・発話連動の頭/胸モーションを無効化する。

## Role of Web Studio

`tools/vrm-talker/` は正規AI解析器ではなく、project.jsonの確認・微調整・ブラウザプレビュー用の補助ツール。

完成動画の正本は `assistant edit-plan.json + exact source audio + local Whisper transcript + render:assistant`。

## Production VRM

動画用VRMは `aa / ih / ou / ee / oh` を持つ production `Subeha.vrm` を使用する。軽量 `subeha-web-site.vrm` は完成動画へ使用しない。
