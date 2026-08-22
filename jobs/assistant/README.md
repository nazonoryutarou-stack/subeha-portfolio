# Assistant video jobs

`jobs/assistant/current/` は、ChatGPTが配信音声から選んだ切り抜きをGitHub/Remotionへ渡すための作業ディレクトリ。

正規ファイル:

- `edit-plan.json`: `remotion/vrm-lipsync/assistant-plan.schema.json` に従う編集指示
- `source.m4a` または `source.wav`: 長尺原音ではなく、選定後に切り出した短い音声
- `assets/`: 任意。採用する画像などをローカル固定する場合に使う

長尺原音をGitHubへ置かない。ChatGPT側で切り抜き位置を決めてから必要区間だけ入れる。

`edit-plan.json` の話者は `HOST / GUEST / UNKNOWN`。`UNKNOWN` は安全側へ倒し、VRM発話モーションを止める。

レンダー:

```bash
cd remotion/vrm-lipsync
npm run render:assistant -- \
  --plan=../../jobs/assistant/current/edit-plan.json \
  --audio=../../jobs/assistant/current/source.m4a \
  --output=out/assistant-current.mp4
```

GitHub Actionsの `Assistant VRM Video Render` も同じ経路を使う。
