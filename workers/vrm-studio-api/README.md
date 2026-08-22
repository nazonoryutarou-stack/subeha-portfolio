# VRM Studio API

`workers/vrm-studio-api/` は、`tools/vrm-talker/` から秘密鍵を分離し、timed ASR・話者分離・Visual Director・画像生成・Openverse画像固定化を担当する Cloudflare Worker。

ブラウザへ `OPENAI_API_KEY` を渡さない。音声時刻の正本は元音声であり、AIに秒数を生成させない。

## Endpoints

### `GET /api/health`

Worker到達とOpenAI secretの設定状態を返す。

```json
{
  "ok": true,
  "openaiConfigured": true,
  "transcriptionModel": "gpt-4o-transcribe-diarize",
  "visualDirectorModel": "gpt-5.4-mini",
  "imageModel": "gpt-image-2"
}
```

### `POST /api/transcribe`

`multipart/form-data`:

- `audio`: 必須。1リクエスト25MB以下
- `knownSpeakerName`: 任意。通常 `HOST`
- `knownSpeakerReference`: 任意。`knownSpeakerName` と組で指定

OpenAI `gpt-4o-transcribe-diarize` を `response_format=diarized_json` / `chunking_strategy=auto` で呼ぶ。

既知話者参照がある場合は `known_speaker_names[]` / `known_speaker_references[]` として渡す。API自身は匿名話者を配信者本人だと推測しない。

返却の主要フィールド:

```json
{
  "durationMs": 45000,
  "speakers": ["HOST", "SPEAKER_00"],
  "avatarSpeaker": "HOST",
  "captions": [
    {"text": "...", "startMs": 0, "endMs": 1200, "speaker": "HOST"}
  ],
  "speakerTurns": [
    {"speaker": "HOST", "startMs": 0, "endMs": 1200}
  ]
}
```

Web Studio側は8分超の元音声を容量に関係なく約8分coreへ分割し、前後2秒のoverlapを付けて16kHz / mono / s16 WAVを1区間ずつ送る。全チャンクWAVをメモリへ溜めない。

### `POST /api/visual-cues`

字幕列を意味解析し、視覚補助が有効な箇所を返す。

AIが返すのは `startIndex / endIndex`。実 `startMs / endMs` はWorker側で既存captionから確定する。

- 実在資料: `mode=search`
- 架空物・抽象概念・演出素材: `mode=generate`
- 最大8件
- Structured OutputsのJSON Schemaで出力形式を固定

Web Studio側では、話者情報がある場合に本人以外の字幕本文を `[非本人発話]` へ置換してから送る。また本人発話にアンカーされない候補は採用しない。

### `POST /api/images/generate`

```json
{
  "prompt": "...",
  "size": "1024x1024",
  "quality": "low"
}
```

OpenAI `gpt-image-2` を使う。画像生成は課金を伴うため、Web Studioでは自動実行せず明示クリックで開始する。

### `POST /api/images/import-openverse`

```json
{"id": "OPENVERSE_IMAGE_ID"}
```

OpenverseのIDからメタデータを取得し、採用画像をdata URLへ固定する。

安全策:

- 任意URLをクライアントから受け取らず、Openverse IDだけ受け取る
- localhost / loopback / private IP / link-local / private IPv6 を拒否
- リダイレクト先も毎回再検査
- 最大リダイレクト数を制限
- 最大6MBまでストリーミング読込
- PNG / JPEG / WebP / GIFの実ファイルシグネチャを確認
- creator / license / source URLを保持

これによりWeb録画CanvasへCORS依存のremote画像を直接混ぜず、固定済み画像を使う。

## Local development

```bash
cd workers/vrm-studio-api
npm install
npm run check
npm test
npx wrangler secret put OPENAI_API_KEY
npm run dev
```

`OPENAI_API_KEY` は `wrangler.jsonc` やソースへ書かない。

## Production deployment

GitHub Actionsの `Deploy VRM Studio API` を正規デプロイ経路とする。

必要なrepository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `OPENAI_API_KEY`

Cloudflare API tokenは対象アカウントへスコープし、Worker scriptのデプロイ・secret更新・workers.dev状態確認ができる権限を持たせる。Cloudflareの `Edit Cloudflare Workers` テンプレートを使うか、少なくともWorkers Scriptsの書き込み権限を含むカスタムtokenを使う。

Deploy workflowは成功前に次を実行する。

```text
required secrets確認
→ npm install
→ Worker構文検査
→ Openverse import安全テスト
→ wrangler deploy
→ OPENAI_API_KEY secret同期
→ workers.dev公開状態確認
→ /api/health
→ openaiConfigured=true確認
```

Secrets未設定のままデプロイはしない。

## GitHub Pages connection

本番Pagesでは、Cloudflare設定が存在すれば `.github/workflows/pages.yml` がアカウントのworkers.devサブドメインを取得し、

```text
https://subeha-vrm-studio-api.<workers-subdomain>.workers.dev/api
```

を `VITE_VRM_STUDIO_API_BASE` としてVite buildへ自動注入する。

各端末でWorker URLを手入力するのは開発用フォールバックだけ。

## CORS

`wrangler.jsonc` の `ALLOWED_ORIGIN` を本番GitHub Pages originへ限定する。

- 本番で `*` を使わない
- `localhost` / `127.0.0.1` はローカル開発用として許可
- 許可外Originは403

## Current deployment blocker

2026-08-22時点のGitHub Actions Config Checkでは次の3 secretsが未設定。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `OPENAI_API_KEY`

そのため実Workerデプロイと実OpenAI E2E QCはまだ行えない。コード側のBuild / Worker安全テスト / Remotion Check / Structural Smoke / Site QAは最新headで通過済み。
