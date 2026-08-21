# Broadcast Shorts Pipeline v1

配信音声から短尺動画を作るための決定論的な FFmpeg / Pillow レンダラー。

## 原則

- 面白さは AI / 編集判断で決める。
- 時刻は ASR / forced alignment 等の機械タイムコードで決める。
- 字幕時刻を勘で置かない。
- 元配信の実音声だけを使う。
- `stock / generated / local` を `asset-manifest.json` に記録する。
- QC に落ちたものは final 扱いしない。

## 現在の実装

- 配信文字起こしから短尺候補をスコアリング
- 実音声の長さ検証
- 確定字幕タイムコード検証
- 音声 RMS を 30fps で抽出して映像へ反映
- local → Pexels → Pixabay → procedural の素材解決
- シーンごとのプロシージャル素材生成
- 9:16 H.264/AAC レンダー
- QC フレーム自動抽出
- `qc-report.json` / `asset-manifest.json` 出力

## 1. ネタ候補を出す

```bash
python tools/video-pipeline/highlight_candidates.py \
  path/to/transcript.txt \
  --top 12 \
  --output out/highlights.json
```

ここでは**内容だけを選ぶ**。時刻は出さない。候補は `requiresAlignment: true` で次工程へ渡し、WhisperX等で音声時刻を確定してから切る。

## 2. 素材を解決する

APIキーなしの場合は procedural graphics へフォールバックする。

```bash
python tools/video-pipeline/asset_resolver.py \
  jobs/video/demo-caffeine-assets.json \
  --output out/asset-manifest.json
```

Pexels / Pixabay を使う場合:

```bash
export PEXELS_API_KEY=...
export PIXABAY_API_KEY=...
python tools/video-pipeline/asset_resolver.py \
  jobs/video/demo-caffeine-assets.json \
  --download-dir out/assets \
  --output out/asset-manifest.json
```

素材ごとに provider / source page / license / search query を manifest へ残す。

## 3. 動画をレンダーする

```bash
python tools/video-pipeline/render_short.py \
  --job jobs/video/demo-caffeine.json \
  --audio /path/to/confirmed-cut.m4a \
  --output out/broadcast-short.mp4
```

## パイプライン設計

```text
broadcast audio
  -> transcript / alignment
  -> highlight score
  -> exact source range
  -> asset plan
  -> local / stock / generated asset resolver
  -> deterministic renderer
  -> QC frames + report
  -> final.mp4
```

## 次の接続点

1. WhisperX: 日本語 forced alignment
2. stock candidate の Vision 検品と再検索
3. source audio / transcript を GitHub Actions へ安全に受け渡す仕組み
4. VRM: 口形 Expression が存在するモデルだけ別 composition で使用

VRM が不適格な場合でも動画制作全体を止めない。B-roll / procedural graphics / subtitles の構成へ自動でフォールバックする。
