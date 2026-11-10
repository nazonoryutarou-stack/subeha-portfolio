# SUBEHA CUT v1.2 — editor cleanup, true video filmstrips and overlay animations

Android Chrome 向け独立開発のローカル動画編集PWA。Videoleap/Lightricksとは無関係。プレビュー・タイムライン・タッチ操作は一般的な動画編集の手法を参考にしつつ、ブランド・素材・実装は独自です。

## v1.2 の変更点

1. **「小窓」専用UIを撤去**: 参考スクリーンショットに写ったYouTubeのシステムPicture-in-PictureをVideoleapの機能と誤認していたため、下部メニュー・詳細メニュー・設定パネルから削除。**オーバーレイ機能は継続**し、通常の画像/動画合成を実行できます。過去に作成したv1.1プロジェクトに`pipStyle`が保存されている場合、動画を壊さないよう従来の描画処理だけ維持しています。新規作成時に小窓装飾は付与されません。
2. **動画の本物のフレームストリップ**: 動画クリップでは先頭サムネイルをただ繰り返さず、トリム範囲・逆再生方向に応じて複数の再生時刻のフレームを採取。縦型タイムライン上に連続表示します。1クリップ当たり上限12枚、キャッシュ最大28クリップ、動画デコーダは一度に1件。端末性能が足りない場合は従来のサムネイルにフォールバック。
3. **オーバーレイのワンタップアニメーション**: フェードイン、下から登場、ポップ、フェードアウト、緩やかな左右移動、解除。既存の編集可能なキーフレーム形式として保存され、プレビュー・書き出しと同じ描画で再生。素材本体は変更しません。
4. オフライン用Service Workerを`v12`へ更新。新規モジュール3件を追加。既存の字幕、音声、編集テンプレート、色調整、トランジション、動画修復、素材込みアーカイブの機能を保持。

## 使い方

- 「オーバーレイ」から画像または動画を重ねる。タイムラインでレイヤーを選択後、オーバーレイの設定内「登場アニメーション」を選ぶ。ドラッグ/ピンチやキーフレーム編集は引き続き可能。
- 動画を追加すると、タイムラインに動画内容に沿った複数サムネイルが読み込まれます。長尺・大量クリップでは初回に時間がかかる場合があります。
- 保存は従来通り`.subecut`で素材ごと移行できます。端末内に保存されたデータをGitHubへアップロードしません。

## 検証

```sh
cd public/cut
for file in *.mjs; do node --check "$file" || exit 1; done
node --test test/*.test.mjs
python test/smoke-browser.py
python test/smoke-export.py
```

- **31件のNode自動テスト合格**。トリム済み/逆再生サムネイルの抽出位置、アニメーションのキーフレームの範囲と元データの非破壊性を含みます。
- Chromium幅420pxで、**専用小窓項目の非表示、オーバーレイ追加、アニメーション設定、MP4素材の追加、3つの異なるフィルムストリップ画像の生成、マジック編集**まで操作検証し、ページ例外なし。
- ブラウザの等速動画書き出しを実行し、ファイルの生成とページ例外なしを確認。ただしAndroid実機での長尺、発熱、全コーデックは未検証です。

## 既知の制限

Webブラウザの`MediaRecorder`書き出しでは、MP4コンテナでもH.264/AACになる保証がありません。大規模プロジェクトのフレームストリップ生成は処理負荷がかかる場合があります。AI背景認識、ネイティブの高精度4K/HEVCレンダリング等は未実装。Nothing Phone実機での長尺編集・書き出しは未検証です。

https://nazonoryutarou-stack.github.io/subeha-portfolio/cut/


## v1.3 — device-observed effects toolbar

The Videoleap 1.40.1 Android UI was inspected from a user-captured screen/XML audit (1260×2800). The captured `home` view was an import overlay, not the app home screen; no home layout is claimed. The editor screenshot confirms a top action bar, content-dominant preview, centered playhead, horizontal filmstrip and bottom effect toolbar. `effects.xml` was captured after the screenshot UI changed, so categories are treated as observed labels, not a verified complete ordering. A new local, independently implemented effects submenu exposes Shake, Prism, Offset, Old Film, Mosaic, Focus Blur, RGB, Pattern, Scan and Kaleido. Effects actually render in the existing Canvas export path and have an intensity slider. No assets or code were extracted from Videoleap. Browser-only app; iOS UI is not claimed to be faithfully reproduced. The original `effects.mjs` effects remain available. Service Worker cache upgraded to v13.
