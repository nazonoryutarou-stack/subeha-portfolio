# 2026-08-22 VRM Studio 開発メモ

## 今日の目標

配信音声を選ぶと、VRM・字幕・話者分離・参考画像検索・画像生成・タイムライン配置まで一つのWebアプリで進められる状態にする。

## 正規の3層

```text
tools/vrm-talker/              Web制作Studio
workers/vrm-studio-api/        timed ASR / 話者分離 / Visual Director / 画像生成API
remotion/vrm-lipsync/          高品質最終レンダー / QC
```

3層は `project.json` を共通データとして扱う。

## 実装済み

### Web Studio
- 区間指定・9:16 / 1:1 / 16:9・Canvasテロップ・MediaRecorderを正規版へ統合
- `main-studio.js` を正規ブラウザレンダラーへ変更、旧 `main-v2.js` は削除
- timed captionをCanvasへ焼き込み、録画にも載せる
- speaker turnsがある場合、本人話者だけで口パク・発話連動身体モーションを動かす
- 本人話者が未指定なら話者解析済み状態では口パクを止める
- 動画用VRMに aa/ih/ou/ee/oh が無ければ警告
- 正しい動画用VRMを一度IndexedDBへ保存し、以後自動ロード
- 元音声SHA-256をprojectへ保存

### HOST話者 / 長尺音声
- 本人だけの2〜10秒区間を16kHz mono WAVへ抽出してIndexedDBへ保存
- OpenAI diarizationへ既知話者 `HOST` として渡す
- HOSTが既知話者として返った場合は自動的にavatar speakerへ設定
- 25MB超の長尺配信はMediabunnyで約8分ずつWAV化
- 全チャンクへ同じHOST参照音声を渡して本人ラベルを固定
- 他話者はチャンクごとに名前空間を分け、別人の誤結合を防ぐ
- 各チャンクの字幕時刻を元配信の絶対時刻へ戻して結合
- WAVは全チャンク分を保持せず、1区間ずつ変換→送信→破棄してピークメモリを抑える
- 解析進行をStudio画面へ表示

### Visual Director
- AIは字幕本文と字幕番号を読み、視覚補助が有効な箇所を選ぶ
- AIに秒数を生成させず、`startIndex/endIndex` だけ返させる
- 実際のstartMs/endMsは既存字幕タイムコードから機械的に確定
- 実在資料 → Openverse参考画像検索
- 架空物・抽象概念・演出素材 → 画像生成候補
- 検索候補は自動取得、画像生成は課金を伴うため明示クリック
- 採用画像を発話タイムラインへ配置
- Visual Timelineで開始/終了を微調整・削除可能
- 採用画像をプレビューへ表示
- 録画時は合成Canvasを使い、Canvas安全な画像をVRM/字幕と一緒に録画

### 自動パイプライン
API接続済みなら既定で:

```text
音声選択
→ 字幕＋話者解析
→ HOST確定（既知参照がある場合）
→ Visual Director
→ 検索画像候補取得
```

まで自動実行する。画像生成だけは自動課金を避けるため自動実行しない。

### project.json / Remotion
- project schemaにsource / clip / avatar / captions / speakerTurns / visualCues / visualReferences / layoutを定義
- `prepare:studio` を追加
- project.jsonと元音声のSHA-256を照合
- 同じ元音声から最終 `voice.wav` を生成
- speaker turnsを切り抜き内0秒基準へ変換
- 最終WAVのSHA-256とdurationでspeaker-turns.jsonを再ロック
- HOST-only envelopeを再生成
- visualReferencesをclip.jsonへ引き継ぐ

### VRM安全策
- `scripts/check-vrm.mjs` を復活
- 動画用VRMの aa/ih/ou/ee/oh / テクスチャ等をレンダー前に検査
- 口モーフのない `subeha-web-site.vrm` へ本番フォールバックしない入口ゲートを追加
- Web軽量VRMを使うCIは「構造レンダーSmoke」と明記し、口パクQCとは扱わない
- CI自身でWeb軽量VRMが動画用検品に落ちることを確認する

## CI

確認済み:
- `Build VRM Studio`: PASS
- Worker syntax check: PASS
- Mediabunnyを含むnpm install: PASS
- Vite build: PASS
- artifact upload: PASS
- `Site QA`: PASS
- `Remotion VRM Check`: PASS
- Remotion補助 `.mjs` Node構文検査: PASS

## 確定した外部ブロッカー

`VRM Studio API Config Check` で、GitHub repository secrets を値を表示せず存在確認した結果、次の3つは **すべて未設定**:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `OPENAI_API_KEY`

したがって現在はCloudflare Workerの実デプロイと実OpenAI API接続を実行できない。確認Workflow自体はPRを赤くしないwarning扱いへ変更済み。

## 外部接続後に必須の実QC
- GitHub Pages → Worker URL 実接続
- 実配信音声で `gpt-4o-transcribe-diarize` のHOST識別確認
- 客発話中にVRM口・発話連動身体モーションが止まる目視QC
- 長尺配信の実ブラウザ変換速度 / メモリ使用量確認
- 検索画像のCORS条件による録画可否確認

## 完成扱いしない条件

実デプロイと実音声QCを通るまでは「MVP実装済み・実運用未検証」とする。
