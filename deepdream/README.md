# DeepDream Lab

スマホブラウザで、動物・昆虫・海洋生物・人体・植物の特徴を使ったDeepDreamを繰り返し実行する実験ツール。

## v21 の方式

- TensorFlow.js 4.22
- ImageNet学習済み InceptionV3 の中間層 (`mixed3` / `mixed5` / `mixed7`)
- アセットごとにビルド時生成した意味チャンネル群を使用
- 16MP以下の入力画像は原寸で保持（48MP級などはモバイルメモリ保護のため16MP以下へ縮小）
- DeepDream計算だけを最大 768 / 1024 / 1280px の作業解像度で実行
- 192px または 256px タイルで勾配計算
- octave間でdetail残差を持ち越す
- 最後に **DeepDreamの差分だけを原寸へ拡大して原画像へ加算**
- WebGLテクスチャは使用後に解放し、履歴は96MB上限で管理

低解像度の完成画像を引き伸ばす方式ではない。原画像の細部は原寸側に残し、夢の差分だけを戻す。

## 操作

1. 画像を選ぶ
2. 重さを `軽い / 標準 / 濃い` から選ぶ
3. 幻覚アセットを選ぶ
4. `夢を見る`
5. 同じ画像へ続けて再変換可能
6. 必要なら `停止 / 戻す / 原画 / PNG保存`

## 再変換のメモリ管理

`tf.disposeVariables()` は使用しない。LayersModelの重みも `tf.Variable` だからである。モデルの寿命は `dreamModel.dispose()` で管理し、変換中の一時Tensorは `dream-engine.js` 内の `tf.tidy()` / `dispose()` で破棄する。

WebGLでは `WEBGL_DELETE_TEXTURE_THRESHOLD=0` を設定し、不要なGPUテクスチャをプールへ溜め続けない。

## モデル生成

モデル本体はリマc��トリへ直接保存せず、GitHub Pagesビルド時に `deepdream/build_dream_models.py` で生成する。

ビルド時にはv21の実タイルサイズである **192px / 256pxの両方**について、BN融合前後の一致と入力勾配が有限値であることを確認する。

## ローカルの軽量テスト

```bash
node deepdream/test-v21.mjs
```

これはモデルをダウンロードせず、縦横比、12MP画像の処理量、v21エントリポイント、再変換を壊す `tf.disposeVariables()` の再混入を検査する。

詳細は `docs/deepdream-v21.md`。
