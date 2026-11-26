import { PRODUCTS, WHOLESALE_EXAMPLE } from '../data';
import type { Photo as LocalPhoto } from '../data';
import { CatalogDocument, DEFAULT_RULES, SCHEMA_VERSION } from './schema';

/**
 * Photos embarquées dans l'application, par clé. Un document publié peut y faire référence
 * (`photo: { asset: 'mangue' }`) ou fournir l'adresse d'une nouvelle image (`photo: { url }`).
 */
export const PHOTO_ASSETS: Record<string, LocalPhoto> = Object.fromEntries(
  PRODUCTS.map((p) => [p.id, p.image]),
);

/** Photos des conditionnements (formats), par clé `format:<produit>:<format>`. */
export const FORMAT_ASSETS: Record<string, LocalPhoto> = Object.fromEntries(
  PRODUCTS.flatMap((p) =>
    (p.formats ?? [])
      .filter((f) => !!f.image)
      .map((f) => [`format:${p.id}:${f.id}`, f.image] as [string, LocalPhoto]),
  ),
);

/** Photos « produit avec son emballage », par clé `preview:<produit>:<format>`. */
export const PREVIEW_ASSETS: Record<string, LocalPhoto> = Object.fromEntries(
  PRODUCTS.flatMap((p) =>
    (p.formats ?? [])
      .filter((f) => !!f.preview)
      .map((f) => [`preview:${p.id}:${f.id}`, f.preview] as [string, LocalPhoto]),
  ),
);

/** Visuels de campagne embarqués, publiables par la base de contrôle via `photo.asset`. */
export const CAMPAIGN_ASSETS: Record<string, LocalPhoto> = {
  'campaign:mangue': require('../../assets/campaigns/mangue.webp'),
  'campaign:melon': require('../../assets/campaigns/melon.webp'),
};

const offersById = new Map(WHOLESALE_EXAMPLE.map((w) => [w.id, w.offers]));

/**
 * CATALOGUE D'EXEMPLE embarqué, au format du futur logiciel de contrôle.
 *
 * Tout ce qu'il contient est une donnée d'exemple (`example: true`) : la liste des produits, les
 * prix particuliers, les offres professionnelles et leurs prix. Il sert à faire fonctionner et à
 * tester l'application en attendant le catalogue réel.
 */
export const EMBEDDED_CATALOG: CatalogDocument = {
  schema: SCHEMA_VERSION,
  updatedAt: '2026-11-22T00:00:00.000Z',
  example: true,
  rules: DEFAULT_RULES,
  /**
   * ANNONCES D'EXEMPLE, toutes non diffusées à ce jour : l'une est éteinte (`enabled:false`),
   * l'autre a une période de diffusion terminée. L'accueil n'affiche donc aucun bandeau —
   * il réapparaîtra dès que la base de contrôle publiera une annonce active.
   */
  campaigns: [
    {
      id: 'mangue',
      accent: 'du Sénégal',
      body: 'Kent et Keitt, récoltées de mai à octobre.',
      photo: { asset: 'campaign:mangue' },
      enabled: false,
    },
    {
      id: 'melon',
      accent: 'du Sénégal',
      body: 'Pleine récolte de février à mai.',
      photo: { asset: 'campaign:melon' },
      enabled: true,
      startsAt: '2026-02-01T00:00:00.000Z',
      endsAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  /**
   * Livraison GP (Europe) : RIEN de convenu à ce jour — liste vide. Quand un accord sera
   * trouvé, publier ici les pays et les modalités réelles, par exemple :
   * `{ gp: [{ country: 'FR', options: ['domicile', 'aéroport'] }] }`.
   * L'application n'affiche que les options réellement configurées.
   */
  delivery: { gp: [] },
  products: PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    variety: p.variety,
    category: p.category,
    origin: p.origin,
    description: p.description,
    photo: { asset: p.id },
    tint: p.tint,
    months: p.season,
    available: true,
    visibility: p.visibility ?? { mode: 'monde' as const, countries: [] },
    bio: p.bio,
    demo: p.demo === true,
    rating: p.rating,
    reviews: p.reviews,
    retail: {
      price: p.price,
      unit: p.unit,
      unitLabel: p.unitLabel,
      noun: p.noun,
      step: p.step,
      ...(p.min ? { min: p.min } : null),
      ...(p.max ? { max: p.max } : null),
    },
    wholesale: (offersById.get(p.id) ?? []).map((o) => ({
      mode: o.mode,
      available: true,
      prices: { EXW: o.exw, FOB: o.fob },
      priceUnit: 'kg' as const,
      ...('containerKg' in o ? { containerKg: o.containerKg } : null),
    })),
    formats: (p.formats ?? []).map((f) => ({
      id: f.id,
      label: f.label,
      detail: f.detail,
      grams: f.grams,
      price: f.price,
      noun: f.noun,
      photo: { asset: `format:${p.id}:${f.id}` },
      ...(f.preview ? { preview: { asset: `preview:${p.id}:${f.id}` } } : null),
      ...(f.description ? { description: f.description } : null),
      available: f.available !== false,
      ...(f.min ? { min: f.min } : null),
      ...(f.step ? { step: f.step } : null),
      ...(f.max ? { max: f.max } : null),
      ...(f.unitLabel ? { unitLabel: f.unitLabel } : null),
      ...(f.currency ? { currency: f.currency } : null),
      ...(f.visibility ? { visibility: f.visibility } : null),
      ...(f.settings ? { settings: f.settings } : null),
    })),
  })),
};
