# 思想アーカイブ（GitHub版）

正本は `content/thought/archive.json`。`public/index.html` と `public/thought/` は生成物です。旧作品・商品・古文書文庫のファイルは変更せず保持し、新しいトップからは接続していません。

## 文章・分岐の追加

1. JSONの `fragments` にレコードを追加する。`id` は一度決めたら維持し、表示番号は `branchNumber` で変更する。
2. 本人の新規原稿を `body` にそのまま入れる。本人原稿は `textOrigin: "author"`、本人指定引用は `kind: "quotation"` と `textOrigin: "designated-quotation"`。表示するには `status: "published"`。
3. `previousId`、`nextId`、`branchIds` に内部IDを指定する。番号から親子関係は推測しない。
4. 日時は `writtenAt` / `publishedAt` にISO形式で入れる。未指定は `null`。分類は `tags`、表示順は `order`。
5. `node scripts/build-thought.mjs` と `node --test tests/thought/*.test.mjs` を実行する。

未登録レコードは `status: "placeholder"`、`body` / `textOrigin` / `citation` は `null`。原稿準備中は `draft`、取り下げは `archived`。非公開レコードと、それに向かうリンクは公開出力から除外されます。

引用情報は `citation` 内の `author` / `source` / `work` / `note` / `url` に、本人が指定した項目だけを登録します。不要な項目は省略可能。URLはHTTP(S)のみ。本文はプレーンテキストでHTMLエスケープされ、改行は保持されます。

## ページ

- `/`：入口
- `/thought/fragments/<id>/`：断章の固有URL
- `/thought/map/`：接続、現在地、通過済み、未読、分岐
- `/thought/index/`：登録順・枝番号・タグ検索
- `/thought/timeline/`：執筆日時、なければ公開日時。日時未登録は後ろに表示
- `/thought/citations/`：指定引用と出典

相対URLなのでGitHub Pagesのプロジェクトパスでも利用可能。JavaScriptなしでも本文、前後移動、分岐、索引、引用、SVGのリンクへ到達できます。経路はタブ内sessionStorageと各履歴エントリー、既読はlocalStorage。保存不可でも本文と通常リンクは動作します。直接アクセスで架空の祖先経路は作りません。

地図は拡大縮小、PCドラッグ、キーボード操作、現在地2接続周辺の段階表示。40件超では周辺表示を初期化します。モバイルは拡大縮小ボタンと周辺表示を使い、ページ自体のスクロールを妨げません。全件探索には索引を利用できます。OSの動きを減らす設定に対応。

## 検証と公開

Node.js 22以上、追加依存パッケージなし。9件のテストで空本文、番号変更、接続検査、非公開除外、引用URL、日付、循環・1000件、全生成リンク、静的分岐、reduced-motionを検証。

今回、ブラウザのローカルURL操作はセキュリティポリシーで拒否されたため、実画面のモバイル・PC操作検証は未実施。これを完了したとは扱いません。

GitHub Actionsの既存公開ワークフローには生成コマンドを追加。Actionsが利用できない場合は上記コマンドで生成して `public/` を既存の手動公開手順で反映してください。ソース保存はデプロイ完了を意味しません。今回の変更は作業ブランチに保存し、本番公開は行いません。
