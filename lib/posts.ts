import { POSTS_ENDPOINT } from './config';

/**
 * Publications photo de l'équipe, visibles dans Favoris › Découvrir › Photos : une à dix photos que
 * l'on fait défiler de côté, avec une description dessous. Seule l'équipe publie, depuis la tour
 * de contrôle. Comme les vidéos, elles ne mènent à aucun produit : on les regarde, on les aime,
 * on les commente.
 */
export type PostImage = { url: string; width: number; height: number };

export type PhotoPost = {
  id: string;
  images: PostImage[];
  description: string;
  /** Date de publication, au format AAAA-MM-JJ. */
  publishedAt: string;
  audience: 'tous' | 'particulier' | 'pro';
};

/** Publications visibles pour un type de compte, de la plus récente à la plus ancienne. */
export function postsFor(list: PhotoPost[], pro: boolean) {
  const mine = pro ? 'pro' : 'particulier';
  return list
    .filter((p) => p.audience === 'tous' || p.audience === mine)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Publications photo de l'équipe ; `null` si la tour n'est pas joignable (on garde les précédentes). */
export async function fetchPhotoPosts(): Promise<PhotoPost[] | null> {
  if (!POSTS_ENDPOINT) return null;
  try {
    const response = await fetch(POSTS_ENDPOINT);
    if (!response.ok) return null;
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) return null;
    return raw.flatMap((item): PhotoPost[] => {
      const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const images = (Array.isArray(o.images) ? o.images : []).flatMap((i): PostImage[] => {
        const img = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
        const size = (v: unknown) => (typeof v === 'number' && v > 0 ? v : 0);
        return typeof img.url === 'string' && /^https:\/\//.test(img.url)
          ? [{ url: img.url, width: size(img.width), height: size(img.height) }]
          : [];
      });
      if (typeof o.id !== 'string' || images.length === 0) return [];
      return [
        {
          id: o.id,
          images: images.slice(0, 10),
          description: typeof o.description === 'string' ? o.description : '',
          publishedAt: typeof o.publishedAt === 'string' ? o.publishedAt.slice(0, 10) : '',
          audience: o.audience === 'pro' || o.audience === 'particulier' ? o.audience : 'tous',
        },
      ];
    });
  } catch {
    return null;
  }
}
