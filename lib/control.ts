import { CATALOG_ENDPOINT, CONTROL_ENDPOINT, TEAM_ENDPOINT, VIDEOS_ENDPOINT } from './config';

/**
 * TOUR DE CONTRÔLE — points de raccordement entre cette application et le futur logiciel
 * de contrôle de l'équipe.
 *
 * Tout ce que l'application affiche est réglable depuis là-bas, sans modification des écrans :
 * - le catalogue : produits, photos, descriptions, disponibilités, prix particuliers,
 *   unités, offres professionnelles (avion / bateau, EXW / FOB), règles de quantité,
 *   et les FORMATS / EMBALLAGES de chaque produit — cartons, sachets, boxes, pots, vrac…
 *   (un seul emballage ou plusieurs, prix par emballage, `price: null` tant qu'il n'est
 *   pas fixé) ; voir `lib/catalog/schema.ts` et `lib/catalog/README.md` ;
 * - les demandes professionnelles : réception par le logiciel de l'équipe ;
 * - les profils : référentiel des comptes (particulier, grossiste, importateur) ;
 * - les vidéos de l'équipe : publication, j'aime et commentaires.
 *
 * Chaque raccordement reste indépendant : renseigner une adresse dans `lib/config.ts`
 * active celui-ci, les autres continuent de fonctionner en local (données d'exemple).
 */

export type ControlLink = {
  id: string;
  label: string;
  /** Ce que la tour de contrôle pourra régler via ce raccordement. */
  scope: string;
  endpoint: string | null;
  connected: boolean;
};

export const CONTROL_LINKS: ControlLink[] = [
  {
    id: 'catalogue',
    label: 'Catalogue',
    scope:
      'Produits, prix, unités, formats et emballages (carton, sachet, box, pot…), offres et règles de quantité.',
    endpoint: CATALOG_ENDPOINT,
    connected: !!CATALOG_ENDPOINT,
  },
  {
    id: 'demandes',
    label: 'Commandes et demandes',
    scope:
      'Commandes des particuliers, demandes des grossistes et importateurs, produits introuvables, et suivi des statuts réglés par l’équipe.',
    endpoint: TEAM_ENDPOINT,
    connected: !!TEAM_ENDPOINT,
  },
  {
    id: 'profils',
    label: 'Profils et comptes',
    scope: 'Référentiel des profils : particulier, grossiste, importateur, coordonnées et droits.',
    endpoint: CONTROL_ENDPOINT,
    connected: !!CONTROL_ENDPOINT,
  },
  {
    id: 'videos',
    label: 'Vidéos de l’équipe',
    scope: 'Publication des vidéos ; réception des vues, j’aime et commentaires.',
    endpoint: VIDEOS_ENDPOINT,
    connected: !!VIDEOS_ENDPOINT,
  },
];

/** Vocabulaire d'emballage accepté pour les formats (libellés libres côté tour de contrôle). */
export const PACKAGING_HINTS = ['Carton', 'Sachet', 'Box', 'Pot', 'Barquette', 'Filet', 'Vrac'];
