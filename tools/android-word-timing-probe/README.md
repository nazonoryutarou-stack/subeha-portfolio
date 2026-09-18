# Subeha Word Timing Probe

Vチューバーエンジン（予備）の字幕時刻採取器。

Android 14+ の標準 `SpeechRecognizer` に録音済みPCMをpipeで渡し、`RecognitionPart` の開始時刻をJSONLへ保存する。

## Build on Nothing Phone / Termux

```bash
cd ~/subeha-portfolio/tools/android-word-timing-probe
bash build-termux.sh
```

生成:
`~/storage/downloads/SubehaWordTimingProbe.apk`

## Input

16kHz / mono / PCM16LE。

例:

```bash
ffmpeg -i 配信165.m4a -vn -ac 1 -ar 16000 -f s16le 165-first60s.pcm
```

## Run

1. APKをインストール
2. PCMを選択
3. まず **ON-DEVICE**
4. timed partが返らない場合のみ **SYSTEM**
5. `Download/SubehaWordTiming/` のJSONLを回収

成功例:

```json
{"type":"part","text":"よし","start_ms":420,"next_start_ms":810,"confidence_level":5,"source":"segment_1"}
```

## Feed backup engine

```bash
bash ~/subeha-portfolio/tools/vtuber-backup/prepare-termux.sh \
  ~/storage/downloads/配信165.m4a \
  ~/storage/downloads/SubehaWordTiming/subeha-word-timing-XXXXXXXX.jsonl \
  ~/subeha-portfolio
```

その後:

```bash
cd ~/subeha-portfolio/remotion/vrm-lipsync
npm run render:backup
```

## Privacy

相談音声・PCM・word timing JSONLはrepoへcommitしない。
SYSTEM認識は端末実装によってネットワークを使う可能性があるので、まず相談を含まない短い冒頭区間だけで検証する。
