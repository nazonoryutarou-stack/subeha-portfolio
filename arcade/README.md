# 不氣屋アーケード

不氣屋界隈を歩く常設空間。正本はこのディレクトリ。`index.html` と `app.html` は同じ画面を直接開く。ヘッダー付きiframeは廃止した。

**状態：実装済み・公開判定保留。** 2026-09-05／09-08の確認用ChromeはWebGLが無効だった。CPU検証画面による操作確認を、WebGLの描画・Android実機の速度の確認と混同しない。詳細は `../docs/arcade-qa.md`。

## 空間

通路幅4.2m、長さ39m、目線1.62m。低い屋根・コンクリート躯体・配管・ケーブル・一人称視点とCanvasTextureによる材質生成は旧実装から継承。移動をカメラ基準に直し、街路の横方向固定クランプを実際の壁・家具の衝突判定に置き換えた。

| 区画 | 建築 | 入店 | 反応する物体／接続先 |
|---|---|---|---|
| 妹字屋 | 黒い古材、引戸、板金庇、木格子、黒和紙 | 可 | 暗号台帳 → `../imoji-lab/app.html`、読み札はその場で裏返る |
| しきがみ上手 | 浅いアルミ建具、ガラス、波板の下屋、種子鉢 | 可 | 使用方法 → `../brands/shikigami/` |
| 祭祀具・異物製品 | 高い板金作業場、巻上げシャッター、作業机 | 可 | 既存のテルテルボット資料 → `../products/joke/` |
| 未祓い観測 | 低いタイル壁、開いた片開き扉、網入り窓、書類棚 | 可 | CRT → `../miharai/` |
| 作品保管庫 | 幅広い煉瓦倉庫、アーチ、鉄扉、塞いだ窓 | 可 | CRT → `../works/ninja-kaishaku/app.html`、祈願端末 → `../works/bari-rebechi/app.html`、目録 → `../works/` |
| 空き店舗 | 閉じたシャッター、外れた看板、残ったメーター | 不可 | なし |
| 札所 | 低いコンクリートの窓口、片側だけ閉じた引戸 | 窓口 | 台帳 → `../archive/neocities/fudasho-observation-091.html` |
| 研究 | 補修された壁、閉じた鉄扉、投函口 | 不可 | 掲示 → `../research/` |

通りの奥の扉は既存サイトのトップへ接続する。

## 設定の出典

- `../docs/arcade-roadmap.md`、`../README.md`、`../IDEA_NOTE.md` を確認。
- 妹字の説明・効能・由来を追加していない。読み札は既存 `imoji-lab/app.html` v0.8 の同じ入力「シト、シュウライ／ポコペン」と78bitの字形規則。
- 「読める。意味は、まだ読めない。」は旧アーケードから継承。
- 種子・折り紙は既存のしきがみ上手の本文。`brands/shikigami/index.html` は圧縮本文を変更せず自己完結HTMLに展開し、存在しない共通JS/CSSの要求を解消。
- テルテルボットの図は既存 `assets/teruteru-bot-turntable.svg` を使用。
- 現在の未祓いデータは空配列、研究ページにも公開ノートはない。観測地点や記録を創作していない。

## 操作

- PC：WASDで歩く、マウスをドラッグして見回す、Eまたは対象表示で調べる。矢印左右で旋回、上下で前後移動。マウス固定は「操作」から任意。
- タッチ：左下のスティックで移動、右側で視点操作。それぞれ独立したPointer IDを保持。方向ボタンにも切替可能。
- 「操作」を開くと移動は停止。blur、visibilitychange、pointercancel、lostpointercaptureで入力を解除。画面外へ離した指の入力も残さない。
- 視点は揺らさない。端末のreduced-motion設定に従い、点滅・換気扇を止める。音は明示的な操作でのみ有効になる。
- リンクへ移る前に同じタブのsessionStorageへ位置と方向を保存し、戻った時に復元する。外部送信なし。

## パフォーマンスと依存

- Three.js **0.184.0** を旧実装と同じ版でローカル同梱。MITライセンスは `vendor/THREE-LICENSE.txt`。CDNやGoogle Fontsへの初回依存なし。
- 汚れ・錆・紙・木目はシード固定の小さな共有テクスチャ。モデルは合計約2万三角形。静的メッシュは材質・形状・8m区画ごとのInstancedMeshに統合。
- 動的ローカルライトは2灯、影用追加レンダーパスなし。DPRはモバイル上限1.2、低速時は0.7まで自動低下。軽量／精細を手動選択可能。
- 音はローカルのWeb Audio合成。接続先の未祓いマップは既存のLeaflet CDN／OpenStreetMap、札所は既存のGoogle Fontsを引き続き使う。これらをアーケード起動時には読み込まない。
- 起動失敗、WebGL context loss、再読込の表示を実装。

## 再現と配信

```sh
npm ci
npm run dev
node scripts/stage-arcade.mjs
npm run arcade:check
```

公開フローは `public/` だけを配信するため、`stage-arcade.mjs` がアーケードと必要な接続先を同期する。既存の `public/index.html`・商品ツリー・理論を変更しない。古いホームへのリンクは配信時に現行トップへ向け、HTMLの参照を相対化する。`miharai/admin.html` や私室は配信しない。

`scripts/arcade-review/` はWebGLの使えない環境用のCPU操作検証器。製品には配信しない。製品と同じシーン・入力・衝突・リンク処理を使うが、陰影・透過・FPSの検証には使えない。

変更前の保存：`backup/arcade-before-completion-20260905`、基準 `296e02450a7935939afa697871947d6d712c5b2f`。

確認候補のNeocities ZIP：`../releases/arcade-neocities-candidate.zip`。`node scripts/stage-arcade.mjs` → 検査 → `python scripts/package-arcade.py` で同じ内容を再生成する。公開判定が済むまでは候補として扱う。
