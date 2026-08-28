import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const asrDir = path.resolve(root, valueArg('asr-dir') || 'out/timed-asr');
const outputPlan = path.resolve(root, valueArg('output-plan') || 'out/auto-edit-plan.json');
const sourceLabelArg = valueArg('source-label');
const fixtureArg = valueArg('response-fixture');
const model = process.env.VTUBER_DIRECTOR_MODEL || 'gpt-5.6-sol';

const captionsPath = path.join(asrDir, 'timed-asr.json');
const metaPath = path.join(asrDir, 'timed-asr.meta.json');
if (!fs.existsSync(captionsPath) || !fs.existsSync(metaPath)) {
  throw new Error(`ASR artifacts missing in ${asrDir}. Run transcribe-source.mjs first.`);
}

const sourceCaptions = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
if (!Array.isArray(sourceCaptions) || sourceCaptions.length === 0) throw new Error('timed-asr.json is empty');
const durationMs = Math.round(Number(meta.sourceDurationSeconds) * 1000);
if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error('ASR meta has invalid source duration');

const normalizedCaptions = sourceCaptions.map((caption, index) => {
  const text = String(caption?.text || '').trim();
  const startMs = Math.max(0, Math.round(Number(caption?.startMs)));
  const endMs = Math.min(durationMs, Math.round(Number(caption?.endMs)));
  if (!text || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error(`invalid ASR caption at index ${index}`);
  }
  return {index, startMs, endMs, text};
});

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['selection', 'speakers', 'motion', 'visuals'],
  properties: {
    selection: {
      type: 'object',
      additionalProperties: false,
      required: ['startIndex', 'endIndex', 'title', 'telop', 'reason', 'hook', 'summary'],
      properties: {
        startIndex: {type: 'integer', minimum: 0},
        endIndex: {type: 'integer', minimum: 0},
        title: {type: 'string'},
        telop: {type: 'string'},
        reason: {type: 'string'},
        hook: {type: 'string'},
        summary: {type: 'string'},
      },
    },
    speakers: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'speaker', 'confidence', 'reason'],
        properties: {
          index: {type: 'integer', minimum: 0},
          speaker: {type: 'string', enum: ['HOST', 'GUEST', 'UNKNOWN']},
          confidence: {type: 'number', minimum: 0, maximum: 1},
          reason: {type: 'string'},
        },
      },
    },
    motion: {
      type: 'object',
      additionalProperties: false,
      required: ['profile', 'notes'],
      properties: {
        profile: {type: 'string', enum: ['deadpan', 'calm', 'normal', 'energetic']},
        notes: {type: 'string'},
      },
    },
    visuals: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['startIndex', 'endIndex', 'visualType', 'title', 'prompt'],
        properties: {
          startIndex: {type: 'integer', minimum: 0},
          endIndex: {type: 'integer', minimum: 0},
          visualType: {type: 'string', enum: ['concept-card', 'timeline', 'comparison', 'ui-mockup']},
          title: {type: 'string'},
          prompt: {type: 'string'},
        },
      },
    },
  },
};

const transcript = normalizedCaptions
  .map((c) => `#${c.index}\t${formatMs(c.startMs)}-${formatMs(c.endMs)}\t${c.text}`)
  .join('\n');

const instructions = `
あなたはVTuber切り抜き動画の自動監督です。
目的は、入力音声から「最後まで見られる一本」を選び、固定済みの映像テンプレートへ渡す編集判断だけを行うことです。
映像レイアウト、VRMモデル、字幕位置、配色はgolden referenceで固定済みなので変更しません。

選定規則:
- 第一候補は20〜45秒、第二候補は45〜75秒。元音声が20秒未満なら全体から成立する範囲を選ぶ。
- 原則として連続した字幕番号の範囲を1本だけ選ぶ。
- 独話として成立し、最初に引きがあり、最後にオチ・意外性・結論のどれかがある区間を優先する。
- 単なる説明、前提だけ、相槌だけ、結論のない途中切れは避ける。
- タイトルは説明文ではなく「何が異常なのか」を短く言う。日本語28文字程度を目安にする。
- telopは必要な場合のみ短い補助フック。不要なら空文字。
- 相談者や第三者の個人情報、病歴、住所推定、電話番号、メール、アカウント特定につながる内容は選ばない。
- 字幕本文や時刻は書き換えない。あなたは字幕番号だけ選ぶ。実データは後段コードがWhisper結果から固定する。

話者規則:
- 選んだ範囲の全字幕番号について、必ずspeaker判定を1件ずつ返す。
- HOSTは動画の主体である配信者本人。GUESTは相手話者。曖昧な相槌・一語・重なりはUNKNOWN。
- 判定に自信がなければUNKNOWNを使う。誤ってGUEST音声でVRMの口を動かすより安全側を選ぶ。
- 一本の動画としてHOST発話が主役になる区間を優先する。

演出規則:
- motion.profileは内容に合わせる。笑いを取りにいく話でも、淡々とした話し方ならdeadpanを選べる。
- visualは0〜2個。情報理解が本当に速くなる時だけ使う。装飾目的では使わない。
- visualは最後のオチを邪魔しない。原則として最後3〜4秒には新しい画像を出さない。
- visualTypeはconcept-card / timeline / comparison / ui-mockupから選ぶ。
- promptには、そのカードで図示すべき事実だけを書く。音声にない固有名詞や事実を創作しない。
`;

const input = `
SOURCE
label: ${sourceLabelArg || meta.sourceAudio || 'audio'}
duration_ms: ${durationMs}
caption_count: ${normalizedCaptions.length}

TIMED ASR
${transcript}
`;

let decision;
let responseMeta = {mode: 'fixture', model: null, responseId: null};
if (fixtureArg) {
  decision = JSON.parse(fs.readFileSync(path.resolve(root, fixtureArg), 'utf8'));
} else {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for automatic directing. For offline validation pass --response-fixture=<director decision JSON>.');
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: {effort: 'high'},
      instructions,
      input,
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'vtuber_director_decision',
          strict: true,
          schema: responseSchema,
        },
      },
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI director request failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  const outputText = extractOutputText(payload);
  if (!outputText) throw new Error(`Director returned no output_text: ${JSON.stringify(payload)}`);
  decision = JSON.parse(outputText);
  responseMeta = {mode: 'openai-responses', model: payload.model || model, responseId: payload.id || null};
}

const plan = buildPlan(decision);
fs.mkdirSync(path.dirname(outputPlan), {recursive: true});
fs.writeFileSync(outputPlan, JSON.stringify(plan, null, 2) + '\n');
const metaOut = outputPlan.replace(/\.json$/i, '') + '.director-meta.json';
fs.writeFileSync(metaOut, JSON.stringify({
  version: 1,
  ...responseMeta,
  asrSourceSha256: meta.sourceSha256,
  asrModel: meta.model,
  whisperCppVersion: meta.whisperCppVersion,
  selectedCaptionRange: [decision.selection.startIndex, decision.selection.endIndex],
  selectedDurationMs: plan.clip.endMs - plan.clip.startMs,
}, null, 2) + '\n');

console.log(JSON.stringify({
  ok: true,
  plan: outputPlan,
  directorMeta: metaOut,
  model: responseMeta.model,
  clip: plan.clip,
  durationMs: plan.clip.endMs - plan.clip.startMs,
  title: plan.text.title,
  captions: plan.captions.length,
  visuals: plan.visualReferences.length,
  motion: plan.motion.profile,
}, null, 2));

function buildPlan(raw) {
  const startIndex = Number(raw?.selection?.startIndex);
  const endIndex = Number(raw?.selection?.endIndex);
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) || startIndex < 0 || endIndex < startIndex || endIndex >= normalizedCaptions.length) {
    throw new Error(`director selected invalid range ${startIndex}-${endIndex}`);
  }
  const selected = normalizedCaptions.slice(startIndex, endIndex + 1);
  const clipStart = selected[0].startMs;
  const clipEnd = selected[selected.length - 1].endMs;
  const clipDuration = clipEnd - clipStart;
  const minPreferred = durationMs >= 20_000 ? 18_000 : Math.max(2_000, Math.round(durationMs * 0.45));
  if (clipDuration < minPreferred) throw new Error(`director clip too short: ${clipDuration}ms < ${minPreferred}ms`);
  if (clipDuration > 75_500) throw new Error(`director clip too long: ${clipDuration}ms`);

  const labels = new Map();
  for (const item of Array.isArray(raw.speakers) ? raw.speakers : []) {
    const index = Number(item?.index);
    if (!Number.isInteger(index) || index < startIndex || index > endIndex) throw new Error(`speaker label outside selected range: ${index}`);
    if (labels.has(index)) throw new Error(`duplicate speaker label for caption ${index}`);
    labels.set(index, item);
  }
  for (let index = startIndex; index <= endIndex; index++) {
    if (!labels.has(index)) throw new Error(`missing speaker label for selected caption ${index}`);
  }

  const captions = selected.map((caption) => {
    const label = labels.get(caption.index);
    return {
      startMs: caption.startMs,
      endMs: caption.endMs,
      speaker: label.speaker,
      text: caption.text,
      speakerConfidence: Number(label.confidence),
      speakerReason: String(label.reason || ''),
    };
  });
  if (!captions.some((caption) => caption.speaker === 'HOST')) throw new Error('director selection contains no HOST caption');

  const visualReferences = (Array.isArray(raw.visuals) ? raw.visuals : []).map((visual, index) => {
    const visualStart = Number(visual.startIndex);
    const visualEnd = Number(visual.endIndex);
    if (!Number.isInteger(visualStart) || !Number.isInteger(visualEnd) || visualStart < startIndex || visualEnd > endIndex || visualEnd < visualStart) {
      throw new Error(`visual ${index} has invalid caption range ${visualStart}-${visualEnd}`);
    }
    return {
      id: `auto-${String(index + 1).padStart(2, '0')}`,
      kind: 'generated',
      visualType: visual.visualType,
      title: String(visual.title || '').trim() || 'REFERENCE',
      prompt: String(visual.prompt || '').trim(),
      query: null,
      url: null,
      dataUrl: null,
      renderFile: null,
      creator: 'VTuber Auto Director',
      license: 'generated',
      startMs: normalizedCaptions[visualStart].startMs,
      endMs: normalizedCaptions[visualEnd].endMs,
    };
  });

  const title = String(raw?.selection?.title || '').trim();
  if (!title) throw new Error('director title is empty');

  return {
    version: 1,
    sourceLabel: sourceLabelArg || String(meta.sourceAudio || 'audio'),
    selection: {
      reason: String(raw.selection.reason || '').trim(),
      hook: String(raw.selection.hook || '').trim(),
      summary: String(raw.selection.summary || '').trim(),
    },
    clip: {startMs: clipStart, endMs: clipEnd},
    layout: {width: 1280, height: 720, captionBottomPx: 34, background: '#0b0e13'},
    text: {title, telop: String(raw.selection.telop || '').trim()},
    captions,
    visualReferences,
    motion: {
      profile: raw?.motion?.profile || 'normal',
      notes: String(raw?.motion?.notes || '').trim(),
    },
  };
}

function extractOutputText(payload) {
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    if (item?.type !== 'message') continue;
    for (const content of Array.isArray(item.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return null;
}

function formatMs(ms) {
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
