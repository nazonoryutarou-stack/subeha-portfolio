# 2026-08-22 VRM Studio 開発メモ

## 目的

配信音声を入力すると、AIが文字起こし・話者分離・本人発話限定VRM同期・字幕・視覚補助候補・画像検索/生成・タイムライン配置まで行い、Web録画またはRemotion高品質レンダーへつなぐ**音声起点型AI動画編集Studio**を作る。

中心原則:

> 意味判断はAI、時刻は実音声由来。AIに秒数を発明させない。

## 正規の3層

```text
tools/vrm-talker/              Web制作Studio
workers/vrm-studio-api/        timed ASR / 話者分離 / Visual Director / 画像生成 / Openverse固定化API
remotion/vrm-lipsync/          高品質最終レンダー / 構造QC / 目視QC素材生成
```

3層は `project.json` を共通データ契約として扱う。

## Web Studio 実装済み

- 9:16 / 1:1 / 16:9
- A/B切り抜き
- タイトル / テロップ / 背景
- timed captionsをCanvasへ焼き込み
- DOM字幕の二重表示を廃止し、Canvasを字幕の唯一の正本にした
- Caption Editorで字幕本文だけ訂正可能。時刻・話者は編集不可
- project.json保存 / 再開
- 元音声SHA-256一致まで復元projectの再生・録画をロック
- 元音声SHA-256は大容量ファイルを一括読込せずチャンク式で計算
- 同一画像素材を複数タイムライン区間へ独立配置可能
- Visual Timelineで開始 / 終了を微調整・削除
- 旧projectの重複配置IDはロード時に自動移行

## VRM安全策

動画用VRMは `aa / ih / ou / ee / oh` の5口形を必須とする。

Web Studio:

- VRM選択時にGLB JSON chunkだけを軽量検査
- 5口形不足ならWeb録画を禁止
- 5口形不足ならIndexedDBへの「このVRMを記憶」も禁止
- 過去に無効VRMを記憶していた場合、起動時に検査して自動破棄
- 実 `subeha-web-site.vrm` が5口形不足で拒否されることをCIで確認

Remotion:

- `scripts/check-vrm.mjs` で口形とテクスチャを本番前検査
- `prepare-clip.mjs` 自身が動画用VRM検品を必須化
- 軽量 `subeha-web-site.vrm` を `Subeha.vrm` としてコピーする旧フォールバックを削除

Structural Smokeは**構造レンダー試験**であり、実VRM口パク品質試験とは呼ばない。

## HOST話者 / 長尺音声

- 本人だけの2〜10秒をHOST参照音声としてIndexedDBへ保存
- `gpt-4o-transcribe-diarize` のknown speakerへ `HOST` として渡す
- 8分超の音声は容量に関係なく分割
- 約8分core + 前後2秒overlap
- 16kHz / mono / s16 WAVを必要区間だけ生成
- 1区間WAV化 → API送信 → 結果保存 → WAV解放 → 次区間
- HOST参照は全区間共通
- 未知話者はチャンク単位で名前空間を分離
- 字幕時刻を元音声絶対時刻へ戻して結合
- overlap区間は字幕中心点が属するcoreだけ採用して重複を防ぐ
- 解析進行をWeb UIへ表示

## 話者ゲート / プライバシー

- 本人未確定ならVRM口パク停止
- HOST発話だけ口・頭・胸の発話連動モーション
- 話者情報があるのに本人未確定ならVisual Director停止
- 本人以外の字幕本文はVisual Directorへ送る前に `[非本人発話]` へ置換
- Visual Directorから戻った候補も本人発話にアンカーされたものだけ採用
- 手動「現在字幕を検索語へ」も本人発話だけ許可

客・ゲストの相談内容を勝手に画像検索・画像生成promptへ流さない。

## Visual Director / 画像

- AIは `startIndex / endIndex` だけ選択
- 実 `startMs / endMs` は既存captionから機械的に確定
- 実在資料 → Openverse検索
- 架空物 / 抽象概念 / 演出素材 → GPT Image生成候補
- 画像生成は課金を伴うため明示クリック
- Openverse採用画像はWorker経由でdata URLへ固定
- `visualReferences[].id` は配置固有ID
- `assetId` は元素材ID
- creator / licenseをWeb録画とRemotionの双方へ表示
- 本番Remotionはremote URLを既定で取得せず、固定済みdata URL / ローカル素材を正規経路にする

Openverse Worker取得口の安全策:

- クライアントから任意URLを受け取らずOpenverse IDだけ受け取る
- localhost / private IP / link-local / private IPv6を拒否
- リダイレクト先も再検査
- リダイレクト回数を制限
- 最大6MBまでストリーミング読込
- PNG / JPEG / WebP / GIFの実シグネチャを確認
- private redirect / 偽Content-Type / oversized streamをCI fixtureで拒否確認

## 自動パイプライン

API接続済みなら既定で:

```text
音声選択
→ 元音声登録
→ timed ASR / 話者分離
→ HOST確定
→ Visual Director
→ Openverse候補取得
```

匿名話者で本人が未確定の場合はエラーにせず正常停止し、本人選択を待つ。

画像生成だけは自動課金を避けるため自動実行しない。

## project.json / 再開

projectに保持するもの:

- source name / SHA-256 / duration
- clip start / end
- avatar speaker / model
- title / telop
- timed captions
- speaker turns
- Visual Director cues
- visual references
- layout / caption safe area / background

入口validatorで次を拒否する。

- clip / caption / speaker turn / imageが元音声長を超える
- 未対応出力サイズ
- avatar speakerがspeakerTurnsに存在しない
- 画像実体 / URLがない
- visual cueの字幕indexが不正

## project.json → Remotion

`prepare:studio`:

```text
project検証
→ 元音声SHA照合
→ voice.wav生成
→ speaker turnsを切り抜き0秒基準へ変換
→ 最終WAV SHA / durationで話者区間を再ロック
→ HOST-only envelope
→ 背景 / 画像固定化
```

`render:studio`:

```text
prepare:studio
→ project出力サイズからComposition自動選択
→ TypeScript check
→ H.264 render
→ Node構造validator
→ QC静止画抽出
```

構造validator:

- 期待解像度
- video stream
- audio stream
- 期待尺 ±0.5秒
- A/V drift 0.15秒以内

## API / Pages / Deploy

Worker endpoints:

- `GET /api/health`
- `POST /api/transcribe`
- `POST /api/visual-cues`
- `POST /api/images/generate`
- `POST /api/images/import-openverse`

Pages build時、Cloudflare設定が存在すればworkers.devサブドメインを取得し、Worker API baseをViteへ自動注入する。

Deploy workflow:

```text
secrets確認
→ Worker install / syntax
→ Openverse import安全テスト
→ wrangler deploy
→ OPENAI_API_KEY secret同期
→ workers.dev公開確認
→ /health
→ openaiConfigured=true確認
```

## 最新CI

最新のコードheadで確認済み:

- Build VRM Studio: PASS
- Worker Openverse import safety tests: PASS
- streaming SHA-256 test: PASS
- project validation / reopen / legacy visual ID migration: PASS
- long-audio overlap chunk planning: PASS
- browser VRM preflight: PASS
- 実軽量 `subeha-web-site.vrm` 拒否: PASS
- Vite build / API base injection: PASS
- Remotion VRM Check: PASS
- Remotion remote visual reject: PASS
- Remotion Structural Smoke: PASS
- render構造QC: PASS
- Site QA: PASS

## 現在の外部ブロッカー

2026-08-22の最新Config CheckでもGitHub repository secretsは3つとも未設定。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `OPENAI_API_KEY`

したがって現在できないのは、**実Workerデプロイと実OpenAI APIを使ったE2E検証**。

## Secrets設定後の必須実QC

1. Worker deploy / `/api/health` PASS
2. GitHub PagesからWorkerへ自動接続確認
3. 実配信音声でtimed ASR
4. HOST識別確認
5. 客発話中に口・頭・胸の発話連動モーションが停止することを目視確認
6. 1〜2時間配信で処理速度 / メモリ / chunk境界を確認
7. Openverse固定化を実画像で確認
8. GPT Image生成を1件確認
9. Web録画を実施
10. project.json保存 → 再開
11. `render:studio` で最終MP4
12. 構造QC + 字幕 / 口パク / 画像タイミング目視QC

## 完成扱いしない条件

実デプロイと実配信E2E QCを通るまでは、**コード実装済み・実運用未検証**としてPR #22をDraft維持する。
