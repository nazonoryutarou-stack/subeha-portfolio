# VRM Studio API Worker

`vrm-studio-api.js` は `tools/vrm-talker/` の秘密鍵が必要な処理だけを担当する薄いAPI。

## ルート

### `POST /api/transcribe`

multipart/form-data:

- `audio`: 音声ファイル

OpenAI Transcription API の `gpt-4o-transcribe-diarize` を使い、以下へ正規化して返す。

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

APIは「どの話者が配信者本人か」を推測しない。Web UIで一度選び、`project.json` の `avatar.speaker` に保存する。

## `POST /api/images/generate`

JSON:

```json
{
  "prompt": "...",
  "size": "1024x1024",
  "quality": "low"
}
```

`gpt-image-2` を使用し、PNGのbase64を返す。

## Secrets / Variables

- secret: `OPENAI_API_KEY`
- variable: `ALLOWED_ORIGIN`
  - 例: `https://nazonoryutarou-stack.github.io`

APIキーをGitHub Pages側JavaScriptへ埋め込まない。

## フロントとの接続

PagesとAPIが別オリジンの場合、ページ読み込み前に次を設定する。

```html
<script>
window.VRM_STUDIO_API_BASE = 'https://YOUR-WORKER.example.workers.dev/api';
</script>
```

同一オリジンの `/api` にプロキシする環境なら設定不要。

## 制約

OpenAI Transcription APIへ直接渡すファイルは25MB以下を前提とする。長尺配信はブラウザ/サーバー側で対象区間へ切ってから送る設計へ拡張する。
