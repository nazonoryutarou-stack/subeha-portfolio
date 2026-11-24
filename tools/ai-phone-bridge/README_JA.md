# AI Phone Bridge v0.1 — Android 16 / Termux

ChatGPTがGitHubに書いた「操作命令」を、持ち主が許可した時間・アプリだけ、Android上のTermuxから実行する試作です。**画面を取得→ChatGPTで観察→次の操作を登録**という往復に向けた土台です。

**現状：Pythonによるローカルテスト済み。Nothing Phoneでの実機操作は未検証です。ChatGPTはあなたのスマホに直接アクセスできません。** TermuxとAndroidワイヤレスデバッグの初期設定は端末の持ち主が行います。常時無人で働くエージェントではありません。

## 何ができるか

- 画面のPNG取得、画像をローカル画面で確認
- 座標によるタップ・スワイプ、戻る／ホーム、画面サイズ・前面アプリの取得
- ChatGPTが接続済みGitHubへ書くJSON命令をTermuxが取得して実行
- **オプション**：画面画像を専用の**非公開GitHubリポジトリ**に保存。ChatGPT側にそのリポジトリへのアクセスがあるときのみ、画像を読む経路を作れる

**できないこと**：任意のAndroidコマンド実行、権限の付与、ロック解除、機密画面の制限解除、何時間もの無人自律操作、スマホの映像ストリームの直接閲覧。音声入力、複雑な文字入力も未対応です。

## ① Termuxにインストール

Termuxで：

```sh
pkg update -y
pkg install python android-tools curl -y
curl -fLsS -o ~/install-ai-phone-bridge.sh https://raw.githubusercontent.com/nazonoryutarou-stack/subeha-portfolio/main/tools/ai-phone-bridge/install.sh
# 内容を確認したい場合: cat ~/install-ai-phone-bridge.sh
sh ~/install-ai-phone-bridge.sh
```

インストーラーはプログラムを配置して単体テストを実行するだけです。ADB接続やリモート操作の許可は**自動的に開始しません**。

## ② スマホ自身をワイヤレスADB接続（root・PC不要）

Androidの「設定」→「開発者向けオプション」→「ワイヤレスデバッグ」を開きます。開発者向けオプションがない場合は「ビルド番号」を通常7回タップして有効にします。ワイヤレスデバッグにはWi-Fi接続が必要な場合があります。

1. Termuxと設定画面を分割画面で並べます。
2. 「ペア設定コードによるデバイスのペア設定」を開き、表示される**ペア設定ポート**と6桁のコードを確認します。
3. Termuxで次を実行。`PAIR_PORT`はそのポート番号に置き換えます。

```sh
adb pair 127.0.0.1:PAIR_PORT
```

画面に表示されたペア設定コードを入力します。

4. ペア設定画面を閉じ、ワイヤレスデバッグのメイン画面に表示される**IPアドレスとポート**から、今度は**接続用ポート**を確認します（ペア用とは別です）。

```sh
adb connect 127.0.0.1:CONNECT_PORT
adb devices
```

`127.0.0.1`で接続できなければ、Androidのワイヤレスデバッグ設定に表示されるIPアドレスを使います。`adb devices`に`device`が1台だけ表示されれば接続成功です。端末再起動後などは接続用ポートが変わり、再接続が必要になることがあります。

公式資料：[Android Debug Bridge](https://developer.android.com/tools/adb)

## ③ 操作するアプリを明示的に許可する

Blenderを起動した状態で：

```sh
python ~/ai-phone-bridge/phone_bridge.py doctor
```

前面アプリのパッケージ名（例：`org.example.blender`）が表示されます。これは例なので**実際に表示された名前**を使ってください。

```sh
python ~/ai-phone-bridge/phone_bridge.py allow 実際のパッケージ名
```

**銀行・パスワード管理・認証・決済・個人の通信アプリは許可しないでください。** 登録されていないアプリが前面にある場合、入力操作とスクリーンショットは拒否します。

## ④ 5分間だけローカルで操作を許可

```sh
python ~/ai-phone-bridge/phone_bridge.py arm 5
```

許可は最大10分で自動的に切れます。即時停止：

```sh
python ~/ai-phone-bridge/phone_bridge.py disarm
```

これらは**端末で直接実行するコマンド**です。GitHubからの命令には`arm`や`disarm`が存在せず、遠隔操作側が勝手に許可できません。ワイヤレスデバッグをオフにすればADB接続も止まります。

## ⑤ 画面確認と操作実験

許可したアプリを前面に表示したまま：

```sh
python ~/ai-phone-bridge/phone_bridge.py snapshot
```

PNGは`~/.ai_phone_bridge/data/latest.png`に保存されます。**自動的に外部へは送信されません。**

別のTermuxセッションで：

```sh
python ~/ai-phone-bridge/phone_bridge.py serve
```

表示された`http://127.0.0.1:8766/?token=...`を**そのスマホのブラウザだけで**開くと、直近の画像と操作結果を確認できます。トークンを他人に公開しないでください。

GitHubの作業命令を1度読み込む：

```sh
python ~/ai-phone-bridge/phone_bridge.py once
```

定期チェック（Termuxが動いている間のみ）：

```sh
python ~/ai-phone-bridge/phone_bridge.py run
```

初期ジョブは`status`のみで、タップやスクリーンショットはしません。新しいIDの命令をChatGPTがGitHubへ書き込むと、許可されたアプリでのみ実行できます。処理中の命令を誤って繰り返さないよう、実行済みIDはローカルに記録されます。

## ⑥ 僕が「目で見て修正」するための非公開画像経路（任意）

初期設定では**無効**です。まずはチャットへ手動で画像を送れば、それを見て次の操作を提案できます。

自動的に画像を受け渡ししたい場合は、**新規の非公開GitHubリポジトリ**を作り、そこにアクセスできる**fine-grained personal access token**（そのリポジトリの`Contents: Read and write`権限のみ）を発行してください。トークンは**絶対にチャットに貼らない**でください。

Termuxでトークンを入力して秘密ファイルに保存：

```sh
mkdir -p ~/.ai_phone_bridge
chmod 700 ~/.ai_phone_bridge
umask 077
read -r -s -p 'Private GitHub token: ' GH_TOKEN; echo
printf '%s' "$GH_TOKEN" > ~/.ai_phone_bridge/github_report_token
unset GH_TOKEN
chmod 600 ~/.ai_phone_bridge/github_report_token
```

その非公開リポジトリには`main`ブランチを用意し、`ai-phone-bridge/jobs/current.json`に次のような初期JSONを配置します。

```json
{
  "id": "private-init-001",
  "steps": [{"op":"status"}]
}
```

非公開リポジトリの検証・設定：

```sh
python ~/ai-phone-bridge/phone_bridge.py private-report GitHubユーザー名/非公開リポジトリ名
```

これで命令の取得先も非公開リポジトリに切り替わります。**公開リポジトリに画像をアップロードする処理はコード上で拒否します。** 許可中に生成された画像は非公開リポジトリの`ai-phone-bridge/latest.png`、結果は`ai-phone-bridge/latest.json`に置かれます。GitHubへの画像送信は一時的に許可中の操作に限定されます。

ChatGPT側で同じ非公開リポジトリが**接続・閲覧可能**になれば、僕が画像を読み取り、次の操作を指示できる構成になります。この接続の成立と実機の画像受け渡しはまだ未検証です。

画像転送を止める（公開テスト命令ソースに戻す）：

```sh
python ~/ai-phone-bridge/phone_bridge.py private-report-off
python ~/ai-phone-bridge/phone_bridge.py disarm
```

## JSON操作命令の例

```json
{
  "id": "blender-rotate-view-0001",
  "target_package": "実際のBlenderパッケージ名",
  "steps": [
    {"op":"snapshot"},
    {"op":"swipe", "x":0.55,"y":0.47,"to_x":0.75,"to_y":0.48,"ms":380},
    {"op":"snapshot"}
  ]
}
```

座標は画面幅・高さに対する比率（0～1）です。`tap`, `swipe`, `back`, `home`, `wait`, `status`, `snapshot`以外は拒否。文字入力、任意シェル、APKインストール、画面ロック解除などは許可していません。

## 注意事項

- ADBは強力な開発者向けアクセスです。安全なWi-Fiで使い、不要なときはワイヤレスデバッグをオフにしてください。
- ローカルの画面確認用トークンとGitHubトークンは秘密に。公開リポジトリに画像や認証情報を置かないでください。
- スマホの画面に銀行情報や個人情報が映る可能性があります。画像共有を有効にする前に、送信する画面を自分で確認してください。
- Android側のADB接続・前面アプリ判定・スクリーンショットは機種差があります。実機での成功は保証できません。
- TermuxはAndroidのバックグラウンド制限で停止する場合があります。常時監視アプリとは異なります。
- このチャットから僕が常時スマホを閲覧するわけではありません。**会話中に命令を登録→ユーザーのスマホが実行→非公開画像を取得→次の命令**という往復ができるのは、各接続と権限が揃ったときだけです。