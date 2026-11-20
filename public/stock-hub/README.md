# STOCK HUB — 素材横断検索

サイト: https://nazonoryutarou-stack.github.io/subeha-portfolio/stock-hub/

画像・動画・音楽・効果音・VRM・3Dモデル・テクスチャ・HDRIを探す**独立した検索アプリの試作版**。

## API検索
- **Openverse**: 画像・音声（CC0と表示されたもののみ）。
- **Wikimedia Commons**: 画像・動画・音声（CC0/PDM等の権利表示を検査）。
- **NASA**: 画像・動画・音声（NASAの使用条件として扱い、CC0とは判定しない）。
- **Poly Haven**: 3Dモデル・テクスチャ・HDRI（CC0、公開APIのデータに基づく）。
- **Pixabay**: 任意APIキー入力時の画像・動画。キーは保存しない。検索結果はAPI規約に合わせて24時間のキャッシュを使う。

通信不能、ブラウザのCORS制限、API制限、入力された検索語や利用条件などにより、一部APIが失敗する場合があります。失敗したサービス名を表示し、別の検索結果は残します。

## 専門サイトへのリンク
Freesound、VRoid Hub、BOOTH、Sketchfab、Pexels、Mixkit、Kenney、ambientCG、YouTubeオーディオライブラリ、Internet Archiveなどへ直接移動できます。**これらは外部サイトへ案内しており、全部をAPIで自動検索・一括ダウンロードしているわけではありません。**

## 権利
無料素材の全てがCC0ではありません。商用利用・クレジット・肖像・商標・人物の政治的/宗教的支持を誤認させる使用等は原ページの規約を確認してください。CC0表示の検索結果もメタデータ誤記の可能性があるため保証ではありません。

## 検証状況
検索UI・APIクエリ構成・正規化関数の構文検査は済み。ライブAPI通信・端末上のファイル保存は未検証。
