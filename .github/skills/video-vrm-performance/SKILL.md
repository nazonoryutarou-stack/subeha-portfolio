---
name: video-vrm-performance
description: Subeha.vrmの自然姿勢、瞬き、音声波形に同期した口パク、話者ゲート、VRM演技を作る際に使用。
---

# video-vrm-performance

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## 入力契約
同一source audio、token timing、10ms waveform RMS、clean captions、speaker turns、`Subeha.vrm`。本番の実音声を省略しない。

## 動作
1. 音声波形を口の開閉へマップ。token/kana → aa/ih/ou/ee/oh viseme、未知漢字は根拠あるfallback。
2. HOST発話のみVRMの口・胸/首動作を有効化。GUEST / UNKNOWN は発話アニメーションを停止。
3. 腕を下ろして自然な上半身姿勢にし、瞬き・呼吸・控えめな頭部動作を追加。
4. golden landscape baseline: 1280x720、左は資料/観察、右はVRM、下に固定字幕、暗色+控えめな金色。
5. 口元/腕/両肩/字幕safe areaを複数フレームで確認。腕をトリミングしてTポーズを隠さない。

## 実装境界
mainの `render:backup:landscape` と、未マージPR #22のV3 Studioは別ルート。両者の完成状況を混同しない。

## 現物の参照先
- PUBLIC / main — `remotion/vrm-lipsync/src/backup/VrmLipSyncBackup.tsx`
- PUBLIC / main — `tools/vtuber-backup/make_mouth_curve.py`
- PUBLIC / main — `docs/vtuber-engine-golden-baseline.md`
- PUBLIC / 未統合PR #22 — `remotion/vrm-lipsync/src/VrmLipSyncV3.tsx`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
