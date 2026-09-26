# ritual-pv

祭祀技師・世界観解説PV向けの映像文法プリセット。

`ブイチューバーエンジン v0.2` では `film-plan.json` が実装済み。新規projectは次で作る。

```bash
node vtuber-engine/bin/vtuber-engine.mjs new <project> --template=ritual-pv
```

## 基本ルール

- 説明のための映像ではなく、問い・物質・記録から入る。
- `vrm / still / video / generated-video / typography / black` をshotとして切る。
- 変な題材を変なエフェクトで補強しない。画面そのものは真面目に作る。
- 強い文章ほど短く置く。常時テロップで埋めない。
- 黒画面と無音に近い間を編集上の有効なshotとして扱う。
- 生成素材は一度生成したら `assets/` に固定し、再レンダー時に再生成しない。
- HOST以外の音声ではVRM発話モーションを止める。

`style.json` は映像文法のプリセット記録。レンダラー側の強制設定ではなく、編集判断の規約として扱う。
