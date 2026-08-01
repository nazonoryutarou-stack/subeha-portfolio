# すべての歯が見える｜霊務技術・異物製品

「総合企業トップ → 製品情報 → 品質・研究 → 個別ブランドサイト」という構造で、妹字、式神、術式・鑑定、黒いてるてる坊主を整理した静的サイト。

## 主な入口

- `/`：総合トップ
- `/products/`：製品情報
- `/brands/imoji/`：妹字
- `/brands/shikigami/`：式神
- `/brands/jutsushiki/`：術式・鑑定
- `/brands/kuro-teruteru/`：黒いてるてる坊主
- `/quality/`：霊務品質
- `/research/`：研究・開発
- `/creator/`：制作者
- `/news/`：ニュース
- `/members/`：霊務記録閲覧室のUI試作
- `/private-room/`：制作者の私室
- `/works/`：既存の特設ページ保管庫

## GitHub試作版の構成

- 各入口の `index.html` は共通シェル
- ページ本文、CSS、仮ビジュアルは `assets/chunks/` の圧縮データへ収録
- `assets/bootstrap.js` がURLに応じて各ページを展開
- 外部画像、外部フォント、外部JavaScriptなし
- 仮ビジュアルは実物写真ではなく、商品像を確認するためのCG風試作
- スマートフォン対応、`prefers-reduced-motion` 対応
- 会員ページはUIのみ。認証・データベース・メール送信は未実装
- 顧客情報はGitHubや静的HTMLへ保存しない

## 公開・販売前に必要な作業

- 制作者の実写写真へ差し替え
- 商品の試作品写真、寸法、素材、納期、価格を掲載
- 正式な申込・決済先を接続
- canonical、og:url、OGPの絶対URLを設定
- 会員機能を実装する場合は、認証・RLS・削除方針を別システムで構築

## 配布版

ローカル配布用ZIPには、圧縮ランタイムではなく、展開済みのHTML・CSS・JavaScript・仮SVGを収録する。

## 公開運用

`main` ブランチへの更新をGitHub Pagesへ自動反映する。
