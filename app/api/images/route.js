import { config } from '../../../src/server/config.js';

export const dynamic = 'force-dynamic';

// Recherche de photos libres de droits sur Unsplash (facultatif : nécessite UNSPLASH_ACCESS_KEY)
export async function GET(req) {
  const { unsplashKey } = config();
  if (!unsplashKey) return Response.json({ images: [] });
  const q = new URL(req.url).searchParams.get('q')?.slice(0, 120) || '';
  if (!q.trim()) return Response.json({ images: [] });
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape&content_filter=high`, {
      headers: { Authorization: `Client-ID ${unsplashKey}`, 'Accept-Version': 'v1' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return Response.json({ images: [] });
    const json = await res.json();
    const images = (json.results || []).map((r) => ({
      url: `${r.urls.raw}&w=1600&q=80&fm=jpg&fit=max`,
      thumb: `${r.urls.raw}&w=640&q=70&fm=jpg&fit=max`,
      alt: r.alt_description || '',
      author: r.user?.name || '',
      link: r.user?.links?.html || '',
      source: 'unsplash',
    }));
    return Response.json({ images });
  } catch {
    return Response.json({ images: [] });
  }
}
