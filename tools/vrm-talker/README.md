# VRM TALKER / Studio

`tools/vrm-talker/` は、配信音声を起点にVRM・字幕・話者分離・参考画像・タイムラインを一つにまとめる正規Web制作アプリ。

## Flow

```text
配信音声
→ 元音声SHA-256をストリーミング計算
→ timed ASR / 話者分離
→ HOSTだけ口パク・発話連動身体反応
→ 字幕生成 / 文字だけ手修正
→ AI Visual Director
→ 参考画像検索 / 画像生成候補
→ タイムライン配置・微調整
→ 9:16 / 1:1 / 16:9 プレビュー・録画
→ project.json保存 / 再開
→ Remotion高品質レンダー / 構造QC
```

**意味判断はAI、時刻は実音声由来。AIに秒数を発明させない。**

## 初回だけ

1. 口モーフ `aa / ih / ou / ee / oh` のある動画用 `Subeha.vrm` を選び、ブラウザへ記憶する。軽量 `subeha-web-site.vrm` は動画用に使わない。
2. 長尺配信では、本人だけが話している2〜10秒をHOST声サンプルとして登録する。
3. Worker未自動設定の開発環境ではCloudflare Worker URLをAPI設定へ登録する。

本番PagesではCloudflare設定が存在すれば、Pages build時にworkers.dev URLを取得し、Viteへ `VITE_VRM_STUDIO_API_BASE` として自動注入する。

## 長尺配信

音声が**8分を超える場合は容量に関係なく**チャンク処理する。高圧縮M4Aが25MB未満でも長時間なら分割する。

各チャンクは約8分のcoreに前後2秒の解析overlapを付ける。境界の発話文脈は両側へ渡しつつ、字幕区間の中心点が属するcoreだけを採用して重複を防ぐ。

全WAVを先に作らず、次を1区間ずつ繰り返す。

```text
必要区間だけWAV化
→ 話者解析
→ 結果を元音声絶対時刻へ戻す
→ WAVを解放
→ 次区間
```

HOST参照は全区間共通。未知の他話者はチャンクごとに名前空間を分ける。

## 話者とプライバシー

- 話者情報があるのに本人話者が未確定なら、口パクとVisual Directorを止める。
- Visual Directorへ渡す字幕では、本人以外の本文を `[非本人発話]` に置換する。
- 画像検索・生成候補は本人発話にアンカーされたものだけ採用する。
- 手動の「現在字幕を検索語へ」も本人発話だけ許可する。

客・ゲストの相談内容を画像検索や生成promptへ勝手に流さない。

## Caption Editor

ASR字幕は本文だけ手修正できる。

- `startMs / endMs` は編集不可
- `speaker` も編集不可
- 30件ずつページ表示
- 現在位置ジャンプ / 検索対応
- 字幕本文を直したら未採用のVisual Director候補は再計算対象にする
- 人間がすでに採用した画像素材は残す

字幕訂正で音声同期を壊さないことを優先する。

## Visual Director

AIは字幕番号 `startIndex / endIndex` だけ選ぶ。実 `startMs / endMs` は既存captionから決定する。

- 実在資料 → Openverse検索
- 架空物 / 抽象表現 → GPT Image生成候補
- 画像生成は料金が発生するため明示操作
- 採用画像はVisual Timelineで開始 / 終了を微調整・削除可能

同じ画像素材を複数区間へ配置しても衝突しないよう、`visualReferences[].id` は配置固有ID、`assetId` は元素材IDとして分離する。

Openverse画像はWorker接続時、採用時に安全な画像データへ固定する。作者・ライセンス情報はWeb録画とRemotion最終レンダーの両方へ表示する。

## Recording

VRM・字幕・タイトルはCanvasへ焼き込み、採用画像も合成Canvasへ重ねてMediaRecorderへ渡す。

字幕はCanvasを唯一の正本とし、DOM字幕を別重ねしない。プレビューと録画の字幕を一致させる。

外部画像がCanvas CORS安全でない場合は、Worker経由で固定できない限り録画に混ぜず警告する。

## project.json

projectには少なくとも次を保持する。

- 元音声名 / SHA-256 / duration
- A/B切り抜き範囲
- 本人話者
- タイトル / テロップ
- timed captions
- speaker turns
- Visual Director候補
- 採用画像と配置時刻
- 出力サイズ / 字幕安全域 / 背景

保存済みprojectを開く場合、元音声を再選択してSHA-256が一致するまで再生・録画をロックする。ファイル名ではなく内容で照合する。

## project.json → Remotion

準備だけ:

```bash
cd remotion/vrm-lipsync
npm run prepare:studio -- --project=/path/project.json --audio=/path/original.m4a
```

最終MP4まで:

```bash
npm run render:studio -- \
  --project=/path/project.json \
  --audio=/path/original.m4a \
  --output=out/studio.mp4
```

`render:studio` はprojectの出力サイズからCompositionを自動選択し、次を実行する。

```text
project検証
→ 元音声SHA照合
→ 動画用VRM検品
→ voice.wav生成
→ speaker turnsを切り抜き0秒基準へ変換
→ 最終WAV SHA / durationで話者ゲートを再ロック
→ HOST-only envelope生成
→ 背景 / 採用画像をpublicへ固定
→ Remotion H.264 render
→ 解像度 / stream / 尺 / A/V drift構造QC
→ 目視QCフレーム抽出
```

構造QCが通っても、実話者・口パク・字幕・画像タイミングは実素材で目視確認する。

## Current external blocker

2026-08-22時点のGitHub Actions Config Checkでは、次のrepository secretsは未設定。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `OPENAI_API_KEY`

そのため、Worker実デプロイ・実OpenAI話者分離・実画像生成のE2E QCはまだ実行できない。

Secrets設定後のdeploy workflowは、Worker deploy → OpenAI secret同期 → workers.dev公開確認 → `/health` → OpenAI secret認識確認まで通して成功判定する。

## Development

```bash
cd tools/vrm-talker
npm install
npm run test:sha
npm run test:project
npm run test:chunks
npm run build
npm run dev
```

設計:
- `../../docs/production-rules.md`
- `../../docs/video-app-architecture.md`
- `../../docs/video-app-today.md`
