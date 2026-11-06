# VIDEO SCRAPYARD — 映像素材の廃品回収所

**現状：96個の仮説的なAgent Skills + 41個のFFmpeg実験レシピ。** 2026-11-07時点の探索・試作品。実際に映像作品へ使える保証はない。

ユーザーの方針：完成度、用途、流行、上品さ、映画向きかどうかで捨てない。即戦力と廃品と妄想の間に上下を付けず、**検証履歴と権利だけを区別する**。

## 見る
- [ブラウザで検索する](index.html) （ローカルHTTPサーバーで開く。GitHubの単独HTMLプレビューでJSON fetchが効かない場合がある）
- [96個の案を収めたデータ](ideas.json)
- [41個の実FFmpegフィルタ](recipes.json)
- [動画制作の正規ルート](../README.md)
- 各アイデアの `SKILL.md`：`../../.github/skills/video-scrap-*/SKILL.md` に収容。Copilot等のAgent Skills形式。

## 廃品レシピ実行

```sh
node video-studio/junkyard/engine.mjs doctor
node video-studio/junkyard/engine.mjs list
node video-studio/junkyard/engine.mjs inspect mandelbrot
node video-studio/junkyard/engine.mjs render mandelbrot --out /tmp/fractal.mp4 --duration 3 --size 640x360
node video-studio/junkyard/engine.mjs render rgb-shift --input /path/to/owned-video.mp4 --out /tmp/rgb-shift.mp4 --duration 3
node video-studio/junkyard/engine.mjs render rgb-shift --input /path/to/owned-video.mp4 --out /tmp/rgb-shift.mp4 --dry-run
node video-studio/junkyard/engine.mjs selftest
```

Node.js、FFmpeg（libx264対応ビルド）、ffprobeが必要。各レシピは読み取り専用入力から最大60秒/最大3840×2160のMP4を新規生成する。上書きには `--force` が必要。端末・ビルド差により失敗しうるため、`selftest` と目視確認を行う。

### 記録規約
1. 最初は人工テストパターンと2〜5秒の低解像度で試す。
2. `idea_id`, 入力source hash, seed, tool version, params, output, duration, success/failure, visual observation, salvage idea を保存。
3. 失敗しても実験メモは残す（GitHubには原音や私的映像を置かない）。
4. 作品の最終動画に組み込む前に元配信のタイムコードと字幕、画像の許諾を検証。
5. FFmpegの構造QCに通っただけでは視覚演出の価値や画面の安全は確認できない。

### 参考となる外部技術（リンクだけ・転載/導入なし）
- [FFmpeg Filters](https://ffmpeg.org/ffmpeg-filters.html) — signal processing / filtergraph
- [projectM](https://github.com/projectM-visualizer/projectm) — 音声映像生成エンジン
- [Manim](https://github.com/3b1b/manim) — 数学CG
- [satyarth/pixelsort](https://github.com/satyarth/pixelsort) — ピクセルソート
- [Datamosher-Pro](https://github.com/Akascape/Datamosher-Pro) — datamoshing研究
- [videoglitchcrazynes](https://github.com/willbearfruits/videoglitchcrazynes) — glitch/粒映像制作
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — 権利処理された資料のダウンロード時に限る

ライセンスは各上流repoで別途確認。本レポジトリには外部ソフトのコード、モデル重み、プリセットパックを持ち込んでいない。
