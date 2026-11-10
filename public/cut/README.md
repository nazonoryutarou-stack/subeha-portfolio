# SUBEHA CUT v1.3 — OBJ CG Studio + integration hub

Android Chrome向けローカル動画編集PWA。Videoleapや他社編集アプリとは独立した実装です。

## OBJ からCG映像を作る（新機能）

- **3D CG** ツールで `.obj` モデルを読み込む。練習用の「◇ サンプルの3Dリング」を使うとOBJ不要で体験できる。
- モデルの材質色、X/Y回転、表示位置、拡大、カメラ距離、光の方向、回転・浮遊・静止などの動きを調整。
- 時間位置を移動して「◆ 再生位置をキーに登録」を押すと、個別のキーフレームで回転・位置等を補間できる。
- **既存の動画の上に3Dを合成**できる。映像をまだ読み込んでいない場合は8秒のCG専用背景を自動生成。
- アニメーションは通常のタイムライン再生と動画の書き出しに含まれる。OBJと編集設定を`.subecut`素材入りアーカイブで保存・復元。
- GPUが利用可能ならWebGLを使用。WebGLが制限された環境では**Canvas2Dソフトウェア描画**へ切り替え（最大2400面/フレームに間引く）。

**制約:** `.mtl`/テクスチャ、UVマッピング、スキニング、ボーンアニメーション、物理演算・レイトレーシング・HDRIは未対応。OBJは静的メッシュ形式。モデルサイズ12MB以下／三角形45,000以内。リアルなCGは照明/材質/モデル次第であり、映画品質を保証しません。Canvasでリアルタイム録画するため、H.264/AAC/4K/60fpsが保証されるわけではありません。Nothing Phone実機テストも未実施です。

## 公開リポジトリの統合状況

`integrations/engines.json` がソースとライセンス、機能、接続状況を一覧管理。`integrations/engine-plan.mjs` が現在の編集プロジェクトのタイムライン情報から、将来のAndroidネイティブ実装向け**互換性レポート**を作る。「すべて」→「統合エンジン」で閲覧とJSON出力ができる。

- **ClearCut (MIT)** — Android/Media3のネイティブ映像処理への移行候補（未接続）
- **ActionCut** — 権利情報を確認できず研究用途のみ。コードはコピーしていない。
- **Open Video Editor (GPL-3.0)** — GPLの権利条件が異なるため、実装参考のみ。
- **Lightricks LTX Desktop (Apache-2.0)** — GPUが必要な別のAI生成アプリ。クラウド・ローカル生成サービス未接続。
- **Videoleap Flow Rebuild** — 導入画面の参考。Videoleapの編集エンジンではない。

「統合」は**相互運用設計・移植候補の管理**を指し、上記のAndroid APK、Python/GPUバックエンドやGPLコードがこのPWA内で動くわけではない。現時点で動作する統合機能は**SUBEHA CUT本体 + OBJ CGレンダラー**です。

## テスト

```bash
for f in *.mjs integrations/*.mjs; do node --check "$f" || exit 1; done
node --test test/*.test.mjs
python test/smoke-cg.py  # ChromiumでWebGLが無効ならCanvas2D代替を試験
```

Node 34件テストパス。Chromium 420×933でCGサンプルを取り込み、角度調整、異なる時刻での実画面変化、動画出力を確認。検証環境はWebGLを提供しないためWebGLパスそのものは端末・GPUで未検証。動画は720×1280・約1.64秒、MP4コンテナ／VP9+Opus。Android実機での長尺・多数オブジェクトのメモリ/熱負荷未検証。

## 既存の編集機能を保持

映像・画像の複数クリップ、スマホ用タッチ操作、連続サムネイル、オーバーレイ、トランジション、速度・逆再生、キーフレーム、フィルター、マスク、クロマキー、動画/写真修復、複数音声、字幕/Whisper JSON、音声EQ、編集テンプレート、フレームPNG、素材込みバックアップ等。

公開先: https://nazonoryutarou-stack.github.io/subeha-portfolio/cut/
