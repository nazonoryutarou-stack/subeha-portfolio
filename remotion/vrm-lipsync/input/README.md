# Backup engine input

このディレクトリは生成時の作業領域。個人音声・相談内容・生成JSONLは原則commitしない。

## word-timing.jsonl

Android `SpeechRecognizer` probe の出力。

最低限必要な行:

```json
{"type":"part","text":"よし","start_ms":420,"next_start_ms":810,"confidence_level":5,"source":"segment_1"}
```

- `text`: 認識文字列
- `start_ms`: 音声先頭からの開始ms
- `next_start_ms`: 次partの開始ms。無い場合はビルダーが次行から推定
- `confidence_level`: 任意
- `source`: 任意

## mouth.jsonl

原音PCMから10ms刻み程度で生成する。

```json
{"type":"mouth","t_ms":420,"open":0.72,"rms":0.0612,"voiced_hint":true}
```

- `t_ms`: 音声先頭からの時刻
- `open`: 0..1
- `voiced_hint`: 発声らしさ

## Build

```bash
npm run build:backup-timeline
npm run render:backup
```

ビルダーは2つのJSONLを検証し、`src/backup/generatedTimeline.ts` を生成する。
