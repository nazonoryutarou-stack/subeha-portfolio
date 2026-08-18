# DeepDream Lab

ブラウザ内で画像をDeepDream処理する実験ツール。

## 機能

- 画像アップロード / ドロップ
- MobileNet中間特徴を勾配上昇で増幅
- 強度・反復・オクターブ・ズーム・ディテール・彩度・解像度調整
- CLASSIC / EYES / FUR / ARCHITECTURE / ACID / MILD プリセット
- Undo / Reset
- 原画比較スライダー
- ランダム設定
- 連続DeepDream生成
- PNG保存
- スマホ対応
- 全処理をブラウザ内で実行

## 技術

TensorFlow.js + MobileNet を使用。Google/TensorFlowのDeepDreamチュートリアルと同様に、中間層の活性を損失として入力画像に対する勾配上昇を行う。

注意: 元祖DeepDreamのCaffe/Inceptionモデルそのものではなく、現代ブラウザで動かすためMobileNetを使用した再実装。モデル差により生成される模様も異なる。

## 操作

`deepdream/index.html` を開き画像を選択し、Dreamを押す。高解像度・高反復・多オクターブはスマホでは負荷が高い。
