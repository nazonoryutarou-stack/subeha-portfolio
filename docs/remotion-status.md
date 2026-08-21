# Remotion / VRM 実装状況

最終更新: 2026-08-21

## 先に読むもの

1. `docs/production-rules.md`
2. この文書

配信切り抜き・VRM動画を扱う別チャットでは、上記を読んでから作業する。

## 現在の正しい実装場所

VRM切り抜きの新しい実装は **`feature/remotion-workflow-v2`** にある。

`main` の `remotion/vrm-lipsync/` は旧・最小実装であり、現時点では本番動画作成に使わない。

新実装の主なファイル:

- `remotion/vrm-lipsync/src/VrmLipSyncV2.tsx`
- `remotion/vrm-lipsync/src/Root.tsx`
- `remotion/vrm-lipsync/scripts/prepare-clip.mjs`
- `remotion/vrm-lipsync/scripts/transcribe-source.mjs`
- `remotion/vrm-lipsync/scripts/generate-envelope.mjs`
- `remotion/vrm-lipsync/scripts/extract-qc-frames.mjs`
- `remotion/vrm-lipsync/AI_WORKFLOW.md`

## 2026-08-21 修正済み

### 1. Tポーズ対策

旧レンダーではVRMの標準Tポーズをそのまま出していた。

新しい `VrmLipSyncV2.tsx` では、読み込み直後に肩・上腕・前腕を自然体へ補正する。

### 2. 口パク

- 実音声のRMS envelopeを使用
- 小さい声にも反応するよう閾値を調整
- `aa / ih / ou / ee / oh` をフレームごとに更新
- Remotionのキャプチャ前にcanvasを更新するため `useLayoutEffect` を使用

既成の口が動かないMP4をループする方式は禁止。

### 3. 音声と字幕の0秒基準

旧処理の `ffmpeg -ss / -to` による中間AAC切り出しをやめた。

現在は:

```text
元音声
→ atrim=start=...:end=...
→ asetpts=PTS-STARTPTS
→ PCM WAV (public/voice.wav)
```

とする。

これにより、中間AACのencoder delayや二重seekによるズレを避ける。

### 4. VRMの自動配置

リポジトリ直下の `subeha-web-site.vrm` を、`npm run prepare` 時に `public/Subeha.vrm` へ自動コピーする。

手動配置忘れを理由に別素材へ逃げない。

### 5. QCフレーム

`npm run clip` 後に以下を自動抽出する。

- `out/qc/start.png`
- `out/qc/speech-peak.png`
- `out/qc/middle.png`
- `out/qc/end.png`

ただし、抽出しただけでは合格ではない。**実際に画像を見て**、姿勢・口・字幕・オチを確認してから完成とする。

### 6. TypeScriptチェック

`npm run clip` の途中で `npm run check` を実行する。

さらに `feature/remotion-workflow-v2` には `.github/workflows/remotion-vrm-check.yml` を追加し、RemotionコードのTypeScriptチェックをCIで行う。

## まだ未完成

### A. 実素材を使った完成レンダーの再検証

コード修正は済んでいるが、第158回「遺影→遊戯王カード→破門」の実素材で、以下を再検証する必要がある。

- 腕が本当に自然体になっているか
- 発話ピークで口が十分動いているか
- 字幕が実発話に一致しているか
- オチまで30〜60秒程度に収まっているか

ここを見ずに「直った」と断言しない。

### B. 単語内タイミングの完全自動補正

Whisperのタイムコードを使うが、ASRの字幕チャンクが粗い場合、単語単位では数百msずれる可能性がある。

既知の人工ギャップを補正する仕組みは、まだ一般化されていない。

### C. 自動画像判定

QCフレームは自動抽出できるが、以下はまだ人または画像を見られるAIの目視が必要。

- Tポーズ判定
- 口が開いているか
- 字幕位置の破綻
- 画面外クリップ

### D. mainへの統合

新実装はまだ `feature/remotion-workflow-v2` にあり、`main` へ未統合。

統合前に、実レンダーとQCを通す。

## 完成判定

次を全部満たして初めて完成。

- 実音声
- 実タイムコード字幕
- Tポーズではない
- 発話中に口が動く
- 冒頭 / 発話ピーク / 中盤 / オチのQC確認
- 個人情報を含まない
- 90秒以内を原則とする

一つでも未確認なら「検証版」「草案」と呼ぶ。
