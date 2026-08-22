# Optional Openverse image proxy

`workers/vrm-studio-api/` は、現在の正規動画制作パイプラインでは**必須ではない**。

正規ルートは:

```text
ChatGPTで長尺音声を分析
→ assistant edit-plan.json
→ 短い採用音声
→ GitHub / Remotion render:assistant
→ VRM付きMP4
```

このWorkerは、Webレビュー画面でOpenverse画像を録画安全なdata URLへ固定したい場合だけ使う無料補助プロキシ。

**OpenAI API、文字起こしAPI、Visual Director API、画像生成APIは使わない。`OPENAI_API_KEY` も不要。**

## Endpoints

### `GET /api/health`

```json
{
  "ok": true,
  "version": 7,
  "freeOnly": true,
  "paidAI": false,
  "openverseImport": true,
  "canonicalPipeline": "chatgpt-edit-plan-to-github-remotion"
}
```

### `POST /api/images/import-openverse`

```json
{"id": "OPENVERSE_IMAGE_ID"}
```

OpenverseのIDからメタデータを取得し、採用画像をdata URLへ固定する。

安全策:

- 任意URLをクライアントから受けずOpenverse IDだけ受け取る
- localhost / loopback / private IP / link-local / private IPv6を拒否
- リダイレクト先も毎回再検査
- 最大リダイレクト数を制限
- 最大6MBまでストリーミング読込
- PNG / JPEG / WebP / GIFの実ファイルシグネチャを確認
- creator / license / source URLを保持

## Removed paid routes

次の旧routeは意図的に削除済みで、呼び出すと `410 Gone` を返す。

- `POST /api/transcribe`
- `POST /api/visual-cues`
- `POST /api/images/generate`

有料AI routeを再有効化しない。編集判断はChatGPTの会話内で行い、`assistant edit-plan.json` としてGitHubへ渡す。

## Local development

```bash
cd workers/vrm-studio-api
npm install
npm run check
npm test
npm run dev
```

秘密鍵は不要。

## Optional deployment

Cloudflareへこの画像プロキシを出したい場合だけ、repository secretsとして次の2つを使う。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

`OPENAI_API_KEY` は使わない。

GitHub Actionsの `Deploy Optional Openverse Proxy` は、

```text
Cloudflare secrets確認
→ Worker構文検査
→ Openverse import安全テスト
→ wrangler deploy
→ /api/health
→ freeOnly=true / paidAI=false / openverseImport=true を確認
```

まで行う。

このWorkerが未デプロイでも、`ChatGPT → edit-plan → GitHub/Remotion` の完成動画制作には影響しない。

## GitHub Pages

Cloudflare設定がある場合のみ、Pages buildはWorker URLをViteへ注入できる。これはWebレビュー画面用の任意機能であり、完成動画レンダーの依存関係ではない。

## CORS

`wrangler.jsonc` の `ALLOWED_ORIGIN` で本番GitHub Pages originを限定する。

- 本番で `*` を使わない
- `localhost` / `127.0.0.1` は開発用
- 許可外Originは403
