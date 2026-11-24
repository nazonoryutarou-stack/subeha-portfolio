# 📱 AI Blender Bridge — Android導入手順

これは **BlenderをChatGPTの指示で動かすための実験的な連携装置**です。スマホでBlenderを完全に遠隔操作する権限をChatGPTに渡すものではありません。Blenderを最初に起動してPython Consoleに1行入力する必要があります。

## まず必要なもの

- Android版Blender（Wanderson-Magalhaes氏の実験的なFull版、Blender 5.3 Android対応）。公式の正式版ではありません。[公開ページ](https://github.com/Wanderson-Magalhaes/blender_for_android/releases)
- Termux（すでに入っていればそのままでよい）
- インターネット接続、APKを入れられる空き容量

## インストール

Termuxに次を順番に貼り付けます。

```sh
pkg install python curl -y
curl -fLsS -o ~/start-ai-blender.sh https://raw.githubusercontent.com/nazonoryutarou-stack/subeha-portfolio/main/tools/ai-blender-bridge/install.sh
sh ~/start-ai-blender.sh
```

実行すると**専用のローカルURL**と **Blender Python Console用の1行コマンド**が表示されます。

1. Android版Blenderを起動。
2. **Scripting** ワークスペースに移動。必要に応じてエディタ種類のメニューから **Python Console** に切り替える。
3. Termuxに表示された `import urllib.request; exec(...)` という**1行全体**をBlenderのPython Consoleへ貼り付けてEnter。
4. Blenderに `[AI Bridge] ACTIVE` と表示されれば連携が始まっています。
5. Termuxに表示された `http://127.0.0.1:8765/?token=...` のURLをスマホのブラウザで開いて、**Create demo modelling job** を押して動作を確認。

初回接続後、GitHubに登録された作業命令が最大約1～2分の間隔で取り込まれます。最初の公開ジョブは、部屋、ソファ、机、照明とカメラを生成する無害なテストです。

## 次の作業の指示方法

ChatGPTで「Blenderで○○を作って」「照明を調整して」と依頼すると、GitHub内の [命令ファイル](./jobs/current.json) を新しいIDで更新します。連携中のTermuxがこの命令を読み取り、Blenderの `AI Bridge Studio` という専用シーンを変更します。

**注意：** 1回のセッションで受け取るのはJSON形式の許可された操作だけです。安全のためGitHubから任意のPythonスクリプトを自動実行しません。既存のBlenderシーンは削除しません。コードは実行前に確認できます。

## 動かないとき

- Termuxの画面でPythonサーバーが動き続けているか確認。AndroidがバックグラウンドのTermuxを停止する場合があります。
- Blenderが `ACTIVE` と表示しない場合は、Blender Python Consoleの**エラーメッセージ全文**をChatGPTに送る。
- Blenderのバージョンやアプリの権限によりローカル通信が遮断される可能性があります。このスマホでの実機動作はまだ未検証です。
- モデルができたかどうかは、Termuxのローカル画面にある Completed と Last result で確認できます。ChatGPTはスマホ画面やログを自動で読む権限を持ちません。
- レンダリングは任意。大きな画像やモデルを作ると端末容量・メモリ・発熱に影響します。出力ファイルはローカルに保存され、約100MBを超えると古いファイルを掃除します。

停止するときはTermuxで `Ctrl+C`。再開するときは `python ~/ai-blender/bridge_server.py` です。Blenderを再起動した場合はPython Consoleの1行も再実行します。

**重要：** このブリッジをインターネットに公開したり、Termuxで公開IPアドレスに待ち受けさせたりしないでください。認証トークンは秘密のままにしてください。
