/**
 * Contenu d'un emballage, ou de plusieurs : ≥ 1 000 g → « 5 kg », « 1,5 kg », « 1,25 kg » (deux
 * décimales au plus, zéros inutiles retirés, virgule) ; < 1 000 g → « 500 g ».
 * Sans dépendance : testé par `scripts/test_contents.mjs`.
 */
export function contentsText(grams: number): string {
  const g = Math.round(grams);
  if (g < 1000) return `${g}\u00A0g`;
  const [whole, decimals] = String(Math.round(g / 10) / 100).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F')}${decimals ? `,${decimals}` : ''}\u00A0kg`;
}
