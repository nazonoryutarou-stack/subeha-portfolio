# ブイチューバーエンジン projects

動画ごとの差分だけをここへ置く。

```text
<project>/
├─ edit-plan.json
├─ source.m4a | source.wav | source.opus
├─ assets/
└─ out/
```

`current/` を置くと、branchへのpushでGitHub Actionsの自動レンダー対象になる。
それ以外のprojectは `workflow_dispatch` でproject名を指定してレンダーする。

長尺配信の原音は置かない。採用区間だけ短尺実音声として置く。
