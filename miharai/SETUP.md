# 未祓いマップ運用セットアップ

この版は Google スプレッドシートを使いません。Chrome から直接 GitHub の `miharai/data.json` を更新します。

## 構成

- `miharai/index.html` 公開マップ
- `miharai/data.json` 公開台帳
- `miharai/admin.html` Chrome用記録端末

## 最初の一回だけ

GitHub で Fine-grained personal access token を作成します。

推奨設定：

- Repository access: `subeha-portfolio` のみ
- Repository permissions: Contents = Read and write
- 有効期限は必要な範囲で短めに設定

トークンを `miharai/admin.html` の認証欄に貼り、「このタブに保持」を押します。

トークンは `sessionStorage` にだけ保存されます。HTML、`data.json`、GitHubコミットには書き込みません。Chromeのタブを閉じると消えます。

## 日常運用

1. Chromeで `miharai/admin.html` を開く
2. 「現在地を取得」を押す、または地図をタップ
3. 地点名、分類、状態、観測内容、未処理理由を入力
4. 公開位置のぼかし距離を選ぶ
5. 必要なら「公開位置をずらし直す」
6. 「本番へ反映」を押す
7. `miharai/data.json` がGitHub上で更新され、公開マップへ反映される

既存の点をタップすると編集できます。状態変更、再観測、処理済み・消失への変更、削除も同じ管理画面から行えます。

## 位置情報

GPSで取得した正確な座標はブラウザ内で公開位置を生成するためにだけ使用します。GitHubに保存するのは、指定距離だけずらした公開座標のみです。

標準のぼかし距離は約700m。300m / 500m / 700m / 1km / 2kmから選べます。

重要：この構成では正確な地点を後から復元できません。将来、非公開の正確な位置も保存したくなった場合は、公開GitHubとは別の非公開ストレージを追加してください。

## Chromeで位置情報が取れない場合

- サイトを HTTPS で開いているか確認
- Chromeのサイト設定で「位置情報」を許可
- Android本体の位置情報をON
- `file://` でHTMLを直接開かず、GitHub Pages等のHTTPS配信URLから開く

## 公開側

`miharai/index.html` は `data.json` を直接読み込みます。Google SheetsやCSV公開URLには依存しません。
