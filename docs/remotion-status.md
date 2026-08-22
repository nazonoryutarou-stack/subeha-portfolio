# Remotion / VRM 実装状況

最終更新: 2026-08-22

## 先に読むもの

1. `docs/production-rules.md`
2. この文書
3. Webアプリ開発時は `docs/video-app-architecture.md`

## 現在の正しい実装場所

高品質レンダーの本命は `remotion/vrm-lipsync/`。

現行の中核:

- `src/VrmLipSyncV2.tsx`
- `src/Root.tsx`
- `scripts/prepare-clip.mjs`
- `scripts/transcribe-source.mjs`
- `scripts/generate-envelope.mjs`
- `scripts/extract-qc-frames.mjs`
- `speaker-turns.example.json`

## 現在までに解決したこと

### Tポーズ / 非同期読み込み

現行 `VrmLipSyncV2.tsx` は自然姿勢補正を行い、VRM / envelope / clip の読み込みに `delayRender / continueRender` を使う。

### 音声と字幕の0秒基準

```text
元音声
→ atrim=start=...:end=...
→ asetpts=PTS-STARTPTS
→ PCM WAV (public/voice.wav)
```

このWAVを字幕・話者分離・口パクの共通ソースとする。

### 口パク

`aa / ih / ou / ee / oh` を使用する。

動画用モデルは `Subeha.vrm`。`subeha-web-site.vrm` は動画口パクに使わない。

### 話者ゲート

2026-08-22に、音声全体のRMSだけで口を動かしていた問題を修正中。

`generate-envelope.mjs` は `speaker-turns.json` の `avatarSpeaker` 区間だけを通す。

本番コマンドは `REQUIRE_SPEAKER_TURNS=1` とし、話者区間なしで完成レンダーを作らない。

話者区間は音声SHA-256と音声長へ結び付ける。

## QC

Remotion側は以下を担当する。

- TypeScript check
- 決定論的レンダー
- QCフレーム抽出
- ffprobeベースの動画構造検査
- 最終目視QC

## 今日からの位置付け

Remotionは制作UIそのものではない。

日常の制作入口は `tools/vrm-talker/` のWebアプリへ移す。

```text
Webアプリ
  音声入力
  字幕
  話者分離
  参考画像
  レイアウト
  プレビュー
       ↓ project.json
Remotion
  高品質レンダー
  再現レンダー
  最終QC
```

## 未完成

- Webアプリから使える話者分離処理
- Webアプリから使えるtimed ASR
- 参考画像検索
- 画像生成
- WebアプリとRemotionで共用するproject JSON schema
- 第158回素材で、客発話中に口が閉じることを確認した最終レンダー

未確認項目を完成扱いしない。
