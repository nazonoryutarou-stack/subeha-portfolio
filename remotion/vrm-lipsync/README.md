# VRM LipSync / production workflow

配信の音声と文字起こしから、AIが面白い区間を選び、同じVRM・同じ画面設計で切り抜き動画を量産するためのRemotionテンプレート。

詳しいAI選定基準は `AI_WORKFLOW.md`。

## 最終形

1. 音声と文字起こしをAIへ渡す
2. AIが面白い区間・開始終了時刻・タイトル・フック・字幕を決める
3. AIが `jobs/current.json` を作る
4. `npm run clip`
5. `out/kiritori.mp4` ができる

## 必要なもの

初回だけ `public/Subeha.vrm` を置く。VRMはGitに入れない。

元音声は `inputs/` に置く。`inputs/` もGitに入れない。

```text
remotion/vrm-lipsync/
  inputs/
    source.m4a
  jobs/
    current.json
  public/
    Subeha.vrm
```

`jobs/current.json` の雛形は `jobs/current.example.json`。

## 初回

```bash
npm install
cp jobs/current.example.json jobs/current.json
npm run studio
```

ffmpeg が必要。

## 一発書き出し

```bash
npm run clip
```

この1コマンドで以下を行う。

1. `jobs/current.json` を読む
2. 元音声の `startMs`〜`endMs` を正確に切り出す
3. `public/voice.m4a` を生成
4. 字幕時刻を切り抜き内の時刻へ変換して `public/clip.json` を生成
5. 実音声から `public/envelope.json` を生成
6. Remotionで縦動画を書き出す

出力: `out/kiritori.mp4`

正方形・横も同じjobから出せる。

```bash
npm run clip:square
npm run clip:landscape
```

## job.json

```json
{
  "sourceAudio": "inputs/source.m4a",
  "sourceLabel": "Gravity 第157回",
  "startMs": 125000,
  "endMs": 158000,
  "title": "牡蠣食えば、謎は深まるばかりやな",
  "hook": "観測したら、分かるとは限らない。",
  "telop": "",
  "captions": [
    {
      "text": "牡蠣食えば、謎は深まるばかりやな",
      "startMs": 131200,
      "endMs": 134800,
      "timestampMs": 131200,
      "confidence": null
    }
  ]
}
```

字幕時刻は**元音声基準**。`prepare-clip.mjs` が自動で切り抜き内時刻へ直す。

## Studio

```bash
npm run prepare
npm run studio
```

Studioでは以下のCompositionを確認できる。

- `VrmLipSync` : 720x1280 縦
- `VrmLipSyncSquare` : 900x900 正方形
- `VrmLipSyncLandscape` : 1280x720 横

尺は音声から生成された `envelope.json` で自動決定する。

## 表示されるもの

- `sourceLabel` : 元配信名
- `title` : 冒頭タイトル
- `hook` : 冒頭の補助コピー
- `captions` : 音声時刻に追従する字幕
- VRM : 実音声のRMS波形に追従して口パク

Propsの `title` / `telop` をStudioから直接指定した場合はjobの文言より優先する。

## 安全策

- VRM読み込み完了まで `delayRender()` で停止
- 波形JSON読み込み完了まで停止
- clip JSON読み込み完了まで停止
- VRM 0.xだけ `rotateVRM0()` を適用
- envelopeのfpsとCompositionのfpsが違えばエラー
- 元音声、job、波形が壊れていればレンダー前に停止
- `npm run clip` は必ず音声切り出しと波形生成をやり直す

## まだ残っている最後の自動化

文字起こしに時刻がない場合の**音声自動アラインメント**。

AIが音声を直接解析できる環境では、AIが元音声からタイムコードを決めてjobを書けばよい。
そうでない環境ではWhisper等でタイムコード付き文字起こしを作る工程を追加する。

時刻を推測で捏造して切り抜くことはしない。
