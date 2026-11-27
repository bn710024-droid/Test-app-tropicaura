import { TEAM_ENDPOINT } from './config';
import type { Account, Order, ProRequest, StatusId } from './store';

/**
 * Échanges avec la tour de contrôle (`TEAM_ENDPOINT` = `<tour>/api/orders`) :
 * - demandes professionnelles (`type: 'demande_professionnelle'`, version 2) ;
 * - commandes des particuliers (`type: 'commande'`) ;
 * - produits introuvables (`type: 'produit_introuvable'`) ;
 * - suivi des statuts (`GET ?compte=<identifiant du compte>`) ;
 * - position du téléphone pour le livreur au Sénégal (`action: 'position'`).
 * Sans tour configurée, rien n'est envoyé : `transmit` répond « not_connected ».
 */
export const PAYLOAD_VERSION = 2;

export function buildRequestPayload(request: ProRequest, account: Account | undefined) {
  return {
    version: PAYLOAD_VERSION,
    type: 'demande_professionnelle',
    reference: request.number,
    createdAt: new Date(request.createdAt).toISOString(),
    incoterm: request.incoterm,
    currency: 'EUR',
    lines: request.lines.map((l) => ({
      productId: l.id.split(':')[0],
      product: l.name ?? l.id,
      // Mode de transport de l'offre : 'avion', 'bateau', ou null (offre sans mode).
      mode: l.mode ?? null,
      // Quantité dans l'unité commandée : kilos, ou conteneurs.
      quantity: l.qty,
      unit: l.unit ?? 'kg',
      // Équivalent en kilos, ou null si le poids du conteneur n'est pas défini.
      quantityKg: l.kg ?? (l.unit === 'conteneur' ? null : l.qty),
      // Prix d'une unité commandée, ou null si aucun prix n'était configuré.
      unitPrice: l.priced === false ? null : l.price,
      total: l.priced === false ? null : Math.round(l.qty * l.price * 100) / 100,
    })),
    // Somme des lignes chiffrées uniquement.
    estimatedTotal: request.subtotal,
    unpricedLines: request.unpriced ?? 0,
    customer: {
      accountId: account?.id ?? null,
      activity: account?.activity ?? null,
      company: request.company,
      contact: request.contactName,
      phone: request.phone,
      email: request.email,
      whatsapp: request.whatsapp,
    },
    destination: request.destination,
    note: request.note,
  };
}

/** Ce que la commande doit dire de chaque ligne, figé au moment de la commande. */
export type OrderLineInfo = { unit: 'kg' | 'unit'; noun: [string, string] };

/**
 * Commande d'un particulier, au format attendu par la tour (`POST /api/orders`). Les totaux
 * sont recalculés par la tour ; la devise est celle de la commande (jamais de conversion).
 * Aucun paiement n'est encaissé : `payment` est le moyen choisi, l'équipe pointe l'argent reçu.
 */
export function buildOrderPayload(
  order: Order,
  account: Account | undefined,
  infoOf: (lineId: string) => OrderLineInfo | undefined,
) {
  return {
    version: 1,
    type: 'commande',
    reference: order.number,
    createdAt: new Date(order.createdAt).toISOString(),
    currency: order.currency ?? 'EUR',
    lines: order.lines.map((l) => {
      const info = infoOf(l.id);
      const name = l.name ?? l.id.split(':')[0];
      return {
        productId: l.id,
        product: l.format ? `${name} · ${l.format}` : name,
        quantity: l.qty,
        unit: info?.unit ?? 'kg',
        unitNoun: info?.noun ?? null,
        unitPrice: l.priced === false ? null : l.price,
        ...(l.qtyText ? { quantityText: l.qtyText } : null),
      };
    }),
    transportCost: order.transportCost,
    payment: order.payment,
    note: order.note,
    address: order.address,
    country: order.country,
    forSelf: order.forSelf !== false,
    ...(order.locationLink ? { locationLink: order.locationLink } : null),
    ...(order.location
      ? {
          location: {
            lat: order.location.latitude,
            lng: order.location.longitude,
            accuracy: order.location.accuracy,
          },
        }
      : null),
    customer: {
      accountId: account?.id ?? null,
      name: order.recipient || account?.name || '',
      email: order.email || account?.email || '',
      phone: order.phone || account?.phone || '',
    },
  };
}

/** Produit introuvable : ce que le client cherchait, envoyé à la tour (Introuvables). */
export function buildMissingPayload(
  product: string,
  account: Account | undefined,
  country: string | null,
) {
  return {
    type: 'produit_introuvable',
    product: product.trim().slice(0, 80),
    country: country ?? '',
    createdAt: new Date().toISOString(),
    customer: {
      accountId: account?.id ?? null,
      name: account?.name ?? '',
      type: account?.type ?? null,
      company: account?.company ?? '',
      email: account?.email ?? '',
      phone: account?.phone ?? '',
      whatsapp: account?.whatsapp ?? '',
    },
  };
}

export type TransmitResult = 'sent' | 'not_connected' | 'failed';

export async function transmit(payload: unknown): Promise<TransmitResult> {
  if (!TEAM_ENDPOINT) return 'not_connected';
  try {
    const response = await fetch(TEAM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

/** Message d'un changement de statut, écrit par la tour (`shared/orders.js`). */
export type TrackNotice = { status: StatusId; at: string; title: string; message: string };

/** Suivi d'une commande ou d'une demande, tel que l'équipe l'a réglé dans la tour. */
export type Tracked = {
  reference: string;
  type: 'commande' | 'demande_professionnelle';
  status: StatusId;
  statusAt: number;
  tracking: boolean;
  stageLabel?: string;
  notifications: TrackNotice[];
};

const STATUSES: StatusId[] = ['attente', 'confirmee', 'preparation', 'expediee', 'livree', 'annulee'];
const isStatus = (s: unknown): s is StatusId => STATUSES.includes(s as StatusId);

function parseTracked(raw: unknown): Tracked | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const at = new Date(String(o.statusAt ?? '')).getTime();
  if (typeof o.reference !== 'string' || !isStatus(o.status) || !Number.isFinite(at)) return null;
  const notifications = (Array.isArray(o.notifications) ? o.notifications : [])
    .map((n) => (n && typeof n === 'object' ? (n as Record<string, unknown>) : {}))
    .filter((n) => isStatus(n.status) && typeof n.title === 'string')
    .map((n) => ({
      status: n.status as StatusId,
      at: String(n.at ?? ''),
      title: String(n.title),
      message: typeof n.message === 'string' ? n.message : '',
    }));
  return {
    reference: o.reference,
    type: o.type === 'demande_professionnelle' ? 'demande_professionnelle' : 'commande',
    status: o.status,
    statusAt: at,
    tracking: o.tracking === true,
    ...(typeof o.stageLabel === 'string' ? { stageLabel: o.stageLabel } : null),
    notifications,
  };
}

/**
 * Statuts des commandes et demandes du compte. `null` : pas de tour, réseau indisponible ou
 * réponse illisible — l'application garde alors ce qu'elle savait.
 */
export async function fetchTracking(accountId: string): Promise<Tracked[] | null> {
  if (!TEAM_ENDPOINT || accountId.length < 6) return null;
  try {
    const response = await fetch(`${TEAM_ENDPOINT}?compte=${encodeURIComponent(accountId)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { orders?: unknown };
    if (!Array.isArray(body.orders)) return null;
    return body.orders.map(parseTracked).filter((t): t is Tracked => !!t);
  } catch {
    return null;
  }
}

/** Position du téléphone pour le livreur (Sénégal), tant que la commande est suivie. */
export async function sendPosition(
  accountId: string,
  reference: string,
  spot: { latitude: number; longitude: number; accuracy: number | null },
): Promise<boolean> {
  if (!TEAM_ENDPOINT) return false;
  try {
    const response = await fetch(TEAM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'position',
        compte: accountId,
        reference,
        lat: spot.latitude,
        lng: spot.longitude,
        accuracy: spot.accuracy,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
