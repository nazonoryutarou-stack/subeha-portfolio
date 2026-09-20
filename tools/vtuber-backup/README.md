# VTuber Backup tools

無料・端末内完結を優先する予備VTuber経路。

現在の字幕タイミング本命は **whisper.cpp token timing**。
Android SpeechRecognizer / APK / ADB 経路は実験停止。アーカイブ正本用の歴史的 whisper.cpp v1.5.5 は変更しない。

## 1. Termuxでtoken timing

```bash
bash tools/vtuber-backup/run-whisper-token-termux.sh ~/storage/downloads/配信165.m4a
```

出力:
`~/storage/downloads/SubehaWhisperToken/word-timing.jsonl`

固定条件:
- latest whisper.cpp を端末上でビルド
- model: small-q5_1
- language: ja
- full JSON (`-ojf`) のtoken offsets
- processors=1
- VAD OFF
- DTW OFF（まず基準測定）

## 2. Remotion入力を準備

```bash
bash tools/vtuber-backup/prepare-termux.sh \
  ~/storage/downloads/配信165.m4a \
  ~/storage/downloads/SubehaWhisperToken/word-timing.jsonl \
  ~/subeha-portfolio
```

処理:
1. 原音を16kHz mono PCM16LEへ変換
2. 10ms口開閉curve生成
3. token timingをRemotion入力へ配置
4. voice.m4a配置
5. timeline TypeScript生成

その後:

```bash
cd ~/subeha-portfolio/remotion/vrm-lipsync
npm run render:backup
```

相談音声・JSONL・PCMはcommitしない。


## 3. 表示字幕は timing と分離

口パク・viseme は `word-timing.jsonl` を使う。
画面に見せる字幕は、clean transcript を matching timed clock に載せた
`display-captions.jsonl` を使う。

形式:

```json
{"type":"caption","start_ms":13000,"end_ms":18000,"text":"よし、じゃあ始まったということにしましょう。"}
```

準備:

```bash
bash tools/vtuber-backup/prepare-termux.sh \
  ~/storage/downloads/配信165.m4a \
  ~/storage/downloads/SubehaWhisperToken/word-timing.jsonl \
  ~/subeha-portfolio \
  ~/storage/downloads/display-captions.jsonl
```

production rule:
- timed/raw text = internal clock / lip-sync source
- clean text = display subtitle
- clean がある回で raw ASR をそのまま字幕に出さない
- 字幕は golden UI の固定下部カード以外に焼かない
- landscape avatar は右側、両腕が見える距離を維持する
