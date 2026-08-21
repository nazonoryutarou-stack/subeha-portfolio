# VRM TALKER / Studio

`tools/vrm-talker/` は、配信音声からVRM動画を組み立てるための**正規Web制作アプリ**。

## 目標

```text
配信音声を選択
→ timed ASR / 話者分離
→ HOSTだけVRM口パク・身体反応
→ 字幕
→ AIが視覚補助箇所を選定
→ 実在資料は参考画像検索
→ 架空物・抽象表現は画像生成候補
→ タイムライン配置・微調整
→ 9:16 / 1:1 / 16:9 プレビュー・録画
→ project.json
→ 必要ならRemotion高品質レンダー
```

**意味判断はAI、時刻は実音声由来**を原則とする。AIに秒数を発明させない。

## 初回だけ必要な設定

### 1. 動画用VRM

動画口パクには `Subeha.vrm` を使う。

`subeha-web-site.vrm` はWeb表示用軽量モデルで aa/ih/ou/ee/oh が無いため動画制作には使用しない。

リポジトリには動画用 `Subeha.vrm` を公開配置しない。最初に正しいVRMを選び、`このVRMを記憶` でブラウザのIndexedDBへ保存する。以後は自動ロードされる。

### 2. HOST声サンプル

長尺配信を安定して話者分離するには、本人だけが話している **2〜10秒** を一度登録する。

Studio上で始点・終点を決めて `この区間をHOST登録` を実行すると、16kHz mono WAVとしてブラウザ内へ保存する。以後の話者分離では既知話者 `HOST` として使用する。

### 3. API

GitHub PagesへAPIキーを埋め込まない。

`workers/vrm-studio-api/` をデプロイし、StudioのAPI設定欄へWorker URLを登録する。

Worker secret:
- `OPENAI_API_KEY`

Worker variable:
- `ALLOWED_ORIGIN`

## 長尺配信

OpenAI転写APIの単一アップロード上限を超える音声は、ブラウザで自動的に約8分ずつのWAVへ変換する。

各チャンクは同じHOST声サンプル付きで話者分離し、結果を元配信の絶対 `startMs/endMs` へ戻して結合する。

- `HOST` は全チャンク共通
- 他話者はチャンク単位で名前空間を分け、別人を誤結合しない
- 元音声SHA-256を `project.json` に保存する

## Visual Director

字幕解析後、AIへ渡すのは字幕本文と**字幕番号**。

AIは `startIndex/endIndex` と `search/generate` の判断だけを返し、実際の `startMs/endMs` は既存字幕から機械的に決める。

- 実在人物・場所・物・歴史資料 → 参考画像検索
- 架空物・比喩・抽象概念・演出素材 → 画像生成候補
- 検索候補は自動取得
- 画像生成は料金が発生するため明示クリック

採用画像はVisual Timelineで開始・終了時刻を微調整できる。

## 録画

VRM・字幕・タイトルはCanvasへ焼き込む。

採用画像は録画用合成Canvasへ重ねて `captureStream()` する。生成画像はそのまま録画可能。検索画像は配信元CORSがCanvas利用を許可した素材だけ録画へ焼き込み、危険な素材はプレビューのみとして警告する。

対応出力:
- 720×1280 / 9:16
- 900×900 / 1:1
- 1280×720 / 16:9

## project.json

共通プロジェクトには以下を保持する。

- 元音声名 / SHA-256 / duration
- clip範囲
- HOST話者
- timed captions
- speaker turns
- AI visual cues
- 採用visual references
- layout

高品質レンダーへ渡す場合:

```bash
cd remotion/vrm-lipsync
npm run prepare:studio -- --project=/path/to/project.json --audio=/path/to/original.m4a
```

この処理はproject.jsonと元音声のSHAを照合し、最終 `voice.wav` を作った後、そのWAVのSHAでspeaker turnsを再ロックする。

## 自動パイプライン

既定ではAPI接続済みなら音声選択後に:

1. 字幕＋話者解析
2. HOST自動設定（登録済みHOST声が識別された場合）
3. 画像挿入候補の意味解析
4. 検索素材候補取得

まで進む。

画像生成だけは自動課金を避けるため自動実行しない。

## 開発

```bash
cd tools/vrm-talker
npm install
npm run dev
```

ビルド:

```bash
npm run build
```

GitHub Actions `Build VRM Studio` でWorker構文検査 + Vite buildも行う。

## 設計・ルール

- `../../docs/production-rules.md`
- `../../docs/video-app-architecture.md`
- `../../docs/video-app-today.md`
