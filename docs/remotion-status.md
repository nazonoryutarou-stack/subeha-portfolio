# Remotion / VRM 実装状況

最終更新: 2026-08-23

## 現在の正しい実装場所

動画制作の本線は **PR #22 / `feature/vrm-studio-webapp`**。

PR #22は `fix/vtuber-qc-v3-integrated` をbaseに、これまでのVRM姿勢補正、実音声同期、HOST/GUEST/UNKNOWN話者ゲート、Assistant edit plan、決定論的Remotionレンダー、構造QCを統合している。

旧動画PR #17 / #18 / #19 / #20 / #21 / #26 / #28 は2026-08-23に整理のためclose済み。履歴としてのみ参照する。

## 正規構成

```text
長尺の実音声
→ 同一音声からtimed ASR
→ 会話全体の文脈から候補選定
→ HOST / GUEST / UNKNOWN分類
→ edit-plan.json
→ 採用区間だけ元音声から切り出す
→ jobs/assistant/current/
→ npm run render:assistant
→ HOST区間だけVRM口・頭胸モーション
→ 字幕 / 背景 / 参考画像
→ H.264 MP4
→ 構造QC
→ QC静止画の目視確認
```

## 実装済み

### Assistant edit plan

- `remotion/vrm-lipsync/assistant-plan.schema.json`
- `scripts/import-assistant-plan.mjs`
- `scripts/render-assistant.mjs`
- `npm run import:assistant`
- `npm run render:assistant`
- 既定 `npm run render` もassistant route

### 音声・字幕ロック

- 実音声からdurationとSHA-256を取得する。
- 最終WAVを0秒基準へ揃える。
- 字幕、speaker turns、口パクは同じ音声へ結び付ける。
- 別配信の文字起こしや推測タイムコードは使わない。

### 話者安全

- アバター話者は `HOST`。
- `GUEST` と `UNKNOWN` ではVRM発話モーションを停止する。
- 本番はspeaker-turn情報なしで通さない。
- HOST発話を含まない切り抜きは完成レンダーにしない。

### Production VRM

- 動画用はリポジトリ直下の `Subeha.vrm`。
- native viseme `aa / ih / ou / ee / oh` を使用する。
- 軽量 `subeha-web-site.vrm` へはフォールバックしない。

### QC

- TypeScript / plan validation
- ffprobeによる解像度、stream、尺、A/V drift確認
- QC静止画抽出
- 冒頭 / 発話ピーク / 中盤 / オチを実際に目視する

## Web Studioの位置付け

`tools/vrm-talker/` は正規AI解析器ではない。

project確認、字幕・レイアウトの微調整、ブラウザプレビュー用の補助UIとして扱う。候補選定やASRの正本にはしない。

## 文字起こし方針

有料OpenAI APIは正規経路の前提にしない。

長尺音声の候補発見にはローカルまたはGitHub Actions上の `whisper.cpp` を利用できる。ただし、音声を壊れやすいbase64テキストへ変換してGitHubへ搬送する方式は採用しない。

最終字幕は必ず採用区間の元音声に対して再整列する。

## 現在の未完了

1. 実配信から正しい候補区間を確定する。
2. その区間のtimed ASRを同一元音声から作る。
3. `HOST / GUEST / UNKNOWN` を確定する。
4. 本物の `jobs/assistant/current/edit-plan.json` と短い実音声を置く。
5. GitHub Actionsで実MP4をレンダーする。
6. 客発話中にHOSTアバターが喋らないことを含め、QC静止画を目視確認する。

未確認項目を完成扱いしない。
