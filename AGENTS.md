# Repository agent guidance

映像制作・配信切り抜き・VRM・字幕・CGを依頼されたら、`video-studio/README.md` と `.github/skills/video-production-director/SKILL.md` を先に読む。
技術別スキルは `video-studio/catalog.json` に一覧化した。Copilot向け標準Agent Skillsを `.github/skills/<name>/SKILL.md` に配置している。

常に `docs/production-rules.md`, `CHATGPT_WORKFLOW.md`, `docs/vtuber-engine-golden-baseline.md` を守る。原音と字幕を捏造せず、発話話者を分離、private transcript repository の個人情報・実音声・JSONLを public にコピーしない。

**Branch boundary:** `main` に存在するのはbackup renderer等。`feature/vrm-studio-webapp`（PR #22）は未マージ。自動演出は `feature/vtuber-auto-director` 実験ブランチ。main上のコマンドだと推定しない。

Check catalog: `node video-studio/cli.mjs check`.
Create private job: `node video-studio/cli.mjs new <slug> [landscape|short]`.
Structural QC: `node video-studio/cli.mjs qc <mp4> [landscape|short]`.
目視QCを省略しない。
