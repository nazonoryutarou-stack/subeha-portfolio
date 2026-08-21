# VRM TALKER / Studio

`tools/vrm-talker/` は、配信音声からVRM動画を組み立てるための正規Web制作アプリ。

## Flow

```text
配信音声
→ timed ASR / 話者分離
→ HOSTだけ口パク・身体反応
→ 字幕
→ AI Visual Director
→ 参考画像検索 / 生成候補
→ タイムライン配置・微調整
→ 9:16 / 1:1 / 16:9 プレビュー・録画
→ project.json
→ 必要ならRemotion高品質レンダー
```

**意味判断はAI、時刻は実音声由来。AIに秒数を発明させない。**

## 初回だけ

1. 口モーフのある動画用 `Subeha.vrm` を選び、ブラウザへ記憶する。軽量 `subeha-web-site.vrm` は動画用に使わない。
2. 長尺配信では本人だけの2〜10秒をHOST声として登録する。
3. Cloudflare Worker URLをAPI設定へ登録する。

## 長尺配信

25MB超の音声は約8分ごとに処理する。全WAVを先に作らず、**1区間をWAV化 → 話者解析 → 結果保存 → 次区間**で処理する。

HOST参照は全区間共通。未知の他話者は区間ごとに名前空間を分ける。

## Visual Director

AIは字幕番号だけ選ぶ。実 `startMs/endMs` は既存captionから決定する。

- 実在資料 → Openverse検索
- 架空物 / 抽象表現 → 画像生成候補
- 画像生成は料金が発生するため明示操作

採用画像はVisual Timelineで時刻調整・削除可能。

## Recording

VRM・字幕・タイトルはCanvasへ焼き込み、採用画像も合成Canvasへ重ねてMediaRecorderへ渡す。

外部画像がCanvas CORS安全でない場合はプレビューのみとして警告する。

## project.json → Remotion

```bash
cd remotion/vrm-lipsync
npm run prepare:studio -- --project=/path/project.json --audio=/path/original.m4a
```

元音声SHAを照合し、最終WAV生成後、そのWAVのSHAとdurationでspeaker turnsを再ロックする。

## Current external blocker

2026-08-22のConfig Checkで次のGitHub repository secretsが全て未設定:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `OPENAI_API_KEY`

そのためWorker実デプロイと実OpenAI API QCはまだ実行できない。

## Development

```bash
cd tools/vrm-talker
npm install
npm run dev
npm run build
```

設計:
- `../../docs/production-rules.md`
- `../../docs/video-app-architecture.md`
- `../../docs/video-app-today.md`
