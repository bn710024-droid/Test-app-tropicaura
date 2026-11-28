/**
 * Réglages du prototype.
 *
 * TOUR DE CONTRÔLE : une seule adresse, `EXPO_PUBLIC_CONTROL_TOWER_URL` (fichier `.env.local` en
 * développement, variable d'environnement Vercel pour le web, `eas.json` pour les mobiles), par
 * exemple `http://localhost:3000` ou `https://<tour>.vercel.app`. Tous les raccordements en
 * dérivent. Sans adresse, rien n'est connecté : catalogue d'exemple embarqué, demandes et
 * commandes gardées sur l'appareil.
 */
const towerUrl = (raw: string | undefined): string | null => {
  const url = (raw ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\/\S+$/.test(url) ? url : null;
};
export const CONTROL_TOWER: string | null = towerUrl(process.env.EXPO_PUBLIC_CONTROL_TOWER_URL);

/**
 * TEAM_ENDPOINT : réception par la tour de contrôle des demandes professionnelles, des commandes
 * des particuliers et des produits introuvables (`POST <tour>/api/orders`), et suivi des statuts
 * (`GET <tour>/api/orders?compte=…`). Sans tour, rien n'est transmis : les demandes restent
 * enregistrées sur l'appareil, marquées « en attente de transmission ».
 */
export const TEAM_ENDPOINT: string | null = CONTROL_TOWER ? `${CONTROL_TOWER}/api/orders` : null;

/**
 * Outils de test : affiche les boutons « Mode test » qui simulent les réponses de l'équipe
 * (validation, préparation, expédition, livraison). À passer à `false` dès que le suivi réel
 * est branché.
 */
// Tour configurée : les statuts viennent de l'équipe, les boutons de test disparaissent.
export const TEST_TOOLS = !CONTROL_TOWER;

/** Commandes professionnelles : quantités en kilos, par produit. */
export const PRO_MIN_KG = 500;
export const PRO_STEP_KG = 100;
export const PRO_MAX_KG = 100000;

/**
 * Vidéos de l'équipe (espace « Découvrir »).
 *
 * VIDEOS_ENDPOINT : adresse du futur outil de publication. Tant qu'elle vaut `null`, l'application
 * montre les vidéos de démonstration embarquées et les vues ne sont comptées que sur l'appareil.
 */
export const VIDEOS_ENDPOINT: string | null = CONTROL_TOWER
  ? `${CONTROL_TOWER}/api/publications?public=videos`
  : null;

/** Publications photo de l'équipe (Favoris › Découvrir › Photos), publiées par la tour. */
export const POSTS_ENDPOINT: string | null = CONTROL_TOWER
  ? `${CONTROL_TOWER}/api/publications?public=photos`
  : null;

/** Une vidéo compte comme regardée après ce temps de lecture (ou à sa fin, si elle est plus courte). */
export const WATCHED_AFTER_SEC = 3;

/**
 * Sens du geste entre les pages principales.
 * -1 : glisser le doigt vers la gauche avance (Accueil → Favoris → Panier → Commandes → Profil),
 *      vers la droite revient à la page précédente. C'est le sens retenu.
 *  1 : sens inverse.
 */
export const SWIPE_FORWARD: 1 | -1 = -1;

/**
 * Catalogue (produits, photos, prix, offres, règles de quantité).
 *
 * CATALOG_ENDPOINT : catalogue publié par la tour de contrôle (`<tour>/api/catalog?v=2`), au
 * format décrit dans `lib/catalog/schema.ts` (schema: 2). Sans tour, l'application affiche le
 * catalogue d'exemple embarqué.
 */
export const CATALOG_ENDPOINT: string | null = CONTROL_TOWER
  ? `${CONTROL_TOWER}/api/catalog?v=2`
  : null;

/**
 * Relecture du catalogue et du suivi des commandes, application ouverte : toutes les 45 secondes,
 * pour qu'un changement fait dans la tour soit visible en moins de 60 s, latence réseau comprise.
 */
export const REFRESH_MS = 45_000;

/** Relecture manquée (réseau, démarrage de la tour) : un seul nouvel essai, 8 s plus tard. */
export const RETRY_MS = 8_000;

/**
 * Tour de contrôle (application de contrôle de l'équipe).
 *
 * CONTROL_ENDPOINT : adresse du futur service des profils et référentiels (comptes
 * particulier / grossiste / importateur, coordonnées, droits). Tant qu'elle vaut `null`,
 * les profils restent enregistrés sur l'appareil uniquement. Voir `lib/control.ts` pour
 * l'ensemble des points de raccordement et ce que chacun permet de modifier à distance.
 */
export const CONTROL_ENDPOINT: string | null = null;

/**
 * Mise en page « ordinateur » de la version web (barre de navigation en haut, pages pleine
 * largeur). Chantier commencé mais pas terminé ni vérifié : laisser à `false`. Sur grand écran,
 * l'application s'affiche alors dans sa colonne « téléphone », centrée.
 */
export const DESKTOP_WEB = false;
