/**
 * Zones et devises des particuliers. Source : la tour (`zones` du catalogue, tour
 * shared/zones.js) ; la liste ci-dessous n'est qu'une copie de secours (catalogue embarqué,
 * hors ligne). La devise découle du pays du COMPTE du client ; pays inconnu : dollar.
 */
export type Currency = 'XOF' | 'EUR' | 'USD';
export type Zones = { XOF: string[]; EUR: string[] };

export const FALLBACK_ZONES: Zones = {
  XOF: ['SN', 'CI', 'ML', 'BF', 'NE', 'BJ', 'TG', 'GW'],
  EUR: [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV',
    'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO', 'IS', 'LI',
    'MC', 'AD', 'SM', 'VA', 'ME', 'XK',
  ],
};

export function currencyOf(country: string | null | undefined, zones: Zones = FALLBACK_ZONES): Currency {
  const code = (country ?? '').toUpperCase();
  if (zones.XOF.includes(code)) return 'XOF';
  if (zones.EUR.includes(code)) return 'EUR';
  return 'USD';
}

export type PackPrices = { XOF: number | null; EUR: number | null; USD: number | null };
type PackLike = {
  available?: boolean;
  prices?: PackPrices;
  countries?: { mode: 'zone' | 'pays' | 'sauf'; list: string[] };
  isDefault?: boolean;
};

/** Emballage proposé dans ce pays : actif, un prix dans la devise du pays, pays permis. */
export function packVisibleIn(pack: PackLike, country: string | null | undefined, zones?: Zones) {
  if (pack.available === false || !pack.prices) return false;
  const code = (country ?? '').toUpperCase();
  const price = pack.prices[currencyOf(code, zones)];
  if (!(typeof price === 'number' && price > 0)) return false;
  const list = pack.countries?.list ?? [];
  if (pack.countries?.mode === 'pays') return list.includes(code);
  if (pack.countries?.mode === 'sauf') return !list.includes(code);
  return true;
}

/** Emballages proposés dans ce pays, dans l'ordre ; le premier est celui « par défaut ». */
export function packsFor<T extends PackLike>(packs: T[], country: string | null | undefined, zones?: Zones): T[] {
  const visible = packs.filter((k) => packVisibleIn(k, country, zones));
  const def = visible.find((k) => k.isDefault);
  return def ? [def, ...visible.filter((k) => k !== def)] : visible;
}
