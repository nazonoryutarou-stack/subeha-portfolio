---
name: video-production-director
description: 配信音声・実写・アニメーションの映像制作を企画から書き出しとQCまで統括する。制作依頼、完成判定、各動画スキルの選択に使用。
---

# video-production-director

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## 作業順序
1. 企画意図、完成形式（16:9 / 9:16）、観客、尺、公開可否を整理する。未指定なら安全な仮定を job に明記する。
2. 出典・音声・使用許諾を確定。個人的な相談や原音は公開リポジトリに置かない。
3. 台本・ショットリストまたは実配信の切り抜き候補を作り、編集根拠を残す。
4. ASRの *timed* と表示用 *clean* を分離し、同じ原音に結び付ける。
5. 話者を HOST / GUEST / UNKNOWN に分類し、UNKNOWN を HOST と断定しない。
6. 絵コンテ、Bロール、音声処理、字幕、VRM、演出、エクスポートを各スキルへ振り分ける。
7. 構造QCと実フレーム目視確認を両方実施。動画を見ていない状態で「完成」としない。

## 制作ルート
- **配信の自動短尺動画**: private timed transcript → video-highlight-editing → video-caption-timing → video-vrm-performance → video-render-delivery。
- **企画からの映像**: video-storyboard-writing → video-visual-research → video-motion-vfx → video-audio-finishing → video-render-delivery。
- **実験映像**: video-deepdream-art → video-motion-vfx → video-render-delivery。

## 最優先
`docs/production-rules.md` を最初に読む。既存の制作正本PR #22は **未マージの draft** であり、mainに存在しないツールをmainの実装済みと報告しない。

## 現物の参照先
- PUBLIC / main — `CHATGPT_WORKFLOW.md`
- PUBLIC / main — `docs/production-rules.md`
- PUBLIC / main — `docs/vtuber-engine-golden-baseline.md`
- PUBLIC / 未統合PR #22 — `docs/assistant-video-pipeline.md`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
