import { currencyOf, packsFor } from '../zones';
import type { Campaign, CategoryId, Photo, Product, ProductFormat } from '../data';
import { CAMPAIGN_ASSETS, FORMAT_ASSETS, PHOTO_ASSETS, PREVIEW_ASSETS } from './embedded';
import { resolveOffer, resolveFormatsForCountry, visibleIn } from './rules';
import { contentsText } from '../weight';
import { CATEGORY_LABEL, FILTERS } from '../data';
import type { FilterId } from '../data';
import type {
  CatalogCampaign,
  CatalogDocument,
  CatalogFormat,
  CatalogProduct,
  Incoterm,
  Mode,
  WholesaleOffer,
} from './schema';

/**
 * Du catalogue (données) aux produits affichés (écrans). C'est le seul endroit qui connaît les
 * deux formats : quand le catalogue change, les écrans suivent sans être modifiés.
 */

const CATEGORIES: CategoryId[] = [
  'fruits',
  'rouges',
  'agrumes',
  'exotiques',
  'legumes',
  'aromates',
  'seches',
  'transformes',
];

/** Catégorie d'un produit : celle du catalogue si elle est connue (code ou rayons publiés). */
function categoryOf(id: string, doc?: CatalogDocument): CategoryId {
  if (CATEGORIES.includes(id as CategoryId)) return id as CategoryId;
  if (doc?.categories?.some((c) => c.id === id)) return id;
  return 'fruits';
}

/**
 * Rayon de l'accueil (pastille ronde) : « Tout », « De saison », puis les rayons. `image` :
 * photo publiée par la tour (ou produit illustrant) ; absente, l'accueil garde son illustration.
 * `pro` faux : rayon masqué aux grossistes et importateurs.
 */
export type Shelf = { id: FilterId; label: string; image?: Photo; imageKey?: string; pro: boolean };

function shelfImage(photo: { url: string } | { asset: string } | null | undefined) {
  if (!photo) return {};
  if ('url' in photo) return { image: { uri: photo.url } as Photo };
  const local = PHOTO_ASSETS[photo.asset];
  return local ? { image: local, imageKey: photo.asset } : {};
}

/**
 * Rayons du catalogue publié (nom, ordre, image), sinon ceux de l'application. Les filtres
 * « Tout » et « De saison » restent en tête, avec le nom réglé dans la tour s'il y en a un.
 */
export function shelvesOf(doc: CatalogDocument): Shelf[] {
  if (!doc.categories || doc.categories.length === 0) {
    return FILTERS.map((f) => ({ id: f.id, label: f.label, pro: true }));
  }
  return [
    { id: 'tout', label: doc.filters?.all.label || 'Tout', ...shelfImage(doc.filters?.all.image), pro: true },
    {
      id: 'saison',
      label: doc.filters?.season.label || 'De saison',
      ...shelfImage(doc.filters?.season.image),
      pro: true,
    },
    ...doc.categories.map((c) => ({
      id: c.id,
      label: c.label || CATEGORY_LABEL[c.id] || c.id,
      ...shelfImage(c.image),
      pro: c.pro,
    })),
  ];
}

const FALLBACK_PHOTO: Photo = require('../../assets/decor/leaf.webp');

function photoOf(p: CatalogProduct): Photo {
  if ('url' in p.photo) return { uri: p.photo.url };
  return PHOTO_ASSETS[p.photo.asset] ?? FALLBACK_PHOTO;
}

/** Photo d'un conditionnement : embarquée, publiée, ou absente si introuvable. */
function formatPhotoOf(photo: CatalogFormat['photo']): Photo | undefined {
  if ('url' in photo) return { uri: photo.url };
  return FORMAT_ASSETS[photo.asset];
}

/** Photo « produit avec son emballage », si elle est fournie ou publiée. */
function formatPreviewOf(preview: CatalogFormat['preview']): Photo | undefined {
  if (!preview) return undefined;
  if ('url' in preview) return { uri: preview.url };
  return PREVIEW_ASSETS[preview.asset];
}

function mapFormat(f: CatalogFormat): ProductFormat {
  return {
    id: f.id,
    label: f.label,
    detail: f.detail,
    grams: f.grams,
    price: f.price,
    noun: f.noun,
    ...(f.description ? { description: f.description } : null),
    ...(f.min ? { min: f.min } : null),
    ...(f.step ? { step: f.step } : null),
    ...(f.max ? { max: f.max } : null),
    ...(f.unitLabel ? { unitLabel: f.unitLabel } : null),
    ...(f.currency ? { currency: f.currency } : null),
    ...(formatPhotoOf(f.photo) ? { image: formatPhotoOf(f.photo)! } : null),
    ...(formatPreviewOf(f.preview) ? { preview: formatPreviewOf(f.preview)! } : null),
  };
}

/**
 * Ligne commandable « produit + emballage » : le prix est celui de l'emballage (prix
 * global, jamais par kilo), la quantité est un nombre d'emballages avec ses propres
 * minimum, palier et maximum.
 */
/** « Maximum vide : aucun maximum » (tour) : une borne haute qui ne gêne aucune commande réelle. */
const PACK_NO_MAX = 9999;

function formatLine(p: Product, f: ProductFormat): Product {
  return {
    ...p,
    id: `${p.id}:${f.id}`,
    price: f.price ?? 0,
    noPrice: f.price === null,
    unit: 'unit',
    unitLabel: f.unitLabel ?? `le ${f.noun[0]}${f.grams ? ` de ${contentsText(f.grams)}` : ''}`,
    noun: f.noun,
    step: f.step ?? 1,
    min: f.min ?? 1,
    // Sans maximum réglé dans la tour : aucun maximum (jamais celui du produit au détail).
    max: f.max ?? PACK_NO_MAX,
    ...(f.currency ? { currency: f.currency } : null),
    formatId: f.id,
    formatLabel: f.label,
    formatDescription: f.description,
    formatGrams: f.grams,
    formats: undefined,
  };
}

/** Identifiant d'une ligne commandable : le produit, complété du mode s'il y en a un. */
export const lineId = (productId: string, mode: Mode | null) =>
  mode ? `${productId}:${mode}` : productId;

/** Produit d'origine d'une ligne : « mangue:avion » → « mangue ». */
export const productIdOf = (id: string) => id.split(':')[0];

/** Informations communes à tous les espaces. Le prix et l'unité viennent ensuite de l'offre. */
function base(p: CatalogProduct, doc?: CatalogDocument): Product {
  const retail = p.retail;
  return {
    id: p.id,
    name: p.name,
    variety: p.variety,
    category: categoryOf(p.category, doc),
    origin: p.origin,
    price: retail?.price ?? 0,
    unit: retail?.unit ?? 'kg',
    unitLabel: retail?.unitLabel ?? 'le kg',
    noun: retail?.noun ?? ['kg', 'kg'],
    step: retail?.step ?? 0.5,
    ...(retail?.min ? { min: retail.min } : null),
    ...(retail?.max ? { max: retail.max } : null),
    noPrice: !retail || retail.price === null,
    tint: p.tint,
    season: p.months,
    bio: p.bio,
    ...(p.demo ? { demo: true } : null),
    rating: p.rating,
    reviews: p.reviews,
    kcal: 0,
    fibres: 0,
    vitC: 0,
    description: p.description,
    tip: '',
    image: photoOf(p),
    // Emballages ACTIFS publiés pour ce produit (les désactivés ne sont jamais proposés).
    // Aucun emballage publié : le produit se vend dans son mode initial, sans section
    // d'emballage — rien n'est inventé.
    ...(() => {
      const active = p.formats.filter((f) => f.available !== false).map(mapFormat);
      return active.length > 0 ? { formats: active } : {};
    })(),
  };
}

/** Visuel d'une annonce : publié (`url`), embarqué (`asset`), ou absent. */
function campaignPhotoOf(photo: CatalogCampaign['photo']): Photo | undefined {
  if (!photo) return undefined;
  if ('url' in photo) return { uri: photo.url };
  return CAMPAIGN_ASSETS[photo.asset] ?? PHOTO_ASSETS[photo.asset] ?? FORMAT_ASSETS[photo.asset];
}

/**
 * Annonces du document de catalogue, prêtes pour l'écran d'accueil. Le filtrage par état
 * de diffusion (`enabled`, période) se fait à l'affichage : voir `campaignActive`.
 */
export function docCampaigns(doc: CatalogDocument): Campaign[] {
  return doc.campaigns.map((c) => {
    const photo = campaignPhotoOf(c.photo);
    return {
      id: c.id,
      ...(c.key ? { key: c.key } : null),
      ...(c.link ? { link: c.link } : null),
      accent: c.accent,
      body: c.body,
      ...(c.kicker ? { kicker: c.kicker } : null),
      ...(c.title ? { title: c.title } : null),
      ...(c.cta ? { cta: c.cta } : null),
      ...(photo ? { photo } : null),
      enabled: c.enabled,
      ...(c.startsAt ? { startsAt: c.startsAt } : null),
      ...(c.endsAt ? { endsAt: c.endsAt } : null),
    };
  });
}

export type Space = {
  /** Produits affichés dans le catalogue, un par produit. */
  catalog: Product[];
  /** Produits et lignes commandables, par identifiant. */
  byId: Record<string, Product>;
};

/** Tous les produits disponibles, pour les affichages qui ne dépendent pas de l'espace. */
export function allProducts(doc: CatalogDocument): Record<string, Product> {
  return Object.fromEntries(
    doc.products.filter((p) => p.available).map((p) => [p.id, base(p, doc)]),
  );
}

/**
 * Espace des particuliers : les produits qui ont un prix particulier et qui sont visibles
 * dans le pays du client (`country` null : pays encore inconnu, voir `visibleIn`).
 */
export function retailSpace(
  doc: CatalogDocument,
  country: string | null,
  zoneCountry: string | null = country,
): Space {
  const products = doc.products.filter(
    (p) =>
      p.available &&
      visibleIn(p.visibility, country) &&
      (p.b2c === 'emballe' || (p.retail && p.retail.price !== null)),
  );
  // Produit emballé : vendu uniquement par ses emballages, au prix de la zone du COMPTE du client
  // (F CFA, €, $). Seuls les emballages qui ont un prix dans cette zone, et que leur réglage de
  // pays permet, sont proposés ; le premier est celui par défaut. Sans emballage visible, le
  // produit n'est pas proposé.
  const currency = currencyOf(zoneCountry, doc.zones);
  const catalog = products.flatMap((cp): Product[] => {
    const p = base(cp, doc);
    if (cp.b2c === 'emballe') {
      const packs = packsFor(cp.formats, zoneCountry, doc.zones).map((f) =>
        mapFormat({
          ...f,
          price: f.prices?.[currency] ?? null,
          currency,
          unitLabel: `le ${f.noun[0]}${f.grams ? ` de ${contentsText(f.grams)}` : ''}`,
        }),
      );
      if (packs.length === 0) return [];
      const d = packs[0];
      // La carte du Marché garde la photo du produit nu ; prix = celui de l'emballage par défaut.
      return [
        {
          ...p,
          packed: true,
          formats: packs,
          price: d.price ?? 0,
          noPrice: d.price === null,
          currency,
          unit: 'unit',
          unitLabel: d.unitLabel ?? '',
          noun: d.noun,
          step: d.step ?? 1,
          min: d.min ?? 1,
          max: d.max ?? 9999,
        },
      ];
    }
    // Deux disponibilités distinctes : le produit d'abord (filtré ci-dessus), puis ses
    // emballages — seuls ceux actifs ET disponibles pour ce pays sont proposés.
    const resolved = resolveFormatsForCountry(cp.formats, country).map(mapFormat);
    return [resolved.length > 0 ? { ...p, formats: resolved } : { ...p, formats: undefined }];
  });
  const byId: Record<string, Product> = Object.fromEntries(catalog.map((p) => [p.id, p]));
  // Une ligne commandable distincte par emballage proposé : « produit:emballage ». Le panier
  // ne mélange jamais le produit initial et un emballage — chaque ligne a son prix et ses règles.
  catalog.forEach((p) => {
    (p.formats ?? []).forEach((f) => {
      byId[`${p.id}:${f.id}`] = formatLine(p, f);
    });
  });
  return { catalog, byId };
}

function line(
  p: CatalogProduct,
  offer: WholesaleOffer,
  doc: CatalogDocument,
  incoterm: Incoterm,
  id: string,
): Product {
  const o = resolveOffer(offer, doc.rules, incoterm);
  return {
    ...base(p, doc),
    id,
    productId: p.id,
    pro: true,
    priceTag: incoterm,
    mode: o.mode,
    unit: o.unit,
    unitLabel: o.unit === 'kg' ? 'le kg' : 'le conteneur',
    noun: o.noun,
    step: o.step,
    min: o.min,
    max: o.max,
    strictStep: o.strictStep,
    price: o.price,
    noPrice: o.noPrice,
    missing: o.missing,
    shownPrice: o.shownPrice,
    shownUnit: o.shownUnit,
    containerKg: o.containerKg,
    // Poids propre à l'offre : ce n'est pas le conteneur de référence, aucune précision affichée.
    containerLabel: offer.containerKg === undefined ? doc.rules.bateau.containerLabel : '',
  };
}

/**
 * Espace des professionnels.
 * - Grossistes et importateurs (`modes` vrai) : chaque offre avion ou bateau configurée devient
 *   une ligne commandable avec ses propres règles ; les offres sans mode gardent la règle
 *   générale.
 * - Autres professionnels : une seule ligne par produit, à la règle générale (kilos, sans mode).
 */
export function wholesaleSpace(
  doc: CatalogDocument,
  incoterm: Incoterm,
  modes: boolean,
  country: string | null,
): Space {
  const catalog: Product[] = [];
  const byId: Record<string, Product> = {};

  for (const p of doc.products) {
    if (!p.available) continue;
    // Visibilité par pays : même règle pour les grossistes et importateurs.
    if (!visibleIn(p.visibility, country)) continue;
    const offers = p.wholesale.filter((o) => o.available);
    if (offers.length === 0) continue;

    if (!modes) {
      // Règle générale : au kilo, d'après la première offre chiffrée au kilo.
      const source = offers.find((o) => o.priceUnit === 'kg' && o.prices[incoterm]) ?? offers[0];
      const only = line(
        p,
        {
          mode: null,
          available: true,
          prices: source.prices,
          priceUnit: source.priceUnit,
          // Offre sans mode : ses propres minimum, palier et maximum (réglés dans la tour).
          ...(source.mode == null ? { minQty: source.minQty, stepQty: source.stepQty, maxQty: source.maxQty } : null),
        },
        doc,
        incoterm,
        p.id,
      );
      catalog.push(only);
      byId[p.id] = only;
      continue;
    }

    // Une ligne par mode (la première offre de chaque mode est retenue).
    const seen = new Set<string>();
    const lines = offers
      .filter((o) => !seen.has(String(o.mode)) && !!seen.add(String(o.mode)))
      .map((o) => line(p, o, doc, incoterm, lineId(p.id, o.mode)));

    if (lines.length === 1 && lines[0].mode == null) {
      catalog.push(lines[0]);
      byId[p.id] = lines[0];
      continue;
    }
    // Produit à offres : la carte du catalogue présente la première, la fiche les propose toutes.
    const card: Product = { ...lines[0], id: p.id, offers: lines };
    catalog.push(card);
    byId[p.id] = card;
    lines.forEach((l) => {
      byId[l.id] = l;
    });
  }
  return { catalog, byId };
}
