---
name: video-visual-research
description: 映像に合う写真、図版、古文書、観察パネル、Bロール、出典と権利を調査・設計する。
---

# video-visual-research

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## 画作り
1. 発話の話題を理解し、画面に示すべき具体物/関係/情緒を抽出。
2. 一致する素材がないときは適当なストック写真を出さず、タイムライン/波形/観察カード/抽象図で表現。
3. 各素材にsource URLまたは内部ファイル、著作権、ライセンス、同意、加工可否、出典表示要否を紐付け。
4. 画の採用時間は発話内容に従う。異なる回や相談者の写真を結び付けない。
5. 生成画像は事実記録と区別し「演出イメージ」と扱う。実在人物の本人証明や記録映像として見せない。

## 合格
asset manifest、使用許諾一覧、ショットごとの採用理由を残す。外部画像のURLだけを実素材取得済みと報告しない。

## 現物の参照先
- PUBLIC / main — `docs/vtuber-engine-golden-baseline.md`
- PUBLIC / 未統合PR #22 — `remotion/vrm-lipsync/scripts/materialize-visuals.mjs`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
