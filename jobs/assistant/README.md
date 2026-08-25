# Assistant video jobs

`jobs/assistant/current/` は、ChatGPTが配信音声から選んだ切り抜きをGitHub / Whisper / Remotionへ渡すための作業ディレクトリ。

## 正規ファイル

- `edit-plan.json`: `remotion/vrm-lipsync/assistant-plan.schema.json` に従う編集指示
- `source.m4a` / `source.wav` / `source.opus`: 長尺原音ではなく、選定後に切り出した短い実音声
- `assets/`: 任意。採用する画像などをローカル固定する場合に使う

Base64分割音声や `source-parts.txt` は使用しない。

長尺原音をGitHubへ置かない。ChatGPT側で切り抜き位置を決めてから必要区間だけ入れる。

## Whisper

`npm run render:assistant` を実行すると、レンダー前に同じ音声へローカル `whisper.cpp` を自動実行する。

生成物:

- `out/timed-asr/timed-asr.json`
- `out/timed-asr/timed-asr.srt`
- `out/timed-asr/timed-asr.vtt`
- `out/timed-asr/timed-asr.meta.json`

`meta.json` には元音声SHA-256、音声長、Whisper model、whisper.cpp versionを保存する。

GitHub Actionsでは `small` / Japanese を既定にし、whisper.cppとmodelはcacheする。有料OpenAI API keyは不要。

ASRだけ欲しい場合はActionsの `Assistant Whisper Transcription` を手動実行する。

## Speaker safety

`edit-plan.json` の話者は `HOST / GUEST / UNKNOWN`。

- `HOST`: VRM発話モーション可
- `GUEST`: VRM発話モーション停止
- `UNKNOWN`: 安全側へ倒してVRM発話モーション停止

Whisperは時刻付きASRの根拠として使い、話者を雑に自動断定するためには使わない。

## Render

```bash
cd remotion/vrm-lipsync
npm run render:assistant -- \
  --plan=../../jobs/assistant/current/edit-plan.json \
  --audio=../../jobs/assistant/current/source.m4a \
  --asr-output=out/timed-asr \
  --output=out/assistant-current.mp4
```

GitHub Actionsの `Assistant VRM Video Render` も同じ `Whisper → render` 経路を使い、MP4・QC・Whisper transcriptを同じArtifactへ出力する。
