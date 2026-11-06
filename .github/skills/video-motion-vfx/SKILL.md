---
name: video-motion-vfx
description: Remotionを用いたモーショングラフィックス、テロップ演出、キネティック文字、トランジション、CG動画に使用。
---

# video-motion-vfx

このスキルは映像制作の専門工程を担当する。まず `docs/production-rules.md` と `video-studio/README.md` を確認する。関連スキルは catalog.json で選ぶ。

## 方針
- Remotionのframe / fpsを単一の時間基準にする。事象の時間をランダムに揺らさず、フレームから決定的に求める。
- 冒頭のvisual hookを作るが、字幕safe area と主画面情報を侵さない。
- 実写/資料/VRMの間のトランジションは内容上の段落や視点転換に紐付ける。
- 不氣屋や「すべての歯が見える」の視覚モチーフは作品に合わせて限定使用し、既存の決定済みgolden UIを無断改変しない。

## 作業
1. shot listからfpsと持続frame、開始/終了、レイヤー優先順位を指定。
2. 画像の余白、安全領域、色とフォントを定数化。
3. 動きはオブジェクトの意味を補助する程度にし、止め画・カメラ・文字の役割を分離。
4. start / middle / end のレンダーでクリッピング・ちらつき・字幕重複を確認。

## 実装
public mainには `remotion/teruteru-bot`、`remotion/vrm-lipsync` がある。Studio拡張はPR #22に存在。

## 現物の参照先
- PUBLIC / main — `remotion/teruteru-bot/src/Root.tsx`
- PUBLIC / main — `remotion/vrm-lipsync/src/Root.tsx`
- PUBLIC / 未統合PR #22 — `remotion/vrm-lipsync/src/VrmLipSyncStudio.tsx`

## 完了報告
実ファイル・差分・検査結果が読める状態のみ「実装・制作完了」。設計のみ、未実行、未目視の項目は明示する。
