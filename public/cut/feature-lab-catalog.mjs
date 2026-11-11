/* Visible inventory of research features. Statuses distinguish shipping from ideas. */
export const FEATURE_LAB_CATALOG=Object.freeze([
  {
    "id": "beat",
    "title": "ビート同期カット",
    "category": "音と時間",
    "status": "active",
    "description": "音楽の音量変化から拍候補を検出。確認後に分割。",
    "implementation": "Web Audio RMS / onset",
    "action": "beat"
  },
  {
    "id": "silence",
    "title": "無音・間の検出",
    "category": "音と時間",
    "status": "active",
    "description": "音声の静かな区間を可視化する。",
    "implementation": "Web Audio RMS",
    "action": "silence"
  },
  {
    "id": "scenes",
    "title": "シーン切替検出",
    "category": "音と時間",
    "status": "active",
    "description": "サムネイル画像の差分で場面転換の候補を抽出。",
    "implementation": "Canvas / pixel difference",
    "action": "scenes"
  },
  {
    "id": "transcript",
    "title": "字幕・文字起こし編集",
    "category": "音と時間",
    "status": "partial",
    "description": "SRT/VTT/Whisper JSONを読んで全文検索・ジャンプ・字幕配置。文言削除と映像カットの完全同期は未対応。",
    "implementation": "SRT/Whisper cue parser",
    "action": "transcript"
  },
  {
    "id": "natural",
    "title": "自然言語編集マクロ",
    "category": "音と時間",
    "status": "partial",
    "description": "日本語の限定文型から分割・速度・文字・移動を実行。自由文AIではない。",
    "implementation": "deterministic parser",
    "action": "command"
  },
  {
    "id": "speedramp",
    "title": "速度ランプと音程維持",
    "category": "音と時間",
    "status": "backend",
    "description": "区間内速度曲線と音程維持を統合。",
    "implementation": "WebCodecs/WSOLA",
    "action": ""
  },
  {
    "id": "gpu",
    "title": "リアルタイムGPU VFX",
    "category": "映像と色",
    "status": "partial",
    "description": "既存の重ねがけフィルタ・Canvas映像効果へ移動。WebGPU専用レンダラーは未接続。",
    "implementation": "Canvas2D/WebGL / planned WebGPU",
    "action": "fx"
  },
  {
    "id": "hsl",
    "title": "HSL色域マスク",
    "category": "映像と色",
    "status": "backend",
    "description": "タップした色だけ変色する色域マスク。",
    "implementation": "pixel color selection / shader",
    "action": ""
  },
  {
    "id": "chroma",
    "title": "クロマキー・背景色除去",
    "category": "映像と色",
    "status": "partial",
    "description": "既存のクロマキー合成パネルを使用。高度なエッジ洗浄は未実装。",
    "implementation": "Canvas compositing",
    "action": "chroma"
  },
  {
    "id": "reframe",
    "title": "被写体追尾オートリフレーム",
    "category": "映像と色",
    "status": "backend",
    "description": "縦横比を変えても主役を中央に追跡。",
    "implementation": "object detection / motion smoothing",
    "action": ""
  },
  {
    "id": "caption-motion",
    "title": "字幕モーション",
    "category": "文字と合成",
    "status": "partial",
    "description": "既存の文字アニメーションを使用。単語単位自動アニメは未対応。",
    "implementation": "Canvas title renderer",
    "action": "caption"
  },
  {
    "id": "parallax",
    "title": "疑似3Dパララックス",
    "category": "3D・深度",
    "status": "backend",
    "description": "深度マップから静止画を立体的に揺らす。",
    "implementation": "depth estimate / warping",
    "action": ""
  },
  {
    "id": "proxy",
    "title": "オフライン・プロキシ編集",
    "category": "基盤",
    "status": "backend",
    "description": "高解像度を軽量データに置換し、書出し時は原本を使用。",
    "implementation": "WebCodecs / OPFS",
    "action": ""
  },
  {
    "id": "branches",
    "title": "編集履歴の分岐",
    "category": "基盤",
    "status": "backend",
    "description": "A/B/C編集案を独立保存して切り替える。",
    "implementation": "immutable command log",
    "action": ""
  },
  {
    "id": "rotoscope",
    "title": "ワンタップAIロトスコープ",
    "category": "AI・被写体",
    "status": "backend",
    "description": "選択した人物・物体の輪郭を時間を通して追跡。",
    "implementation": "SAM 2 / native or cloud inference",
    "action": ""
  },
  {
    "id": "object-fx",
    "title": "被写体連動VFX",
    "category": "AI・被写体",
    "status": "backend",
    "description": "人物だけネオン、文字の前後関係、物体追従など。",
    "implementation": "segmentation masks / effect graph",
    "action": ""
  },
  {
    "id": "object-remove",
    "title": "AIオブジェクト除去",
    "category": "生成AI",
    "status": "backend",
    "description": "動画内の対象を消し、背景を時系列補完。",
    "implementation": "video inpainting API",
    "action": ""
  },
  {
    "id": "background",
    "title": "背景交換・再照明",
    "category": "生成AI",
    "status": "backend",
    "description": "人物を残して背景と光だけ変更。",
    "implementation": "segmentation / relighting API",
    "action": ""
  },
  {
    "id": "outpaint",
    "title": "映像・画像アウトペイント",
    "category": "生成AI",
    "status": "backend",
    "description": "元映像の外側を生成して構図を拡張。",
    "implementation": "outpainting API",
    "action": ""
  },
  {
    "id": "extend",
    "title": "生成フレーム延長",
    "category": "生成AI",
    "status": "backend",
    "description": "足りない前後フレームを生成。",
    "implementation": "generative video API",
    "action": ""
  },
  {
    "id": "restyle",
    "title": "動画スタイル変換",
    "category": "生成AI",
    "status": "backend",
    "description": "動画全体をアニメ・夢・古いフィルム風に変換。",
    "implementation": "video-to-video API",
    "action": ""
  },
  {
    "id": "depth",
    "title": "3D深度マップ編集",
    "category": "3D・深度",
    "status": "backend",
    "description": "前景・中景・背景を分けて編集。",
    "implementation": "Depth Anything / model",
    "action": ""
  },
  {
    "id": "refocus",
    "title": "AI後処理フォーカス",
    "category": "3D・深度",
    "status": "backend",
    "description": "焦点位置とボケ深度を撮影後に変更。",
    "implementation": "depth map / bokeh renderer",
    "action": ""
  },
  {
    "id": "optical",
    "title": "光学フロー補間",
    "category": "3D・深度",
    "status": "backend",
    "description": "高品質な超スロー再生と速度補間。",
    "implementation": "RAFT / native GPU",
    "action": ""
  },
  {
    "id": "stems",
    "title": "音声4ステム分離",
    "category": "音と時間",
    "status": "backend",
    "description": "会話・音楽・環境・効果音を分解。",
    "implementation": "Demucs / MDX",
    "action": ""
  },
  {
    "id": "speech",
    "title": "声の強調・残響除去",
    "category": "音と時間",
    "status": "backend",
    "description": "スマホ音声からノイズや反響を抑える。",
    "implementation": "denoise / dereverb model",
    "action": ""
  },
  {
    "id": "sound-design",
    "title": "自動サウンドデザイン",
    "category": "生成AI",
    "status": "backend",
    "description": "映像を認識して足音・環境音などを提案。",
    "implementation": "video understanding / audio generation",
    "action": ""
  },
  {
    "id": "music",
    "title": "生成音楽・映像同期",
    "category": "生成AI",
    "status": "backend",
    "description": "尺・BPM・雰囲気指定で音楽を生成。",
    "implementation": "licensed music generation API",
    "action": ""
  },
  {
    "id": "semantic",
    "title": "意味で素材検索",
    "category": "AI・被写体",
    "status": "backend",
    "description": "夕日・赤い車など自然言語でローカル素材検索。",
    "implementation": "CLIP/SigLIP embeddings",
    "action": ""
  },
  {
    "id": "director",
    "title": "AI自動編集監督",
    "category": "生成AI",
    "status": "backend",
    "description": "プロンプトから編集案を複数生成。差分確認後のみ適用。",
    "implementation": "LLM / analysis / edit DSL",
    "action": ""
  },
  {
    "id": "spacetime",
    "title": "時空間オブジェクト編集",
    "category": "未来研究",
    "status": "research",
    "description": "登場人物ごとに独立した物理・時間・演出を保持。",
    "implementation": "SAM 2 + effect graph",
    "action": ""
  },
  {
    "id": "3d-recon",
    "title": "動画から自由視点3D再構築",
    "category": "未来研究",
    "status": "research",
    "description": "通常の撮影動画を仮想カメラで移動できる3D空間へ。",
    "implementation": "3DGS / NeRF",
    "action": ""
  },
  {
    "id": "world-text",
    "title": "深度連動・世界固定字幕",
    "category": "未来研究",
    "status": "research",
    "description": "被写体の後ろに隠れ、壁に貼り付く文字。",
    "implementation": "depth + camera pose",
    "action": ""
  },
  {
    "id": "time-brush",
    "title": "時間ワープブラシ",
    "category": "未来研究",
    "status": "research",
    "description": "画面の場所ごとに異なる時間を合成。",
    "implementation": "optical flow / temporal resampling",
    "action": ""
  },
  {
    "id": "semantic-physics",
    "title": "意味・物理ルールVFX",
    "category": "未来研究",
    "status": "research",
    "description": "物体に重力・磁場・風などの属性を追加。",
    "implementation": "object+material detection / sim",
    "action": ""
  },
  {
    "id": "weather",
    "title": "領域別天候・季節変換",
    "category": "未来研究",
    "status": "research",
    "description": "人物はそのままで背景だけ雪景色にする。",
    "implementation": "video generation + masking",
    "action": ""
  },
  {
    "id": "causal",
    "title": "因果イベント編集",
    "category": "未来研究",
    "status": "research",
    "description": "振り向いたら暗転など出来事をトリガーにする。",
    "implementation": "event detection / rule engine",
    "action": ""
  },
  {
    "id": "preference",
    "title": "個人の編集意図学習",
    "category": "未来研究",
    "status": "research",
    "description": "過去のカットから編集癖を学んで提案。",
    "implementation": "local preference model",
    "action": ""
  },
  {
    "id": "provenance",
    "title": "生成映像の真正性記録",
    "category": "未来研究",
    "status": "research",
    "description": "どの区間がAI生成か記録・可視化する。",
    "implementation": "C2PA / provenance graph",
    "action": ""
  },
  {
    "id": "tracking",
    "title": "ポイントトラッキング",
    "category": "映像と色",
    "status": "partial",
    "description": "既存の指定点追跡パネルに移動。対象の自動意味認識は未対応。",
    "implementation": "local point tracker",
    "action": "tracking"
  },
  {
    "id": "3d",
    "title": "3D CGシーン",
    "category": "3D・深度",
    "status": "partial",
    "description": "OBJベースの3D CG編集を開く。自由視点映像再構築とは別。",
    "implementation": "WebGL OBJ rendering",
    "action": "3d"
  },
  {
    "id": "stock",
    "title": "無料素材・権利管理",
    "category": "基盤",
    "status": "partial",
    "description": "Openverse/Commons等の検索、権利情報保存を開く。",
    "implementation": "public APIs / rights metadata",
    "action": "stock"
  }
]);
export const FEATURE_STATUS_LABEL=Object.freeze({active:'利用可能',partial:'一部利用可能',backend:'接続・実装待ち',research:'研究段階'});
export function featureSummary(list=FEATURE_LAB_CATALOG){return list.reduce((x,f)=>(x[f.status]=(x[f.status]||0)+1,x),{active:0,partial:0,backend:0,research:0});}
