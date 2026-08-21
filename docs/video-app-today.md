# 2026-08-22 VRM Studio 開発メモ

## 今日の目標

音声を入れると、VRM・字幕・話者分離・参考画像検索・画像生成まで一つのWebアプリで扱える状態へ進める。

## 現在までに実装したもの

- `tools/vrm-talker/` を正規Web制作アプリとして定義
- ZIPで検証済みの区間指定・出力比率・テロップ・録画UIを復元
- 新しい `main-studio.js` を正規ブラウザレンダラーとして追加
- timed caption をCanvasへ焼き込み、録画へ乗る構成へ変更
- 話者区間がある場合、選択した本人話者だけで口パクするゲートを追加
- 本人話者をUIで明示選択し、勝手に推測しない
- `project.json` schema / example / state管理を追加
- Openverse参考画像検索クライアントを追加
- 画像生成APIクライアントを追加
- OpenAIの話者分離付き転写 + 画像生成を担当するWorkerを追加
- PR時にVite build + Worker syntax checkを行うWorkflowへ更新

## まだ接続確認が必要

- Workerの実デプロイ
- `OPENAI_API_KEY` / `ALLOWED_ORIGIN` 設定
- GitHub PagesからWorkerへのAPI BASE設定
- 実音声による diarization 結果の確認
- 本人話者選択後、客発話中に口が閉じる目視QC
- Openverse画像の採用後の画面挿入
- 生成画像の採用後の画面挿入
- `project.json` をRemotionへ渡す変換処理

## 完成扱いしない条件

上記の実接続・実音声QCを通るまでは「WebアプリMVP途中」とする。
