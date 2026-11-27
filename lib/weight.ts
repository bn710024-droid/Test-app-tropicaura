/**
 * Contenu d'un emballage, ou de plusieurs : ≥ 1 000 g → « 5 kg », « 1,5 kg » (une décimale au
 * plus, virgule) ; < 1 000 g → « 500 g ». Sans dépendance : testé par `scripts/test_contents.mjs`.
 */
export function contentsText(grams: number): string {
  const g = Math.round(grams);
  if (g < 1000) return `${g}\u00A0g`;
  const [whole, tenth] = String(Math.round(g / 100) / 10).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F')}${tenth ? `,${tenth}` : ''}\u00A0kg`;
}
