export const PREVIEW_TIMEOUT_MS = 2000;

export async function fetchTrackPreview(input, fetchImpl = fetch) {
  const url = new URL(input);
  const host = url.hostname.toLowerCase();
  let endpoint;
  if (['youtube.com', 'www.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    endpoint = new URL('https://www.youtube.com/oembed');
  } else if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) {
    endpoint = new URL('https://soundcloud.com/oembed');
  } else {
    return null;
  }
  endpoint.searchParams.set('url', url.href);
  endpoint.searchParams.set('format', 'json');
  try {
    const response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS) });
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data.title !== 'string' || !data.title || typeof data.thumbnail_url !== 'string') return null;
    const thumbnail = new URL(data.thumbnail_url);
    if (!['https:', 'http:'].includes(thumbnail.protocol)) return null;
    return { title: data.title, thumbnail: thumbnail.href, url: url.href };
  } catch {
    return null;
  }
}
