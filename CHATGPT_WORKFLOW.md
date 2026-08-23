# ChatGPT Workflow

配信アーカイブ、切り抜き動画、VRM動画を扱う前に、必ず次を読むこと。

1. `docs/production-rules.md`
2. `docs/remotion-status.md`

この2文書を読まずに、字幕同期・VRMレンダリング・GitHub保存完了を判断しない。

## 現在の動画制作正本

2026-08-23時点の本線は **PR #22 / `feature/vrm-studio-webapp`**。

旧世代の `feature/remotion-workflow-v2`、`fix/vtuber-qc-v2`、`fix/vtuber-qc-v3-integrated`、一時Whisper/レンダーPRを作業入口にしない。必要な実装はPR #22へ統合済みとして扱い、未統合差分が必要な場合だけ履歴を参照する。

## 正規フロー

```text
長尺の実音声
→ 同じ音声からtimed ASR / 文脈確認
→ ChatGPTが候補選定
→ HOST / GUEST / UNKNOWN分類
→ edit-plan.json
→ 採用区間だけ元音声から切り出し
→ jobs/assistant/current/
→ Remotion render:assistant
→ HOSTだけVRM発話モーション
→ 構造QC + 目視QC
→ MP4
```

- 長尺原音はGitHubへ常設しない。
- 別配信の文字起こしを流用しない。
- 字幕タイミングを推測しない。
- OpenAIの有料文字起こしAPIを正規経路の前提にしない。必要ならローカル / GitHub Actions上の `whisper.cpp` を使う。
- `tools/vrm-talker/` は確認・微調整用。正規の候補選定やASRの正本にはしない。
- 完成条件は `docs/production-rules.md` に従う。

正本ルール: `docs/production-rules.md`
実装状況: `docs/remotion-status.md`
