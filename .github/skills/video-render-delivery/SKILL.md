---
name: video-render-delivery
description: Remotion/FFmpegによるH.264/AAC書き出し、16:9/9:16制作プロファイル、実ファイルの検証と納品に使用。
---

# video-render-delivery

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## ルート
- main側は `remotion/vrm-lipsync` のbackupレンダーコマンドを持つ。実音声とtiming準備が必要。
- PR #22のみ `npm run render:assistant` を定義する（mainのpackage.jsonにあると誤認しない）。
- Shortsなら原則9:16、一般画面は16:9。golden横画面は1280x720を保持し、縦画面への単純な機械的切り取りは避ける。

## 書き出し
1. 入力原音・正しいtiming・表示用字幕・話者設定・参照画像を固定。
2. レンダーjobの version、fps、frame count、source hash、codec 設定を記録。
3. H.264/AAC MP4を書き出し。出力は必ず存在とffprobeを検証。
4. `node video-studio/cli.mjs qc <mp4> [landscape|short]` で構造確認する。
5. 実フレームを見てQCし、未確認なら納品を「要検品」とする。

## 注意
作業jobや音声素材は `video-studio/jobs/` に置いてもGitに入れない。.gitignoreで隔離する。

## 現物の参照先
- PUBLIC / main — `remotion/vrm-lipsync/package.json`
- PUBLIC / main — `docs/vtuber-engine-golden-baseline.md`
- PUBLIC / 未統合PR #22 — `remotion/vrm-lipsync/scripts/render-assistant.mjs`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
