# VRM LipSync / production workflow

配信の実音声と文字起こしから、AIが面白い区間を選び、VRM・字幕・口パクを同じタイムラインでレンダリングするためのRemotionテンプレート。

**制作前に `docs/production-rules.md`（mainの正本）を読むこと。**
詳しいAI選定基準は `AI_WORKFLOW.md`。

## 原則

**面白さはAIが決める。時刻は音声から機械的に決める。**

AIが存在しない秒数を推測しない。字幕を勘で配置しない。VRMの口パク・姿勢を確認せず完成扱いしない。

## 現在の処理

1. AIが文字起こしから切り抜く発言を選ぶ
2. `jobs/current.json` に `quote` / `anchor` / タイトル / 前後余白を書く
3. `npm run clip`
4. タイムコードが無ければWhisper.cppで元音声を文字起こし
5. `anchor` を認識結果から検索し、開始・終了位置を決める
6. `atrim + asetpts` で実音声を正確に0秒基準へ切り出し、`public/voice.wav` を生成
7. 元音声基準の字幕を切り抜き内時刻へ変換
8. 実音声から `public/envelope.json` を生成
9. 実VRMを直接レンダリングし、自然姿勢・瞬き・頭部モーション・口パクを適用
10. MP4書き出し後、`out/qc/` に検品フレームを抽出

## 必要なもの

- ffmpeg
- Node.js
- 元音声を `inputs/` に置く

VRMはリポジトリ直下の `subeha-web-site.vrm` を `npm run prepare` が `public/Subeha.vrm` へ自動コピーする。手作業で別モデルを置く必要はない。

```text
remotion/vrm-lipsync/
  inputs/
    source.m4a
  jobs/
    current.json
  public/
    Subeha.vrm   # prepare時に自動生成
    voice.wav    # 精密切り出し
    clip.json
    envelope.json
```

生成物・入力音声はGitへ入れない。

## 初回

```bash
cd remotion/vrm-lipsync
npm install
cp jobs/current.example.json jobs/current.json
```

Studioで見る場合:

```bash
npm run prepare
npm run studio
```

## 一発書き出し

```bash
npm run clip
```

処理順:

```text
prepare
  → TypeScript check
  → Remotion render
  → QC frame extraction
```

出力:

```text
out/kiritori.mp4
out/qc/start.png
out/qc/speech-peak.png
out/qc/middle.png
out/qc/end.png
out/qc/CHECKLIST.txt
```

**QC画像を実際に見ずに「完成」と言わない。**

## job.json

通常は秒数を手入力せず、`quote` と `anchor` を使う。

```json
{
  "sourceAudio": "inputs/source.m4a",
  "sourceLabel": "Gravity 第158回",
  "quote": "AIで遊戯王のカードみたいにしたんですよ。破門になりました。",
  "anchor": "遊戯王のカードみたいにした",
  "contextBeforeMs": 12000,
  "contextAfterMs": 2500,
  "title": "遺影をAIでカード化したら破門された",
  "hook": "師匠は遺影を丁寧に残したかった。",
  "telop": ""
}
```

`startMs` / `endMs` は、外部ASR等で確定済みの時刻を使う場合だけ指定する。指定した場合はquote検索より優先する。

## 字幕

Whisperのタイムコードを基準にする。元音声基準の字幕は `prepare-clip.mjs` が切り抜き内の0秒基準へ変換する。

ASRに明白な誤認識がある場合は、**文言だけ補正し、時刻は実測値を維持する**。

例: 第158回では「家」ではなく「遺影」。

要点をまとめた文章を画面へ出す場合、それは逐語字幕ではなく「演出テロップ」と明記する。

## VRM

`src/VrmLipSyncV2.tsx` が現在のレンダラー。

- Tポーズの標準姿勢から腕を下ろして自然体へ補正
- 実音声RMSから口パク
- 小さい声にも反応するゲート
- 瞬き
- 頭・首・胸の微動
- Remotionのフレームキャプチャ前にcanvasを更新するため `useLayoutEffect` を使用

旧 `src/VrmLipSync.tsx` は比較用に残っているが、Compositionからは使用しない。

## Composition

- `VrmLipSync` : 720x1280
- `VrmLipSyncSquare` : 900x900
- `VrmLipSyncLandscape` : 1280x720

尺は `envelope.json` から自動決定する。

## QC

`npm run clip` の最後に4枚を抽出する。

確認事項:

- `start.png`: Tポーズではないか、腕・姿勢が自然か
- `speech-peak.png`: 喋っている時に口が開いているか
- `middle.png`: 字幕・画面が破綻していないか
- `end.png`: オチまで入っているか、終端字幕がズレていないか

フレーム抽出は自動だが、**合否判定は目視が必要**。

## まだ未完成の部分

- ASRの単語内タイミングまで完全に保証する自動補正
- QC画像の自動画像判定（Tポーズ、口開閉、字幕位置の機械判定）
- 実素材を使ったCIレンダリング。現在のGitHub ActionsはTypeScriptチェックまで
- `feature/remotion-workflow-v2` のmainへの統合

ここを未完成のまま完成品扱いしない。
