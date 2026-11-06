---
name: video-deepdream-art
description: DeepDream Labで夢幻的な静止画・テクスチャを制作し、映像の背景・場面転換・美術へ応用する。
---

# video-deepdream-art

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## 手順
1. DeepDream用入力写真・絵を権利確認。構図の主役、境界、色、変化の強さを定義。
2. `deepdream/` のv21実装を確認し、モデルがある環境でブラウザ処理を実施。
3. 出力PNGを素材として保管し、元画像、モデル、設定、処理日、変更点を記録。
4. 動画化はRemotion/FFmpeg等でズーム、パン、クロスフェード、反復などを実装。DeepDream自体が動画生成器だと誤称しない。
5. VRM背景に使う場合は、視線、字幕コントラスト、画面密度を優先して画像を控えめに配置。

## 禁則
夢幻加工の画像を科学的・歴史的な証拠写真として提示しない。現在のmainで直接動画生成まで完成したとは主張しない。

## 現物の参照先
- PUBLIC / main — `deepdream/index.html`
- PUBLIC / main — `deepdream/dream-engine.js`
- PUBLIC / main — `deepdream/test-v21.mjs`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
