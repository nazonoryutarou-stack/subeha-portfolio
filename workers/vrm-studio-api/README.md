# VRM Studio API

`tools/vrm-talker/` が秘密鍵を必要とする処理だけを担当する Cloudflare Worker。

## API

### `POST /api/transcribe`

multipart/form-data の `audio` を受け取り、OpenAI `gpt-4o-transcribe-diarize` で字幕と話者区間へ変換する。

返却例:

```json
{
  "durationMs": 45000,
  "speakers": ["SPEAKER_00", "SPEAKER_01"],
  "avatarSpeaker": null,
  "captions": [
    {"text": "...", "startMs": 0, "endMs": 1200, "speaker": "SPEAKER_00"}
  ],
  "speakerTurns": [
    {"speaker": "SPEAKER_00", "startMs": 0, "endMs": 1200}
  ]
}
```

APIは本人話者を推測しない。Web UIで本人を一度指定し、`project.json` の `avatar.speaker` に保存する。

### `POST /api/images/generate`

```json
{
  "prompt": "...",
  "size": "1024x1024",
  "quality": "low"
}
```

OpenAI `gpt-image-2` で参考画像を生成する。

## Setup

```bash
cd workers/vrm-studio-api
npm install
npx wrangler secret put OPENAI_API_KEY
npm run dev
```

本番:

```bash
npm run deploy
```

`OPENAI_API_KEY` は `wrangler.jsonc` やソースへ書かない。

## Configuration

`wrangler.jsonc`:

- `compatibility_date`: 現行開発日の 2026-08-22
- `ALLOWED_ORIGIN`: GitHub Pages の origin
- Workers Logs / Traces を有効化

ローカルで別originから試す場合は開発用設定を使い、本番originを無闇に `*` にしない。

## Frontend connection

GitHub Pages と Worker が別オリジンなら、ページ側でAPIのベースURLを設定する。

```html
<script>
window.VRM_STUDIO_API_BASE = 'https://YOUR-WORKER.example.workers.dev/api';
</script>
```

同一オリジンで `/api` を中継する構成なら設定不要。

## Current limit

転写へ直接渡す音声は25MB以下に制限している。長尺配信は、対象区間を先に切り出してから送る設計へ拡張する。
