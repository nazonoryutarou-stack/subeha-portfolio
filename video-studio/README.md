# すべての歯が見える — Video Production Skill Hub

撮影・脚本・配信アーカイブ・字幕・切り抜き・VRM・DeepDream・Remotion・音響・納品を、実装状態の分かる **15個のAgent Skills** に統合した入口。GitHub Copilotが読み取れる形式の `.github/skills/<name>/SKILL.md` を使う（`video-studio/catalog.json` は機械可読索引）。

## 入口と役割
- `AGENTS.md`: 動画担当エージェントへの共通指示。
- `.github/skills/video-production-director/SKILL.md`: 工程ルーター。
- `catalog.json`: 技術分類、mainでの実装、private参照、未マージ参照の区別。
- `cli.mjs`: npm install不要の索引検査・制作job作成・ffprobe構造QC。
- `docs/production-rules.md`: 同一原音、正確な時刻、raw/clean/report、相談者プライバシー。
- `docs/vtuber-engine-golden-baseline.md`: 横型VRMの固定UI、口パク、字幕safe area。

## 技術資産の所在
| 分野 | main で確認した実装 | 別ブランチ / private |
|---|---|---|
| Whisper時刻抽出 | `tools/vtuber-backup/` | private `subeha-transcripts/tools/whisper-timed/` |
| VRMモーション | `remotion/vrm-lipsync/src/backup/`, `Subeha.vrm` | PR #22のV3 / Assistantレンダー |
| 字幕・口同期 | `remotion/vrm-lipsync/scripts/build-backup-timeline.mjs` | PR #22の編集・QC |
| Studioプレビュー | `tools/vrm-talker/` | PR #22のWeb Studio |
| 映像演出 | `remotion/teruteru-bot/` | 実験ブランチのauto-director |
| 画像加工 | `deepdream/` | 動画への編集接続は別工程 |
| 元配信切り抜き | public側はルールのみ | private `video_clip_manifest.py` |

**重要**: PR #22 (`feature/vrm-studio-webapp`) は現在draft・未マージ。PRの機能がmainで使えると断言しない。実験的な `feature/vtuber-auto-director` も本番機能としない。

## CLI

    node video-studio/cli.mjs list
    node video-studio/cli.mjs check
    node video-studio/cli.mjs doctor
    node video-studio/cli.mjs new example-short short
    node video-studio/cli.mjs validate video-studio/jobs/example-short/job.json
    node video-studio/cli.mjs qc /path/to/render.mp4 short

- `new` は **draft** の雛形を作るだけ。audioや字幕は生成しない。
- `validate` は企画jsonの形式と必須項目、参照ファイルを検査する。未入力時は失敗する。
- `qc` はffprobeによるcodec/stream/尺/AV drift/プロファイル照合の **構造QC**。口パク・字幕・映像の目視QCは別途必須。
- `video-studio/jobs/` と `outputs/` はGit ignore対象。PRIVATEの原音・相談者データは公開repoへ追加しない。

## 制作経路
1. `video-storyboard-writing` で企画 / ショットリスト確定。
2. `video-source-ingest` → `video-asr-timing` で同一sourceに由来するtimed/cleanを作る。
3. `video-highlight-editing` で確かな切り抜きと話者ラベルを決定。
4. `video-caption-timing`, `video-vrm-performance`, `video-visual-research`, `video-motion-vfx`, `video-audio-finishing` を合成。
5. `video-render-delivery` → `video-quality-assurance` → `video-publishing-packaging`。

## スキル一覧
- [video-production-director](../.github/skills/video-production-director/SKILL.md) — orchestration / procedure
- [video-storyboard-writing](../.github/skills/video-storyboard-writing/SKILL.md) — preproduction / procedure
- [video-source-ingest](../.github/skills/video-source-ingest/SKILL.md) — ingest / procedure
- [video-asr-timing](../.github/skills/video-asr-timing/SKILL.md) — transcription / available
- [video-highlight-editing](../.github/skills/video-highlight-editing/SKILL.md) — editing / branch-only
- [video-caption-timing](../.github/skills/video-caption-timing/SKILL.md) — editing / available
- [video-vrm-performance](../.github/skills/video-vrm-performance/SKILL.md) — production / available
- [video-visual-research](../.github/skills/video-visual-research/SKILL.md) — production / procedure
- [video-motion-vfx](../.github/skills/video-motion-vfx/SKILL.md) — production / available
- [video-deepdream-art](../.github/skills/video-deepdream-art/SKILL.md) — production / available
- [video-audio-finishing](../.github/skills/video-audio-finishing/SKILL.md) — postproduction / procedure
- [video-render-delivery](../.github/skills/video-render-delivery/SKILL.md) — delivery / branch-only
- [video-quality-assurance](../.github/skills/video-quality-assurance/SKILL.md) — quality / available
- [video-publishing-packaging](../.github/skills/video-publishing-packaging/SKILL.md) — delivery / procedure
- [video-automation-rd](../.github/skills/video-automation-rd/SKILL.md) — research / experimental

## 未実施の作業
このハブ登録だけではPR #22のマージ、外部生成AIの接続、レンダーファーム設置、実音声からのMP4レンダー、動画公開は完了しない。音声・字幕・VRMが揃ったjobで個別に実行と検品を行う。
