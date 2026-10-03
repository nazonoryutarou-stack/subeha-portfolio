# 言葉の枝（GitHub版）

元の商品系統図の実装はコミット `668a29d66033b960e7b776d766df521860627e25` にあります。その `public/tree.css` を変更せず `public/thought/tree.css` へ復元し、`tree.js` のDOM計測・曲線・描画タイミング・ホバー・フォーカス・ResizeObserverを直接使っています。HTMLの入れ子、書体、文字サイズ、84pxの枝間隔、モバイルの62pxの枝間隔は元の設定です。

商品データの読み込み部分だけを、断章データから同じクラスのHTMLを静的生成する処理へ変更しています。商品が置かれていた `product` ノードに本人の新規文章（現在は「本文未登録」）を表示し、クリックで一篇の読解画面を開きます。旧商品名・旧文章・旧紹介文は新しい入口に転載していません。既存の古文書文庫・作品・商品ファイルは保持しています。

## 文章・枝の追加

正本は `content/thought/archive.json`。`public/index.html` と `public/thought/` は生成物です。

1. `fragments` にレコードを追加する。`id` は一度決めたら維持し、表示番号は `branchNumber` で変更する。
2. 本人の新規原稿を `body` にそのまま登録する。本人原稿は `textOrigin: "author"`、本人指定引用は `kind: "quotation"` と `textOrigin: "designated-quotation"`。公開は `status: "published"`。
3. `previousId`、`nextId`、`branchIds` に内部IDを指定する。番号から接続は推測しない。
4. 日時は `writtenAt` / `publishedAt` にISO形式で登録する。未指定は `null`。分類は `tags`、登録順は `order`。
5. `node scripts/build-thought.mjs` と `node --test tests/thought/*.test.mjs` を実行する。

未登録は `status: "placeholder"`、`body` / `textOrigin` / `citation` は `null`。準備中は `draft`、取り下げは `archived`。非公開レコードとそれへ向かうリンクは出力しません。

引用情報は `citation` の `author` / `source` / `work` / `note` / `url` に指定された項目だけを登録します。不要な項目は省略可能。URLはHTTP(S)のみ。本文はプレーンテキストでHTMLエスケープされ、読解画面では改行を保持します。

## 構造

- `/` と `/thought/map/`：旧商品ツリーによる言葉の枝
- `/thought/fragments/<id>/`：断章の固有URL・本文・前後・枝・実際の通過経路
- `/thought/index/`：索引・枝番号・タグ検索
- `/thought/timeline/`：執筆日時、なければ公開日時。日時未登録は後ろへ
- `/thought/citations/`：本人指定引用と指定された出典

相対URLなのでGitHub Pagesのプロジェクトパスでも利用可能。JavaScriptなしでも、ツリー内の言葉・本文・前後・分岐・索引・引用へ通常リンクで到達できます。曲線の描画とホバー演出はJavaScriptが追加します。スマートフォンでは元の `.tree-wrap` の内側を横へスクロールします。本文を読む画面では横スクロールは必要ありません。

ツリーのHTMLは明示的な接続から組み立てます。内部IDと表示番号は独立。循環や合流は最初の位置で展開し、二度目以降は同じ断章へ向かうリンクとして表示し、無限に複製しません。孤立した断章も入口から選べます。

経路はタブ内sessionStorageと各履歴エントリー、既読はlocalStorage。直接アクセスで架空の祖先経路は作りません。元のデザインを保つ追加状態は、現在地の下線、既読の注記、通過経路の線の濃さだけです。OSの動きを減らす設定に対応します。

## 検証と公開

Node.js 22以上、追加依存パッケージなし。11件のテストで空本文、番号変更、接続検査、非公開除外、引用URL、日付、循環・合流・1000件、全生成リンク、静的分岐、reduced-motion、および元の商品CSSとの完全一致を検証します。

ブラウザのローカルURL操作がセキュリティポリシーで拒否されたため、実ブラウザでのPC・モバイル操作検証は未実施です。これを完了したとは扱いません。

公開ワークフローには生成コマンドを追加しています。Actionsが利用できない場合は生成後の `public/` を既存の手動公開手順で反映してください。今回は作業ブランチへの保存までで、本番公開は行いません。
