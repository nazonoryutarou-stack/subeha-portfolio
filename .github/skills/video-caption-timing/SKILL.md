---
name: video-caption-timing
description: 日本語字幕、タイムコード、SRT/JSONL、画面safe area、字幕の内容校正と同期検証に使用。
---

# video-caption-timing

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## データ契約
- `timed`: 同一原音からの時刻。表示文言として直使用しない。
- `clean`: 表示用の逐語字幕本文。校正不能部は `[聞き取り不明]` とする。
- `display-captions.jsonl`: `{"type":"caption","start_ms":13000,"end_ms":18000,"text":"..."}` の1行1caption形式。
- テロップは逐語字幕と別レイヤー・別ラベル。

## 手順
1. source音声・timed・cleanの回番号とhashを揃える。
2. cleanを読みやすい2〜3行単位へ分割。論理語・オチで分割し、推定時刻を作らない。
3. 先頭/発話ピーク/中盤/長い無音/最後で音と字幕を同時確認する。
4. 16:9 golden UIでは下部の字幕カードのみ使用。二重焼き付けASSを禁止し、VRM腕やカードを字幕領域へ重ねない。
5. 音声からずれた場合は原音とtimestampsを修正し、勝手な一括時間移動をしない。

## 合格
字幕の実文言がcleanと一致し、同一原音基準の時間軸上で表示・消失すること。

## 現物の参照先
- PUBLIC / main — `tools/vtuber-backup/prepare-termux.sh`
- PUBLIC / main — `remotion/vrm-lipsync/scripts/build-backup-timeline.mjs`
- PUBLIC / main — `docs/vtuber-engine-golden-baseline.md`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
