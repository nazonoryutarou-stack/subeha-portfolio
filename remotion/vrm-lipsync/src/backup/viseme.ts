export type Viseme = 'aa' | 'ih' | 'ou' | 'ee' | 'oh';

const rows: Array<[string, Viseme]> = [
  ['あかさたなはまやらわがざだばぱぁゃゎアカサタナハマヤラワガザダバパァャヮ', 'aa'],
  ['いきしちにひみりぎじぢびぴぃイキシチニヒミリギジヂビピィ', 'ih'],
  ['うくすつぬふむゆるぐずづぶぷぅゅウクスツヌフムユルグズヅブプゥュヴ', 'ou'],
  ['えけせてねへめれげぜでべぺぇエケセテネヘメレゲゼデベペェ', 'ee'],
  ['おこそとのほもよろをごぞどぼぽぉょオコソトノホモヨロヲゴゾドボポォョ', 'oh'],
];

const table = new Map<string, Viseme>();
for (const [chars, viseme] of rows) for (const ch of Array.from(chars)) table.set(ch, viseme);

export const charToViseme = (ch: string): Viseme | null => table.get(ch) ?? null;

export const visemeForTimedText = (text: string, progress: number): Viseme | null => {
  const chars = Array.from(text).filter((ch) => !/\s|[、。！？!?.,]/u.test(ch));
  if (!chars.length) return null;
  const index = Math.min(chars.length - 1, Math.max(0, Math.floor(progress * chars.length)));
  for (let i = index; i >= 0; i--) {
    const v = charToViseme(chars[i]);
    if (v) return v;
  }
  for (let i = index + 1; i < chars.length; i++) {
    const v = charToViseme(chars[i]);
    if (v) return v;
  }
  return null;
};
