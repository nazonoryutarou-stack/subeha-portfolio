# VTuber Backup tools

Whisperに依存しない予備経路のTermux側ツール。

## Prepare

Android word timing JSONLが取れたあと:

```bash
bash tools/vtuber-backup/prepare-termux.sh \
  ~/storage/downloads/配信165.m4a \
  ~/storage/downloads/SubehaWordTiming/subeha-word-timing-XXXXXXXX.jsonl \
  ~/subeha-portfolio
```

処理内容:

1. 原音を16kHz mono PCM16LEへ変換
2. 10ms口開閉curve生成
3. Android word timingをRemotion入力へ配置
4. voice.m4aをRemotion publicへ配置
5. timeline TypeScript生成

その後:

```bash
cd ~/subeha-portfolio/remotion/vrm-lipsync
npm run render:backup
```

出力:
`out/vrm-lipsync-backup.mp4`

相談音声・JSONL・PCMはcommitしない。
