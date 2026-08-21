# VRM TALKER / Studio

`tools/vrm-talker/` は、音声からVRM切り抜きを作るための**正規Web制作アプリ**。

## 役割

ブラウザで素早く制作する。

```text
音声
→ 字幕
→ 話者分離
→ HOSTだけ口パク
→ 参考画像検索 / 生成
→ レイアウト
→ プレビュー / 録画
```

高品質な決定論的最終レンダーは `remotion/vrm-lipsync/` が担当する。

## 動画用VRM

動画口パクには `Subeha.vrm` を使う。

`subeha-web-site.vrm` はWeb表示用軽量モデルで、aa/ih/ou/ee/oh が無いため動画制作には使わない。

## 現在の実装

現行GitHub版:
- VRM読み込み
- 音声読み込み
- 自然姿勢
- RMSベース口パク
- 背景画像
- 構図変更

ユーザー提供の検証済みスナップショットには、さらに以下の実装があるためこのブランチへ順次戻す:
- 区間指定
- Canvasテロップ
- 縦 / 正方 / 横出力
- MediaRecorder録画
- VRM口表情チェック

## 今日追加するもの

- timed ASR
- 字幕トラック
- speaker diarization
- HOST-only lip sync
- 参考画像検索
- 画像生成
- project.json保存

## セキュリティ

GitHub PagesへAPIキーを埋め込まない。

秘密鍵が必要な処理は `/api/*` バックエンド経由にする。

## 開発

```bash
cd tools/vrm-talker
npm install
npm run dev
```

ビルド:

```bash
npm run build
```

GitHub Actions `Build VRM Talker` でもビルドする。

## 設計

- `../../docs/production-rules.md`
- `../../docs/video-app-architecture.md`
