# ChatGPT → GitHub VRM Video Pipeline

最終更新: 2026-08-22

## 目的

このプロジェクトの正規フローは、ブラウザ内でAI編集を完結させることではない。

**編集判断はChatGPT側、GitHub側は決定済みの編集指示を正確に再現する動画工場**とする。

```text
配信音声をChatGPTへ渡す
→ ChatGPTが内容を聞く / 読む
→ 面白い区間を選ぶ
→ 台本・字幕・話者ラベル・演出を決める
→ edit-plan.json を作る
→ GitHub / Remotion が決定論的にレンダー
→ VRM口パク・身体モーション・字幕・画像を合成
→ MP4 + QC
```

外部の有料OpenAI APIは正規パイプラインに必須としない。

## 役割分担

### ChatGPT = 編集者

ChatGPTが担当する。

- 長尺音声から切り抜き候補を選ぶ
- 冒頭フック / 本文 / オチを組み立てる
- 不要な間・重複を落とす
- 字幕テキストを整える
- 話者を `HOST / GUEST / UNKNOWN` に分類する
- タイトル / テロップを決める
- 必要なら参考画像や差し込み位置を決める
- VRMモーションの強さ・演出メモを決める
- `edit-plan.json` を生成する

### GitHub / Remotion = 動画工場

GitHub側は編集判断をしない。

- 元音声と `edit-plan.json` を照合
- 指定区間を同じ元音声から切り出す
- HOST区間だけ口パク / 発話連動身体モーション
- GUEST / UNKNOWN区間は口・発話連動モーション停止
- 字幕描画
- 指定画像 / 背景合成
- VRM自然姿勢・モーション
- H.264 MP4レンダー
- 解像度 / 尺 / 音声stream / A/V drift QC
- QCフレーム抽出

## 話者分離方針

専用の有料diarization APIを正規必須にはしない。

ChatGPTは次を総合して話者を推定する。

1. 会話の文脈
2. 質問 → 回答の構造
3. 呼びかけ・敬語・一人称
4. 配信者の既知の話し方
5. 発話順
6. 音声上で聞き分けられる声質差

ただし**口パク用ラベルは保守的に扱う**。

```text
HOST     確信が高い配信者発話
GUEST    確信が高い他者発話
UNKNOWN  判定が曖昧
```

`UNKNOWN` はHOSTへ寄せない。口パク事故を避けるため、最終レンダーでは発話連動モーションを停止する。

各captionは任意で以下を持てる。

```json
{
  "speaker": "HOST",
  "speakerConfidence": 0.96,
  "speakerReason": "相談者の質問に対する回答で、配信者の一人称と話し方が一致"
}
```

## 正規入力: edit-plan.json

ChatGPTが動画工場へ渡す契約。

例:

```json
{
  "version": 1,
  "sourceLabel": "GRAVITY #158",
  "clip": {
    "startMs": 7640000,
    "endMs": 7685000
  },
  "selection": {
    "hook": "遺影をAIでカードにした",
    "reason": "説明→異常行動→破門のオチが45秒で閉じる",
    "summary": "遺影をカード化して師匠に破門された話"
  },
  "text": {
    "title": "遺影をAIでカード化したら\n師匠に破門された",
    "telop": ""
  },
  "captions": [
    {
      "startMs": 7640200,
      "endMs": 7643100,
      "speaker": "HOST",
      "speakerConfidence": 0.98,
      "text": "遺影をAIに入れてカードにしたんですよ"
    },
    {
      "startMs": 7643200,
      "endMs": 7644100,
      "speaker": "GUEST",
      "speakerConfidence": 0.93,
      "text": "え？"
    }
  ],
  "visualReferences": [],
  "motion": {
    "profile": "normal",
    "notes": "オチ直前だけ少し前傾"
  },
  "layout": {
    "width": 720,
    "height": 1280,
    "captionBottomPx": 290
  }
}
```

## 正規レンダー入口

`remotion/vrm-lipsync/`

```bash
npm run render:assistant -- \
  --plan=/path/edit-plan.json \
  --audio=/path/source.m4a \
  --output=out/final.mp4
```

内部では:

```text
import-assistant-plan.mjs
→ source SHA / duration 検証
→ captions / speaker labels 検証
→ project.json 生成
→ render-studio.mjs
→ voice.wav
→ HOST-only envelope
→ visual / background materialize
→ Remotion render
→ 構造QC
→ QCフレーム
```

## VRM

動画用VRMは `Subeha.vrm` を正本にする。

必要条件:

- `aa`
- `ih`
- `ou`
- `ee`
- `oh`

軽量Web用 `subeha-web-site.vrm` は口形不足のため本番動画用へ使わない。

現在の安全ゲートは動画用VRMが無ければ停止する。別素材へ自動フォールバックしない。

## 画像

追加課金ゼロを正規条件とする。

優先順:

1. リポジトリ内の既存素材
2. Openverse等の再利用可能な公開素材
3. このチャット内で作成した素材を明示的にGitHubへ渡す
4. 画像なしでVRM + 字幕だけで成立させる

有料画像生成APIをレンダーの必須条件にしない。

## Web Studioの位置づけ

`tools/vrm-talker/` は今後、正規AI編集エンジンではない。

残す価値がある機能:

- VRMの見た目確認
- レイアウト確認
- 手動タイムライン調整
- project.json確認

次の機能は正規フローから外す。

- 有料OpenAI APIを前提にした自動文字起こし
- APIによる話者分離を必須化
- API Visual Directorを必須化
- GPT Image生成を必須化

削除は一度に行わず、`render:assistant` が実素材で完成動画を出せることを確認してから整理する。

## 完成判定

一本の動画を完成扱いする条件:

- 元音声からChatGPTが面白い区間を選定
- edit-plan.json が存在
- 字幕が実発話と一致
- HOST / GUEST / UNKNOWN が明示
- UNKNOWNをHOST扱いしない
- HOST発話でのみ口パク
- GUEST / UNKNOWN発話では口・発話連動身体モーション停止
- VRMが自然姿勢
- タイトル / 字幕 / 画像が意図通り
- MP4構造QC PASS
- QCフレームを目視確認

この条件を通るまで「完成」と呼ばない。
