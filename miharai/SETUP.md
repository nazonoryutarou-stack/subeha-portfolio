# 未祓いマップ運用セットアップ

この版は Google スプレッドシートを使いません。

## 構成

- `miharai/index.html` 公開マップ
- `miharai/data.json` 公開台帳
- `miharai/admin.html` スマホ用記録端末
- `workers/miharai-worker.js` 記録受付。公開座標をぼかして GitHub の `data.json` を更新する

## Cloudflare Worker に必要な設定

Workerへ `workers/miharai-worker.js` を配置し、以下の環境変数／Secretを設定します。

- `ADMIN_KEY` 管理端末から送る秘密鍵。長いランダム文字列を推奨
- `GITHUB_TOKEN` このリポジトリの Contents を読み書きできる fine-grained personal access token。HTMLへは絶対に書かない
- `GITHUB_REPO` `nazonoryutarou-stack/subeha-portfolio`（省略時もこの値）
- `GITHUB_BRANCH` `main`（省略可）
- `DATA_PATH` `miharai/data.json`（省略可）
- `ALLOWED_ORIGIN` 公開サイトの origin。例 `https://example.com`。本番では設定推奨

WorkerのURLが `https://miharai-api.example.workers.dev` なら、`miharai/admin.html` の初回設定欄へそのURLと `ADMIN_KEY` を入力します。

## 日常運用

1. スマホで `miharai/admin.html` を開く
2. 地点名、分類、状態、観測内容などを入力
3. 「現在地を取得」
4. 公開位置のぼかし半径を選ぶ
5. 「記録する」
6. Worker が座標をずらしたうえで `miharai/data.json` をコミット
7. `miharai/index.html` が次の読み込み時に反映

## 位置情報について

正確な緯度・経度は Worker が受け取った時点で公開用座標へずらし、GitHubには保存しません。したがって、この構成だけでは正確な地点を後から復元できません。

正確な場所を非公開で保存したくなった場合は、GitHubではなく Cloudflare D1 / KV 等の非公開ストレージを別途使います。

## 更新系を追加する場合

現在の Worker は新規記録の追加専用です。再観測、状態変更、処理済みへの変更などは、次段階で `PATCH /records/:id` を追加し、変更履歴も保持する設計に拡張できます。
