# Membership Report Archive

月額会員「常連」向けに、private `subeha-transcripts` の `reports/*.md` を検索・閲覧する仕組み。

## 構成

- `members/` — GitHub Pages 側の会員UI
- `members/admin/` — 所有者専用のレポート管理室UI
- `workers/membership-worker.js` — 会員用 Cloudflare Worker
- `workers/report-admin-worker.js` — 所有者用 Cloudflare Worker
- Stripe — 月額1,000円の定期課金
- private `nazonoryutarou-stack/subeha-transcripts` — レポート本文の正本

会員限定本文は public repo に置かない。

## Stripe

- Product: `prod_V7qF7gyIfxRcAg`
- Price: `price_1U7aZ5CafhdTqnR3mloVrsj3`
- Payment Link: `https://buy.stripe.com/3cI14m9owgCu7nZaSzgjC03`
- `members/config.js` の `signupUrl` に設定済み

## 会員用 Worker secrets / variables

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

## 所有者用 Worker secrets / variables

必須:

- `SESSION_SECRET` — 所有者セッション署名用。会員用とは別値推奨
- `GITHUB_TOKEN` — private `subeha-transcripts` の read-only fine-grained token
- `ADMIN_EMAILS` — 管理者として許可するメール。複数ならカンマ区切り
- `ALLOWED_ORIGIN` — 公開サイト origin
- `CF_ACCESS_TEAM_DOMAIN` — `<team>.cloudflareaccess.com`
- `CF_ACCESS_AUD` — 所有者用 Access application audience tag

任意:

- `TRANSCRIPTS_REPO=nazonoryutarou-stack/subeha-transcripts`
- `TRANSCRIPTS_BRANCH=main`

所有者WorkerはStripe秘密鍵を持たない。管理画面から課金操作はしない。

## Cloudflare Access

### 会員用

会員 Worker の `/login` を Cloudflare Access で保護し、One-time PIN を有効にする。

ログイン時:

1. Access がメールOTPで本人確認
2. Worker が `Cf-Access-Jwt-Assertion` を検証
3. 認証メールと一致する Stripe Customer を検索
4. `常連` product を含む `active` / `trialing` subscription があればセッション発行
5. 会員ページへ戻す

### 所有者用

所有者 Worker の `/login` も Access One-time PIN で保護する。

1. Access がメールOTPで本人確認
2. Worker が Access JWT を検証
3. メールが `ADMIN_EMAILS` に含まれる場合だけ所有者セッション発行
4. `/members/admin/` へ戻る
5. 所有者セッションで private repo のレポートを検索・閲覧

## 会員 API

- `GET /login?return=<members url>` — Access認証後、会員セッション発行
- `GET /api/me` — 会員状態
- `GET /api/reports?q=...` — レポート一覧・検索
- `GET /api/reports/:episode` — Markdown本文
- `POST /api/portal` — Stripe Customer Portal session作成

すべての `/api/*` は会員セッション必須で、呼び出し時にも Stripe subscription 状態を再確認する。

## 所有者 API

- `GET /login?return=<admin url>` — Access認証後、所有者セッション発行
- `GET /api/me` — 管理者本人確認
- `GET /api/reports?q=...` — 全レポート一覧・全文検索
- `GET /api/reports/:episode` — Markdown本文

## レポート検索索引

private repo 側の `.github/workflows/member-report-index.yml` が `reports/*.md` 更新時に `reports/index.json` を生成する。

索引には episode / date / title / headings / search_text を含む。本文そのものの正本は `reports/<episode>.md`。

## 常連プランを開始する手順

1. Cloudflare Workers で会員用 Worker を作成し、`workers/membership-worker.js` をデプロイ
2. 会員用 Worker に上記 secrets / variables を設定
3. Cloudflare Zero Trust > Access で会員Workerの `/login*` を保護する Self-hosted application を作成
4. Login methods で One-time PIN を有効化
5. Access application の audience tag を `CF_ACCESS_AUD` に設定
6. Stripe Customer Portal を有効化
7. 会員Worker URL を `members/config.js` の `apiBase` に設定
8. 所有者用 Worker を作成し、`workers/report-admin-worker.js` をデプロイ
9. 所有者用 Worker に `ADMIN_EMAILS` と private repo read token 等を設定
10. 所有者Workerの `/login*` も別の Access application で保護し、その audience tag を設定
11. 所有者Worker URL を `members/admin/config.js` の `apiBase` に設定
12. test customer で「加入 → OTPログイン → 検索 → 本文閲覧 → portal → 解約後アクセス不可」を確認
13. `/members/admin/` で「管理者OTP → 一覧 → 検索 → 本文閲覧」を確認
14. 確認後に feature branch を `main` へマージ

## 公開開始

上記テスト完了後、サイト上に「常連」導線を出す。

入会URLは既に本番 Stripe Payment Link。公開前に会員Workerの `apiBase` が空でないことを必ず確認する。課金だけ通って本文が読めない状態を作らない。
