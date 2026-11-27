import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { CATALOG_ENDPOINT, REFRESH_MS, RETRY_MS } from '../config';
import { EMBEDDED_CATALOG } from './embedded';
import { CatalogDocument, parseCatalog } from './schema';

/**
 * D'où vient le catalogue affiché.
 * - 'exemple' : le catalogue d'exemple embarqué (aucune tour de contrôle configurée).
 * - 'base'    : le catalogue publié par la tour de contrôle (`<tour>/api/catalog?v=2`).
 * - 'copie'   : la dernière version reçue, conservée sur l'appareil quand le réseau manque.
 */
export type CatalogOrigin = 'exemple' | 'base' | 'copie';
export type CatalogState = {
  doc: CatalogDocument;
  origin: CatalogOrigin;
  /** Date (ISO) de la version affichée, pour « Hors ligne · copie du … ». */
  receivedAt?: string;
};

const CACHE_KEY = 'primeur:catalogue:v2';

export const START_CATALOG: CatalogState = { doc: EMBEDDED_CATALOG, origin: 'exemple' };

/** Vrai quand une tour de contrôle est configurée (`EXPO_PUBLIC_CONTROL_TOWER_URL`). */
export const catalogConnected = () => !!CATALOG_ENDPOINT;

type Cached = { raw: unknown; receivedAt: string };

/** Dernière copie du catalogue publié conservée sur l'appareil, ou `null`. */
export async function cachedCatalog(): Promise<CatalogState | null> {
  try {
    const text = await AsyncStorage.getItem(CACHE_KEY);
    if (!text) return null;
    const cached = JSON.parse(text) as Cached;
    const doc = parseCatalog(cached.raw);
    return doc ? { doc, origin: 'copie', receivedAt: cached.receivedAt } : null;
  } catch {
    return null;
  }
}

/** Télécharge le catalogue publié. `null` : réseau indisponible ou document illisible. */
async function fetchCatalog(): Promise<{ text: string; doc: CatalogDocument } | null> {
  if (!CATALOG_ENDPOINT) return null;
  try {
    const response = await fetch(CATALOG_ENDPOINT, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const text = await response.text();
    const doc = parseCatalog(JSON.parse(text));
    return doc ? { text, doc } : null;
  } catch {
    return null;
  }
}

function keep(text: string, receivedAt: string) {
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ raw: JSON.parse(text), receivedAt })).catch(
    () => {},
  );
}

/**
 * Charge une fois le catalogue publié, avec repli sur la copie conservée. Sans tour configurée :
 * `null`, rien n'est demandé au réseau et l'application garde le catalogue d'exemple.
 */
export async function loadCatalog(): Promise<CatalogState | null> {
  if (!CATALOG_ENDPOINT) return null;
  const fresh = await fetchCatalog();
  if (fresh) {
    const receivedAt = new Date().toISOString();
    keep(fresh.text, receivedAt);
    return { doc: fresh.doc, origin: 'base', receivedAt };
  }
  return cachedCatalog();
}

/**
 * Suit le catalogue publié : lecture à l'ouverture, puis toutes les `REFRESH_MS` (45 s) et à
 * chaque retour de l'application au premier plan. `onChange` n'est appelé que si le document
 * reçu diffère du précédent (aucun rendu inutile). Réseau perdu : la version affichée reste ;
 * au démarrage sans réseau, la copie conservée sur l'appareil est montrée.
 * Renvoie la fonction d'arrêt.
 */
export function watchCatalog(onChange: (state: CatalogState) => void): () => void {
  if (!CATALOG_ENDPOINT) return () => {};
  let alive = true;
  let lastText: string | null = null;
  let triedCache = false;
  let running = false;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const refresh = async (isRetry = false) => {
    if (running || !alive) return;
    running = true;
    try {
      const fresh = await fetchCatalog();
      if (!alive) return;
      if (fresh) {
        if (fresh.text !== lastText) {
          const receivedAt = new Date().toISOString();
          lastText = fresh.text;
          keep(fresh.text, receivedAt);
          onChange({ doc: fresh.doc, origin: 'base', receivedAt });
        }
      } else {
        if (lastText === null && !triedCache) {
          triedCache = true;
          const cached = await cachedCatalog();
          if (alive && cached) onChange(cached);
        }
        // Relecture manquée : un seul nouvel essai, sans attendre le tour suivant.
        if (!isRetry && !retry && alive) {
          retry = setTimeout(() => {
            retry = null;
            refresh(true);
          }, RETRY_MS);
        }
      }
    } finally {
      running = false;
    }
  };

  refresh();
  const timer = setInterval(() => refresh(), REFRESH_MS);
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') refresh();
  });
  return () => {
    alive = false;
    clearInterval(timer);
    if (retry) clearTimeout(retry);
    sub.remove();
  };
}
