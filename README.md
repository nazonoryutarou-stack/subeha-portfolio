# すべての歯が見える｜不氣屋

配信・ことば・作品・商品をまとめた公式サイト。正本はこのリポジトリ、公開ファイルは `public/`。

## 公開側の入口

- `public/index.html`：不氣屋トップ。作品、GRAVITY配信案内、商品、ごあいさつ
- `public/words/`：語録。HTML本文と正本データ
- `public/works/ninja-kaishaku/`：短編小説「忍者解釈」
- `public/komonjo/`：古文書文庫
- `public/theory/`：知覚・記録・道具についての作業仮説
- `public/products/`：実際の相談・商品と既存決済先
- `public/workboard/`：企画管理
- `public/arcade/`：未完成のため非公開案内のみ

ルートの `home.html` や旧共通シェルは以前の構成を含む資料・制作資産であり、現行公開トップではない。

## 公開運用

公開先は既存NeocitiesとGitHub Pages。GitHub Actionsが使えない間は、公開用更新ZIPをNeocitiesへ手動で反映する。ソースの保存と公開反映を区別し、公開URLの確認なしに反映完了とはしない。

- 大幅改修前の状態はバックアップブランチへ保存する。
- 原稿・商品価格・購入先を推測で変更しない。
- 未完成の作品を公開側へ載せない。
- 配信プロフィールURLや配信中表示を推測で作らない。
- 顧客情報はGitHubや静的HTMLへ保存しない。
- 動画制作は `CHATGPT_WORKFLOW.md` と `docs/production-rules.md` に従う。

今回の変更と手動反映手順：`docs/creator-site-2026-10.md`。
