---
name: video-quality-assurance
description: 動画の実音声同期、字幕、VRM自然姿勢、コード検証、ffprobe構造検査、プライバシー審査に使用。
---

# video-quality-assurance

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## 検査軸
1. **source**: 原音とtimed/cleanの回・hashが一致。
2. **sync**: 発話時に口が動き、無音/他者発話では止まる。字幕のon/offが音と合う。
3. **visual**: 冒頭、最初の連続発話、中盤、早口/オチ、末尾でフレーム抽出して目視。
4. **pose**: 左右の腕、肩、指、首。Tポーズをクロップで隠していない。
5. **layout**: 参照域、字幕safe area、字幕カードの重複やはみ出しなし。
6. **structure**: codec、video/audio stream、尺、FPS、解像度、A/V drift。
7. **rights/privacy**:相談者特定情報、公開許諾、生成素材の表示、音楽権利。

## 自動QC
`node video-studio/cli.mjs qc path/to/output.mp4 landscape` はffprobeによる**構造**検査。構造合格だけで完成にしない。

## 結果
PASS/FAIL/未確認、証拠時刻、検査人、修正必要箇所、再検査を残す。試作と検品済みを区別する。

## 現物の参照先
- PUBLIC / main — `docs/production-rules.md`
- PUBLIC / main — `docs/vtuber-engine-golden-baseline.md`
- PUBLIC / 未統合PR #22 — `tools/video-pipeline/validate_render.py`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
