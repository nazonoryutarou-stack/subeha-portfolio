# AI Blender Bridge Autostart add-on (Android / experimental)

## 何をするか
Blenderのアドオンが有効になると、起動後にローカルの Termux Blender Bridge `127.0.0.1:8765` に接続を試みます。接続できないときは再試行し、復旧したら既存の許可されたJSON命令を扱う `blender_agent.py` を起動します。**ワイヤレスADBは不要**です（インストールはBlenderの設定画面で1回行う）。

**注意：** これはAndroid版の非公式Blenderで未検証の実験的アドオンです。Blenderが実行中でTermuxのBridgeが起動している必要があり、Androidのバックグラウンド停止を回避するものではありません。

## 1. TermuxでZIPを生成

```sh
termux-setup-storage
curl -fLsS -o ~/ai-blender/build_android_addon.py https://raw.githubusercontent.com/nazonoryutarou-stack/subeha-portfolio/main/tools/ai-blender-bridge/build_android_addon.py
python ~/ai-blender/build_android_addon.py
```

出力：`Download/AI_Blender_Bridge_Autostart.zip`。ZIPには接続用のローカルトークンが含まれるため、**絶対に他人に送らないこと**。GitHubにもアップロードしない。インストール後はDownloadsのZIPを削除してよい。

## 2. Blenderからアドオンをインストール
- Blenderを起動
- Edit > Preferences を開く
- `Get Extensions` の右上のメニューから `Install from Disk`、または `Add-ons > Install`（移植版のUIによって異なる）
- `Download/AI_Blender_Bridge_Autostart.zip` を指定
- `AI Blender Bridge Autostart` を有効化
- 必要なら `Save Preferences` を実行

インストールに失敗する場合はBlender側のエラー画面を確認する。Android移植版がZIPインストールをサポートしていない場合、この方法では導入できない。

## 3. 接続確認

TermuxでBridgeの稼働確認：

```sh
curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8765/
```

`HTTP 403` ならローカルサーバーは起動中。もし起動していなければ別セッションで：

```sh
python ~/ai-blender/bridge_server.py
```

Blenderを前面に戻し、Termuxで接続状況だけを確認：

```sh
python - <<'PY'
import json
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlencode
from datetime import datetime
t=(Path.home()/'.ai_blender_bridge/token').read_text().strip()
u='http://127.0.0.1:8765/status?'+urlencode({'token':t})
with urlopen(u,timeout=5) as f: d=json.load(f)
seen=d.get('status',{}).get('blender_last_seen')
print('Blender最終通信:',datetime.fromtimestamp(seen) if seen else 'なし')
print('待機中:', d.get('pending'))
print('実行中:',d.get('inflight'))
print('最後の結果:',d.get('status',{}).get('last_result'))
PY
```

通信が続くかを確認するには、Blenderを閉じて再起動し、もう一度この診断を行う。ADB接続はこのテストでは不要。

## 停止と安全
- BlenderのPreferencesからアドオンを無効化するとタイマーを停止する。
- Termuxのブリッジサーバーは `Ctrl+C` で停止する。
- トークンを変更したら端末内でZIPを作り直し、Blenderに再導入する。
- 現状はローカルブリッジから取得したPythonエージェントを読み込む。**ローカルのTermux環境自体を信用できることが前提**。GitHubの公開JSONから任意のPythonコードを実行する設計にはしていない。
- 同期中の現在ジョブはロボットv2の専用シーンをリセットする。保存したい未保存の作品がある場合は、アドオンを有効にする前に別ファイルへ保存する。
