# ERREURS — ce qui reste à corriger (application)

## Résumé de la nuit (27/11/2026, branche `nuit-branchement` des deux dépôts)

1. L'app lit la tour (`?v=2`, format de l'app) : prix, masquage, emballages, prix par pays, rayons, annonces, GP — visibles en ≤ 60 s sans recharger.
2. Commandes, demandes pro, introuvables et réactions vidéo partent vers la tour ; statuts relus toutes les 60 s ; file locale + renvoi après coupure.
3. Testé de bout en bout contre une tour LOCALE (base simulée, pas de clés Supabase sur le poste) : `test_tower_live.py` 36/36.
4. Non-régression : `test_app.py` 63/63 ; `tsc` 0 erreur ; lint 0 erreur des deux côtés ; `expo export` et `npm run build` OK.
5. Relevé automatique ~90 écrans et gestes (390×844, 1440×900) : 0 erreur console / page / réseau.
6. Textes devenus faux corrigés (tour : « appliquez le correctif », adresse `?v=2`… ; app : « aucune commande transmise »…).
7. Tour : pays GP, montants dans leur devise (F CFA), devises jamais additionnées dans les statistiques, `npm run local`.
8. Non fait (décision de design) : publications photo, messages de suivi affichés, photos d'emballage. (Contenus en kg dès 1 000 g : corrigé le 27/11 au matin.)
9. À configurer par toi (`A-CONNECTER.md`) : variables Supabase de la tour, `EXPO_PUBLIC_CONTROL_TOWER_URL`, identité EAS.
10. Non testé : téléphone, vraie base Supabase, déploiement Vercel. Aucun style ni animation modifié (quai, carrousel, emballages intacts) ; seul ajout visuel : la carte « Produit introuvable » demandée.

## Test complet en ligne (27/11 après-midi, `scripts/online/`)

- t1 tour → app : 75/76 ; t2 app → tour + statuts : 31/34 ; t3 chaque bouton (deux apps, 390×844
  et 1440×900) : 954 clics, 0 erreur console / page / réseau.
- Corrigé : relecture 45 s + nouvel essai, vidéos relues sans recharger, textes de l'accueil de la
  tour, cache des vidéos publiques. Données de test retirées (commandes, réactions, fichiers).
- Restant : n° 10 à 13 ci-dessous ; tour n° 1, 7 et 8.

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

### 2. ~~Contenu affiché en grammes au-delà du kilo (« contient 5000 g »)~~ — corrigé
- **Corrigé** (27/11, matin) : `lib/weight.ts` — ≥ 1 000 g → « 5 kg », « 1,5 kg », « 1,25 kg » (deux décimales
  au plus, zéros inutiles retirés), < 1 000 g → « 500 g » ; fiche, cartes emballage, texte des commandes, et côté tour
  (`packContent`). Tests : `scripts/test_contents.mjs`, `test_tower_live.py`.

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

### 10. Annonce « toucher l'image » : l'application affiche quand même un bouton
- **Écran** : Accueil › bandeau d'annonces.
- **Reproduire** : tour › Publications › Annonces › image + lien « Toucher l'image » (produit Poire)
  → l'application montre le bouton « Voir la poire » sous l'image.
- **Cause** : `components/HomeHero.tsx` ignore `link` (`tap` / `button`) publié par `?v=2`.
- **Correctif proposé** : pour `link: 'tap'`, rendre toute la diapositive touchable et ne pas
  afficher de bouton. Non fait : touche au bandeau (design) — à valider.

### 11. Étapes des demandes pro non affichées au client (« Contacté », « En discussion »)
- **Écran** : Commandes / Demandes (compte professionnel).
- **Reproduire** : tour › demande pro › étape « Contacté » puis « En discussion » → le client
  voit toujours « En attente de réponse » (test en ligne t2).
- **Cause** : `stageLabel` est reçu et enregistré, mais la carte de suivi n'affiche que le statut.
- **Correctif proposé** : afficher `stageLabel` sous le statut dans la carte pro (texte seul).

### 12. Statut parfois visible au-delà de 60 s (corrigé en partie)
- **Mesuré en ligne** (t2, 3 passages) : statuts vus en 18–60 s, avec un raté isolé par passage
  (> 75 s) sans erreur réseau relevée.
- **Corrigé** (commit `fa6dde5`) : relecture toutes les 45 s (au lieu de 60) et un nouvel essai
  8 s après une relecture manquée ; dernier passage : 18–44 s, un raté sur 14 statuts.
- **Si cela persiste** : relire toutes les 20 s tant qu'une commande est en cours, ou recevoir les
  changements de la tour (temps réel Supabase / notifications).

### 13. `test_app.py` doit tourner sur un export SANS tour
- `.env.local` (adresse de la tour) et le cache de Metro s'intègrent à l'export : le Profil affiche
  alors « Connecté » et la vérification « 4 liens non connectés » échoue.
- **Commande** : écarter `.env.local`, puis `npx expo export --platform web --clear`, puis le remettre.
