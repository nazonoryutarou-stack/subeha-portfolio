export const createTimelineVisualReference = ({
  item,
  startMs,
  endMs,
  query = null,
  prompt = null,
} = {}) => {
  if (!item) throw new Error('画像素材がありません。');
  const start = Number(startMs);
  const end = Number(endMs);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    throw new Error('画像素材のタイムライン区間が不正です。');
  }

  return {
    // id は「この配置」固有。同じ画像assetを複数区間へ置いても衝突しない。
    id: crypto.randomUUID(),
    assetId: item.assetId || item.id || null,
    kind: item.kind || 'search',
    provider: item.provider || null,
    startMs: Math.round(start),
    endMs: Math.round(end),
    query: query ?? item.query ?? null,
    prompt: prompt ?? item.prompt ?? null,
    url: item.url || item.imageUrl || null,
    thumbnailUrl: item.thumbnailUrl || item.url || item.imageUrl || null,
    originalUrl: item.originalUrl || null,
    sourceUrl: item.sourceUrl || null,
    creator: item.creator || null,
    license: item.license || null,
    title: item.title || null,
  };
};
