---
name: video-asr-timing
description: Whisper.cppによる日本語文字起こしとトークン時刻、破損タイムスタンプの検出、clean転記との分離に使用。
---

# video-asr-timing

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## 正本
- public `tools/vtuber-backup/run-whisper-token-termux.sh` は whisper.cpp の token timing 経路。
- private `subeha-transcripts/tools/whisper-timed/` はアーカイブ絶対時刻と再開可能な窓処理。機微データは移送しない。
- `raw` はASR原文、`timed` は時計、`clean` は全文を読めるようにした校正版。三者を混同しない。

## 手順
1. 同一原音を16kHz mono等へ変換し、source_id と duration を記録。
2. whisper.cpp / small-q5_1 経路で token/segment timing を出力。既知の端末設定では processors=1、VAD OFF、問題があるDTWを無理に有効化しない。
3. start<end、単調性、音声全体との一致、長い同一文反復を検査。
4. 壊れた区間の補正は波形根拠を記録し、native時刻と補正時刻を識別。
5. 読める表示字幕はcleanから作る。時刻だけtimedに由来し、ASR語句の誤認識を完成字幕へ直結しない。

## 合格
未検証時刻を「正確に同期した」と称さず、episode/source hash と誤差・不明箇所を残す。

## 現物の参照先
- PUBLIC / main — `tools/vtuber-backup/run-whisper-token-termux.sh`
- PUBLIC / main — `tools/vtuber-backup/whisper-json-to-parts.py`
- PUBLIC / main — `docs/vtuber-engine-repro-164-166-169.md`
- PRIVATE / main — `tools/whisper-timed/transcribe_archive.py`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
