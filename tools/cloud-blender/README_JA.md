# Cloud Blender / 九龍城（GitHub Actions 不使用）

このディレクトリは **クラウド側で Blender を実行するための最小構成**です。GitHub に置くのは公開可能な制御用 JSON とコードのみです。モデルの実体、中間ファイル、レンダリング結果は外部サーバーのストレージに保存します。

## 仕様
- `jobs/current.json`: 実行したいジョブ。任意の Python コードは受け付けない。
- `cloud_worker.py`: GitHub Raw のジョブを読んで検証し、**一度だけ** Blender を起動して終了。無限ループ・定期実行なし。
- `blender_task.py`: Blender のバックグラウンドモードで指定済みの `.blend` を開き、保存、レンダリング、任意で GLB エクスポート。
- `Dockerfile`: Ubuntu の Blender を使う CPU ベースの試験用。GPU/Cycles 性能は実機プロバイダーと Blender ビルドに依存する。
- GitHub Actions の workflow、GitHub-hosted runner、GitHub の Secrets は使わない。

## 初回手順
1. Runpod などで Linux 環境と**永続ストレージ**を準備する（費用発生の可能性あり。利用者が明示的に起動する）。
2. Android Termux にある `~/storage/downloads/Kowloon_Walled_City_Latest.blend` を、プロバイダーのファイルアップロード、SSH/SCP、または `runpodctl` などでクラウドの `/workspace/inputs/kowloon-v13.blend` に一度だけコピーする。クラウドへ送るのは完成モデルのみ。
3. リポジトリをクラウド上に取得し、`tools/cloud-blender` ディレクトリで Docker ビルドする。
4. **例（Docker が使える環境）**：
   ```sh
   docker build -t kowloon-cloud:0.1 tools/cloud-blender
   docker run --rm -v /workspace:/workspace -e CLOUD_WORKSPACE=/workspace kowloon-cloud:0.1 --once
   ```
   実行するたびにプロバイダー側の利用料金がかかる場合がある。成功時、`/workspace/outputs/kowloon-cloud-preview-v1/` に `preview.png`, `kowloon-cloud.blend`, `render-report.json` ができる。最初は CPU 互換性優先の Workbench レンダリング。
5. クラウド保存領域の `outputs` から PNG をブラウザーで確認する。スマホへのダウンロードは任意。

## オプション：完成物だけオブジェクトストレージへ
S3互換ストレージで `CLOUD_S3_BUCKET`、必要に応じて `CLOUD_S3_ENDPOINT_URL` と、`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`、`AWS_DEFAULT_REGION` を **クラウドのシークレット/環境変数**として設定する。成果物は `kowloon/<ジョブID>/` に保存される。公開 URL の発行・ユーザーへの通知・自動課金制御はまだ未実装。アクセス権を限定し、資格情報を GitHub にコミットしない。

## 運用上の注意
- **Runpodアカウント、GPU Pod、ネットワークボリューム、S3バケットは未作成**。この段階ではクラウドでの実行・GPU性能・成果物受取は未検証。
- 最初の `.blend` は Android で生成したものをコピーする。GitHub にバイナリを直接置かない。
- `jobs/current.json` を更新した後、外部ワーカーを明示的に実行する。新規ジョブにするときは `id` を変える。既存成果物の上書きを拒否する。
- `/workspace` は永続ストレージへ必ずマウントする。コンテナ内の一時領域だけでは停止時にデータが消える。
- GPU使用版の導入前に、レンダリング負荷・ジョブ最大時間・料金上限・S3保持期間を設定する。
- 手元の Android Blender Bridge は削除しない。モデルの手動修正や緊急復旧に引き続き利用できる。
