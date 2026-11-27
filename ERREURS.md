# ERREURS — ce qui reste à corriger (application)

<!-- RÉSUMÉ DE LA NUIT : complété à 5 h 45 -->

Format : écran · étapes pour reproduire · cause probable · correctif proposé. Tout ce qui a pu
être corrigé cette nuit est dans `BUGS.md` (état « Corrigé ») et n'apparaît pas ici.

Relevé automatique de cette nuit (scripts `hunt_errors.py` et `hunt_interactions.py`, 390×844 et
1440×900, ~70 écrans et gestes) : **0 erreur console, 0 erreur de page, 0 requête en échec**.
`npx tsc --noEmit` : 0 erreur. `npx expo lint` : 0 erreur, 26 avertissements (voir n° 7).

---

### 1. Cartes d'emballage sans photo quand l'app est reliée à la tour
- **Écran** : fiche produit › « Choisissez votre format ».
- **Reproduire** : app reliée à la tour, ouvrir « Mangue séchée » : les cartes Sachet / Pot /
  Carton n'ont pas d'image (elles en ont avec le catalogue embarqué).
- **Cause** : la tour ne publie une photo d'emballage que si l'équipe l'a téléversée
  (`photo_url`) ; les photos embarquées de l'app (`format:<produit>:<emballage>`) ne sont pas
  référencées. Choix volontaire (consigne « photo:{url}|undefined »).
- **Correctif** : téléverser les photos dans la tour (Produits › Emballages), ou publier
  `photo: { asset: 'format:<produit>:<emballage>' }` par défaut dans `shared/catalog-v2.js`.

### 2. Contenu affiché en grammes au-delà du kilo (« contient 5000 g »)
- **Écran** : fiche produit avec un emballage de 5 kg.
- **Cause** : l'app affiche `grams` tel quel.
- **Correctif** : afficher en kg à partir de 1 000 g dans `lib/format.ts` (non fait : texte de la
  fiche, à valider par vous). Le libellé de prix, lui, est corrigé (« par cagette de 5 kg »,
  publié par la tour).

### 3. Forfait transport codé en dur dans l'app (6 € Sénégal, 48 € France…)
- **Écran** : Validation de commande › Transport.
- **Cause** : `transportFee()` (lib/countries.ts) ; la tour ne publie aucun tarif. Ce montant
  part avec la commande (`transportCost`).
- **Correctif** : publier les forfaits par pays depuis la tour (réglage Livraison) et les lire
  dans `?v=2`, ou afficher « à confirmer ». Donnée à valider par l'équipe.

### 4. Messages de suivi de la tour reçus mais pas affichés
- **Écran** : Commandes › carte de suivi.
- **Cause** : la tour publie un message par statut (`notifications`) ; l'app les enregistre
  (`Order.notifications`) mais la carte n'a pas d'emplacement prévu.
- **Correctif** : afficher le dernier message sous l'étape en cours (`TrackCard`) — décision de
  design.

### 5. Publications photo non affichées
- **Écran** : Favoris › Découvrir.
- **Cause** : aucun écran photo dans l'app ; la tour publie `?public=photos`.
- **Correctif** : ajouter un onglet Photos (le correctif obsolète de la tour contient un
  `PhotoPosts.tsx` de référence).

### 6. Identifiant de compte prévisible
- **Cause** : dérivé de l'heure de création ; `GET ?compte=` ne livre que des statuts.
- **Correctif** : identifiant aléatoire 128 bits + secret de compte (SecureStore) exigé par la tour.

### 7. 26 avertissements ESLint (règles du compilateur React)
- **Cause** : `react-hooks/immutability`, `refs`, `set-state-in-effect`, `use-memo` signalent
  les valeurs partagées Reanimated (`x.value = …`) dans TabBar, Reels, ProductCard, PageSwipe,
  PressableScale, HeartButton… C'est le fonctionnement normal de Reanimated.
- **Correctif** : aucun nécessaire ; code d'animation volontairement non touché.

### 8. Emballages réservés aux professionnels non proposés aux pros
- **Cause** : l'app n'affiche les formats que dans l'espace particuliers ; la tour exclut
  `audience: 'pros'` de `?v=2`.
- **Correctif** : à décider (les pros commandent par offre avion / bateau).

### 9. Bandeau : accroche « Campagne à venir · dès mai » déduite par l'app
- **Cause** : la tour n'a pas de champs `kicker` / `title` pour une annonce ; l'app les déduit
  de la saison du produit.
- **Correctif** : ajouter accroche et titre à l'éditeur d'annonce de la tour (publiés tels quels).
