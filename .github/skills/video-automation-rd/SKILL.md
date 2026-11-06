---
name: video-automation-rd
description: 配信音声から自動企画・編集・絵選び・映像生成を統合する未完成機能の調査と実装優先順位づけに使用。
---

# video-automation-rd

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## 現状
`feature/vtuber-auto-director` に実験用コード、`feature/vrm-studio-webapp` にStudioの未統合基盤がある。どちらもmain本番で動作保証済みとは扱わない。

## ロードマップ
1. ingestion → ASR/timed/clean → candidate score → edit plan → speaker gate。
2. 原音サンプルから決定論的な絵の割付/タイミング/字幕/口パクを構成。
3. 手動レビューで発話の正誤、相談者情報、参照画像の関連性を確定。
4. レンダーを再現可能にし、job manifest とQC結果を成果物に付随。
5. 複数回（164/166/169など）の静寂/長話/混在パターンで回帰検査。

## 実装の合格条件
同一入力に同じedit plan、第三者による元音声照合、HOSTのみ発話、実MP4と構造/目視QCが揃うこと。設計案と稼働済みを混同しない。

## 現物の参照先
- PUBLIC / 実験ブランチ — `remotion/vrm-lipsync/scripts/auto-director.mjs`
- PUBLIC / 実験ブランチ — `remotion/vrm-lipsync/scripts/vtuber-auto.mjs`
- PUBLIC / 未統合PR #22 — `docs/video-app-architecture.md`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
