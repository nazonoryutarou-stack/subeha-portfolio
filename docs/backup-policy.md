# 制作物バックアップ・公開運用

## 正本

GitHubリポジトリ `nazonoryutarou-stack/subeha-portfolio` を正本とする。チャット内の生成ファイル、Neocities、端末内ZIPは複製物として扱う。

## 完成時の必須手順

1. `works/<slug>/` にソース、README、OGP、データを保存する。
2. UTF-8、相対リンク、スマホ表示、JavaScript構文、主要リンクを確認する。
3. Neocities用ZIPを同一ソースから生成する。
4. GitHubへコミットし、PRまたはmainへの反映状況を確認する。
5. `works/README.md` の目録を更新する。

## 外部依存

API、画像、Google Fonts、販売URLなどは各作品READMEへ列挙し、停止時のフォールバックを用意する。

## 復旧

Neocities側が消失した場合、GitHubの該当ディレクトリをそのまま再アップロードする。GitHub上のファイルが不足している場合は公開を完了扱いにしない。
