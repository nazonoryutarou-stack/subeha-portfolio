# 九龍城砦をBlenderで自動実行する

九龍城の無彩色OBJ v0.13から、AI Blender Bridgeがそのまま実行できる作業命令を生成した。現在の命令は西南角の外壁で、張出し4組、下層7段の帯材、縦材39片を含む。既存のTermuxサーバーとBlender内のエージェントが動いていると、`jobs/current.json` の新しいIDを通常1〜2分で受信する。

| 作業命令 | 収録内容 | 元OBJの面数 |
|---|---|---:|
| [facade.json](jobs/kowloon/facade.json) | 西南角の拡張した外壁。相対単位、実寸と全域図への配置は未確定 | 849 |
| [no24.json](jobs/kowloon/no24.json) | 7住戸、水回り、共用部、2つの光庭、階段の投影線、バルコニー | 1,120 |
| [city.json](jobs/kowloon/city.json) | 全域234区画、街路、北部19棟の階数に基づく作業立体、西側2面の屋根と壁、番地の位置 | 13,203 |
| [roofs.json](jobs/kowloon/roofs.json) | 信義里19号・長安里3号の屋上図、階段の投影線13本、貯水槽の輪郭、3号の柵高の断面 | 52 |

現在の外壁ジョブは、切替前のBlenderプロジェクトを端末内へ保存してから模型を組み立て、640×426のPNGを保存する。保存先は `~/.ai_blender_bridge/outputs/kowloon-facade-v13-20261126-a1.png`。現行エージェントの切替前の保存名は `kowloon-facade-v13-20261126-a1_before-kowloon.blend`、初期エージェントでは同じIDの `.blend` になる。

各命令は専用シーン `AI Bridge Studio` を作り直し、実際のメッシュ、カメラ、中立色の照明を配置する。形状ごとの出典、判読の状態、仮定は命令内に保持する。全域版は18個のメッシュに313部材をまとめ、各部材の面範囲を記録した。

## 現物を確認する

端末側のローカル状態ページで `Last result` のIDと `ok` を確認する。新しいIDは一度ずつ実行される。`studio_watch.py` が起動している場合は、Blenderジョブの成功後に既存の端末側の許可設定に沿って画面を取得する。画像は `~/.ai_phone_bridge/data/latest.png`、ローカル画像ページは既存の `phone_bridge.py serve` で開ける。

本変更では既存のJSON操作を使っている。Blenderエージェントの再インストールは不要。Blenderを再起動した際の接続手順は [START_HERE_JA.md](START_HERE_JA.md) に従う。

現在と初期の両方のエージェントを使い、受信・切替前のプロジェクト保存・メッシュの作成・完了通知・PNG保存をデスクトップBlender 4.3.2で検査した。 [検査結果](jobs/kowloon/desktop_validation_v13.json)今回の九龍城ジョブについて、Android端末からの実行結果と画像の受信は未確認。

## 次の修正を送る

展開した九龍城のフォルダを入力にする。`model/` と `evidence/project_manifest.json` を同じ版でそろえる。

```sh
python kowloon_job.py /path/to/Kowloon_Uncoloured_OBJ_v13 \
  --view facade --id kowloon-facade-next-001 --save-before --render --out jobs/current.json
```

`--view` は `facade`、`no24`、`city`、`roofs`。`--save-before` は切替前のBlenderプロジェクトを端末内へ保存する。出力をこのリポジトリの `tools/ai-blender-bridge/jobs/current.json` に反映すると、既存の受信処理につながる。修正ごとに新しいIDを使う。

座標はOBJのY上向きからBlenderのZ上向きへ回転する。表示の原点は命令内の `source_origin_OBJ`、回転行列は `axis_rotation` に記録する。城砦全域の表示座標は1mm刻みで、外壁は0.000001相対単位刻み。尺度は命令内の `source_units` と `viewport_coordinate_unit`、丸め幅は `viewport_coordinate_precision` に記録する。元のOBJを読み替える計算にはこの表示原点と精度を使う。

`evidence_columns`、`evidence_values`、`source_parts` から、各部材の出典・状態・注記・仮定を復元できる。メッシュ内の `source_ranges` は部材番号、面の開始位置、面数を表す。元ファイルのSHA-256も保持する。

## 復元の確かさ

今回の外壁は、各組9頂点を昼夜両方で採録した接続部と、見える帯材・縦材の面からなる。実寸、地図への配置、隠れた内部、材料の断面と厚さは未確定。バルコニーの下部の境界には鼻先の帯と軒裏の部分が混在する可能性がある。

24号の室内図にはA〜G住戸と対象階の記載がある。尺度棒の単位と0.82mの表示断面高には作業上の仮定を含む。室内の向き、階の標高、各階の構成は未確定。

全域では北部19棟に階数の記録がある。階高と通路の高さは作業値で、残る215区画の高さは未確定。西側2面の屋根の高さは写真からの推定。屋上図の水平縮尺は面積注記から採った小さい案で、屋根の標高は未確定。

資料は渡辺俊一・居林昌宏（1993）図2〜4、Lau・Lai・Ho（2018）図1、Chua・Yau（2022）図5〜6と、元OBJに付属する出典目録・観察記録を参照。
