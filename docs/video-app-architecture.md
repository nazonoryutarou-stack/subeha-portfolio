# VRM Studio Web App Architecture

最終更新: 2026-08-22

## 目的

音声ファイルを一つ入れれば、以下を一つの制作画面で扱えるようにする。

```text
音声入力
→ timed ASR
→ 話者分離
→ HOST発話だけでVRM口パク
→ 字幕編集
→ 内容から参考画像候補を検索
→ 必要なら画像生成
→ 背景 / インサートとして配置
→ プレビュー
→ 端末録画 または Remotion最終レンダー
```

## 正規の入口

`tools/vrm-talker/`

名称は当面パス互換のため `vrm-talker` のまま維持するが、役割は単純なTalkerではなく制作スタジオ。

## 既存資産の役割

### `tools/vrm-talker/`

主役。ブラウザ編集UI。

既存で使えるもの:
- VRM読み込み
- 自然姿勢
- 音声RMSによる口形制御
- 背景画像
- 区間指定
- 9:16 / 1:1 / 16:9
- Canvasへのテロップ合成
- MediaRecorder / captureStreamによる端末録画
- VRM口表情の有無チェック

### `remotion/vrm-lipsync/`

高品質書き出し、再現可能な最終レンダー、QC。

### `remotion/vrm-talker/`

旧試作。新機能を追加しない。削除は別PRで行う。

### `tools/remotion-preview/`

レイアウト検証の知見だけWebアプリへ移す。新機能を追加しない。

## データの正本

すべて `project.json` に集約する。

例:

```json
{
  "version": 1,
  "source": {
    "name": "配信158.m4a",
    "sha256": "...",
    "durationMs": 45000
  },
  "clip": {
    "startMs": 0,
    "endMs": 45000
  },
  "avatar": {
    "speaker": "HOST",
    "model": "Subeha.vrm"
  },
  "captions": [],
  "speakerTurns": [],
  "visualReferences": [],
  "generatedImages": [],
  "layout": {
    "width": 720,
    "height": 1280,
    "captionBottomPx": 290
  }
}
```

音声と派生データをファイル名だけで結び付けない。SHA-256を使う。

## フロントエンド

Vite + Three.js + three-vrm を継続使用する。

ページを巨大な1ファイルへ戻さない。責務を次へ分ける。

```text
tools/vrm-talker/src/
  main.js
  style.css
  app/
    project-state.js
    timeline.js
  vrm/
    viewer.js
    lip-sync.js
    pose.js
  audio/
    player.js
    envelope.js
  captions/
    captions.js
  references/
    search.js
    generation.js
  recording/
    recorder.js
  api/
    client.js
```

最初から全分割する必要はない。機能追加時にこの境界へ寄せる。

## バックエンドが必要な処理

GitHub Pagesは静的配信なので、秘密鍵をブラウザへ置かない。

バックエンドAPIを次の薄い契約にする。

```text
POST /api/transcribe
  audio -> timed captions + speaker turns

POST /api/images/generate
  prompt -> generated image
```

参考画像検索は公開検索APIを使える場合はブラウザ直結可能。秘密鍵が必要な検索プロバイダを使う場合はバックエンド経由にする。

## 参考画像

用途は二種類に分ける。

1. **検索画像**
   - 実在物・場所・人物・物品の参照
   - 出典URL・作者・ライセンスをprojectへ保持

2. **生成画像**
   - 抽象背景
   - 再現困難なイメージ
   - 権利関係を簡潔にしたい演出素材

検索画像と生成画像をUI上で混同しない。

## 自動参考画像提案

字幕全文から毎秒検索するのではなく、話題単位で「visual cue」を作る。

例:

```json
{
  "startMs": 12400,
  "endMs": 18800,
  "query": "遊戯王風 トレーディングカード 枠 参考",
  "mode": "search"
}
```

ユーザーが採用した画像だけタイムラインへ置く。

## 字幕

字幕は timed ASR を正本にする。

- ASR誤字修正は文字列だけ変更
- startMs/endMsは維持
- 要約文は演出テロップとして別フィールド

縦動画の字幕既定位置は下端290px。SNS UI安全領域を表示する。

## 話者と口パク

口パク入力:

```text
lipSyncValue(frame)
  = audioEnvelope(frame)
  × avatarSpeakerMask(frame)
```

客の音量が大きくてもmask=0なら口は動かない。

## 今日のMVP

優先順:

1. ZIPにある改良版ブラウザTalkerを現行ブランチへ戻す
2. 音声を一回選ぶだけで再生・VRM口パク
3. timed ASRボタンと字幕トラックUI
4. speaker turnsを読み込み、HOSTだけ口パク
5. 字幕から参考画像検索
6. 画像生成
7. 採用画像を背景/インサートへ配置
8. Web録画
9. project.json保存
10. Remotionへproject.jsonを渡す

## 完成条件

今日のMVPを「できた」と呼ぶ条件:

- 音声をブラウザへ投入できる
- `Subeha.vrm` が自然姿勢で表示される
- 本人発話で口が動く
- 客発話で口が閉じる
- 実タイムコード字幕が表示される
- 字幕内容から参考画像検索ができる
- 生成画像を少なくとも1枚作れる
- 選んだ画像を画面へ反映できる
- プレビューが録画可能

これを満たしていない段階では「MVP途中」と呼ぶ。
