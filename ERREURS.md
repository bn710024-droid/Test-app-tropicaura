# ERREURS — ce qui reste à corriger (application)

## État au 27/11/2026, soir (branche `nuit-branchement`, en ligne)

- **En ligne** : app https://tropicaura-app.vercel.app · tour https://tropicaura-tour.vercel.app ·
  vraie base Supabase. Les deux PR `nuit-branchement → main` restent ouvertes, non fusionnées.
- **Tests en ligne** (`app/scripts/online/`) : t1 tour → app 80/80 · t2 app → tour + statuts 42/42 ·
  t4 images 20/20 (0 image en 404, 0 image vide) · t5 forfait transport 8/8 · t3 boutons : 954 clics,
  0 erreur. Hors ligne : `test_app.py` 63/63, `tsc` 0 erreur, `npm run build` OK, tests unitaires
  des deux côtés au vert.
- **Corrigé aujourd'hui** : images de la tour revenues ; annonces « toucher » et « image seule » ;
  libellés des étapes pro ; moyens de paiement réglables ; publications photo dans l'app ; cause du
  raté de statut (la position du client écrasait le statut) ; photos des emballages ; forfaits de
  transport réglables dans la tour ; identifiant de compte aléatoire.
- **À faire par l'équipe** : saisir les vrais forfaits de transport (Réglages › Transport) ; ajouter
  les contenus manquants des emballages (tour n° 3).
- **Encore ouvert** (décisions de design ou de produit) : app n° 4, 8, 9 ; tour n° 2, 4, 8.

## Test complet en ligne (27/11 après-midi, `scripts/online/`)

- t1 tour → app : 75/76 ; t2 app → tour + statuts : 31/34 ; t3 chaque bouton (deux apps, 390×844
  et 1440×900) : 954 clics, 0 erreur console / page / réseau.
- Corrigé : relecture 45 s + nouvel essai, vidéos relues sans recharger, textes de l'accueil de la
  tour, cache des vidéos publiques. Données de test retirées (commandes, réactions, fichiers).
- Restant à ce moment-là : n° 10 à 13 ; tour n° 1, 7 et 8 — tous traités depuis, sauf tour n° 8.

Format : écran · étapes pour reproduire · cause probable · correctif proposé. Tout ce qui a pu
être corrigé cette nuit est dans `BUGS.md` (état « Corrigé ») et n'apparaît pas ici.

Relevé automatique de cette nuit (scripts `hunt_errors.py` et `hunt_interactions.py`, 390×844 et
1440×900, ~70 écrans et gestes) : **0 erreur console, 0 erreur de page, 0 requête en échec**.
`npx tsc --noEmit` : 0 erreur. `npx expo lint` : 0 erreur, 26 avertissements (voir n° 7).

---

### 1. ~~Cartes d'emballage sans photo quand l'app est reliée à la tour~~ — corrigé
- **Corrigé** (27/11, soir, tour `ef81e6d`) : un emballage sans photo envoyée publie
  `photo: { asset: 'format:<produit>:<emballage>' }` (et l'aperçu `preview:…`) dans `?v=2` ; l'app
  affiche sa photo embarquée. Test en ligne t4 : photos des emballages affichées.

### 2. ~~Contenu affiché en grammes au-delà du kilo (« contient 5000 g »)~~ — corrigé
- **Corrigé** (27/11, matin) : `lib/weight.ts` — ≥ 1 000 g → « 5 kg », « 1,5 kg », « 1,25 kg » (deux décimales
  au plus, zéros inutiles retirés), < 1 000 g → « 500 g » ; fiche, cartes emballage, texte des commandes, et côté tour
  (`packContent`). Tests : `scripts/test_contents.mjs`, `test_tower_live.py`.

### 3. ~~Forfait transport codé en dur dans l'app~~ — corrigé
- **Corrigé** (27/11, soir, tour `ef81e6d` + `cf40392`, app `a6dfa87`) : tour › Réglages ›
  « Transport des particuliers » (un forfait en euros par zone, mêmes champs que les règles), publié
  dans `?v=2` (`transport.zones`) une fois enregistré. L'app l'applique à la validation et à la
  commande envoyée ; sans réglage (ou retiré), le barème d'exemple de l'app reste appliqué.
- **À faire par l'équipe** : saisir les vrais tarifs (le bloc indique « Barème d'exemple » tant
  qu'ils ne sont pas enregistrés). Tests : `test_transport.mjs`, tour `test-transport.mjs`, en ligne t5.

### 4. Messages de suivi de la tour reçus mais pas affichés
- **Écran** : Commandes › carte de suivi.
- **Cause** : la tour publie un message par statut (`notifications`) ; l'app les enregistre
  (`Order.notifications`) mais la carte n'a pas d'emplacement prévu.
- **Correctif** : afficher le dernier message sous l'étape en cours (`TrackCard`) — décision de
  design.

### 5. ~~Publications photo non affichées~~ — corrigé
- **Corrigé** (27/11, `473551c`) : Favoris › Découvrir › choix Vidéos / Photos ; 1 à 10 photos
  en défilement horizontal, description dessous, J'aime et commentaires comme les vidéos
  (`components/PhotoPosts.tsx`, `lib/posts.ts`, jetons et composants existants seulement).

### 6. Identifiant de compte prévisible (corrigé en partie)
- **Corrigé** (27/11, `a6dfa87`) : nouveau compte = heure de création + 128 bits aléatoires
  (`crypto.getRandomValues`). Les comptes déjà créés gardent leur identifiant.
- **Reste** : aucun secret de compte exigé par la tour pour `GET ?compte=` (statuts seulement).

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

### 10. ~~Annonce « toucher l'image » : l'application affiche quand même un bouton~~ — corrigé
- **Corrigé** (27/11, `473551c`) : `link: 'tap'` → image seule, toute la diapositive ouvre la fiche ;
  `link: 'none'` → image seule, aucun produit exigé (`id: null` accepté par l'app et la tour).
  Test en ligne t1.

### 11. ~~Étapes des demandes pro non affichées au client~~ — corrigé
- **Corrigé** (27/11, `473551c`) : le client voit « Intérêt reçu », « Contacté », « En discussion »
  (libellés de `PRO_STAGES` publiés par la tour). Test en ligne t2.

### 12. ~~Statut parfois visible au-delà de 60 s (raté isolé, 1 sur 14)~~ — cause trouvée, corrigé
- **Cause** (tour, `api/orders.js`) : l'envoi de position de l'app relisait toutes les commandes puis
  réécrivait la commande chiffrée entière. Un statut changé par l'équipe entre la lecture et
  l'écriture était effacé : t2 relisait encore « confirmee » 44 s après le passage à « preparation ».
  Touchait aussi les vrais clients (statut revenu en arrière dans la tour).
- **Corrigé** (tour `a7d4899`) : écritures conditionnelles sur l'empreinte du bloc chiffré ; la
  position est posée sur la copie la plus récente ; l'équipe reprend la position si c'est le seul
  changement, sinon « modifiée par ailleurs, rechargez » (409). Test : `test-stamp.mjs`, en ligne t2.
- **Vérifié en ligne** (t2, 2 passages après correctif) : 8/8 statuts de commande vus en 10–45 s,
  France 4/4, demandes pro 16/16 ; chaque relecture renvoie le statut posé par la tour.

### 13. `test_app.py` doit tourner sur un export SANS tour
- `.env.local` (adresse de la tour) et le cache de Metro s'intègrent à l'export : le Profil affiche
  alors « Connecté » et la vérification « 4 liens non connectés » échoue.
- **Commande** : écarter `.env.local`, puis `npx expo export --platform web --clear`, puis le remettre.
