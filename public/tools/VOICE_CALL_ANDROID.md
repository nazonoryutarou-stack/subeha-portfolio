# AndroidのLINE通話で動くリアルタイム・ボイスチェンジャー：実装調査

対象：Android 16系スマートフォン、LINE等の第三者通話アプリへ加工済みマイク音声を入力する構想。

## 結論
**通常のAndroidアプリやブラウザアプリ単独で、LINEのマイク入力を任意の仮想音声へ差し替える標準APIはない。** 別アプリで録音・再生するだけではLINE通話には乗らない。動作しない「LINE対応」アプリを作って完成と呼ばない。

根拠：
- Android公式： [音声入力の共有優先順位](https://developer.android.com/media/platform/sharing-audio-input)
- Android公式： [AudioManager の音声デバイス制御](https://developer.android.com/reference/android/media/AudioManager)
- Android Issue Tracker： [通話の入力マイクと出力デバイスの独立選択に関する制限](https://issuetracker.google.com/issues/562108909)

## 現実的な経路

### A. USB Audio Class対応の外部ハードウェア
通話機器の接続端子から**加工済み音声を本物のマイク入力として認識させる**方式。DSP内蔵ボイスチェンジャー、USB audio interface、TRRS変換の互換性を確認する。端末・LINEの音声ルーティングによっては使えない場合もあるので、機材は実機確認前に購入しない。

### B. Root + Zygisk / LSPosed の第三者アプリ音声キャプチャ処理
特殊なコード注入方式なら通話アプリのAudioRecord経路に介入できる可能性がある。例： [Echidna](https://github.com/supermarsx/echidna) はRoot前提の実験的研究用実装。しかし同プロジェクト自身が物理端末・音声ルート・SELinux・LSPosedの検証不足を記しており、**この端末やLINEに対応したと確認できたわけではない**。ブートローダ解除はデータ初期化やセキュリティ低下を伴う場合がある。現時点でユーザー端末には導入しない。

### C. Windows PC上の仮想マイク
PC版の通話アプリが仮想マイクを選択できる場合は比較的現実的。ただし「スマホ単体にインストールする」という希望とは異なる。

## まず必要な検証
- 接続するUSB Audio Classマイクが端末の通話音声入力として選択されるか。
- LINEのマイクテストで、その入力が使われるか。
- 加工前の生音声と加工後の音声が二重に送出されないか。
- 通話中の遅延、エコー、音声途切れが許容範囲か。

**現状**：LINE通話中の実働するボイスチェンジャー本体は未実装。上記方式の実機検証なしに動作保証しない。
