/**
 * Format du catalogue — la source de données commune aux deux applications (particuliers et
 * professionnels) et au futur logiciel de contrôle sur ordinateur.
 *
 * Un seul document décrit les produits, leurs photos, leurs descriptions, leur disponibilité,
 * leurs prix, leurs unités et leurs offres. Il ne contient que des données simples (texte,
 * nombres, listes) : il peut donc être enregistré tel quel dans une base, envoyé par un serveur
 * ou modifié dans un tableur, sans toucher aux écrans.
 *
 * Aujourd'hui, l'application lit un document d'exemple embarqué (voir `embedded.ts`). Le logiciel
 * de contrôle n'existe pas encore : quand il publiera un document à ce format, les écrans
 * suivront sans modification (voir `source.ts`).
 */
export const SCHEMA_VERSION = 1;
/**
 * Versions lues : 1 (catalogue embarqué) et 2 (catalogue publié par la tour de contrôle,
 * `GET <tour>/api/catalog?v=2` — mêmes types, plus les clés facultatives `categories`,
 * `filters`, `payments`, `productRequest` et les prix par pays `countryPrices`).
 */
export const SUPPORTED_SCHEMAS = [1, 2] as const;
export type SchemaVersion = (typeof SUPPORTED_SCHEMAS)[number];

export type Mode = 'avion' | 'bateau';
export type Incoterm = 'EXW' | 'FOB';
/** Unité sur laquelle porte un prix de gros. */
export type PriceUnit = 'kg' | 'conteneur';

/** Photo d'un produit : image embarquée dans l'application, ou adresse d'une image publiée. */
export type Photo = { asset: string } | { url: string };

/**
 * Réglage propre à un ou plusieurs pays pour un emballage : disponibilité, prix, devise,
 * photo. Indépendants les uns des autres : un pays peut avoir sa photo et garder le prix
 * d'origine, ou l'inverse. Aucune conversion n'est calculée : seul ce qui est configuré
 * s'applique. Le dernier réglage applicable (dans l'ordre publié) l'emporte.
 */
export type FormatCountrySetting = {
  /** 'pays' : uniquement `countries`. 'monde_sauf' : tous sauf `countries`. 'monde' : tous. */
  mode: 'pays' | 'monde' | 'monde_sauf';
  countries: string[];
  /** Faux : emballage indisponible dans ces pays (même si le produit y est visible). */
  available?: boolean;
  /** Prix propre ; `undefined` : prix d'origine ; `null` : prix à compléter. */
  price?: number | null;
  /** Devise du prix propre (ISO 4217, ex. 'XOF') ; défaut : EUR. */
  currency?: string;
  /** Photo propre à ces pays ; absente : photo d'origine. */
  photo?: Photo;
  preview?: Photo;
};

/**
 * Emballage proposé aux particuliers : sachet, pot, carton…
 * `price` nul : prix pas encore fixé — les écrans l'indiquent et ne calculent aucun total.
 */
export type CatalogFormat = {
  id: string;
  label: string;
  detail: string;
  /** Contenu d'un emballage, en grammes, s'il est connu. */
  grams: number | null;
  /** PRIX GLOBAL par emballage (jamais par kilo) ; nul tant qu'il n'est pas fixé. */
  price: number | null;
  noun: [string, string];
  photo: Photo;
  /** Faux : emballage désactivé par l'équipe — l'application ne le propose pas. */
  available: boolean;
  /** Photo du produit avec cet emballage (aperçu haut de fiche) ; absente : à publier. */
  preview?: Photo;
  /** Description propre à cet emballage, affichée quand il est choisi. */
  description?: string;
  /** Nombre d'emballages : minimum (défaut 1), palier (défaut 1), maximum éventuel. */
  min?: number;
  step?: number;
  max?: number;
  /** Conservé pour compatibilité ; un emballage se commande toujours à l'unité. */
  unit?: 'kg' | 'unit';
  /** Libellé d'unité tel quel, s'il diffère de celui déduit du conditionnement. */
  unitLabel?: string;
  /** Devise du prix d'origine (ISO 4217) ; défaut : EUR. */
  currency?: string;
  /** Pays où cet emballage est proposé ; défaut : monde entier. */
  visibility?: Visibility;
  /** Réglages propres à certains pays (dispo, prix, devise, photo). */
  settings?: FormatCountrySetting[];
  /** Particuliers, produit emballé : prix de l'emballage entier par devise (null = non vendu dans cette zone). */
  prices?: { XOF: number | null; EUR: number | null; USD: number | null };
  /** Pays : toutes les zones avec un prix, seulement ces pays, ou sauf ces pays. */
  countries?: { mode: 'zone' | 'pays' | 'sauf'; list: string[] };
  /** Emballage sélectionné à l'ouverture de la fiche. */
  isDefault?: boolean;
};

/** Offre aux particuliers (B2C). `null` sur un produit : il n'est pas vendu aux particuliers. */
export type RetailOffer = {
  /** Prix particulier en euros ; `null` s'il n'est pas fixé (le produit n'est alors pas proposé). */
  price: number | null;
  /** 'kg' : vendu au poids. 'unit' : vendu à la pièce, à la botte, à la barquette… */
  unit: 'kg' | 'unit';
  /** Libellé de l'unité : « le kg », « la pièce », « la barquette de 250 g »… */
  unitLabel: string;
  /** Nom de l'unité au singulier et au pluriel : ['pièce', 'pièces']. */
  noun: [string, string];
  /** Palier de quantité (0,5 kg, 1 pièce…). */
  step: number;
  min?: number;
  max?: number;
  /**
   * Prix propres à certains pays (publiés par la tour) : un pays n'apparaît que dans un groupe.
   * Les autres pays gardent `price`. Appliqués par `forCountry`.
   */
  countryPrices?: CountryPrice[];
};

/** Prix particulier propre à un groupe de pays. */
export type CountryPrice = { countries: string[]; price: number };
/** Prix professionnels propres à un groupe de pays ; un incoterm `null` garde le prix global. */
export type OfferCountryPrice = { countries: string[]; prices: Record<Incoterm, number | null> };

/** Offre aux professionnels (B2B). Un produit peut en avoir zéro, une ou plusieurs. */export type WholesaleOffer = {
  /** Mode de transport de l'offre ; `null` pour une offre sans distinction avion / bateau. */
  mode: Mode | null;
  /** `false` : l'offre existe mais n'est pas commandable pour le moment. */
  available: boolean;
  /** Prix en euros par incoterm ; `null` tant que le prix n'est pas communiqué. Pas de CIF. */
  prices: Record<Incoterm, number | null>;
  /** Unité du prix : au kilo, ou au conteneur (bateau uniquement). */
  priceUnit: PriceUnit;
  /** Règles propres à cette offre. Absentes : celles du catalogue (`rules`) s'appliquent. */
  minQty?: number;
  stepQty?: number;
  maxQty?: number;
  /**
   * Bateau : kilos par conteneur pour cette offre. Absent : la référence du catalogue
   * s'applique. `null` : poids non défini (seul le nombre de conteneurs est alors affiché).
   */
  containerKg?: number | null;
  /** Prix propres à certains pays (publiés par la tour), appliqués par `forCountry`. */
  countryPrices?: OfferCountryPrice[];
};

/**
 * Visibilité d'un produit par pays, réglée par l'équipe :
 * - 'pays'        : visible uniquement dans `countries` (ex. Sénégal seul) ;
 * - 'monde'       : visible partout (défaut) ;
 * - 'monde_sauf'  : visible partout sauf dans `countries`.
 */
export type VisibilityMode = 'pays' | 'monde' | 'monde_sauf';
export type Visibility = { mode: VisibilityMode; countries: string[] };

/**
 * Livraison GP (Europe) : les pays et les modalités RÉELLEMENT convenues avec les GP.
 * Liste vide tant que rien n'est arrêté : l'application ne présente alors aucune option
 * GP comme disponible, et n'invente ni tarif ni délai.
 */
export type GpDelivery = { country: string; options: ('domicile' | 'aéroport')[] };
export type DeliveryConfig = { gp: GpDelivery[] };

/** Règles de quantité des professionnels, modifiables sans refaire les écrans. */
export type QuantityRules = {
  /** Offres sans mode de transport (et profil « autre professionnel »). */
  standard: { minKg: number; stepKg: number; maxKg: number };
  /** Avion : minimum et paliers en kilos. */
  avion: { minKg: number; stepKg: number; maxKg: number };
  /** Bateau : en conteneurs entiers ; `containerKg` est le poids de référence d'un conteneur. */
  bateau: {
    minContainers: number;
    stepContainers: number;
    maxContainers: number;
    containerKg: number | null;
    /** Précision affichée à côté du poids de référence : « Europe ». */
    containerLabel: string;
  };
};

export type CatalogProduct = {
  id: string;
  name: string;
  variety: string;
  category: string;
  origin: string;
  description: string;
  photo: Photo;
  /** Couleur d'ambiance de la fiche, au format #RRGGBB. */
  tint: string;
  /** Mois de disponibilité (1 = janvier … 12 = décembre). */
  months: number[];
  /** `false` : le produit est masqué partout, sans être supprimé. */
  available: boolean;
  /** Pays où le produit est visible ; défaut : monde entier. */
  visibility: Visibility;
  bio: boolean;
  /** Note et nombre d'avis affichés aux particuliers (0 avis : rien n'est affiché). */
  rating: number;
  reviews: number;
  /** Vrai : ligne de démonstration, à remplacer par les données réelles. */
  demo: boolean;
  /** Particuliers : 'emballe' = vendu uniquement par ses emballages, prix par zone. */
  b2c?: 'emballe' | 'frais';
  retail: RetailOffer | null;
  wholesale: WholesaleOffer[];
  /** Conditionnements proposés aux particuliers ; liste vide : aucun. */
  formats: CatalogFormat[];
};

/**
 * Annonce / publication de l'écran d'accueil, gérée par l'équipe : affichée seulement si
 * `enabled` est vrai et si la date courante est dans la fenêtre `startsAt`…`endsAt`.
 * `id` désigne le produit concerné (le bandeau ouvre sa fiche) ; `null` pour une image seule.
 * `link` : ce que fait un toucher sur une annonce illustrée — `button` (bouton sous le texte),
 * `tap` (toute l'image ouvre la fiche, sans bouton), `none` (image seule, aucun produit).
 */
export type CampaignLink = 'button' | 'tap' | 'none';
export type CatalogCampaign = {
  id: string | null;
  key?: string;
  link?: CampaignLink;
  accent: string;
  body: string;
  kicker?: string;
  title?: string;
  cta?: string;
  photo?: Photo;
  enabled: boolean;
  /** Début et fin de diffusion, au format ISO ; absents : pas de borne. */
  startsAt?: string;
  endsAt?: string;
};

/** Rayon publié par la tour : nom, ordre, image ; `pro` faux : masqué aux grossistes et importateurs. */
export type CatalogCategory = { id: string; label: string; order: number; image: Photo | null; pro: boolean };
/** Filtres « Tout » et « De saison » : nom et image réglés par l'équipe. */
export type CatalogFilter = { label: string; image: Photo | null };
export type CatalogFilters = { all: CatalogFilter; season: CatalogFilter };
/** Moyen de paiement proposé aux particuliers. Aucun n'est encaissé par l'application. */
export type CatalogPayment = { id: string; title: string; detail: string; icon: string; enabled: boolean };
/** Message « Produit introuvable » réglé dans la tour ; `enabled` faux : rien n'est proposé. */
export type ProductRequestMessage = {
  enabled: boolean;
  title: string;
  body: string;
  placeholder: string;
  button: string;
  thanks: string;
};

export type CatalogDocument = {
  schema: SchemaVersion;
  /** Date de dernière mise à jour, au format ISO. */
  updatedAt: string;
  /** `true` : données d'exemple, à remplacer par le catalogue réel. */
  example: boolean;
  rules: QuantityRules;
  products: CatalogProduct[];
  /** Annonces de l'accueil, publiées par l'équipe ; vide : aucun bandeau. */
  campaigns: CatalogCampaign[];
  /** Livraison GP : pays et modalités réellement convenus ; vide : rien de configuré. */
  delivery: DeliveryConfig;
  /** Rayons publiés (schema 2) ; absents : rayons de l'application (`lib/data.ts`). */
  categories?: CatalogCategory[];
  /** Filtres publiés (schema 2) ; absents : « Tout » et « De saison » de l'application. */
  filters?: CatalogFilters;
  /** Moyens de paiement publiés (schema 2) ; absents : ceux de l'application. */
  payments?: CatalogPayment[];
  /** Message « Produit introuvable » (schema 2) ; absent : rien n'est proposé. */
  productRequest?: ProductRequestMessage | null;
  /** Forfaits de transport par zone de destination et par devise de client ; absents : barème de l'application. */
  transport?: Readonly<Record<string, { XOF: number | null; EUR: number | null; USD: number | null }>>;
  /** Pays du franc CFA et de l'euro (le reste : dollar), publiés par la tour. */
  zones?: { XOF: string[]; EUR: string[] };
};

/** Valeurs de départ des règles (demandées pour les grossistes et importateurs). */
export const DEFAULT_RULES: QuantityRules = {
  standard: { minKg: 500, stepKg: 100, maxKg: 100000 },
  avion: { minKg: 500, stepKg: 500, maxKg: 100000 },
  bateau: {
    minContainers: 1,
    stepContainers: 1,
    maxContainers: 99,
    containerKg: 22000,
    containerLabel: 'Europe',
  },
};

// ───────────── Lecture d'un document reçu

const text = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const positive = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
const numberOr = (v: unknown, fallback: number) => positive(v) ?? fallback;

function parseRules(raw: unknown): QuantityRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as {
    standard?: Record<string, unknown>;
    avion?: Record<string, unknown>;
    bateau?: Record<string, unknown>;
  };
  const d = DEFAULT_RULES;
  const kg = (src: Record<string, unknown> | undefined, base: QuantityRules['avion']) => ({
    minKg: numberOr(src?.minKg, base.minKg),
    stepKg: numberOr(src?.stepKg, base.stepKg),
    maxKg: numberOr(src?.maxKg, base.maxKg),
  });
  return {
    standard: kg(r.standard, d.standard),
    avion: kg(r.avion, d.avion),
    bateau: {
      minContainers: Math.round(numberOr(r.bateau?.minContainers, d.bateau.minContainers)),
      stepContainers: Math.round(numberOr(r.bateau?.stepContainers, d.bateau.stepContainers)),
      maxContainers: Math.round(numberOr(r.bateau?.maxContainers, d.bateau.maxContainers)),
      containerKg:
        r.bateau && 'containerKg' in r.bateau
          ? positive(r.bateau.containerKg)
          : d.bateau.containerKg,
      containerLabel: text(r.bateau?.containerLabel, d.bateau.containerLabel),
    },
  };
}

/** Liste de codes pays ISO à deux lettres, en majuscules, sans doublon. */
function countryList(raw: unknown): string[] {
  const list = (Array.isArray(raw) ? raw : [])
    .map((c) => (typeof c === 'string' ? c.trim().toUpperCase() : ''))
    .filter((c) => /^[A-Z]{2}$/.test(c));
  return [...new Set(list)];
}

function parseWholesale(raw: unknown): WholesaleOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  // Mode inconnu : l'offre est écartée plutôt que d'être prise pour une offre sans mode.
  if (o.mode != null && o.mode !== 'avion' && o.mode !== 'bateau') return null;
  const mode = o.mode === 'avion' || o.mode === 'bateau' ? o.mode : null;
  const prices = (o.prices && typeof o.prices === 'object' ? o.prices : {}) as Record<
    string,
    unknown
  >;
  const offer: WholesaleOffer = {
    mode,
    available: o.available !== false,
    prices: { EXW: positive(prices.EXW), FOB: positive(prices.FOB) },
    // Un prix au conteneur n'a de sens que par bateau.
    priceUnit: o.priceUnit === 'conteneur' && mode === 'bateau' ? 'conteneur' : 'kg',
  };
  const min = positive(o.minQty);
  const step = positive(o.stepQty);
  const max = positive(o.maxQty);
  if (min) offer.minQty = min;
  if (step) offer.stepQty = step;
  if (max) offer.maxQty = max;
  if ('containerKg' in o) offer.containerKg = positive(o.containerKg);
  const byCountry = (Array.isArray(o.countryPrices) ? o.countryPrices : [])
    .map((g) => {
      const r = (g && typeof g === 'object' ? g : {}) as Record<string, unknown>;
      const pr = (r.prices && typeof r.prices === 'object' ? r.prices : {}) as Record<string, unknown>;
      return {
        countries: countryList(r.countries),
        prices: { EXW: positive(pr.EXW), FOB: positive(pr.FOB) },
      };
    })
    .filter((g) => g.countries.length > 0 && (g.prices.EXW !== null || g.prices.FOB !== null));
  if (byCountry.length > 0) offer.countryPrices = byCountry;
  return offer;
}

function parseRetail(raw: unknown): RetailOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const noun = Array.isArray(o.noun) && o.noun.length === 2 ? o.noun.map((n) => text(n)) : null;
  const unit = o.unit === 'unit' ? 'unit' : 'kg';
  const offer: RetailOffer = {
    price: positive(o.price),
    unit,
    unitLabel: text(o.unitLabel, unit === 'kg' ? 'le kg' : 'la pièce'),
    noun: noun ? [noun[0], noun[1]] : unit === 'kg' ? ['kg', 'kg'] : ['pièce', 'pièces'],
    step: numberOr(o.step, unit === 'kg' ? 0.5 : 1),
  };
  const min = positive(o.min);
  const max = positive(o.max);
  if (min) offer.min = min;
  if (max) offer.max = max;
  const byCountry = (Array.isArray(o.countryPrices) ? o.countryPrices : [])
    .map((g) => {
      const r = (g && typeof g === 'object' ? g : {}) as Record<string, unknown>;
      return { countries: countryList(r.countries), price: positive(r.price) };
    })
    .filter((g): g is CountryPrice => g.countries.length > 0 && g.price !== null);
  if (byCountry.length > 0) offer.countryPrices = byCountry;
  return offer;
}

function parseFormat(raw: unknown): CatalogFormat | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = text(o.id);
  const label = text(o.label);
  if (!id || !label) return null;
  const noun =
    Array.isArray(o.noun) && o.noun.length === 2 ? o.noun.map((n) => text(n)) : null;
  const photo = (o.photo && typeof o.photo === 'object' ? o.photo : {}) as Record<string, unknown>;
  const step = positive(o.step);
  const unitLabel = text(o.unitLabel);
  const description = text(o.description);
  const min = positive(o.min);
  const max = positive(o.max);
  const currency =
    typeof o.currency === 'string' && /^[A-Z]{3}$/.test(o.currency.trim().toUpperCase())
      ? o.currency.trim().toUpperCase()
      : undefined;
  const settings = (Array.isArray(o.settings) ? o.settings : [])
    .map(parseFormatSetting)
    .filter((s): s is FormatCountrySetting => !!s);
  const preview = (o.preview && typeof o.preview === 'object' ? o.preview : {}) as Record<
    string,
    unknown
  >;
  const previewPhoto: Photo | null =
    typeof preview.url === 'string' && preview.url
      ? { url: preview.url }
      : typeof preview.asset === 'string' && preview.asset
        ? { asset: preview.asset }
        : null;
  return {
    id,
    label,
    detail: text(o.detail),
    grams: positive(o.grams),
    // Prix absent ou invalide : nul, donc « à compléter » — aucun montant n'est inventé.
    price: positive(o.price),
    noun: noun && noun[0] && noun[1] ? [noun[0], noun[1]] : ['format', 'formats'],
    photo:
      typeof photo.url === 'string' && photo.url
        ? { url: photo.url }
        : { asset: text(photo.asset, id) },
    available: o.available !== false,
    ...(o.unit === 'kg' || o.unit === 'unit' ? { unit: o.unit } : null),
    ...(description ? { description } : null),
    ...(min ? { min } : null),
    ...(step ? { step } : null),
    ...(max ? { max } : null),
    ...(unitLabel ? { unitLabel } : null),
    ...(previewPhoto ? { preview: previewPhoto } : null),
    ...(o.prices && typeof o.prices === 'object'
      ? (() => {
          const pr = o.prices as Record<string, unknown>;
          return { prices: { XOF: positive(pr.XOF), EUR: positive(pr.EUR), USD: positive(pr.USD) } };
        })()
      : null),
    ...(o.countries && typeof o.countries === 'object'
      ? (() => {
          const c = o.countries as Record<string, unknown>;
          const mode = c.mode === 'pays' || c.mode === 'sauf' ? c.mode : 'zone';
          const list = (Array.isArray(c.list) ? c.list : [])
            .map((x) => (typeof x === 'string' ? x.trim().toUpperCase() : ''))
            .filter((x) => /^[A-Z]{2}$/.test(x));
          return { countries: { mode, list } };
        })()
      : null),
    ...(o.isDefault === true ? { isDefault: true } : null),
    ...(currency ? { currency } : null),
    ...(o.visibility ? { visibility: parseVisibility(o.visibility) } : null),
    ...(settings.length > 0 ? { settings } : null),
  };
}

function parseFormatSetting(raw: unknown): FormatCountrySetting | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const mode: FormatCountrySetting['mode'] =
    o.mode === 'pays' || o.mode === 'monde_sauf' ? o.mode : 'monde';
  const countries = (Array.isArray(o.countries) ? o.countries : [])
    .map((c) => (typeof c === 'string' ? c.trim().toUpperCase() : ''))
    .filter((c) => /^[A-Z]{2}$/.test(c));
  if (mode !== 'monde' && countries.length === 0) return null;
  const setting: FormatCountrySetting = { mode, countries };
  if (o.available === false) setting.available = false;
  // Prix propre : présent (nombre > 0, ou null = à compléter) ou absent (prix d'origine).
  if ('price' in o) setting.price = positive(o.price);
  if (typeof o.currency === 'string' && /^[A-Z]{3}$/.test(o.currency.trim().toUpperCase())) {
    setting.currency = o.currency.trim().toUpperCase();
  }
  const photo = (o.photo && typeof o.photo === 'object' ? o.photo : null) as Record<
    string,
    unknown
  > | null;
  if (photo) {
    if (typeof photo.url === 'string' && photo.url) setting.photo = { url: photo.url };
    else if (typeof photo.asset === 'string' && photo.asset)
      setting.photo = { asset: photo.asset } as Photo;
  }
  const preview = (o.preview && typeof o.preview === 'object' ? o.preview : null) as Record<
    string,
    unknown
  > | null;
  if (preview) {
    if (typeof preview.url === 'string' && preview.url) setting.preview = { url: preview.url };
    else if (typeof preview.asset === 'string' && preview.asset)
      setting.preview = { asset: preview.asset } as Photo;
  }
  return setting;
}

function parseVisibility(raw: unknown): Visibility {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const mode: VisibilityMode =
    v.mode === 'pays' || v.mode === 'monde_sauf' ? v.mode : 'monde';
  const countries = (Array.isArray(v.countries) ? v.countries : [])
    .map((c) => (typeof c === 'string' ? c.trim().toUpperCase() : ''))
    .filter((c) => /^[A-Z]{2}$/.test(c));
  return { mode, countries };
}

function parseDelivery(raw: unknown): DeliveryConfig {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const gp = (Array.isArray(d.gp) ? d.gp : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const country = typeof o.country === 'string' ? o.country.trim().toUpperCase() : '';
      if (!/^[A-Z]{2}$/.test(country)) return null;
      const options = (Array.isArray(o.options) ? o.options : []).filter(
        (x): x is 'domicile' | 'aéroport' => x === 'domicile' || x === 'aéroport',
      );
      return options.length > 0 ? { country, options } : null;
    })
    .filter((x): x is GpDelivery => !!x);
  return { gp };
}

function parseCampaign(raw: unknown): CatalogCampaign | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = text(o.id) || null;
  const link: CampaignLink | undefined =
    o.link === 'button' || o.link === 'tap' || o.link === 'none' ? o.link : undefined;
  const photo = (o.photo && typeof o.photo === 'object' ? o.photo : null) as Record<
    string,
    unknown
  > | null;
  const parsedPhoto: Photo | null = !photo
    ? null
    : typeof photo.url === 'string' && photo.url
      ? { url: photo.url }
      : typeof photo.asset === 'string' && photo.asset
        ? { asset: photo.asset }
        : null;
  // Sans produit, seule une image sans lien a un sens.
  if (!id && !(parsedPhoto && link === 'none')) return null;
  const key = text(o.key);
  const kicker = text(o.kicker);
  const title = text(o.title);
  const cta = text(o.cta);
  const startsAt = text(o.startsAt);
  const endsAt = text(o.endsAt);
  return {
    id,
    ...(key ? { key } : null),
    ...(link ? { link } : null),
    accent: text(o.accent),
    body: text(o.body),
    ...(kicker ? { kicker } : null),
    ...(title ? { title } : null),
    ...(cta ? { cta } : null),
    ...(parsedPhoto ? { photo: parsedPhoto } : null),
    // Une annonce publiée est diffusée sauf si l'équipe l'a éteinte.
    enabled: o.enabled !== false,
    ...(startsAt ? { startsAt } : null),
    ...(endsAt ? { endsAt } : null),
  };
}

function parseProduct(raw: unknown): CatalogProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id || p.id.includes(':') || typeof p.name !== 'string') {
    return null;
  }
  const photo = (p.photo && typeof p.photo === 'object' ? p.photo : {}) as Record<string, unknown>;
  const months = (Array.isArray(p.months) ? p.months : []).filter(
    (m): m is number => typeof m === 'number' && m >= 1 && m <= 12,
  );
  return {
    id: p.id,
    name: p.name,
    variety: text(p.variety),
    category: text(p.category, 'fruits'),
    origin: text(p.origin),
    description: text(p.description),
    photo:
      typeof photo.url === 'string' && photo.url
        ? { url: photo.url }
        : { asset: text(photo.asset, p.id) },
    tint: /^#[0-9a-fA-F]{6}$/.test(text(p.tint)) ? text(p.tint) : '#7AAA2C',
    months: months.length > 0 ? months : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    available: p.available !== false,
    visibility: parseVisibility(p.visibility),
    bio: p.bio === true,
    demo: p.demo === true,
    ...(p.b2c === 'emballe' ? { b2c: 'emballe' as const } : null),
    rating: typeof p.rating === 'number' ? p.rating : 0,
    reviews: typeof p.reviews === 'number' ? p.reviews : 0,
    retail: parseRetail(p.retail),
    wholesale: (Array.isArray(p.wholesale) ? p.wholesale : [])
      .map(parseWholesale)
      .filter((o): o is WholesaleOffer => !!o),
    formats: (Array.isArray(p.formats) ? p.formats : [])
      .map(parseFormat)
      .filter((f): f is CatalogFormat => !!f),
  };
}

/**
 * Vérifie et normalise un document reçu de l'extérieur. Renvoie `null` s'il n'est pas à ce
 * format : l'application garde alors le catalogue qu'elle avait.
 */
export function parseCatalog(raw: unknown): CatalogDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (!SUPPORTED_SCHEMAS.includes(d.schema as SchemaVersion) || !Array.isArray(d.products)) {
    return null;
  }
  const seen = new Set<string>();
  const products = d.products
    .map(parseProduct)
    .filter((p): p is CatalogProduct => !!p && !seen.has(p.id) && !!seen.add(p.id));
  if (products.length === 0) return null;
  const categories = parseCategories(d.categories);
  const filters = parseFilters(d.filters);
  const payments = parsePayments(d.payments);
  const productRequest = parseProductRequest(d.productRequest);
  const transport = parseTransport(d.transport);
  const zonesRaw = d.zones && typeof d.zones === 'object' ? (d.zones as Record<string, unknown>) : null;
  const codes = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[A-Z]{2}$/.test(x)) : []);
  const zones = zonesRaw && codes(zonesRaw.XOF).length > 0 ? { XOF: codes(zonesRaw.XOF), EUR: codes(zonesRaw.EUR) } : undefined;
  return {
    schema: d.schema as SchemaVersion,
    updatedAt: text(d.updatedAt, new Date().toISOString()),
    example: d.example === true,
    rules: parseRules(d.rules),
    products,
    campaigns: (Array.isArray(d.campaigns) ? d.campaigns : [])
      .map(parseCampaign)
      .filter((c): c is CatalogCampaign => !!c),
    delivery: parseDelivery(d.delivery),
    ...(categories ? { categories } : null),
    ...(filters ? { filters } : null),
    ...(payments ? { payments } : null),
    ...(productRequest !== undefined ? { productRequest } : null),
    ...(transport ? { transport } : null),
    ...(zones ? { zones } : null),
  };
}

/**
 * Forfaits de transport par zone de destination : un montant par devise de client (F CFA, €, $),
 * `null` = tarif à confirmer. Anciennes formes reprises : `currency: 'EUR'` (montant en euros),
 * `'XOF+EUR'` (montant et devise par zone).
 */
function parseTransport(
  raw: unknown,
): Readonly<Record<string, { XOF: number | null; EUR: number | null; USD: number | null }>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (!['EUR', 'XOF+EUR', 'ZONES'].includes(String(o.currency)) || !Array.isArray(o.zones)) return undefined;
  const MAX: Record<string, number> = { EUR: 10000, USD: 10000, XOF: 10000000 };
  const ok = (v: unknown, c: string) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX[c] ? Math.round(v * 100) / 100 : null);
  const out: Record<string, { XOF: number | null; EUR: number | null; USD: number | null }> = {};
  for (const item of o.zones) {
    if (!item || typeof item !== 'object') continue;
    const z = item as Record<string, unknown>;
    if (typeof z.id !== 'string') continue;
    const fees = { XOF: null as number | null, EUR: null as number | null, USD: null as number | null };
    if (z.fees && typeof z.fees === 'object') {
      const f = z.fees as Record<string, unknown>;
      fees.XOF = ok(f.XOF, 'XOF');
      fees.EUR = ok(f.EUR, 'EUR');
      fees.USD = ok(f.USD, 'USD');
    } else {
      const cur = z.currency === 'XOF' ? 'XOF' : 'EUR';
      fees[cur] = ok(z.fee, cur);
    }
    if (fees.XOF !== null || fees.EUR !== null || fees.USD !== null) out[z.id] = fees;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parsePhoto(raw: unknown): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.url === 'string' && o.url) return { url: o.url };
  if (typeof o.asset === 'string' && o.asset) return { asset: o.asset };
  return null;
}

function parseCategories(raw: unknown): CatalogCategory[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const list = raw
    .map((item, i): CatalogCategory | null => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const id = text(o.id);
      const label = text(o.label);
      if (!id || !label || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        label,
        order: typeof o.order === 'number' && Number.isFinite(o.order) ? o.order : i,
        image: parsePhoto(o.image),
        pro: o.pro !== false,
      };
    })
    .filter((c): c is CatalogCategory => !!c)
    .sort((a, b) => a.order - b.order);
  return list.length > 0 ? list : undefined;
}

function parseFilters(raw: unknown): CatalogFilters | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const one = (v: unknown, fallback: string): CatalogFilter => {
    const f = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    return { label: text(f.label) || fallback, image: parsePhoto(f.image) };
  };
  return { all: one(o.all, 'Tout'), season: one(o.season, 'De saison') };
}

function parsePayments(raw: unknown): CatalogPayment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map((item): CatalogPayment | null => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const id = text(o.id);
      const title = text(o.title) || text(o.label);
      if (!id || !title) return null;
      return {
        id,
        title,
        detail: text(o.detail),
        icon: text(o.icon, 'card-outline'),
        enabled: o.enabled !== false,
      };
    })
    .filter((p): p is CatalogPayment => !!p && p.enabled);
  return list.length > 0 ? list : undefined;
}

function parseProductRequest(raw: unknown): ProductRequestMessage | null | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    title: text(o.title),
    body: text(o.body),
    placeholder: text(o.placeholder),
    button: text(o.button),
    thanks: text(o.thanks),
  };
}

// ───────────── Prix par pays

function groupFor<T extends { countries: string[] }>(list: T[] | undefined, country: string | null) {
  return country ? ((list ?? []).find((g) => g.countries.includes(country)) ?? null) : null;
}

/**
 * Le catalogue tel que le voit un client de ce pays : chaque prix particulier et professionnel
 * est remplacé par celui de son pays s'il en a un (`countryPrices`), sinon le prix global est
 * gardé. Pays inconnu : prix globaux. Aucun prix n'est inventé ni converti. Renvoie le même
 * document s'il n'y a rien à changer.
 */
export function forCountry(doc: CatalogDocument, country: string | null): CatalogDocument {
  const code = country ? country.toUpperCase() : null;
  if (!code) return doc;
  let changed = false;
  const products = doc.products.map((p) => {
    const own = groupFor(p.retail?.countryPrices, code);
    const offers = p.wholesale.map((o) => {
      const g = groupFor(o.countryPrices, code);
      if (!g) return o;
      return { ...o, prices: { EXW: g.prices.EXW ?? o.prices.EXW, FOB: g.prices.FOB ?? o.prices.FOB } };
    });
    const offersChanged = offers.some((o, i) => o !== p.wholesale[i]);
    if (!own && !offersChanged) return p;
    changed = true;
    return {
      ...p,
      ...(own && p.retail ? { retail: { ...p.retail, price: own.price } } : null),
      ...(offersChanged ? { wholesale: offers } : null),
    };
  });
  return changed ? { ...doc, products } : doc;
}
