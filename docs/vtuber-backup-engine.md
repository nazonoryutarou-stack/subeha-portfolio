# Vチューバーエンジン（予備）

状態: 実装中 / 本線とは独立

## 目的

Whisper/GitHub Actionsが利用不能でも、Nothing Phoneと無料の端末機能だけで

1. 字幕時刻
2. 口パク
3. VRM映像

を生成できる予備経路を持つ。

本線のWhisper timedデータを置き換えるものではなく、障害時の代替と比較実験用。

## 構成

```text
録音済み音声
  ├─ Android SpeechRecognizer
  │    └─ word-timing.jsonl
  │         └─ 字幕 + かな部分の母音推定
  │
  └─ PCM waveform
       └─ mouth.jsonl (10ms)
            └─ 口の開閉量

word timing + mouth curve
        ↓
build-backup-timeline.mjs
        ↓
generatedTimeline.ts
        ↓
Remotion VrmLipSyncBackup
        ↓
MP4
```

## 本線との違い

### 本線

- whisper.cpp timestamp
- raw / clean / immutable segment ID
- アーカイブ正本
- 長期保存向け

### 予備

- Android OS音声認識
- RecognitionPart start timestamp
- waveform直接口パク
- 無料 / 端末完結を優先
- 結果には `engine=android.speech.SpeechRecognizer` を明記

予備結果をWhisper結果として偽装しない。

## 口パク

口の開閉量は文字タイムスタンプから作らない。
原音波形のRMSから約10ms刻みで取得する。

これにより字幕認識が数百msずれても、顎の開閉自体は音声へ追従する。

母音blendshapeは、現在のRecognitionPart内の位置から文字を選び、

- A → `aa`
- I → `ih`
- U → `ou`
- E → `ee`
- O → `oh`

へ変換する。

ひらがな/カタカナで母音を確定できない漢字部分は、誤った口形を派手に出すより `aa` を口開閉量に合わせるfallbackとする。

## 字幕

現在時刻周辺のRecognitionPartを最大34文字程度表示。
現在発話中のpartだけ強調表示する。

RecognitionPartが日本語で文字単位を返した場合は、カラオケ字幕に近い細粒度になる。
単語単位の場合も同じデータ構造で処理する。

## 実装

Remotion:

- `src/backup/VrmLipSyncBackup.tsx`
- `src/backup/viseme.ts`
- `src/backup/generatedTimeline.ts`
- `scripts/build-backup-timeline.mjs`

commands:

```bash
cd remotion/vrm-lipsync
npm run build:backup-timeline
npm run render:backup
```

## 成功条件

配信165冒頭60秒で以下を確認する。

- Androidからtimed partが20件以上返る
- start_msが単調増加
- 発声と字幕の主観ズレが概ね300ms以内
- mouth curveが無音時に閉じる
- 発声時の顎運動が原音へ追従
- Remotionが60秒完走
- 本線の既存Compositionに差分影響なし

条件を満たせば「予備v0.1」とする。

## 次段階

1. Android probeをNothing Phoneで実測
2. JSONLを予備エンジンへ投入
3. 165冒頭60秒をレンダリング
4. Whisper版と横並び比較
5. 字幕ズレ・口パクを調整
6. 長尺を10〜20分単位で処理できるよう分割
7. 原音1本を選ぶだけのTermuxコマンドへ統合
