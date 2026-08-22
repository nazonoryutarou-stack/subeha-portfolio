# ChatGPT → GitHub → VRM video pipeline

この動画制作系の正規ルートは、ブラウザや外部の有料AI APIへ判断を分散させず、ChatGPTが編集判断を行い、GitHub上のRemotionが決定論的に動画へする。

## Canonical flow

```text
長尺配信音声をChatGPTへ渡す
→ ChatGPTが全体を聞く / 面白い区間を選ぶ
→ 切り抜き開始・終了を確定
→ 発話をHOST / GUEST / UNKNOWNへ文脈で分類
→ タイトル / フック / 字幕 / 画像候補 / モーション方針を作る
→ assistant edit-plan.json
→ 必要区間だけ短い音声ファイルへ切り出す
→ GitHub jobへplan + short audio + optional assetsを置く
→ Remotion render:assistant
→ HOST区間だけVRMの口・発話連動頭/胸モーションを許可
→ GUEST / UNKNOWN区間は発話モーションを停止
→ 字幕・画像・背景を合成
→ 構造QC
→ 目視QC
→ MP4
```

## Why this architecture

- 面白い箇所の判断は音量や単語頻度ではなく、会話全体の文脈・オチ・キャラクター性を使う。
- 話者識別も音響特徴だけへ依存せず、発話内容・呼びかけ・応答関係・前後文脈を使える。
- 曖昧な相槌や一語発話は無理にHOST/GUESTへ断定せず `UNKNOWN` にする。
- `UNKNOWN` はVRM発話モーションを止めるため、誤推定でゲスト音声に口が動くより安全。
- 外部OpenAI APIは正規レンダー経路に不要。ChatGPTの会話内判断とGitHub/Remotionで完結させる。
- 長尺原音をGitHubへ置く必要はない。採用区間だけ短い音声へ切り出してjobへ渡す。

## Edit plan contract

Schema:

`remotion/vrm-lipsync/assistant-plan.schema.json`

主要フィールド:

- `clip.startMs/endMs`: 元配信上の絶対時刻
- `text.title/telop`: 動画テキスト
- `captions[]`: 絶対時刻つき字幕
- `captions[].speaker`: `HOST | GUEST | UNKNOWN`
- `captions[].speakerConfidence`: 文脈上の推定確信度
- `captions[].speakerReason`: 必要なら根拠
- `visualReferences[]`: 任意の静止画素材
- `motion.profile`: `deadpan | calm | normal | energetic`
- `selection`: なぜこの区間を選んだか、フック、要約

`edit-plan.json` 自体には音声SHAや音声長を手書きしない。`import-assistant-plan.mjs` が実音声からSHA-256とdurationを計算し、既存Studio project形式へ変換する。

## One-command render

```bash
cd remotion/vrm-lipsync
npm run render:assistant -- \
  --plan=../../jobs/assistant/current/edit-plan.json \
  --audio=../../jobs/assistant/current/source.m4a \
  --output=out/assistant-current.mp4
```

内部処理:

```text
assistant plan validation
→ actual audio SHA/duration
→ Studio project生成
→ clip WAV生成
→ speaker-turns生成
→ HOST-only envelope
→ VRM検品
→ visual/background materialization
→ Remotion render
→ resolution/duration/A-V drift QC
→ QC frame extraction
```

## Speaker policy

話者分類は編集判断であり、100%確実でない区間を無理に断定しない。

- `HOST`: 配信者本人と十分に判断できる
- `GUEST`: 相手話者と十分に判断できる
- `UNKNOWN`: 相槌、短い声、重なり、曖昧な区間

レンダー時のアバター話者は常に `HOST`。
`GUEST` と `UNKNOWN` は口パク・発話連動の頭/胸モーションを無効化する。

## Role of Web Studio

`tools/vrm-talker/` は正規AI解析器ではなく、必要ならproject.jsonの確認・微調整・ブラウザプレビューに使う補助ツールとする。

ブラウザ内解析やWorker経由解析は、将来の補助経路として残してもよいが、完成動画の正本は `assistant edit-plan.json + source audio + render:assistant`。

## Remaining external asset

動画用VRMは `aa / ih / ou / ee / oh` を持つ production `Subeha.vrm` が必要。
軽量 `subeha-web-site.vrm` は口モーフを持たないため完成動画へは使用しない。
