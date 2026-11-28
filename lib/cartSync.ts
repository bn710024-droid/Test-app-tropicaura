import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { REFRESH_MS, TEAM_ENDPOINT } from './config';
import { transmit } from './transmission';
import type { Product } from './data';

/**
 * Panier en cours, envoyé à la tour (`TEAM_ENDPOINT`, `type: 'panier'`) pour que l'équipe puisse
 * aider le client à finaliser sa commande. L'application envoie l'état COMPLET du panier (même
 * méthode que les réactions vidéo) : renvoyer le même état ne change rien côté tour.
 *  - 3 s après la dernière modification (anti-rebond), et au passage en arrière-plan ;
 *  - panier vidé : envoi avec `lines: []` ;
 *  - échec réseau : seul le dernier état est gardé, renvoyé à la relecture suivante (REFRESH_MS).
 * Les prix envoyés ne sont qu'indicatifs : la tour les recalcule d'après son catalogue.
 */
export const CART_DELAY_MS = 3000;

export type CartTime = { addedAt: string; updatedAt: string };

export type CartAccount = {
  id: string;
  secret: string;
  name: string;
  type: 'particulier' | 'pro';
  activity: string | null;
  company: string;
  phone: string;
  email: string;
  whatsapp: string;
  country: string;
};

export function buildCartPayload(input: {
  account: CartAccount;
  cart: Record<string, number>;
  times: Record<string, CartTime>;
  byId: Record<string, Product>;
  totals: { currency: string; amount: number }[];
  country: string | null;
  incoterm: 'EXW' | 'FOB';
  updatedAt: string;
}) {
  const { account, cart, times, byId } = input;
  return {
    type: 'panier',
    version: 1,
    account,
    country: input.country ?? '',
    incoterm: input.incoterm,
    lines: Object.entries(cart).map(([id, qty]) => {
      const p = byId[id];
      const t = times[id];
      return {
        lineId: id,
        productId: p?.productId ?? id.split(':')[0],
        product: p?.name ?? id.split(':')[0],
        formatLabel: p?.formatLabel ?? null,
        mode: p?.mode ?? null,
        quantity: qty,
        unit: p?.pro ? (p.unit === 'unit' ? 'conteneur' : 'kg') : (p?.unit ?? 'kg'),
        unitNoun: p?.noun ?? null,
        unitPrice: p && !p.noPrice ? p.price : null,
        currency: p?.currency ?? 'EUR',
        addedAt: t?.addedAt ?? input.updatedAt,
        updatedAt: t?.updatedAt ?? input.updatedAt,
      };
    }),
    totals: input.totals,
    updatedAt: input.updatedAt,
  };
}

/** Envoie le panier (`payload`, ou `null` sans compte ni tour) selon les règles ci-dessus. */
export function useCartSync(payload: object | null) {
  const pending = useRef<string | null>(null);
  const sent = useRef<string | null>(null);
  const busy = useRef(false);
  const text = payload && TEAM_ENDPOINT ? JSON.stringify(payload) : null;

  const flush = useCallback(async () => {
    const next = pending.current;
    if (!next || next === sent.current || busy.current) return;
    busy.current = true;
    try {
      if ((await transmit(JSON.parse(next))) === 'sent') sent.current = next;
    } finally {
      busy.current = false;
    }
  }, []);

  // 3 s après la dernière modification.
  useEffect(() => {
    pending.current = text;
    if (!text) return undefined;
    const timer = setTimeout(flush, CART_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, flush]);

  // Passage en arrière-plan : envoi immédiat ; relecture régulière : renvoi après un échec.
  useEffect(() => {
    const every = setInterval(flush, REFRESH_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    return () => {
      clearInterval(every);
      sub.remove();
    };
  }, [flush]);
}
