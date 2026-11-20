# VRM STAGE — 音声連動VRMカット演出

サイト: https://nazonoryutarou-stack.github.io/subeha-portfolio/vrm-stage/

**独立アプリの試作版**。VRM 0.x / VRM 1.0を自分の端末から読み込み、音声の再生時刻に応じて骨・表情・カメラを変化させます。映像編集の最終仕上げはVideoleap本家が担当します。

## できること
- VRM / GLB形式のうち、VRM拡張を持つ3Dモデルの読み込み（75MBまで）。
- 音声ファイルの読み込みと、音声の強弱による口パク。自動音素判定ではなくRMSベースの簡易同期です。
- 音声時刻でカット分割し、カットごとに表情6種・身振り7種・カメラ3距離・口の開き方・動きの強さ・左右の構図を指定。
- カット境界の位置調整、削除。モデルをドラッグしてカメラの角度を微調整。
- 9:16、16:9、1:1。PNG静止画。収録APIのあるブラウザでは音声付き動画の実時間キャプチャ。
- 設定JSONの保存・復元。JSONにはVRMや音声の本体を埋め込まないため、後日再び素材を読み込みます。

## 動画ファイルについて
`MediaRecorder.isTypeSupported()` によって、音声付きMP4が使えるブラウザではMP4、そうでない環境ではWebMを試します。特にAndroid ChromiumではWebMが選ばれることがあります。**WebMのままiPhone版Videoleapで読み込める保証はありません。** TermuxのFFmpegを使ってMP4に変換する場合（端末内で実施）:

```sh
pkg install ffmpeg
ffmpeg -i input.webm -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart output.mp4
```

ファイル名・配置は各自の保存先に合わせて変更してください。書き出しは**音声の実時間の長さだけ**かかります。ブラウザのバックグラウンド停止・WebGLメモリ不足・MediaRecorder制約などで失敗する場合があります。

## 参照と権利
- [pixiv three-vrm](https://github.com/pixiv/three-vrm) — THREE.js + VRMLoaderPlugin、VRM表情・正規化ボーン。
- VRMモデル自体の商用利用・宗教・政治利用・モデル改変・クレジット表記はモデルごとに異なります。ロードできることと自由に使ってよいことは別です。
- 外部CDNからthree.js / three-vrmを読み込むため、初回表示にはインターネットが必要です。
- VRM・音声のファイルを当プロジェクトのサーバーへアップロードする処理はありません。

## 未完成・未検証
- Nothing Phone / iPhone実機での画面表示、GPU負荷、音声付き書き出しを未検証。
- 日本語の音素認識・自然なモーションキャプチャ・表情自動推定・長時間録音の最適化は未実装。
- モデルに存在しない表情・ボーンは動作しません。モデル差によるポーズの見え方は未調整。
- 2026年11月時点の試作であり、公式VideoleapやVRoid Hubの製品ではありません。
