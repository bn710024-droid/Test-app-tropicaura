# Catalogue — source de données des applications

Ce dossier prépare la liaison avec le futur **logiciel de contrôle sur ordinateur**. Ce logiciel
n'existe pas encore et **rien n'est connecté** : l'application affiche un catalogue d'exemple
embarqué.

## Les fichiers

| Fichier | Rôle | État |
|---|---|---|
| `schema.ts` | Format du catalogue : produits, photos, descriptions, disponibilités, prix, unités, offres particuliers et professionnels, modes avion / bateau, règles de quantité, **choix de format / emballage (`formats`)**. Vérification d'un document reçu (`parseCatalog`). | En service |
| `rules.ts` | Calculs : minimums, paliers, conteneurs, équivalent en kilos, totaux, contrôle des quantités saisies. | En service, testé |
| `build.ts` | Passage du catalogue aux écrans, selon le profil (particulier, grossiste ou importateur, autre professionnel). | En service |
| `embedded.ts` | Catalogue **d'exemple** embarqué (`example: true`). | Données d'exemple |
| `source.ts` | Chargement du catalogue publié, avec copie de secours sur l'appareil. | **Préparé, non connecté** |

## Ce qui se modifie dans les données, sans toucher aux écrans

- Les produits, leurs photos (`photo.asset` pour une image embarquée, `photo.url` pour une image
  publiée), leurs descriptions, leurs mois de disponibilité, leur visibilité (`available`).
- Le prix particulier et son unité (`retail`). Sans prix, le produit n'est pas proposé aux
  particuliers.
- Les offres professionnelles (`wholesale`) : une par mode (`avion`, `bateau`, ou `null` pour une
  offre sans mode), avec ses prix EXW et FOB, l'unité du prix (`kg` ou `conteneur`) et, si besoin,
  ses propres minimum, palier, maximum et poids de conteneur.
- **Les choix de format / emballage (`formats`)**, pour tous les produits : une carte par
  emballage **actif** (`available: false` = désactivé par l'équipe, jamais proposé) —
  libellés libres : **« Carton », « Sachet », « Box », « Pot »**, barquette, filet… (`id`, `label`, `detail`, `grams`, `price`, `noun`, `photo`,
  `preview`, `unit` : `'kg'` pour un format au poids ou `'unit'` pour un conditionnement,
  `step` et `unitLabel` si besoin). Un produit peut n'avoir qu'un seul emballage ou
  plusieurs : la fiche les affiche tous au-dessus de la carte « Saison », et le format
  coché donne son prix et son unité au total, au panier et à la commande.
  - `photo` : photo de l'emballage seul ; `preview` : photo du **produit avec cet
    emballage** — elle habille l'aperçu en haut de la fiche (et l'anneau du carrousel) dès
    sa publication ; en attendant, l'application montre le produit détouré. Choisir un
    emballage fait remonter la fiche vers l'aperçu.
  - `price: null` : emballage annoncé mais prix pas encore fixé → carte « Prix à compléter »,
    aucun total calculé, ajout au panier bloqué avec explication.
  - **Disponibilité par pays de l'emballage** (`visibility`, indépendante de celle du
    produit) : un emballage peut être configuré pour un pays avant que le produit y soit
    commercialisé — le produit reste prioritaire : s'il n'est pas visible dans le pays,
    rien n'est proposé. `visibility: { mode: 'pays' | 'monde' | 'monde_sauf', countries }`.
  - **Réglages par pays** (`settings`) : pour chaque emballage, un pays peut avoir sa
    disponibilité (`available`), son **prix** et sa **devise** (`price`, `currency` — aucune
    conversion calculée), sa **photo** et son visuel `preview` ; ces choix sont indépendants
    (photo propre avec prix d'origine possible, et inversement). Sans réglage applicable :
    prix et photo d'origine. Pays inconnu : seuls les réglages « monde » s'appliquent.
    Devises mélangées au panier : totaux séparés par devise, paiement bloqué tant que le
    total n'est pas certain.
  - **Sans `formats` publiés**, le produit se vend simplement dans son mode initial
    (kilo ou pièce) : aucune section d'emballage, rien d'inventé. Publier `formats` depuis
    le logiciel de contrôle ajoute le choix d'emballage, sans rien casser.
  - Le champ `demo: true` signale une ligne de démonstration à remplacer.
- **La visibilité par pays (`visibility`)** de chaque produit, pour tous les profils :
  `{ mode: 'pays', countries: ['SN'] }` (uniquement ces pays), `{ mode: 'monde' }` (défaut),
  ou `{ mode: 'monde_sauf', countries: ['FR'] }` (partout sauf ces pays). La règle s'applique
  aux listes, catégories, recherche, fiches, paniers et liens directs, en particulier comme
  chez les professionnels ; le pays retenu est celui de l'adresse de livraison, sinon le
  pays de l'appareil (fuseau/langue, sans autorisation).
- **La livraison GP (`delivery.gp`)** : par pays, les modalités réellement convenues
  (`['domicile']`, `['aéroport']`, les deux). Liste vide tant que rien n'est arrêté :
  l'application ne présente alors aucune option GP comme disponible et n'invente ni tarif
  ni délai. La livraison Sénégal (livreurs moto, à domicile) est gérée par l'application
  côté parcours particulier.
- **Les annonces de l'accueil (`campaigns`)** : une par bandeau, avec le produit concerné
  (`id`), l'image de fond (`photo`), les textes (`accent`, `body`, `kicker`, `title`, `cta`),
  l'état de diffusion (`enabled`) et la période (`startsAt`, `endsAt`, ISO). L'application
  n'affiche que les annonces activées et dans leur période ; une annonce éteinte ou périmée
  disparaît de l'accueil sans laisser de cadre vide. Aucune annonce publiée : aucun bandeau.
- Les règles générales (`rules`) : minimum et palier par avion (500 kg / 500 kg), minimum en
  conteneurs par bateau (1), poids de référence d'un conteneur (22 000 kg, « Europe »).

Un prix absent (`null`) n'est jamais remplacé : l'offre s'affiche « Prix à confirmer » et n'entre
dans aucun total.

## Pour connecter le logiciel de contrôle, plus tard

1. Faire publier par le logiciel un document JSON au format de `schema.ts` (`schema: 1`).
2. Renseigner son adresse dans `lib/config.ts` (`CATALOG_ENDPOINT`).
3. Tester `source.ts` contre ce serveur : ce chemin n'a jamais été exercé en conditions réelles.

Restent à développer côté serveur : l'authentification, la publication des photos, et la
répercussion en temps réel (aujourd'hui, le catalogue serait relu à l'ouverture de l'application).
