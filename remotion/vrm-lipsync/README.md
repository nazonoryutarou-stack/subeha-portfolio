# VRM LipSync / production workflow

配信切り抜きを、同じVRM・同じ画面設計で繰り返し書き出すためのRemotionテンプレート。

## 必要なもの

`public/` に次を置く。

- `Subeha.vrm`
- `voice.m4a`（`voice.mp3` / `voice.wav` でも波形生成可）

`public/` の素材と `out/` の書き出しはGit管理しない。

## 初回

```bash
npm install
npm run envelope
npm run studio
```

`npm run envelope` は ffmpeg を使用する。音声から30fpsのRMS波形を作り、`public/envelope.json` に保存する。

## Studioで変えるもの

CompositionのPropsから変更する。

- `title` : 冒頭の見出し
- `telop` : 画面下のテロップ
- `background` : 背景色
- `showMeter` : AUDIO DRIVE表示
- `modelFile` : VRMファイル名
- `audioFile` : 再生音声ファイル名
- `envelopeFile` : 口パク波形JSON

## Composition

- `VrmLipSync` : 720x1280 縦
- `VrmLipSyncSquare` : 900x900 正方形
- `VrmLipSyncLandscape` : 1280x720 横

尺は `envelope.json` の `durationInFrames` から自動決定する。

## 書き出し

```bash
npm run render
npm run render:square
npm run render:landscape
```

各renderコマンドは、書き出し前に必ず `npm run envelope` を実行する。音声だけ差し替えて古い口パク波形のまま納品する事故を防ぐため。

出力先:

- `out/kiritori.mp4`
- `out/kiritori-square.mp4`
- `out/kiritori-landscape.mp4`

## Propsをコマンドから渡す

```bash
npx remotion render VrmLipSync out/kiritori.mp4 \
  --props='{"title":"第百五十三回 / 切り抜き","telop":"ほんまに視えとる人は、視えるとは言わへん。"}'
```

この方法で直接renderする場合は、その直前に `npm run envelope` を実行すること。

## 安全策

- VRM読み込み完了までは `delayRender()` で書き出しを止める。
- `envelope.json` 読み込み完了までも書き出しを止める。
- VRM 0.x のときだけ `rotateVRM0()` を適用する。VRM 1.0を無条件に回転させない。
- envelopeのfpsとCompositionのfpsが違う場合はエラーにする。
- envelopeが無い、空、壊れている場合は書き出しを中断する。

## 音声を交換するとき

1. `public/voice.m4a` を交換
2. `npm run envelope`
3. `npm run studio` で確認
4. `npm run render`

通常のrenderコマンドでは手順2を自動で再実行するが、Studioで先に確認したい場合は明示的に実行する。
