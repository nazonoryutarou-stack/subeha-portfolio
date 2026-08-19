# DeepDream Lab

スマホブラウザでもクラシックなDeepDreamを安定して動かすための固定設定ツール。

## 操作

1. 画像を選ぶ
2. `夢を見る` を押す
3. 完了後にPNG保存

調整パラメータはありません。停止・戻す・原画復帰のみ用意しています。

## v17 の方式

- TensorFlow.js 4.22
- ImageNet学習済み InceptionV3
- 対象層: `mixed5` 単独
- 損失: 中間活性の平均
- 入力画像に対する gradient ascent
- gradient は標準偏差で正規化
- `step_size = 0.01`
- jitter
- 複数 octave
- octave 間の detail 残差持ち越し
- **勾配計算は常に 96×96 タイル単位**

以前の実装では自己診断だけ96px、実処理は大きなフレーム全体を逆伝播していたため、Android上でTensorFlow.js内部の `dataId` エラーが起きる経路が残っていました。v17では自己診断と本処理の計算単位を完全に同一化し、全てのモデル呼び出しを96×96タイルに固定しています。

## モデル生成

モデル本体はリポジトリへ直接保存せず、GitHub ActionsのPagesビルド時にTensorFlow/Kerasから生成してTensorFlow.js形式へ変換します。ビルド時には96×96入力で実際にGradientTapeを通すsmoke testを行い、勾配が有限値であることを確認してからデプロイします。
