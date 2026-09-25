# Remotion projects

このディレクトリには複数の実験がある。役割を混同しない。

## `vrm-lipsync/` — 現役

VRM切り抜き動画の**高品質・再現可能な最終レンダー**を担当する。

日常の編集UIは `../tools/vrm-talker/`。Web Studioが出力する `project.json` を、将来的にRemotionへ渡して同じ字幕・話者区間・レイアウトを再現する。

## `vrm-talker/` — 旧試作

初期のRemotion VRM実験。**新機能を追加しない。**

削除・archive移動は、参照先を確認した専用cleanup PRで行う。

## `teruteru-bot/` — 別プロジェクト

VTuber切り抜きとは別用途。今回のVRM Studio整理対象外。

## 正規ルート

```text
tools/vrm-talker/       Web制作Studio
        ↓ project.json
remotion/vrm-lipsync/   最終レンダー / QC
```

制作原則は `../docs/production-rules.md`、全体設計は `../docs/video-app-architecture.md` を参照する。
