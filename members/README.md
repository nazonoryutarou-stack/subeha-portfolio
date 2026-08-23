# 配信観測記録アーカイブ

会員向けUIの入口。

- `index.html` — 会員ページ
- `app.js` — ログイン、検索、閲覧、Customer Portal
- `config.js` — API URL / Stripe入会URL

本文は public repo に置かず、`workers/membership-worker.js` 経由で private `subeha-transcripts` から取得する。
