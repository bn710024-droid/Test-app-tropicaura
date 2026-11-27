import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import {
  Shelf,
  Space,
  allProducts,
  docCampaigns,
  retailSpace,
  shelvesOf,
  wholesaleSpace,
} from './catalog/build';
import { forCountry } from './catalog/schema';
import type { CatalogDocument, ProductRequestMessage, QuantityRules } from './catalog/schema';
import {
  CatalogOrigin,
  START_CATALOG,
  cachedCatalog,
  catalogConnected,
  watchCatalog,
} from './catalog/source';
import { countryName, isCountry, transportFee } from './countries';
import { PAYMENTS } from './data';
import type { Campaign, Product } from './data';
import { coordsIfAllowed, deviceCountry } from './locate';
import {
  contentsText,
  euro,
  formatAddress,
  kgEquivalent,
  maxQty,
  minQty,
  money,
  qtyLabel,
  round2,
} from './format';
import { isEmail, normEmail, phoneDigits, tidyPhone } from './identity';
import {
  TrackNotice,
  Tracked,
  TransmitResult,
  buildMissingPayload,
  buildOrderPayload,
  buildRequestPayload,
  fetchTracking,
  sendPosition,
  transmit,
} from './transmission';
import { REFRESH_MS, RETRY_MS, TEAM_ENDPOINT } from './config';
import {
  DEMO_VIDEOS,
  TeamVideo,
  fetchTeamVideos,
  reportComment,
  reportLike,
  reportView,
  sendReactions,
  videosFor,
} from './videos';

// ───────────── Stockage
// Tout est enregistré sur l'appareil (pas de serveur) : la liste des comptes et la session
// d'un côté, les données de chaque compte de l'autre.
const AUTH_KEY = 'primeur:auth:v1';
const dataKey = (accountId: string) => `primeur:data:v1:${accountId}`;
/** Données d'avant la création des comptes : reprises par le premier compte créé. */
const LEGACY_KEY = 'primeur:v1';

export type TabId = 'home' | 'favorites' | 'cart' | 'requests' | 'orders' | 'profile';

// ───────────── Comptes
export type AccountType = 'particulier' | 'pro';
export type Activity = 'grossiste' | 'importateur' | 'autre';

export type Account = {
  id: string;
  type: AccountType;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  company: string;
  activity: Activity | null;
  /** Pays du client (ISO 3166-1), obligatoire à l'inscription : pilote les offres et la
   * visibilité des produits. Vide pour les comptes créés avant ce champ. */
  country: string;
  createdAt: number;
};

export type NewAccount = Omit<Account, 'id' | 'createdAt'>;

type Auth = { accounts: Account[]; sessionId: string | null };

export const ACTIVITY_LABEL: Record<Activity, string> = {
  grossiste: 'Grossiste',
  importateur: 'Importateur',
  autre: 'Autre professionnel',
};

// ───────────── Commandes
export type Address = {
  id: string;
  /** Nom du destinataire. */
  name: string;
  line: string;
  line2: string;
  postal: string;
  city: string;
  region: string;
  /** Code ISO 3166-1 à deux lettres. */
  country: string;
};

export type NewAddress = Omit<Address, 'id'>;

/** Où écrire au client : confirmation, validation, suivi. */
export type Contact = { email: string; phone: string };

export type OrderLine = {
  id: string;
  qty: number;
  /** Prix d'une unité commandée au moment de la commande (0 si `priced` est faux). */
  price: number;
  /** Emballage choisi au moment de la commande (« Sachet », « Pot »). */
  format?: string;
  /** Quantité en clair, figée à la commande : « 2 pots (10 kg) », « 500 g ». */
  qtyText?: string;
  // ── Demandes professionnelles : ce qui a été demandé, figé au moment de l'envoi.
  name?: string;
  mode?: 'avion' | 'bateau' | null;
  /** Unité de `qty` : kilos, ou conteneurs. */
  unit?: 'kg' | 'conteneur';
  /** Équivalent en kilos, quand il est connu. */
  kg?: number | null;
  /** Faux : le prix n'était pas défini, la ligne n'entre pas dans l'estimation. */
  priced?: boolean;
};

export type StatusId = 'attente' | 'confirmee' | 'preparation' | 'expediee' | 'livree' | 'annulee';

const FLOW: StatusId[] = ['attente', 'confirmee', 'preparation', 'expediee', 'livree'];

/**
 * Position partagée par le client POUR LE LIVREUR (Sénégal), après son accord explicite.
 * Elle est enregistrée avec la commande ; sa transmission à l'équipe puis au livreur
 * n'est pas encore connectée (aucun serveur) — c'est un point restant.
 */
export type OrderLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  at: number;
};

/** Commande d'un particulier, payée à la confirmation. */
export type Order = {
  id: string;
  number: string;
  createdAt: number;
  lines: OrderLine[];
  subtotal: number;
  /** Vrai : nous expédions. Faux : le client organise lui-même son transport. */
  transport: boolean;
  transportCost: number;
  total: number;
  recipient: string;
  address: string;
  country: string;
  email: string;
  phone: string;
  payment: string;
  note: string;
  /** Position partagée pour le livreur, si le client l'a acceptée. */
  location?: OrderLocation | null;
  /** Devise du montant de la commande (défaut EUR) ; jamais de conversion calculée. */
  currency?: string;
  /** Faux : commande validée pour un proche (adresse et téléphone du proche). */
  forSelf?: boolean;
  /** Lien de localisation du proche (ex. Google Maps), s'il a été fourni. */
  locationLink?: string;
  status: StatusId;
  statusAt: number;
  /**
   * Faux : pas encore reçue par la tour de contrôle (renvoyée à l'ouverture, toutes les 60 s et
   * au retour au premier plan). Absent : commande passée sans tour configurée, jamais envoyée.
   */
  transmitted?: boolean;
  /** Messages de suivi publiés par la tour, un par changement de statut. */
  notifications?: TrackNotice[];
};

export type Incoterm = 'EXW' | 'FOB';

/** Demande d'un professionnel : aucune somme n'est payée dans l'application. */
export type ProRequest = {
  id: string;
  number: string;
  createdAt: number;
  /** Quantités en kilos, prix au kilo selon l'incoterm choisi. */
  lines: OrderLine[];
  incoterm: Incoterm;
  /** Estimation : somme des lignes dont le prix est défini. */
  subtotal: number;
  /** Nombre de lignes sans prix défini, donc hors estimation. */
  unpriced?: number;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  whatsapp: string;
  destination: string;
  note: string;
  status: StatusId;
  statusAt: number;
  /** Date de prise en charge par l'équipe : la demande passe alors dans « Commandes ». */
  takenAt: number | null;
  /** Vrai une fois la demande reçue par la tour de contrôle. */
  transmitted: boolean;
  /** Étape en clair réglée par l'équipe (« Contacté », « Contrat conclu »…). */
  stageLabel?: string;
  /** Messages de suivi publiés par la tour. */
  notifications?: TrackNotice[];
};

export type VideoComment = { id: string; text: string; at: number };

type Persisted = {
  favorites: string[];
  cart: Record<string, number>;
  /** Conditionnement retenu par produit : identifiant du produit → identifiant du format. */
  formats: Record<string, string>;
  orders: Order[];
  requests: ProRequest[];
  addresses: Address[];
  addressId: string;
  contact: Contact;
  incoterm: Incoterm;
  /** Vidéos de l'équipe déjà regardées par ce compte. */
  watched: string[];
  /** Vidéos aimées, et commentaires écrits par ce compte (enregistrés sur l'appareil). */
  likes: string[];
  comments: Record<string, VideoComment[]>;
};

const EMPTY: Persisted = {
  favorites: [],
  cart: {},
  formats: {},
  orders: [],
  requests: [],
  addresses: [],
  addressId: '',
  contact: { email: '', phone: '' },
  incoterm: 'EXW',
  watched: [],
  likes: [],
  comments: {},
};

// ───────────── Catalogue selon l'espace

/** Grossistes et importateurs commandent par avion ou par bateau, avec les règles de ces modes. */
const usesModesFor = (account: Pick<Account, 'type' | 'activity'>) =>
  account.type === 'pro' &&
  (account.activity === 'grossiste' || account.activity === 'importateur');

function spaceFor(
  doc: CatalogDocument,
  account: Pick<Account, 'type' | 'activity'> | null,
  incoterm: Incoterm,
  country: string | null,
): Space {
  // Prix par pays (`countryPrices` publiés par la tour) : chaque client voit le prix de son pays.
  const local = forCountry(doc, country);
  if (account?.type !== 'pro') return retailSpace(local, country);
  return wholesaleSpace(local, incoterm, usesModesFor(account), country);
}

/** Ramène une quantité dans les bornes de la ligne (minimum, maximum, palier). */
function clampQty(p: Product | undefined, qty: number) {
  if (!p || p.offers || !(qty > 0)) return 0;
  let q = p.pro ? Math.round(qty) : round2(qty);
  if (p.strictStep) q = Math.round(q / p.step) * p.step;
  return Math.max(p.min ?? 0, Math.min(q, maxQty(p)));
}

const isStatus = (s: unknown): s is StatusId =>
  typeof s === 'string' && (FLOW as string[]).concat('annulee').includes(s);

/** Remet d'équerre des données lues sur l'appareil (y compris celles d'anciennes versions). */
function sanitize(
  raw: unknown,
  account: Pick<Account, 'type' | 'activity'>,
  doc: CatalogDocument,
): Persisted {
  const saved = (raw && typeof raw === 'object' ? raw : {}) as Partial<Persisted>;
  const incoterm: Incoterm = saved.incoterm === 'FOB' ? 'FOB' : 'EXW';
  // Pays du client : son adresse enregistrée, sinon le pays de l'appareil (fuseau/langue,
  // sans autorisation). Sert aux règles de visibilité des produits par pays.
  const savedAddresses = (Array.isArray(saved.addresses) ? saved.addresses : []).filter(
    (a) => a && isCountry(a.country) && !!a.line,
  );
  const savedAddressId = typeof saved.addressId === 'string' ? saved.addressId : '';
  const country =
    (savedAddresses.find((a) => a.id === savedAddressId) ?? savedAddresses[0])?.country ??
    deviceCountry();
  const { byId } = spaceFor(doc, account, incoterm, country);

  const cart: Record<string, number> = {};
  Object.entries(saved.cart ?? {}).forEach(([key, q]) => {
    // Un produit désormais proposé par avion ou par bateau : la ligne rejoint sa première offre.
    const id = byId[key]?.offers?.[0]?.id ?? key;
    const qty = typeof q === 'number' ? clampQty(byId[id], q) : 0;
    if (qty > 0 && !cart[id]) cart[id] = qty;
  });

  const orders = (Array.isArray(saved.orders) ? saved.orders : [])
    .filter((o) => o && o.id)
    .map((o: Order & { delivery?: number }): Order => ({
      id: o.id,
      number: o.number,
      createdAt: o.createdAt,
      lines: o.lines ?? [],
      subtotal: o.subtotal ?? 0,
      currency: typeof o.currency === 'string' && o.currency ? o.currency : 'EUR',
      transport: typeof o.transport === 'boolean' ? o.transport : true,
      transportCost: o.transportCost ?? o.delivery ?? 0,
      total: o.total ?? 0,
      recipient: o.recipient ?? '',
      address: o.address ?? '',
      country: o.country ?? '',
      email: o.email ?? '',
      phone: o.phone ?? '',
      payment: o.payment ?? '',
      note: o.note ?? '',
      location: o.location ?? null,
      forSelf: typeof o.forSelf === 'boolean' ? o.forSelf : true,
      locationLink: o.locationLink ?? '',
      // Les commandes d'avant le suivi par étapes sont considérées comme terminées.
      status: isStatus(o.status) ? o.status : 'livree',
      statusAt: o.statusAt ?? o.createdAt,
      ...(typeof o.transmitted === 'boolean' ? { transmitted: o.transmitted } : null),
      ...(Array.isArray(o.notifications) ? { notifications: o.notifications } : null),
    }));

  // Un conditionnement inconnu du catalogue (ou d'un autre espace) est simplement écarté.
  const formats: Record<string, string> = {};
  Object.entries(saved.formats ?? {}).forEach(([pid, fid]) => {
    if (typeof fid !== 'string') return;
    if (byId[pid]?.formats?.some((f) => f.id === fid)) formats[pid] = fid;
  });

  return {
    favorites: (Array.isArray(saved.favorites) ? saved.favorites : []).filter((id) => byId[id]),
    cart,
    formats,
    orders,
    requests: (Array.isArray(saved.requests) ? saved.requests : []).filter(
      (r) => r && r.id && isStatus(r.status),
    ),
    // Les adresses d'avant l'ouverture à l'international n'ont pas de pays : on les écarte.
    addresses: savedAddresses,
    addressId: savedAddressId,
    contact: { ...EMPTY.contact, ...saved.contact },
    incoterm,
    watched: (Array.isArray(saved.watched) ? saved.watched : []).filter(
      (id) => typeof id === 'string',
    ),
    likes: (Array.isArray(saved.likes) ? saved.likes : []).filter((id) => typeof id === 'string'),
    comments:
      saved.comments && typeof saved.comments === 'object' && !Array.isArray(saved.comments)
        ? Object.fromEntries(
            Object.entries(saved.comments).map(([id, list]) => [
              id,
              (Array.isArray(list) ? list : []).filter((c) => c && typeof c.text === 'string'),
            ]),
          )
        : {},
  };
}

/**
 * Référence lisible d'une commande ou d'une demande : 6 caractères sans ambiguïté (ni O/0 ni
 * I/1). Les 4 chiffres d'avant pouvaient se répéter d'un client à l'autre.
 */
function referenceCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

/**
 * Statuts relus dans la tour : ils remplacent ceux de l'appareil (statut, date, messages). Rien
 * ne change si la tour n'a rien de nouveau (aucune écriture inutile).
 */
function applyTracking(prev: Persisted, tracked: Tracked[]): Persisted {
  const byRef = new Map(tracked.map((t) => [`${t.type}:${t.reference}`, t]));
  const same = (a?: TrackNotice[], b?: TrackNotice[]) =>
    (a?.length ?? 0) === (b?.length ?? 0) && JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  let changed = false;
  const orders = prev.orders.map((o) => {
    const t = byRef.get(`commande:${o.number}`);
    if (!t) return o;
    if (o.status === t.status && o.statusAt === t.statusAt && same(o.notifications, t.notifications) && o.transmitted !== false) {
      return o;
    }
    changed = true;
    return { ...o, status: t.status, statusAt: t.statusAt, notifications: t.notifications, transmitted: true };
  });
  const requests = prev.requests.map((r) => {
    const t = byRef.get(`demande_professionnelle:${r.number}`);
    // Une demande annulée par le client n'est pas transmise : elle reste annulée ici.
    if (!t || r.status === 'annulee') return r;
    if (r.status === t.status && r.statusAt === t.statusAt && r.stageLabel === t.stageLabel && same(r.notifications, t.notifications)) {
      return r;
    }
    changed = true;
    return {
      ...r,
      status: t.status,
      statusAt: t.statusAt,
      transmitted: true,
      ...(t.stageLabel ? { stageLabel: t.stageLabel } : null),
      notifications: t.notifications,
      // Prise en charge par l'équipe : la demande passe dans « Commandes » dès qu'elle est confirmée.
      takenAt: r.takenAt ?? (t.status !== 'attente' ? t.statusAt : null),
    };
  });
  return changed ? { ...prev, orders, requests } : prev;
}

const matches = (a: Account, identifier: string) => {
  const id = identifier.trim();
  if (!id) return false;
  if (isEmail(id)) return !!a.email && a.email === normEmail(id);
  const digits = phoneDigits(id);
  return digits.length >= 8 && !!a.phone && phoneDigits(a.phone) === digits;
};

type Result = { ok: true } | { ok: false; error: string };

type Store = Persisted & {
  hydrated: boolean;
  /** Compte connecté, ou null : l'application affiche alors l'inscription. */
  account: Account | null;
  isPro: boolean;
  signUp: (input: NewAccount) => Result;
  signIn: (identifier: string) => Promise<Result>;
  signOut: () => void;
  deleteAccount: () => void;
  updateAccount: (patch: Partial<NewAccount>) => Result;

  tab: TabId;
  setTab: (t: TabId) => void;

  /** Produits visibles dans l'espace du compte : prix particuliers, ou prix de gros. */
  catalog: Product[];
  /** Produits et lignes commandables de l'espace, par identifiant. */
  byId: Record<string, Product>;
  /** Tous les produits du catalogue, pour afficher un nom ou une photo quel que soit l'espace. */
  baseById: Record<string, Product>;
  /** Vrai pour les grossistes et importateurs : offres par avion et par bateau. */
  usesModes: boolean;
  /** D'où vient le catalogue : exemple embarqué (aujourd'hui), base de contrôle, ou copie. */
  catalogOrigin: CatalogOrigin;
  /** Vrai tant que le catalogue affiché est fait de données d'exemple. */
  catalogExample: boolean;
  /** Règles de quantité des professionnels, lues dans le catalogue. */
  rules: QuantityRules;
  /** Pays retenu pour la visibilité des produits : adresse de livraison, sinon appareil. */
  clientCountry: string | null;
  /** Livraison GP réellement configurée (pays + modalités) ; vide : rien de convenu. */
  delivery: { gp: { country: string; options: ('domicile' | 'aéroport')[] }[] };
  /** Annonces publiées par la base de contrôle (le filtrage par diffusion est à l'affichage). */
  campaigns: Campaign[];
  /** Rayons de l'accueil : publiés par la tour (nom, ordre, image), sinon ceux de l'application. */
  shelves: Shelf[];
  /**
   * Message « Produit introuvable » réglé dans la tour ; `null` : rien n'est proposé (tour non
   * configurée, message absent ou désactivé par l'équipe).
   */
  productRequest: ProductRequestMessage | null;
  /** Envoie à la tour le produit que le client n'a pas trouvé. */
  requestProduct: (product: string) => Promise<TransmitResult>;
  /** Moyens de paiement : publiés par la tour, sinon ceux de l'application. Aucun n'est encaissé. */
  payments: readonly { id: string; title: string; detail: string; icon: string }[];
  setIncoterm: (i: Incoterm) => void;

  toggleFavorite: (id: string) => boolean;
  /** Conditionnements retenus, par produit. */
  formats: Record<string, string>;
  /** Retient (ou oublie, avec `null`) le conditionnement choisi pour un produit. */
  setFormat: (productId: string, formatId: string | null) => void;
  setQty: (id: string, qty: number) => void;
  addToCart: (id: string, qty: number) => void;
  /** Ajoute la quantité de départ (ou un palier de plus) ; renvoie ce qui a été ajouté. */
  addStep: (id: string) => { product: Product; qty: number } | null;
  cartLines: { id: string; qty: number }[];
  cartCount: number;
  /** Somme des lignes en euros dont le prix est défini. */
  subtotal: number;
  /** Totaux par devise : on n'additionne jamais des montants de devises différentes. */
  totalsByCurrency: { currency: string; amount: number }[];
  /** Nombre de lignes dont le prix n'est pas défini (elles n'entrent pas dans `subtotal`). */
  unpriced: number;

  /** Adresse sélectionnée, ou undefined tant que le client n'en a saisi aucune. */
  address: Address | undefined;
  selectAddress: (id: string) => void;
  addAddress: (address: NewAddress) => void;

  placeOrder: (o: {
    transport: boolean;
    payment: string;
    note: string;
    contact: Contact;
    location?: OrderLocation | null;
    forSelf?: boolean;
    locationLink?: string;
  }) => Order;
  placeRequest: (r: {
    company: string;
    contactName: string;
    email: string;
    phone: string;
    whatsapp: string;
    destination: string;
    note: string;
  }) => ProRequest;
  cancelRequest: (id: string) => void;
  /** Outils de test : simulent l'étape suivante, à la place de l'équipe. */
  advanceOrder: (id: string) => StatusId | null;
  advanceRequest: (id: string) => StatusId | null;
  reorder: (lines: OrderLine[]) => void;

  /** Vidéos de l'équipe visibles par ce compte, de la plus récente à la plus ancienne. */
  videos: TeamVideo[];
  /** Nombre de vidéos pas encore regardées : c'est le compteur de l'onglet Favoris. */
  newVideoCount: number;
  markWatched: (id: string) => void;
  /** J'aime et commentaires : enregistrés sur l'appareil, pas encore transmis à l'équipe. */
  toggleLike: (id: string) => boolean;
  addComment: (videoId: string, text: string) => void;
  removeComment: (videoId: string, commentId: string) => void;
};

const Ctx = createContext<Store | null>(null);

const nextStatus = (s: StatusId): StatusId | null => {
  const i = FLOW.indexOf(s);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<Auth>({ accounts: [], sessionId: null });
  // Les données et le compte auquel elles appartiennent changent toujours ensemble.
  const [box, setBox] = useState<{ id: string; data: Persisted } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTabState] = useState<TabId>('home');
  const legacy = useRef<unknown>(null);
  // Publications de l'équipe : exemples embarqués, remplacés par les vraies dès que l'outil
  // de publication est connecté.
  const [published, setPublished] = useState<TeamVideo[]>(DEMO_VIDEOS);
  // Relues comme le catalogue (toutes les REFRESH_MS et au retour au premier plan) : une vidéo
  // publiée dans la tour apparaît sans recharger. La liste n'est remplacée que si elle a changé.
  useEffect(() => {
    let alive = true;
    let last = '';
    const load = () =>
      fetchTeamVideos().then((list) => {
        if (!alive || !list) return;
        const text = JSON.stringify(list);
        if (text === last) return;
        last = text;
        setPublished(list);
      });
    load();
    const timer = setInterval(load, REFRESH_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  const account = useMemo(
    () => (box ? (auth.accounts.find((a) => a.id === box.id) ?? null) : null),
    [auth.accounts, box],
  );
  const isPro = account?.type === 'pro';
  const data = box?.data ?? EMPTY;

  // Catalogue : celui de la tour de contrôle quand elle est configurée (relu à l'ouverture,
  // toutes les 60 s et au retour au premier plan, voir lib/catalog/source.ts), sinon l'exemple
  // embarqué.
  const [cat, setCat] = useState(START_CATALOG);
  const catRef = useRef(cat);
  catRef.current = cat;
  useEffect(() => watchCatalog(setCat), []);

  const accountType = account?.type ?? null;
  const activity = account?.activity ?? null;
  const usesModes = !!account && usesModesFor(account);
  // Pays du client, dans tous les parcours : l'adresse de livraison le cas échéant, sinon
  // le pays obligatoire saisi à l'inscription, sinon le pays de l'appareil (sans autorisation).
  const clientCountry = useMemo(() => {
    const adr = data.addresses.find((a) => a.id === data.addressId) ?? data.addresses[0];
    const fromAccount = account && isCountry(account.country) ? account.country : null;
    return adr?.country ?? fromAccount ?? deviceCountry();
  }, [data.addresses, data.addressId, account]);
  const clientCountryRef = useRef(clientCountry);
  clientCountryRef.current = clientCountry;
  const space = useMemo(
    () =>
      spaceFor(
        cat.doc,
        accountType ? { type: accountType, activity } : null,
        data.incoterm,
        clientCountry,
      ),
    [cat.doc, accountType, activity, data.incoterm, clientCountry],
  );
  const catalog = space.catalog;
  const byId = space.byId;
  const baseById = useMemo(() => allProducts(cat.doc), [cat.doc]);
  const campaigns = useMemo(() => docCampaigns(cat.doc), [cat.doc]);
  const shelves = useMemo(() => shelvesOf(cat.doc), [cat.doc]);
  const payments = useMemo(() => cat.doc.payments ?? PAYMENTS, [cat.doc]);
  const productRequest = useMemo(
    () => (TEAM_ENDPOINT && cat.doc.productRequest?.enabled ? cat.doc.productRequest : null),
    [cat.doc],
  );

  // Valeurs courantes, pour les actions qui ne doivent pas être recréées à chaque rendu.
  const live = useRef({ auth, data, byId, account, isPro });
  live.current = { auth, data, byId, account, isPro };

  const setData = useCallback((fn: (d: Persisted) => Persisted) => {
    setBox((b) => (b ? { ...b, data: fn(b.data) } : b));
  }, []);

  // ───── Lecture au démarrage
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rawAuth, rawLegacy] = await Promise.all([
          AsyncStorage.getItem(AUTH_KEY),
          AsyncStorage.getItem(LEGACY_KEY),
        ]);
        if (rawLegacy) legacy.current = JSON.parse(rawLegacy);
        const saved = rawAuth ? (JSON.parse(rawAuth) as Partial<Auth>) : null;
        // Les comptes créés avant le pays obligatoire n'en ont pas : champ vide.
        const accounts = (saved?.accounts ?? [])
          .filter((a) => a && a.id && a.type)
          .map((a) => ({ ...a, country: isCountry(a.country) ? a.country : '' }));
        const session = accounts.find((a) => a.id === saved?.sessionId);
        let loaded: { id: string; data: Persisted } | null = null;
        if (session) {
          const raw = await AsyncStorage.getItem(dataKey(session.id));
          // Tour configurée : le panier enregistré se relit contre la dernière copie du catalogue
          // publié (un produit ajouté par la tour ne doit pas disparaître du panier au démarrage).
          const kept = catalogConnected() ? await cachedCatalog() : null;
          if (kept && catRef.current.origin === 'exemple') setCat(kept);
          loaded = {
            id: session.id,
            data: sanitize(raw ? JSON.parse(raw) : null, session, (kept ?? catRef.current).doc),
          };
        }
        if (!alive) return;
        setAuth({ accounts, sessionId: session?.id ?? null });
        setBox(loaded);
      } catch {
        // Stockage illisible : on repart sans compte, rien n'est écrasé tant qu'on ne s'inscrit pas.
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ───── Écriture à chaque changement
  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(AUTH_KEY, JSON.stringify(auth)).catch(() => {});
  }, [auth, hydrated]);

  useEffect(() => {
    if (hydrated && box) {
      AsyncStorage.setItem(dataKey(box.id), JSON.stringify(box.data)).catch(() => {});
    }
  }, [box, hydrated]);

  // ───── Comptes
  const signUp = useCallback<Store['signUp']>((input) => {
    const email = input.email ? normEmail(input.email) : '';
    const phone = input.phone ? tidyPhone(input.phone) : '';
    const taken = live.current.auth.accounts.some(
      (a) => (email && matches(a, email)) || (phone && matches(a, phone)),
    );
    if (taken) {
      return {
        ok: false,
        error:
          'Un compte existe déjà avec cet e-mail ou ce numéro sur cet appareil. Connectez-vous.',
      };
    }
    const now = Date.now();
    const created: Account = {
      ...input,
      email,
      phone,
      whatsapp: tidyPhone(input.whatsapp),
      name: input.name.trim(),
      company: input.company.trim(),
      country: isCountry(input.country) ? input.country : '',
      id: `c${now.toString(36)}`,
      createdAt: now,
    };
    // Le premier compte reprend ce qui avait été enregistré avant l'arrivée des comptes.
    const first = live.current.auth.accounts.length === 0;
    const start = sanitize(first ? legacy.current : null, created, catRef.current.doc);
    if (first && legacy.current) {
      legacy.current = null;
      AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
    }
    setAuth((a) => ({ accounts: [...a.accounts, created], sessionId: created.id }));
    setBox({ id: created.id, data: start });
    setTabState('home');
    return { ok: true };
  }, []);

  const signIn = useCallback<Store['signIn']>(async (identifier) => {
    const found = live.current.auth.accounts.find((a) => matches(a, identifier));
    if (!found) {
      return {
        ok: false,
        error:
          'Aucun compte ne correspond sur cet appareil. Vérifiez la saisie, ou créez votre compte.',
      };
    }
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(dataKey(found.id));
    } catch {
      // Lecture impossible : le compte s'ouvre avec des données vides.
    }
    setBox({
      id: found.id,
      data: sanitize(raw ? JSON.parse(raw) : null, found, catRef.current.doc),
    });
    setAuth((a) => ({ ...a, sessionId: found.id }));
    setTabState('home');
    return { ok: true };
  }, []);

  const signOut = useCallback(() => {
    setAuth((a) => ({ ...a, sessionId: null }));
    setBox(null);
  }, []);

  const deleteAccount = useCallback(() => {
    const id = live.current.account?.id;
    if (!id) return;
    AsyncStorage.removeItem(dataKey(id)).catch(() => {});
    setAuth((a) => ({ accounts: a.accounts.filter((x) => x.id !== id), sessionId: null }));
    setBox(null);
  }, []);

  const updateAccount = useCallback<Store['updateAccount']>((patch) => {
    const me = live.current.account;
    if (!me) return { ok: false, error: 'Aucun compte ouvert.' };
    const next: Account = {
      ...me,
      ...patch,
      email: patch.email !== undefined ? normEmail(patch.email) : me.email,
      phone: patch.phone !== undefined ? tidyPhone(patch.phone) : me.phone,
      whatsapp: patch.whatsapp !== undefined ? tidyPhone(patch.whatsapp) : me.whatsapp,
    };
    const clash = live.current.auth.accounts.some(
      (a) =>
        a.id !== me.id &&
        ((next.email && matches(a, next.email)) || (next.phone && matches(a, next.phone))),
    );
    if (clash) {
      return { ok: false, error: 'Cet e-mail ou ce numéro est déjà utilisé par un autre compte.' };
    }
    setAuth((a) => ({ ...a, accounts: a.accounts.map((x) => (x.id === me.id ? next : x)) }));
    return { ok: true };
  }, []);

  // « Panier » pour un particulier, « Demandes » pour un professionnel : même intention.
  const setTab = useCallback((t: TabId) => {
    const pro = live.current.isPro;
    setTabState(pro && t === 'cart' ? 'requests' : !pro && t === 'requests' ? 'cart' : t);
  }, []);

  // ───── Favoris, panier
  const toggleFavorite = useCallback(
    (id: string) => {
      const was = live.current.data.favorites.includes(id);
      setData((d) => ({
        ...d,
        favorites: d.favorites.includes(id)
          ? d.favorites.filter((f) => f !== id)
          : [id, ...d.favorites],
      }));
      return !was;
    },
    [setData],
  );

  const setFormat = useCallback(
    (productId: string, formatId: string | null) => {
      setData((d) => {
        const next = { ...d.formats };
        if (formatId === null) delete next[productId];
        else next[productId] = formatId;
        return { ...d, formats: next };
      });
    },
    [setData],
  );

  const setQty = useCallback(
    (id: string, qty: number) => {
      setData((d) => {
        const next = { ...d.cart };
        const q = clampQty(live.current.byId[id], qty);
        if (q <= 0) delete next[id];
        else next[id] = q;
        return { ...d, cart: next };
      });
    },
    [setData],
  );

  const addToCart = useCallback(
    (id: string, qty: number) => {
      setData((d) => {
        const q = clampQty(live.current.byId[id], (d.cart[id] ?? 0) + qty);
        return q > 0 ? { ...d, cart: { ...d.cart, [id]: q } } : d;
      });
    },
    [setData],
  );

  const addStep = useCallback<Store['addStep']>(
    (id) => {
      const found = live.current.byId[id];
      // Produit à plusieurs offres : le choix (avion ou bateau) se fait sur la fiche.
      const product = found?.offers ? (found.offers.length === 1 ? found.offers[0] : null) : found;
      if (!product) return null;
      const lineKey = product.id;
      const qty = (live.current.data.cart[lineKey] ?? 0) > 0 ? product.step : minQty(product);
      addToCart(lineKey, qty);
      return { product, qty };
    },
    [addToCart],
  );

  const setIncoterm = useCallback(
    (incoterm: Incoterm) => setData((d) => ({ ...d, incoterm })),
    [setData],
  );

  const selectAddress = useCallback(
    (id: string) => setData((d) => ({ ...d, addressId: id })),
    [setData],
  );

  const addAddress = useCallback(
    (address: NewAddress) => {
      const id = `adr-${Date.now().toString(36)}`;
      setData((d) => ({ ...d, addresses: [...d.addresses, { ...address, id }], addressId: id }));
    },
    [setData],
  );

  const totals = useMemo(() => {
    const cartLines = Object.entries(data.cart)
      .filter(([id]) => byId[id])
      .map(([id, qty]) => ({ id, qty }));
    // Chaque ligne (produit initial ou produit + emballage) porte déjà son propre prix.
    const priced = cartLines.filter((l) => !byId[l.id].noPrice);
    // Un total par devise : aucune conversion, aucune somme entre devises différentes.
    const byCur: Record<string, number> = {};
    priced.forEach((l) => {
      const cur = byId[l.id].currency ?? 'EUR';
      byCur[cur] = round2((byCur[cur] ?? 0) + byId[l.id].price * l.qty);
    });
    return {
      cartLines,
      cartCount: cartLines.length,
      subtotal: byCur['EUR'] ?? 0,
      totalsByCurrency: Object.entries(byCur).map(([currency, amount]) => ({ currency, amount })),
      unpriced: cartLines.length - priced.length,
    };
  }, [data.cart, byId]);

  const address = useMemo(
    () => data.addresses.find((a) => a.id === data.addressId) ?? data.addresses[0],
    [data.addresses, data.addressId],
  );

  const currentLines = () => {
    const { data: d, byId: products } = live.current;
    return Object.entries(d.cart)
      .filter(([id]) => products[id] && !products[id].offers)
      .map(([id, qty]): OrderLine => {
        const p = products[id];
        if (!p.pro) {
          // Ligne de particulier : produit initial ou produit + emballage, jamais mélangés.
          return {
            id,
            qty,
            price: p.noPrice ? 0 : p.price,
            name: p.name,
            ...(p.formatLabel ? { format: p.formatLabel } : null),
            qtyText:
              qtyLabel(p, qty) + (p.formatGrams ? ` (${contentsText(p.formatGrams * qty)})` : ''),
          };
        }
        return {
          id,
          qty,
          price: p.noPrice ? 0 : p.price,
          name: p.name,
          mode: p.mode ?? null,
          unit: p.unit === 'kg' ? 'kg' : 'conteneur',
          kg: p.unit === 'kg' ? qty : kgEquivalent(p, qty),
          priced: !p.noPrice,
        };
      });
  };

  // ───── Commande d'un particulier
  /** Envoie une commande à la tour ; reçue (ou déjà reçue), elle sort de la file d'attente. */
  const sendOrder = useCallback(
    (order: Order) => {
      const products = live.current.byId;
      const payload = buildOrderPayload(order, live.current.account ?? undefined, (id) => {
        const p = products[id];
        return p ? { unit: p.unit === 'kg' ? 'kg' : 'unit', noun: p.noun } : undefined;
      });
      transmit(payload).then((result) => {
        if (result !== 'sent') return; // réseau ou tour indisponible : renvoyée plus tard
        setData((d) => ({
          ...d,
          orders: d.orders.map((o) => (o.id === order.id ? { ...o, transmitted: true } : o)),
        }));
      });
    },
    [setData],
  );

  const requestProduct = useCallback<Store['requestProduct']>(
    (product) =>
      transmit(
        buildMissingPayload(product, live.current.account ?? undefined, clientCountryRef.current),
      ),
    [],
  );

  const placeOrder = useCallback<Store['placeOrder']>(
    ({ transport, payment, note, contact, location, forSelf, locationLink }) => {
      const d = live.current.data;
      const lines = currentLines();
      const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
      // Devise de la commande : celle des lignes si elles n'en font qu'une, sinon EUR
      // (le paiement en devises mélangées est bloqué avant d'arriver ici).
      const currencies = [
        ...new Set(lines.map((l) => live.current.byId[l.id]?.currency ?? 'EUR')),
      ];
      const currency = currencies.length === 1 ? currencies[0] : 'EUR';
      const adr = d.addresses.find((a) => a.id === d.addressId) ?? d.addresses[0];
      const transportCost = transport && adr ? transportFee(adr.country) : 0;
      const now = Date.now();
      const order: Order = {
        id: now.toString(36),
        number: `PR-${referenceCode()}`,
        createdAt: now,
        lines,
        subtotal,
        currency,
        transport,
        transportCost,
        total: round2(subtotal + transportCost),
        recipient: adr?.name ?? '',
        address: adr ? formatAddress(adr) : '',
        country: adr?.country ?? '',
        email: contact.email,
        phone: contact.phone,
        payment,
        note,
        location: location ?? null,
        forSelf: forSelf !== false,
        locationLink: locationLink ?? '',
        status: 'attente',
        statusAt: now,
        // Tour configurée : la commande part tout de suite, et sera renvoyée tant qu'elle n'est
        // pas reçue (file locale sur l'appareil).
        ...(TEAM_ENDPOINT ? { transmitted: false } : null),
      };
      setData((prev) => ({ ...prev, cart: {}, contact, orders: [order, ...prev.orders] }));
      if (TEAM_ENDPOINT) sendOrder(order);
      return order;
    },
    [setData, sendOrder],
  );

  // ───── Demande d'un professionnel
  const sendToTeam = useCallback(
    (request: ProRequest) => {
      transmit(buildRequestPayload(request, live.current.account ?? undefined)).then((result) => {
        if (result !== 'sent') return; // pas connecté, ou échec : la demande reste en attente
        setData((d) => ({
          ...d,
          requests: d.requests.map((r) => (r.id === request.id ? { ...r, transmitted: true } : r)),
        }));
      });
    },
    [setData],
  );

  const placeRequest = useCallback<Store['placeRequest']>(
    (fields) => {
      const lines = currentLines();
      const now = Date.now();
      const request: ProRequest = {
        ...fields,
        id: now.toString(36),
        number: `DP-${referenceCode()}`,
        createdAt: now,
        lines,
        incoterm: live.current.data.incoterm,
        subtotal: round2(
          lines.filter((l) => l.priced !== false).reduce((sum, l) => sum + l.price * l.qty, 0),
        ),
        unpriced: lines.filter((l) => l.priced === false).length,
        status: 'attente',
        statusAt: now,
        takenAt: null,
        transmitted: false,
      };
      setData((prev) => ({ ...prev, cart: {}, requests: [request, ...prev.requests] }));
      sendToTeam(request);
      return request;
    },
    [setData, sendToTeam],
  );

  // À l'ouverture d'un compte professionnel, on retente les demandes pas encore transmises.
  const boxId = box?.id;
  useEffect(() => {
    if (!boxId || !live.current.isPro) return;
    live.current.data.requests.filter((r) => !r.transmitted).forEach(sendToTeam);
  }, [boxId, sendToTeam]);

  // Vues, J'aime et commentaires : l'état complet part vers la tour 2 s après chaque geste, et
  // repart à la relecture suivante s'il n'est pas passé. Le nom du compte n'est pas envoyé : la
  // fenêtre des commentaires ne prévient pas encore le client qu'il accompagnerait ses gestes.
  const reactionsDirty = useRef(false);
  const pushReactions = useCallback(() => {
    const { data: d, account: acc } = live.current;
    if (!acc) return;
    const comments = Object.entries(d.comments).flatMap(([publicationId, list]) =>
      list.map((c) => ({ id: c.id, publicationId, text: c.text, at: c.at })),
    );
    sendReactions({
      account: { id: acc.id, name: '', type: acc.type === 'pro' ? 'pro' : 'particulier' },
      views: d.watched,
      likes: d.likes,
      comments,
    }).then((r) => {
      reactionsDirty.current = r === 'failed';
    });
  }, []);
  const reactionsKey = box ? JSON.stringify([data.watched, data.likes, data.comments]) : '';
  useEffect(() => {
    if (!reactionsKey || !TEAM_ENDPOINT) return;
    const timer = setTimeout(pushReactions, 2000);
    return () => clearTimeout(timer);
  }, [reactionsKey, pushReactions]);

  // Tour de contrôle : à l'ouverture, toutes les 45 s et au retour au premier plan, on renvoie
  // ce qui n'est pas parti, puis on relit les statuts réglés par l'équipe.
  useEffect(() => {
    if (!boxId || !TEAM_ENDPOINT) return;
    let alive = true;
    const sync = async () => {
      const { data: d, isPro: pro, account: acc } = live.current;
      d.orders.filter((o) => o.transmitted === false).forEach(sendOrder);
      if (pro) d.requests.filter((r) => !r.transmitted).forEach(sendToTeam);
      if (reactionsDirty.current) pushReactions();
      if (!acc) return;
      let tracked = await fetchTracking(acc.id);
      // Relecture manquée (réseau, démarrage de la tour) : un seul nouvel essai, sans attendre le tour suivant.
      if (tracked === null) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
        if (!alive) return;
        tracked = await fetchTracking(acc.id);
      }
      if (alive && tracked && tracked.length > 0) setData((prev) => applyTracking(prev, tracked));
      // Livraison au Sénégal en cours : la position du téléphone est rafraîchie pour le livreur,
      // seulement si le client l'a partagée à la commande (aucune nouvelle demande d'accord).
      const follow = (tracked ?? []).filter(
        (t) => t.type === 'commande' && t.tracking && d.orders.some((o) => o.number === t.reference && o.location),
      );
      if (follow.length > 0) {
        const spot = await coordsIfAllowed();
        if (alive && spot) follow.forEach((t) => sendPosition(acc.id, t.reference, spot));
      }
    };
    sync();
    const timer = setInterval(sync, REFRESH_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [boxId, sendOrder, sendToTeam, setData, pushReactions]);

  const cancelRequest = useCallback(
    (id: string) => {
      const now = Date.now();
      setData((d) => ({
        ...d,
        requests: d.requests.map((r) =>
          r.id === id && r.status !== 'livree' ? { ...r, status: 'annulee', statusAt: now } : r,
        ),
      }));
    },
    [setData],
  );

  const advanceOrder = useCallback<Store['advanceOrder']>(
    (id) => {
      const order = live.current.data.orders.find((o) => o.id === id);
      const next = order ? nextStatus(order.status) : null;
      if (!next) return null;
      const now = Date.now();
      setData((d) => ({
        ...d,
        orders: d.orders.map((o) => (o.id === id ? { ...o, status: next, statusAt: now } : o)),
      }));
      return next;
    },
    [setData],
  );

  const advanceRequest = useCallback<Store['advanceRequest']>(
    (id) => {
      const request = live.current.data.requests.find((r) => r.id === id);
      const next = request ? nextStatus(request.status) : null;
      if (!next) return null;
      const now = Date.now();
      setData((d) => ({
        ...d,
        requests: d.requests.map((r) =>
          r.id === id ? { ...r, status: next, statusAt: now, takenAt: r.takenAt ?? now } : r,
        ),
      }));
      return next;
    },
    [setData],
  );

  const reorder = useCallback(
    (lines: OrderLine[]) => {
      setData((d) => {
        const cart = { ...d.cart };
        lines.forEach((l) => {
          const products = live.current.byId;
          // Une ancienne ligne sans mode rejoint la première offre du produit.
          const id = products[l.id]?.offers?.[0]?.id ?? l.id;
          const q = clampQty(products[id], (cart[id] ?? 0) + l.qty);
          if (q > 0) cart[id] = q;
        });
        return { ...d, cart };
      });
    },
    [setData],
  );

  const videos = useMemo(() => videosFor(published, isPro), [published, isPro]);
  const newVideoCount = useMemo(
    () => videos.filter((v) => !data.watched.includes(v.id)).length,
    [videos, data.watched],
  );
  const markWatched = useCallback(
    (id: string) => {
      if (live.current.data.watched.includes(id)) return;
      setData((d) => (d.watched.includes(id) ? d : { ...d, watched: [...d.watched, id] }));
      // Pas encore connecté : la vue n'est comptée que sur cet appareil.
      reportView(id, live.current.account?.id ?? null);
    },
    [setData],
  );

  const toggleLike = useCallback(
    (id: string) => {
      const liked = !live.current.data.likes.includes(id);
      setData((d) => ({
        ...d,
        likes: liked ? [...d.likes.filter((x) => x !== id), id] : d.likes.filter((x) => x !== id),
      }));
      reportLike(id, liked, live.current.account?.id ?? null);
      return liked;
    },
    [setData],
  );
  const addComment = useCallback(
    (videoId: string, text: string) => {
      const clean = text.trim().slice(0, 300);
      if (!clean) return;
      const now = Date.now();
      const comment: VideoComment = { id: now.toString(36), text: clean, at: now };
      setData((d) => ({
        ...d,
        comments: { ...d.comments, [videoId]: [...(d.comments[videoId] ?? []), comment] },
      }));
      reportComment(videoId, clean, live.current.account?.id ?? null);
    },
    [setData],
  );
  const removeComment = useCallback(
    (videoId: string, commentId: string) => {
      setData((d) => ({
        ...d,
        comments: {
          ...d.comments,
          [videoId]: (d.comments[videoId] ?? []).filter((c) => c.id !== commentId),
        },
      }));
    },
    [setData],
  );

  const value = useMemo<Store>(
    () => ({
      ...data,
      ...totals,
      hydrated,
      account,
      isPro,
      signUp,
      signIn,
      signOut,
      deleteAccount,
      updateAccount,
      tab,
      setTab,
      catalog,
      byId,
      baseById,
      usesModes,
      catalogOrigin: cat.origin,
      catalogExample: cat.doc.example,
      rules: cat.doc.rules,
      clientCountry,
      delivery: cat.doc.delivery,
      campaigns,
      shelves,
      payments,
      productRequest,
      requestProduct,
      setIncoterm,
      toggleFavorite,
      formats: data.formats,
      setFormat,
      setQty,
      addToCart,
      addStep,
      address,
      selectAddress,
      addAddress,
      placeOrder,
      placeRequest,
      cancelRequest,
      advanceOrder,
      advanceRequest,
      reorder,
      videos,
      newVideoCount,
      markWatched,
      toggleLike,
      addComment,
      removeComment,
    }),
    [
      data,
      totals,
      hydrated,
      account,
      isPro,
      signUp,
      signIn,
      signOut,
      deleteAccount,
      updateAccount,
      tab,
      setTab,
      catalog,
      byId,
      baseById,
      usesModes,
      cat,
      clientCountry,
      campaigns,
      shelves,
      payments,
      productRequest,
      requestProduct,
      setIncoterm,
      toggleFavorite,
      data.formats,
      setFormat,
      setQty,
      addToCart,
      addStep,
      address,
      selectAddress,
      addAddress,
      placeOrder,
      placeRequest,
      cancelRequest,
      advanceOrder,
      advanceRequest,
      reorder,
      videos,
      newVideoCount,
      markWatched,
      toggleLike,
      addComment,
      removeComment,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return v;
}

// ───────────── Suivi

/** Message de confirmation adressé au client dès le paiement. */
export function confirmationMessage(o: Order) {
  const firstName = o.recipient.trim().split(/\s+/)[0];
  return (
    `${firstName ? `Bonjour ${firstName}, nous` : 'Nous'} avons bien reçu votre commande ${o.number} ` +
    `et votre paiement de ${money(o.total, o.currency)}. Notre équipe la vérifie et vous écrit dès qu’elle est validée.`
  );
}

export type TrackView = {
  label: string;
  /** Jalons affichés sous forme de barres, et nombre de jalons franchis. */
  steps: string[];
  done: number;
  active: boolean;
  cancelled: boolean;
  message: string;
  /** Étape suivante, ou null si le suivi est terminé. */
  next: StatusId | null;
};

const view = (
  status: StatusId,
  labels: Record<StatusId, string>,
  steps: string[],
  messages: Record<StatusId, string>,
): TrackView => ({
  label: labels[status],
  steps,
  done: status === 'annulee' ? 0 : FLOW.indexOf(status),
  active: status !== 'livree' && status !== 'annulee',
  cancelled: status === 'annulee',
  message: messages[status],
  next: nextStatus(status),
});

/** Commande d'un particulier : validation par l'équipe, préparation, expédition, livraison. */
export function orderView(o: Order): TrackView {
  const destination = o.country ? ` Destination : ${countryName(o.country)}.` : '';
  // Sénégal avec transport : livraison à domicile par nos livreurs (moto).
  const courier = o.country === 'SN' && o.transport;
  return view(
    o.status,
    {
      attente: 'En validation',
      confirmee: 'Validée',
      preparation: 'En préparation',
      expediee: courier ? 'Livreur en route' : o.transport ? 'Expédiée' : 'Prête à enlever',
      livree: o.transport ? 'Livrée' : 'Enlevée',
      annulee: 'Annulée',
    },
    courier
      ? ['Validée', 'Préparation', 'Livreur en route', 'Livrée']
      : o.transport
        ? ['Validée', 'Préparation', 'Expédiée', 'Livrée']
        : ['Validée', 'Préparation', 'À enlever', 'Enlevée'],
    {
      attente: confirmationMessage(o),
      confirmee: 'Votre commande est validée par notre équipe.',
      preparation: 'Nous préparons vos produits.',
      expediee: courier
        ? `Votre livreur est en route avec votre adresse${o.location ? ' et votre position' : ''}. Il vous appelle au ${o.phone} si besoin.`
        : o.transport
          ? `Votre commande a quitté le Sénégal.${destination}`
          : 'Votre commande est prête. Votre transporteur peut l’enlever à notre entrepôt au Sénégal.',
      livree: o.transport
        ? 'Votre commande est livrée. Bonne dégustation !'
        : 'Votre commande a été remise à votre transporteur.',
      annulee: 'Cette commande est annulée.',
    },
  );
}

/** Demande d'un professionnel : réponse de l'équipe, puis commande suivie jusqu'à la livraison. */
export function requestView(r: ProRequest): TrackView {
  return view(
    r.status,
    {
      attente: 'En attente de réponse',
      confirmee: 'Confirmée',
      preparation: 'En préparation',
      expediee: 'Expédiée',
      livree: 'Livrée',
      annulee: 'Annulée',
    },
    ['Confirmée', 'Préparation', 'Expédiée', 'Livrée'],
    {
      attente:
        'Notre équipe vous contacte pour confirmer les détails et organiser le paiement. Rien n’est payé dans l’application.',
      confirmee:
        'Détails et paiement confirmés avec notre équipe. Votre commande est prise en charge.',
      preparation: 'Votre commande est en préparation : calibrage, conditionnement, documents.',
      expediee:
        r.incoterm === 'FOB'
          ? 'Marchandise chargée au port de départ (FOB). La suite du transport est à votre charge.'
          : 'Marchandise mise à votre disposition à notre entrepôt (EXW).',
      livree: 'Commande livrée.',
      annulee: 'Cette demande est annulée.',
    },
  );
}
