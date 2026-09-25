const OPENVERSE_ENDPOINT = 'https://api.openverse.org/v1/images/';

export const searchReferenceImages = async (query, {pageSize = 12} = {}) => {
  const q = String(query || '').trim();
  if (!q) return [];

  const url = new URL(OPENVERSE_ENDPOINT);
  url.searchParams.set('q', q);
  url.searchParams.set('page_size', String(Math.max(1, Math.min(20, pageSize))));

  const response = await fetch(url, {
    headers: {'accept': 'application/json'},
  });
  if (!response.ok) throw new Error(`Reference search failed (${response.status})`);

  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];

  return results.map((item) => ({
    id: String(item.id || crypto.randomUUID()),
    kind: 'search',
    title: item.title || '',
    url: item.url || null,
    thumbnailUrl: item.thumbnail || null,
    sourceUrl: item.foreign_landing_url || null,
    creator: item.creator || null,
    license: item.license || null,
    provider: item.provider || null,
  }));
};
