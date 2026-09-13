# Fly Brain BTC/JPY PAPER experiment

This branch is an isolated research branch. It does not change the public site and is not intended to merge into `main` until explicitly approved.

## What is being tested

Use the public MIT-licensed `Lulzx/fly-brain` project as a second decision system beside Qwen. The upstream project simulates the male Drosophila CNS with 165,122 neurons and about 10.5 million connections, plus embodied sensory and motor loops.

Upstream is pinned to:

- repository: `https://github.com/Lulzx/fly-brain`
- commit: `7cd56e16b782a584f26ff3a9f63151c63d4db31b`
- code license: MIT

This experiment does **not** claim the fly connectome was trained for markets. It treats it as an embodied nonlinear transducer and measures whether its action bias contains any useful signal after a fixed, documented market-to-stimulus mapping.

## Market mapping

Past 20 x 5-minute BTC/JPY candles become one stimulus condition for the fly:

- large recent volatility -> `threat`
- sufficiently positive recent return -> `nearodor`
- sufficiently negative recent return -> `onheat`
- otherwise -> `default`

The fly is simulated headlessly for 0.6 s with flyvis disabled to keep the experiment tractable on GitHub Actions. Descending-neuron motor output is reduced to two spot-market states only:

- approach / forward bias -> `BTC`
- escape / backing / insufficient approach -> `CASH`

The decision is then applied to the **next** 20 candles, so the experiment does not use future candles to choose the action.

## Comparison

Starting capital is JPY 1,000. Results compare:

- Fly Brain
- Cash
- BTC Buy & Hold

The script fetches public GMO Coin BTC 5-minute KLines and the current public taker fee when available. No API key, private endpoint, or real order is used.

Outputs are uploaded as the `fly-brain-btc-paper` workflow artifact:

- `summary.md`
- `result.json`

The first goal is not profit. The first goal is to learn whether a whole-connectome embodied controller behaves differently enough from Qwen and simple baselines to justify a more direct sensory encoding later.
