---
name: video-highlight-editing
description: 長尺配信から切り抜き候補を選び、話者判定、原音切り出し、編集プランを作成する。
---

# video-highlight-editing

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## 編集手順
1. 全体の前後文脈と時刻付き配信記録から、独話として成立、オチがある、個人情報リスクが低い箇所を選ぶ。
2. セグメントIDで原音の範囲を確定。private `tools/whisper-timed/video_clip_manifest.py` は clip-relative SRT と任意の音声切り出しに使える。
3. HOST / GUEST / UNKNOWN を必ず区別。UNKNOWN で本人の口パクを動かさない。
4. 編集プランの各cutについて source start/end、speaker、目的、採否理由、音声連続性を記録。
5. PR #22 の edit-plan schema / import script は未マージ。利用時は `feature/vrm-studio-webapp` を明示してcheckoutし、mainから呼ばない。

## 禁止
別配信から音声・字幕を代用しない。推定時刻で切り抜きの長さを装わない。相談者が特定される切り抜きを無審査で公開しない。

## 現物の参照先
- PRIVATE / main — `tools/whisper-timed/video_clip_manifest.py`
- PUBLIC / 未統合PR #22 — `remotion/vrm-lipsync/assistant-plan.schema.json`
- PUBLIC / 未統合PR #22 — `remotion/vrm-lipsync/scripts/import-assistant-plan.mjs`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
