# Remotion / VRM 実装状況

最終更新: 2026-08-26

## 現在の正しい実装場所

動画制作の本線は **PR #22 / `feature/vrm-studio-webapp`**。

高品質レンダー本体は `remotion/vrm-lipsync/`。編集jobは `jobs/assistant/`。

## 正規構成

```text
ChatGPTが長尺配信から候補選定
→ 採用区間だけ短尺実音声へ切り出す
→ edit-plan.json + source.m4a/wav/opus
→ render:assistant
→ local whisper.cpp timed ASR
→ assistant project生成
→ HOST / GUEST / UNKNOWN gate
→ HOST-only口パク・頭胸モーション
→ Remotion render
→ 構造QC + 目視QC
→ MP4 + Whisper JSON/SRT/VTT/meta
```

## Whisper

2026-08-26に正規レンダーへ統合済み。

- `scripts/transcribe-source.mjs`
- open-source `whisper.cpp`
- `@remotion/install-whisper-cpp`
- 既定model `small`
- language `ja`
- 元音声をffmpegで16kHz mono PCMへ変換
- token-level timestamps
- `timed-asr.json`
- `timed-asr.srt`
- `timed-asr.vtt`
- `timed-asr.meta.json`
- metaへ元音声SHA-256 / duration / model / whisper.cpp versionを保存

GitHub Actionsではwhisper.cpp本体とmodelをcacheする。有料OpenAI API / API keyは不要。

`Assistant VRM Video Render` はWhisperを自動前処理として実行する。
ASRだけ必要な場合は `Assistant Whisper Transcription` を手動実行する。

Base64分割音声と `source-parts.txt` は正規経路から撤去済み。入力は実音声ファイルのみ。

## Assistant edit plan

- `remotion/vrm-lipsync/assistant-plan.schema.json`
- `scripts/import-assistant-plan.mjs`
- `scripts/render-assistant.mjs`
- `npm run import:assistant`
- `npm run render:assistant`
- 既定 `npm run render` もassistant route

Whisperは時刻付きASRと監査レイヤー。面白い区間の選定や話者の文脈判断そのものをWhisperへ丸投げしない。

## 音声・字幕ロック

- 実音声からdurationとSHA-256を取得する。
- Whisper metaも同じ元音声SHA-256へ結び付ける。
- 最終WAVを0秒基準へ揃える。
- 字幕、speaker turns、口パクは同じ音声へ結び付ける。
- 別配信の文字起こしや推測タイムコードは使わない。

## 話者安全

- アバター話者は `HOST`。
- `GUEST` と `UNKNOWN` ではVRM発話モーションを停止する。
- 本番はspeaker-turn情報なしで通さない。
- HOST発話を含まない切り抜きは完成レンダーにしない。

## Production VRM

- 動画用はリポジトリ直下の `Subeha.vrm`。
- native viseme `aa / ih / ou / ee / oh` を使用する。
- 軽量 `subeha-web-site.vrm` へはフォールバックしない。

## QC

- TypeScript / plan validation
- Whisper ASR artifact validation
- ffprobeによる解像度、stream、尺、A/V drift確認
- QC静止画抽出
- 冒頭 / 発話ピーク / 中盤 / オチを目視確認

## Web Studio

`tools/vrm-talker/` は正規AI解析器ではない。
project確認、字幕・レイアウトの微調整、ブラウザプレビュー用の補助UIとして扱う。

## 現在の未完了

1. `jobs/assistant/current/` に実際の短尺 `source.m4a / wav / opus` を置く。
2. Whisperを含む本物のActions runを完走させる。
3. MP4とtimed ASRをArtifactで確認する。
4. 客発話中にHOSTアバターが喋らないことをQC静止画で目視確認する。

未確認項目を完成扱いしない。
