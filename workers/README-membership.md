# Membership Worker

`membership-worker.js` は Cloudflare Worker 用。

役割:

- Cloudflare Access OTP 認証
- Stripe subscription 状態確認
- 会員セッション発行
- private transcript repo の `reports/index.json` / `reports/<episode>.md` 読み出し
- Stripe Customer Portal session 作成

詳細は `docs/membership-report-archive.md`。
