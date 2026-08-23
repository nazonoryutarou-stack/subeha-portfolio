# Membership Report Archive

月額会員「常連」向けに、private `subeha-transcripts` の `reports/*.md` を検索・閲覧する仕組み。

## 構成

- `members/` — GitHub Pages 側の会員UI
- `workers/membership-worker.js` — Cloudflare Worker
- Stripe — 月額1,000円の定期課金
- private `nazonoryutarou-stack/subeha-transcripts` — レポート本文の正本

会員限定本文は public repo に置かない。

## Stripe

- Product: `prod_V7qF7gyIfxRcAg`
- Price: `price_1U7aZ5CafhdTqnR3mloVrsj3`
- Payment Link: `https://buy.stripe.com/3cI14m9owgCu7nZaSzgjC03`
- `members/config.js` の `signupUrl` に設定済み

## Worker secrets / variables

必須:

- `STRIPE_SECRET_KEY` — Stripe live secret key
- `MEMBERSHIP_PRODUCT_ID=prod_V7qF7gyIfxRcAg`
- `SESSION_SECRET` — 十分に長いランダム文字列
- `GITHUB_TOKEN` — private `subeha-transcripts` を read できる fine-grained token
- `ALLOWED_ORIGIN` — 公開サイト origin
- `CF_ACCESS_TEAM_DOMAIN` — `<team>.cloudflareaccess.com`
- `CF_ACCESS_AUD` — Cloudflare Access application audience tag

任意:

- `TRANSCRIPTS_REPO=nazonoryutarou-stack/subeha-transcripts`
- `TRANSCRIPTS_BRANCH=main`
- `MEMBER_CACHE` — KV binding。Stripe状態の5分キャッシュに使用

## Cloudflare Access

Worker の `/login` を Cloudflare Access で保護し、One-time PIN を有効にする。

ログイン時:

1. Access がメールOTPで本人確認
2. Worker が `Cf-Access-Jwt-Assertion` を検証
3. 認証メールと一致する Stripe Customer を検索
4. `常連` product を含む `active` / `trialing` subscription があればセッション発行
5. 会員ページへ戻す

## API

- `GET /login?return=<members url>` — Access認証後、会員セッション発行
- `GET /api/me` — 会員状態
- `GET /api/reports?q=...` — レポート一覧・検索
- `GET /api/reports/:episode` — Markdown本文
- `POST /api/portal` — Stripe Customer Portal session作成

すべての `/api/*` は会員セッション必須で、呼び出し時にも Stripe subscription 状態を再確認する。

## レポート検索索引

private repo 側の `.github/workflows/member-report-index.yml` が `reports/*.md` 更新時に `reports/index.json` を生成する。

索引には episode / date / title / headings / search_text を含む。本文そのものの正本は `reports/<episode>.md`。

## main反映前に必要なこと

1. Cloudflare Worker をデプロイ
2. Access One-time PIN application を作成
3. Worker secrets / variables を設定
4. Customer Portal を有効化
5. `members/config.js` の `apiBase` を Worker URL に設定
6. test customer で「加入 → OTPログイン → 検索 → 本文閲覧 → portal → 解約後アクセス不可」を確認
7. 確認後に main へマージ
