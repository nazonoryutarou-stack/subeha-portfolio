---
name: video-audio-finishing
description: 配信原音の修復、ノイズ除去、レベル整合、BGM・SEのミックス、音声尺と映像尺の確認に使用。
---

# video-audio-finishing

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## 原則
- 本人の実音声が最重要。BGM・効果音で言葉を埋めない。
- 編集素材は原本コピー。原音の時刻と口パク駆動用エンベロープを同じファイルに基づける。
- ノイズ処理は可逆な作業系列で検証し、声の抑揚・子音を破壊しない。
- BGMは利用規約/購入ライセンス/公開先の権利処理を確認。無断で商業楽曲を使用しない。

## 手順
1. 音声stream、sample rate、durationをffprobeで測定。
2. クリップ境界は短いフェードを使い、音節の途中切断やクリックノイズを避ける。
3. 声とBGMのラウドネスを分離して計測し、必要ならFFmpeg loudnorm等で正規化。配信先の仕様は都度確認。
4. 真のピーク、過大な音量差、長い無音、A/V duration差を検査。
5. 最終書き出しで原音の出所・版をメタデータに残す。

## 合格
言葉の聞き取りやすさ、実音声の連続性、BGM権利の監査が完了していること。

## 現物の参照先
- PUBLIC / main — `docs/production-rules.md`
- PUBLIC / 未統合PR #22 — `remotion/vrm-lipsync/scripts/generate-envelope.mjs`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
