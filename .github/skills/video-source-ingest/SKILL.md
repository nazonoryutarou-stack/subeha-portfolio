---
name: video-source-ingest
description: 実配信の音声、撮影素材、動画、静止画を取り込み、来歴・権利・プライバシーを確認する。
---

# video-source-ingest

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## 手順
1. 素材ごとに source_id、撮影/配信回、出典、所有・許諾、原本パス、hash、長さ、fps、codec を記録。
2. 原音・原動画を読み取り専用で保全し、編集は作業用コピーから実施。音声の欠落や破損をffprobe等で調べる。
3. 相談者の氏名、病歴、連絡先、アカウント、住所、推定可能な情報を公開対象から除外。
4. 他回のタイムコードや文字起こしと組み合わせない。source_idが一致しない場合は制作停止。
5. GitHub public に原音、相談データ、timed JSONL、識別情報、認証情報をcommitしない。private transcript repoのデータは私有のまま。

## 境界
Nothing Phone / Termux は音声認識と時刻抽出を主用途とする。重いVRMレンダーは別実行環境へ送るが、原本ファイルの公開移動は必要としない。

## 現物の参照先
- PUBLIC / main — `docs/production-rules.md`
- PRIVATE / main — `tools/whisper-timed/archive_io.py`
- PUBLIC / 未統合PR #22 — `remotion/vrm-lipsync/scripts/prepare-clip.mjs`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
