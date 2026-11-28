# RAPPORT — Projet Primeur (app-tropicaura)

Ce fichier garde la trace de chaque passage de modifications. Nouvelles entrées en tête.

---

## MÉMOIRE POUR LES PROCHAINS PROMPTS (application + tour de contrôle)

À recopier tel quel dans les prochains prompts pour ne rien perdre en route :

1. **Priorité mobile** ; ne jamais casser l'apparence ni le comportement desktop (colonne
   centrée, `DESKTOP_WEB = false`) ; quai « quantité / total / ajouter » de la fiche produit
   conservé strictement (barre verticale verte, pastille « + », tuile Total).
2. **Catégories** : Tout, De saison, Fruits, Légumes, Agrumes, Fruits rouges, Exotiques,
   **Séchés**, **Transformés**, Aromates — pastilles rondes illustrées, défilement horizontal,
   filtrage réel, recherche/fiches/panier cohérents.
3. **Emballages FACULTATIFS, publiés par la base de contrôle** (section « Choisissez votre
   format » au-dessus de la carte « Saison ») : à l'ouverture AUCUN emballage coché — le
   produit initial (visuel, prix, unité, min/palier/max configurés) s'applique ; carte
   « Produit initial » pour revenir en arrière ; produit sans emballage publié = aucune
   section, rien d'inventé ; prix d'un emballage = prix GLOBAL par emballage, quantité =
   nombre d'emballages (min/step/max propres, contenu en grammes, contenu total affiché) ;
   `price: null` → « Prix à compléter », ajout bloqué ; emballage désactivé jamais proposé ;
   chaque emballage = ligne de panier distincte (`produit:emballage`), jamais mélangée au
   produit initial ; au choix : aperçu mis à jour (photo `preview` dès publication,
   description propre de l'emballage) + remontée automatique en haut.
4. **Carrousel de fiche** : anneau en arc/demi-cercle, très fluide, bouclant dernier ↔ premier,
   photo/nom/description/prix mis à jour à chaque cran ; retour, favoris, quantité, total,
   ajout vérifiés ; préférence « réduire les animations » respectée.
5. **Offres pro** : particuliers préservés ; avion min 500 kg paliers 500 kg ; bateau min
   1 conteneur + sélection rapide du nombre ; poids par conteneur configurable par offre
   (référence 22 000 kg « Europe ») ; mode/quantité/unité affichés fiche, demande, récap ;
   totaux calculés uniquement sur prix réellement configurés.
6. **Accueil** : aucun bandeau de campagne tant que la base de contrôle n'a rien publié
   (`CAMPAIGNS` vide) — le bandeau réapparaît automatiquement dès qu'une annonce est publiée
   (image de fond plein cadre + textes libres : `photo`, `kicker`, `title`, `cta`, avec
   kicker « Campagne à venir · dès … », titre serif + accent or italique, bouton « Voir … »,
   points de pagination). Les filtres de rayons sont montés tout en haut de l'accueil
   téléphone, juste sous la barre recherche/logo/panier.
7. **Tour de contrôle** : UNE adresse, `EXPO_PUBLIC_CONTROL_TOWER_URL` (`lib/config.ts` en
   dérive tous les raccordements). L'app lit `<tour>/api/catalog?v=2` (`schema: 2`, format de
   `lib/catalog/schema.ts` + `categories`, `filters`, `payments`, `productRequest`,
   `countryPrices`, `transport`) à l'ouverture / 45 s (+ nouvel essai à 8 s) / premier plan ; envoie commandes, demandes pro,
   introuvables (`/api/orders`) et réactions vidéo (`?public=reactions`) ; relit les statuts
   (`/api/orders?compte=`). Sans adresse : catalogue d'exemple, rien n'est envoyé. Le correctif
   `app-tropicaura.patch` de la tour est OBSOLÈTE : ne jamais l'appliquer.
   Tests : `scripts/test_app.py` (sans tour) et `scripts/test_tower_live.py` (avec la tour
   locale `npm run local`).
8. **Honnêteté des données** : aucune donnée commerciale inventée sans être marquée
   (puce « Données de démonstration », note sous les formats, `example: true`, `demo: true`) ;
   aucun paiement / envoi réel présenté comme tel.
9. **Rapport écrit à chaque passage** dans ce fichier (modifications + vérifications
   réellement effectuées + points restants).
10. **Visibilité par pays** (`visibility` : 'pays' / 'monde' / 'monde_sauf') appliquée à tous
    les parcours (particulier, grossiste, importateur), listes, recherche, fiches, panier et
    liens directs ; pays = adresse de livraison sinon pays appareil ; un produit masqué ne
    peut pas être commandé.
11. **Livraison** : Sénégal = domicile par livreurs moto (téléphone + position partagée
    uniquement après accord, repli adresse/repère si refus, pas de suivi temps réel promis) ;
    Europe = GP avec seulement les options réellement configurées (`delivery.gp`), sans
    tarif ni délai inventés ; pros inchangés (EXW/FOB).
12. **Inscription** : parcours en 4 étapes avec barre de progression — 1) type seul,
    2) « Vos informations » (particulier : nom, téléphone, e-mail facultatif, pays
    obligatoire, pas d'adresse ; pro : nom, société, téléphone, WhatsApp, pays),
    3) « Choix de connexion » (numéro ou e-mail — aucun SMS payant ; Apple/Google préparés,
    non connectés), 4) recommandation facultative. `clientCountry` = adresse de livraison →
    pays du compte → pays appareil ; il pilote offres/produits visibles. Panier :
    « Valider pour moi » (localisation demandée avant paiement au Sénégal) ou
    « Valider pour un proche » (lien de localisation facultatif, sinon adresse + numéro) ;
    confirmation particulier : le téléphone suffit, e-mail facultatif. Suivi SN :
    « Livreur en route ».

---

## Passage 21 — 28 novembre 2026 : particuliers = produits emballés, prix par zone

- **Zones et devises** (une seule source, tour `shared/zones.js`, copie de secours `lib/zones.ts`) :
  F CFA (SN CI ML BF NE BJ TG GW), € (UE + GB CH NO IS LI MC AD SM VA ME XK), $ partout ailleurs
  et pays inconnu. La devise vient du pays du COMPTE, jamais choisie à la main.
- **Fiche tour** : type particuliers (Emballé / Frais) en tête, bloc Emballages après Identité,
  grille de prix 3 colonnes (case vide = pas vendu dans cette zone), pays zone / seulement / sauf,
  photo seule + photo produit dans l'emballage, emballage par défaut, alerte « devise inversée »,
  aperçu SN / CI / FR / US / MA. Transport : 3 montants par zone.
- **Migration en ligne** (liste validée avant) : 38 produits frais « Pour les particuliers »
  désactivés (prix gardés) ; 4 séchés/transformés → emballés ; baobab « Sachet Sénégal »
  2 500 F CFA (SN seulement) ; pot de bissap sans prix rendu inactif. Rien supprimé.
- **App** : carte = produit nu au prix de l'emballage par défaut dans la devise du client ; fiche
  ouverte sur l'emballage par défaut, plus de « Produit initial » ; panier, transport et commande
  dans une seule devise ; changement de pays du compte → panier vidé avec message.
- **Rangée d'emballages** : un glissement qui y commence ne change plus de produit (doigt, souris,
  molette). Sur le web `manager.fail()` n'interrompait pas le geste : remplacé par un verrou.
- **Tests** : `test_app.py` 63/63 ; en ligne `t7_b2c.py` 32/32 (comptes SN, FR, US ; produit et
  emballages TEST supprimés, transport remis à sa valeur d'avant).

---

## Passage 20 — 28 novembre 2026 (nuit) : paniers en cours, audit de correspondance, tests sûrs

**Demandes** : paniers en cours app → tour ; plus aucune remise à zéro globale (le propriétaire saisit
de vraies données) ; audit de chaque champ tour → ?v=2 → app, test à la main d'un emballage, correction
des « non ».

**Fait**
- Tests : journal ciblé (un réglage n'est remis que s'il n'a pas changé) ; t1/t3 refusés sur le
  catalogue réel ; éléments TEST seulement, retirés un par un.
- Paniers : horodatage des lignes, secret de compte, envoi de l'état complet (3 s / arrière-plan),
  table `carts`, prix recalculés par la tour, page « Paniers » (filtres, tri, KPI par devise),
  fiche avec relance WhatsApp / appel / e-mail, lien commande et client, tableau de bord.
- Audit (`AUDIT.md` de la tour) : 98 champs ; corrigés — maximum d'emballage, devise F CFA (prix
  par pays des emballages et forfait de transport), offre pro sans mode, référence du conteneur,
  illustration des rayons, nom d'unité, « · » seul, surtitre/titre des annonces ; restants annoncés
  dans la tour.

**Vérifié** : t2 61/61 (paniers 19/19) · t6 (emballage à la main) 13/13 · test_app 63/63 · tests unitaires tour
(paniers 12, catalogue 16, transport 10…) et app · revue de code : 0 critique, 0 majeur.

**Reste** : t1 à réécrire sur des éléments TEST ; rapport des photos (carrousel) ; décisions :
emballages pros, texte des annonces image, titre des vidéos.

---

## Passage 19 — 27 novembre 2026 (jour et soir) : mise en ligne, test complet, correctifs

**Demande** : brancher Supabase + Vercel, remplir la base, test complet en ligne (tour → app,
app → tour, statuts, chaque bouton), rendre les images à la tour, corriger les KO 1 à 5 ; puis,
propriétaire absent : « fais tout pour que l'application soit prête ».

**En ligne** : app https://tropicaura-app.vercel.app · tour https://tropicaura-tour.vercel.app ·
Supabase (RLS, rôle serveur seul). Branche de production Vercel = `nuit-branchement` (à remettre
sur `main` après fusion). PR n° 1 des deux dépôts ouvertes, non fusionnées.

**Corrigé / ajouté**
- Images de la tour revenues (liste des photos embarquées + 4 photos webp) ; photos des emballages
  publiées (`format:<produit>:<emballage>`).
- Annonces : « toucher l'image » (image seule, ouvre la fiche) et « image seule » sans produit.
- Demandes pro : « Intérêt reçu », « Contacté », « En discussion » affichés au client.
- Tour › Réglages : moyens de paiement (interrupteurs) et forfaits de transport par zone (en euros),
  publiés dans `?v=2` ; l'app les applique, sinon son barème.
- Publications photo : Favoris › Découvrir › Photos (1 à 10 photos, description, J'aime, commentaires).
- Raté de statut (1 sur 14) : cause trouvée côté tour — la position du client réécrivait la commande
  entière et effaçait un statut changé au même moment ; écritures conditionnelles.
- Photos remplacées ou retirées dans la tour : fichier supprimé du stockage si plus rien ne le cite
  (9 fichiers de test laissés par les passages précédents retirés à la main).
- Identifiant de compte : 128 bits aléatoires. Relecture du catalogue 45 s + nouvel essai.

**Vérifié (en ligne)** : t1 tour → app 81/81 · t2 app → tour + statuts 42/42 · t4 images 20/20 ·
t5 transport 8/8 · t3 boutons 954 clics, 0 erreur. Hors ligne : `test_app.py` 63/63, `tsc` 0 erreur,
tour `npm run build` OK, tests unitaires (contenus, catalogue v2, paiements, transport, empreinte).
Revue de code des correctifs de concurrence et du transport : 0 critique, 0 majeur.

**Reste** : voir `ERREURS.md` (app n° 4, 8, 9 ; tour n° 2, 4) ; vrais forfaits de transport à
saisir par l'équipe.

---

## Passage 18 — nuit du 27 novembre 2026 : branchement réel sur la tour de contrôle

**Demande** : brancher l'app sur la tour (catalogue v2, commandes, suivi, demandes pro,
introuvables, annonces, publications), chasse aux erreurs, Vercel ; mode autonome. Travail sur la
branche `nuit-branchement` (pas `main`). Décisions : `DECISIONS.md`. Réglages restants :
`A-CONNECTER.md`. Ce qui reste à corriger : `ERREURS.md`.

**Fait**
- `lib/config.ts` : `CONTROL_TOWER` (variable `EXPO_PUBLIC_CONTROL_TOWER_URL`) → `CATALOG_ENDPOINT`
  (`?v=2`), `TEAM_ENDPOINT`, `VIDEOS_ENDPOINT`, `REFRESH_MS = 60 s` ; `TEST_TOOLS = !CONTROL_TOWER`.
- `lib/catalog/schema.ts` : `schema` 1 ou 2 ; `categories`, `filters`, `payments`,
  `productRequest`, `countryPrices` (particuliers et pros) ; `forCountry()` applique le prix du
  pays du client (adresse → compte → appareil).
- `lib/catalog/source.ts` : `watchCatalog` (ouverture, 60 s, `AppState` actif), rendu seulement
  si le document change, copie hors ligne ; panier relu contre la dernière copie au démarrage.
- Rayons et filtres du document (nom, ordre, nouveaux rayons) ; illustrations de l'app gardées
  sauf photo publiée par l'équipe (design inchangé).
- Commandes particuliers → `POST /api/orders` (`type: 'commande'`, devise, position, pour un
  proche) avec file locale (`transmitted: false`) et renvoi ; suivi `GET ?compte=` → statut,
  date, messages ; demandes pro (format v2 existant) + étape en clair.
- `components/MissingProduct.tsx` (repris du correctif, mêmes jetons de style) sous la recherche
  quand rien n'est trouvé dans TOUT le catalogue → `produit_introuvable`.
- Bandeau d'annonces construit sur les produits publiés ; paiements lus dans le catalogue ;
  état vues/J'aime/commentaires envoyé à `?public=reactions` (sans le nom du compte).
- Textes devenus faux corrigés (Profil « Vos données », Validation « aucune commande
  transmise »), selon que la tour est branchée ou non.
- Position pour le livreur rafraîchie tant que la tour renvoie `tracking: true` (sans redemander
  l'accord) ; références de commande sur 6 caractères ; carte « Tour de contrôle » du Profil
  exacte ; `DesktopHero` sur les annonces publiées.
- `vercel.json` (build, `no-store`, `immutable`) ; ESLint (`expo lint`) configuré, 0 erreur.
- Côté tour (même branche) : `?v=2`, pays GP, devise des commandes (F CFA), statistiques sans
  mélange de devises, libellé « par cagette de 5 kg », textes faux corrigés, `npm run local`.

**Testé réellement** (navigateur Chromium via Playwright, contre la tour LOCALE — base simulée)
- `npx tsc --noEmit` : 0 erreur. `npx expo export --platform web` : OK.
- `scripts/test_app.py` (export sans tour, 390×844) : **63/63**.
- `scripts/test_tower_live.py` (390×844) : **36/36** — prix modifié + produit masqué +
  emballage ajouté dans la tour visibles en 53–55 s sans recharger (« 14,50 € par cagette de
  5 kg ») ; prix Sénégal (`countryPrices`) ; annonce publiée puis retirée ; introuvable reçu ;
  commande reçue (lignes, devise, position) → paiement pointé → « Validée » dans l'app en
  42–46 s ; position du livreur rafraîchie sans nouvel accord ; commande passée pendant une
  coupure réseau → gardée puis renvoyée en ~50 s ; GP France proposé à la validation ; demande
  pro → « Contrat conclu » → « Confirmée ».
- Relevé d'erreurs (`hunt_errors.py` : ~50 écrans ; `hunt_interactions.py` : ~35 gestes —
  favoris, Découvrir, profil, adresse, commande pour un proche, crédits, déconnexion /
  reconnexion ; tour : fiche modifiée et enregistrée via l'interface, rayon, annonce, prix,
  livraison, introuvables) à 390×844 et 1440×900 : **0 erreur console / page / réseau**.

**Non testé** : sur téléphone (iOS / Android) ; contre la vraie base Supabase (aucune clé sur
le poste) ; déploiement Vercel (aucun projet créé).

**Restant** : voir `ERREURS.md` (photos d'emballage, forfait
transport codé en dur, messages de suivi non affichés, publications photo, identifiant de compte
prévisible…) et `A-CONNECTER.md` (Supabase, variable de la tour, identité EAS).

---

## Passage 17 — 25 novembre 2026 : emballages par pays (dispo, prix, devise, photo) + devises au panier

**Demande** : deux disponibilités distinctes (produit / emballage) ; photo d'origine par
emballage + photo propre par pays ; prix propre ou prix d'origine par pays, avec devise,
sans conversion inventée ; total incertain interdit ; le reste (ouverture sans
présélection, remontée, livraison SN, GP non inventés) déjà en place.

**Fichiers modifiés**
- `lib/catalog/schema.ts` : `FormatCountrySetting` (mode pays/monde/monde-sauf, `available`,
  `price`, `currency`, `photo`, `preview`) ; `CatalogFormat.visibility`, `.currency`,
  `.settings` ; parsing complet.
- `lib/catalog/rules.ts` : `resolveFormatForCountry()` / `resolveFormatsForCountry()` —
  l'emballage n'est proposé que s'il est actif ET visible dans le pays du client ; les
  réglages applicables remplacent dispo/prix/devise/photos ; pays inconnu → réglages
  « monde » seulement ; aucune conversion.
- `lib/catalog/build.ts` : `retailSpace` résout les emballages **par pays** (le produit
  reste filtré d'abord par sa propre visibilité) ; lignes `produit:emballage` avec devise.
- `lib/format.ts` : `money(n, devise)` (EUR → « 3,90 € », XOF/XAF → « 2 500 F CFA », autre
  code ISO) ; `priceText`/`lineTotalText` suivent la devise de la ligne.
- `lib/store.tsx` : `totalsByCurrency` (jamais de somme entre devises) ; `Order.currency` ;
  message de confirmation dans la devise de la commande.
- `screens/CheckoutScreen.tsx` : récapitulatif par devise ; **paiement bloqué** si devises
  mélangées (total « À confirmer » + explication) — aucune commande à total incertain.
- `screens/CartScreen.tsx` : sous-totaux par devise.
- `screens/{SuccessScreen,OrdersScreen}.tsx` : montants dans la devise de la commande.
- `lib/data.ts` (exemples) : carton de la mangue séchée réservé au Sénégal (`visibility`) ;
  sachet de baobab à 2 500 F CFA au Sénégal (`settings`, donnée d'exemple, pas une
  conversion).
- `components/FormatPicker.tsx` : prix des cartes dans leur devise.

**Tests réellement effectués** : build web + **63 vérifications Playwright, 0 échec** —
compte Sénégal : sachet baobab affiché « 2 500 F CFA », carton mangue séchée proposé ;
compte États-Unis : carton SN masqué, sachet au prix d'origine en EUR, aucun montant XOF ;
ouverture sans présélection, remontée auto, retour au produit initial, panier à lignes
distinctes (18,10 €), emballage désactivé masqué, produit sans emballage sans section,
livraison SN (position avant paiement), visibilité produit par pays, parcours pro inchangé.

**Ce qui fonctionne réellement** : toutes les règles ci-dessus, sur le catalogue embarqué
(exemple). **Non connecté** : `CATALOG_ENDPOINT` = `null` — les réglages par pays
(photos propres, prix/devises, disponibilités) seront publiés par la tour de contrôle ;
le mécanisme est testé via le document d'exemple, pas contre un vrai serveur.

**Points restants** : photos propres par pays (le schéma les accepte, aucune publiée) ;
profil pro : les emballages ne s'appliquent qu'au parcours particulier (les pros gardent
offres avion/bateau EXW/FOB en EUR) — à confirmer côté équipe ; paiement multi-devises
bloqué tant qu'aucun prestataire n'est configuré.

---

## Passage 16 — 25 novembre 2026 : vérification « modifications activées » + anti-cache

**Signalement** : « on ne voit rien » — suspicion de modifications non activées.

**Vérifications réellement effectuées** : le bundle servi en production est **identique**
(même empreinte) à celui construit localement et contient bien le nouveau comportement
(« Produit initial », « contenu total », plus aucun emballage déduit « Kraft »). Les
modifications SONT actives ; l'aperçu affichait une copie en cache.

**Action** : en-têtes `Cache-Control: no-store, must-revalidate` ajoutés sur `/` et
`/index.html` dans `vercel.json` + redéploiement immédiat. Si l'aperçu paraît encore
ancien : le recharger (bouton rafraîchir de l'aperçu ou vidage du cache du navigateur).

---

## Passage 15 — 25 novembre 2026 : produit initial sans emballage présélectionné, emballages facultatifs, prix par emballage

**Demande** (remplace l'instruction « emballage affiché par défaut ») : à l'ouverture, le
produit initial seul (visuel, prix, unité, minimum/palier/maximum configurés), rien de
coché ; emballages facultatifs (aucun publié = pas de section, rien d'inventé) ; prix
d'emballage = prix GLOBAL par emballage, quantité = nombre d'emballages avec ses règles ;
retour possible au produit initial ; panier sans mélange ; aperçu mis à jour + remontée
automatique ; architecture prête pour les photos produit détouré / produit emballé.

**Fichiers modifiés**
- `lib/catalog/build.ts` : suppression des emballages déduits automatiquement (« Sachet /
  Carton » inventés pour tous les produits) — un produit sans emballage publié se vend
  dans son mode initial, sans section ; chaque emballage actif devient une **ligne
  commandable distincte** `produit:emballage` (prix global, min/step/max propres) ;
  `formatLine()` construit ces lignes.
- `lib/catalog/schema.ts` : `CatalogFormat` gagne `description`, `min`, `step`, `max` ;
  `unit` devient optionnel (un emballage se commande à l'unité) ; prix documenté comme
  global par emballage.
- `lib/data.ts` : `ProductFormat.description/min/step/max` ; champs de ligne
  `formatId/formatLabel/formatDescription/formatGrams` ; exemples : oignon minimum 4 kg
  (palier 0,5), courgette minimum 1 kg, pot de baobab description + règles 1 à 10 pots.
- `lib/format.ts` : `selectedFormat` ne présélectionne PLUS rien (`null` à l'ouverture) ;
  suppression de `withFormat` (les lignes portent déjà leurs règles) ; `contentsText`
  (« 2 pots = 10 kg ») ; `inCartLabel` et `requestLineText` gèrent les lignes emballage.
- `lib/store.tsx` : totaux et lignes de commande lus directement sur les lignes (jamais de
  mélange initial/emballage) ; `OrderLine.qtyText` fige « 2 pots (400 g) » à la commande.
- `screens/ProductScreen.tsx` : à l'ouverture, produit initial (quantité = minimum
  configuré) ; carte « Produit initial » pour revenir en arrière (désélection) ; ligne
  « Contenu : X g par pot · contenu total Y » ; description propre à l'emballage affichée
  au-dessus de la description générale ; aperçu haut = photo `preview` de l'emballage
  choisi dès qu'elle est publiée ; remontée automatique conservée.
- `components/FormatPicker.tsx` : carte « Produit initial » en tête (cochée à l'ouverture),
  prix des emballages affiché « par sachet / par pot » avec contenu en grammes.
- `screens/CartScreen.tsx` : chaque ligne affiche son emballage dans la ligne de prix
  (« Pot · 5,20 € le pot »), règles propres à la ligne.
- `scripts/test_app.py` : 59 vérifications (ouverture sans présélection, minimums 4 kg et
  1 kg, sachet puis pot puis retour au produit initial, panier à lignes distinctes
  18,10 €, emballage désactivé masqué, produit sans emballage sans section).

**Comportement réellement opérationnel** : tout ce qui précède, testé en Playwright sur le
bundle exporté. **Non connecté** : photos `preview` définitives, emballages actifs et prix
réels viendront du document publié (`CATALOG_ENDPOINT` = `null` aujourd'hui) ; les visuels
baobab sachet/pot sont des données de démonstration.

**Points restants** : publier emballages/visuels/prix depuis la base de contrôle ; prix des
cartons et pots « à compléter » ; affichage du contenu total dans le panier (déjà dans la
fiche et les lignes de commande).

---

## Passage 14 — 25 novembre 2026 : inscription par étapes + commande « pour moi / pour un proche »

**Demande** : inscription en pages successives qui s'enchaînent (type → « Vos informations »
→ « Choix de connexion » → recommandation) avec barre de progression « X sur 4 » ;
particulier : nom, téléphone, pays, e-mail facultatif (pas d'adresse) ; professionnel :
nom, société, téléphone, WhatsApp, pays ; connexion sans frais de SMS (numéro ou e-mail ;
Apple/Google préparés mais non connectés) ; au panier : « Valider pour moi » (localisation
demandée avant paiement, Sénégal) ou « Valider pour un proche » (pas de localisation
directe : lien de localisation facultatif, sinon adresse + numéro) ; particuliers :
l'e-mail n'est plus exigé à la confirmation, le téléphone suffit.

**Fichiers modifiés**
- `screens/AuthScreen.tsx` : parcours d'inscription en 4 étapes avec barre de progression
  et fondu entre pages ; étape 1 = choix du type seul (un clic ouvre l'étape 2) ;
  étape 2 « Vos informations » (particulier : nom, téléphone, e-mail facultatif, pays ;
  professionnel : activité, nom, société, téléphone, WhatsApp, pays — e-mail retiré) ;
  étape 3 « Choix de connexion » (numéro, e-mail/Gmail, carte Apple « Bientôt » préparée
  non connectée, note « aucun SMS payant ») ; étape 4 « Recommandation » (partage WhatsApp)
  puis « Entrer dans l'application » qui crée le compte ; page « Me connecter » : puces
  Apple/Google « bientôt » + note sans frais de SMS.
- `screens/CheckoutScreen.tsx` : choix « Valider pour moi / Valider pour un proche » en tête
  (obligatoire) ; pour un proche : adresse du proche, lien de localisation facultatif
  (repli adresse + numéro expliqué), aucune localisation directe ; pour soi au Sénégal :
  demande de position avant le paiement (inchangée) ; e-mail facultatif à la confirmation,
  téléphone obligatoire ; libellés adaptés (numéro du proche).
- `lib/store.tsx` : `Order.forSelf` et `Order.locationLink` conservés avec la commande.
- `screens/SuccessScreen.tsx` : mention « pour votre proche » sur le suivi le cas échéant.
- `scripts/test_app.py` : parcours d'inscription par étapes (3 comptes), choix
  moi/proche au checkout, barre de progression vérifiée.

**Tests réellement effectués** : build web + **53 vérifications Playwright, 0 échec** —
inscription particulier et professionnel en 4 étapes (pays obligatoire, progression 2/4 et
4/4), connexion par numéro, recommandation, entrée dans l'app ; checkout : choix moi/proche
présent, commande Sénégal « pour moi » avec position avant paiement et suivi ; visibilité
par pays et formats inchangés ; desktop inchangé. Captures des étapes 2 et 3 vérifiées
visuellement.

**Connexions réellement opérationnelles** : aucune — comptes, positions et commandes restent
sur l'appareil ; Apple/Google OAuth et transmission au livreur/équipe restent à configurer
(`CONTROL_ENDPOINT`, `TEAM_ENDPOINT` = `null`). Aucun SMS n'est envoyé (aucun service).

**Points restants** : activer Apple/Google quand les services seront configurés ; page de
recommandation enrichie si souhaité ; lien de localisation du proche affiché à l'équipe
(transmission non connectée).

---

## Passage 13 — 25 novembre 2026 : pays obligatoire à l'inscription + localisation demandée avant paiement (Sénégal)

**Demande** : pays obligatoire à la création du compte (particulier comme professionnel) —
les offres et produits visibles en découlent ; inscription particulier simplifiée (fenêtre
« Vos informations » : nom, téléphone, pays — pas d'adresse) ; localisation demandée au
moment de la commande (avant l'envoi de l'argent), pas à l'inscription ; le suivi affiche
le livreur en route au Sénégal ; l'Europe/GP attendra (mécanisme déjà prêt, passage 12).

**Fichiers modifiés**
- `screens/AuthScreen.tsx` : formulaire particulier « Vos informations » = nom, **téléphone
  (obligatoire)**, e-mail (facultatif), **pays (obligatoire)** avec sélecteur de pays
  rechercher/choisir (même principe que le carnet d'adresses) ; formulaire professionnel :
  **pays obligatoire** ajouté ; soumission sans pays → erreur explicite. La localisation
  n'est PAS demandée à l'inscription (conforme à la demande).
- `lib/store.tsx` : `Account.country` (comptes existants migrés à vide sans casse) ;
  `clientCountry` = adresse de livraison → sinon **pays du compte** → sinon pays appareil ;
  il pilote la visibilité des produits (passage 12) pour les trois profils ;
  `orderView()` : commande Sénégal avec transport → étape **« Livreur en route »** et message
  indiquant que le livreur a l'adresse (et la position si partagée) et appelle le client.
- `screens/CheckoutScreen.tsx` : au Sénégal avec transport, la **demande d'autorisation de
  localisation est déclenchée avant le paiement** (premier appui sur « Payer et confirmer ») ;
  accord → position jointe à la commande ; refus/indisponible → repli adresse + téléphone
  expliqué, second appui pour continuer. Aucun suivi temps réel promis : la position est
  enregistrée avec la commande, sa transmission au livreur passe par l'équipe (non connectée).
- `screens/ProfileScreen.tsx` : ligne « Pays » ajoutée au profil.
- `scripts/test_app.py` : inscriptions mises à jour (pays/téléphone), refus sans pays vérifié,
  suivi de commande Sénégal vérifié.

**Tests réellement effectués** : build web + **50 vérifications Playwright, 0 échec** —
inscription sans pays refusée ; compte particulier (Sénégal) et pro (Sénégal) créés avec
pays ; visibilité par pays toujours effective (compte États-Unis : mangue SN masquée,
piment « monde sauf FR » visible) ; commande Sénégal complète : adresse Dakar, bloc
livreurs moto, demande de position avant paiement, position enregistrée après accord,
confirmation avec mention livreur, suivi « En validation ».

**Connexions réellement opérationnelles** : aucune vers un serveur — pays, position et
commandes restent sur l'appareil ; la transmission au logiciel d'équipe/livreur reste à
connecter (`TEAM_ENDPOINT`/`CONTROL_ENDPOINT` = `null`). Le suivi « livreur en route »
reflète les étapes de statut (simulables via les outils de test), pas une géolocalisation
du livreur en temps réel — cette brique (app livreur + serveur) reste à développer.

**Points restants** : Europe/GP — door-to-door vs aéroport à convenir puis publier dans
`delivery.gp` (mécanisme prêt) ; modification du pays depuis le profil (non ajoutée) ;
suivi temps réel du livreur (hors périmètre actuel) ; destination pro encore en texte libre.

---

## Passage 12 — 25 novembre 2026 : visibilité par pays, livraison Sénégal (livreurs), GP Europe

**Demande** : règles de visibilité par produit/pays (un pays seul, monde, monde sauf…)
appliquées à tous les parcours ; livraison Sénégal à domicile par livreurs moto avec
téléphone + position (accord explicite, repli si refus) ; GP Europe préparé selon les
options réellement configurées ; vérifier et rapporter honnêtement.

**Fichiers modifiés**
- `lib/catalog/schema.ts` : `Visibility` (`'pays' | 'monde' | 'monde_sauf'` + `countries`)
  sur chaque produit (défaut : monde) ; `DeliveryConfig` (`gp` : pays + options
  `domicile`/`aéroport`) au niveau du document ; parsing validé.
- `lib/catalog/rules.ts` : `visibleIn()` — pays inconnu : les produits réservés à un pays
  sont masqués (éligibilité non confirmée), monde/monde-sauf affichés puis re-filtrés dès
  que le pays est connu (adresse).
- `lib/catalog/build.ts` : `retailSpace` / `wholesaleSpace` filtrent par pays → listes,
  catégories, recherche, fiches ET parcours pro ; un produit masqué sort de `byId`, donc
  panier, totaux et liens directs ne peuvent plus le commander.
- `lib/store.tsx` : `clientCountry` (adresse de livraison, sinon pays appareil via
  `deviceCountry()` — fuseau/langue, sans autorisation) ; `delivery` exposé ;
  `Order.location` (position partagée pour le livreur) + `placeOrder({location})`.
- `lib/locate.ts` : `locateCoords()` — coordonnées uniquement après accord explicite ;
  refus/indisponible → erreur gérée, aucun collecteur silencieux.
- `screens/CheckoutScreen.tsx` : Sénégal → « Livraison à domicile par nos livreurs
  (moto) », bloc livreur (appel au numéro saisi, partage de position optionnel, message
  clair si refus/indisponible, mention « pas de suivi en temps réel ») ; Europe → note GP
  uniquement si des options sont configurées, sinon « modalités pas encore arrêtées »,
  sans tarif ni délai inventés.
- `screens/SuccessScreen.tsx` : mention « position partagée pour le livreur » si présente.
- `lib/data.ts` : exemples de règles (mangue fraîche réservée au Sénégal ; piment visible
  partout sauf France) — données d'exemple à remplacer.
- `lib/catalog/embedded.ts` : `delivery: { gp: [] }` (rien de convenu à ce jour).
- `scripts/test_app.py` : 10 vérifications ajoutées (visibilité par pays, parcours Sénégal
  complet avec géolocalisation accordée).

**Tests réellement effectués** : 48 vérifications Playwright, 0 échec — mangue SN masquée
pour un appareil hors Sénégal et mangue séchée (monde) visible ; piment (monde sauf FR)
visible ; commande Sénégal : adresse Dakar, forfait 6,00 €, bloc livreurs moto, position
partagée après accord puis commande confirmée avec mention livreur.

**Connexions réellement opérationnelles** : aucune vers un serveur — la position reste sur
l'appareil, la commande est locale, `CATALOG_ENDPOINT`/`CONTROL_ENDPOINT`/`TEAM_ENDPOINT`
sont `null`. La transmission de la position au livreur par l'équipe reste à connecter.

**Points restants / à clarifier** : pays du parcours pro = pays appareil tant qu'aucune
adresse/destination ISO n'est saisie (destination pro = texte libre aujourd'hui) ; options
GP Europe à convenir puis publier (`delivery.gp`) ; tarifs/délais GP réels ; transmission
position/commandes au logiciel d'équipe.

---

## Passage 11 — 25 novembre 2026 : emballages activables + visuels « produit dans son emballage » + annonces pilotables

**Demande** : l'application doit tenir compte de ce que l'équipe configure : emballages
activables/désactivables avec leurs infos et leur visuel « produit dans cet emballage »
(aperçu haut de fiche qui change au choix, avec remontée automatique) ; annonces de
l'accueil allumables/éteignables avec période de diffusion ; ne jamais montrer un élément
désactivé ; préparer l'architecture sans développer la tour de contrôle ; rapport précis.

**Fichiers modifiés**
- `lib/catalog/schema.ts` : `CatalogFormat.available` (emballage activable) ; nouveau
  `CatalogCampaign` + `CatalogDocument.campaigns` : annonce avec `enabled`, `startsAt`,
  `endsAt`, `photo`, textes libres — le tout vérifié par `parseCatalog`.
- `lib/catalog/embedded.ts` : `available` transmis ; `CAMPAIGN_ASSETS` (visuels de campagne
  embarqués) ; deux annonces d'exemple **non diffusées** (une éteinte, une périmée) :
  l'accueil n'affiche aucun bandeau tant que rien n'est publié.
- `lib/catalog/build.ts` : seuls les emballages **actifs** sont proposés ; si aucun
  emballage actif n'est publié, repli clair sur les emballages déduits de l'unité de vente ;
  `docCampaigns()` expose les annonces du document au store.
- `lib/data.ts` : `ProductFormat.available` et `preview` ; type `Campaign` ; visuels de
  démonstration « baobab en sachet » et « baobab en pot » (`assets/formats/baobab-*-preview.png`) ;
  pot de l'ananas séché marqué `available: false` (démo d'emballage désactivé).
- `lib/format.ts` : `campaignActive()` — annonce affichée seulement si activée ET dans sa
  période de diffusion.
- `lib/store.tsx` : expose `campaigns` (issues du catalogue, donc de la future base).
- `components/HomeHero.tsx` / `screens/HomeScreen.tsx` : le bandeau ne construit que les
  annonces diffusées ; aucune annonce active → aucun bandeau (pas de cadre vide).
- `screens/ProductScreen.tsx` : inchangé sur ce point — l'anneau affiche déjà la photo
  `preview` du format choisi et remonte automatiquement au choix d'un emballage.
- `scripts/test_app.py` : parcours baobab complet (sachet par défaut → pot : visuel changé,
  remontée mesurée, total 5,20 €), pot désactivé de l'ananas masqué, aucun bandeau sans
  annonce active.

**Tests réellement effectués**
- Suite complète : 42 vérifications Playwright, 0 échec (état livré : annonces éteintes).
- Parcours baobab vérifié visuellement : aperçu « baobab en sachet » à l'ouverture, puis
  « baobab en pot » après choix du pot, avec remontée automatique (captures conservées).
- Chemin « annonce active » testé séparément (annonce mangue activée temporairement puis
  remise éteinte) : bandeau affiché avec sa photo et son CTA, et **1 seul point de
  pagination** — l'annonce melon périmée reste masquée.

**Connexions réellement opérationnelles** : AUCUNE vers un serveur externe —
`CATALOG_ENDPOINT`, `CONTROL_ENDPOINT`, `TEAM_ENDPOINT`, `VIDEOS_ENDPOINT` sont `null`.
Tout le mécanisme (emballages actifs, `preview`, annonces `enabled`/période) est prêt et
testé sur le document embarqué ; il s'activera sans modification des écrans dès qu'un
document sera publié.

**Points restants** : publier depuis la base de contrôle les visuels `preview` définitifs,
les emballages actifs et les annonces ; prix des cartons/pots « à compléter ».

---

## Passage 10 — 25 novembre 2026 : pastille d'emballage retirée de l'aperçu

**Demande** : « Enleve moi ça » — la pastille ronde affichant l'emballage choisi sur la
scène du haut (capture jointe).

**Fichiers modifiés**
- `screens/ProductScreen.tsx` : suppression du bloc `packBadge` (pastille photo de
  l'emballage sur l'aperçu) et de ses styles. Le reste est inchangé : l'aperçu utilise
toujours la photo `preview` « produit + emballage » dès qu'elle est publiée, et le choix
  d'un emballage fait toujours remonter la fiche vers l'aperçu.
- `lib/catalog/README.md` + mémoire des prompts : mention de la pastille retirée.

**Vérifications réellement effectuées** : build web + 38 vérifications Playwright, 0 échec
(formats, remontée automatique, totaux, panier, pro, desktop).

---

## Passage 9 — 25 novembre 2026 : vérification en production (la pomme n'est plus « Vrac »)

**Signalement** : capture montrant encore « Vrac · Au poids » sur la fiche Pomme.

**Diagnostic réellement effectué**
- Le bundle servi en production contient bien le code du passage 8 (`Kraft · au poids`,
  pastille d'emballage) ; le mot « Vrac » ne subsiste que dans le vocabulaire d'emballage
  de `lib/control.ts`, jamais affiché sur une fiche.
- Test Playwright **contre le site en production** : fiche Pomme → cartes **Sachet**
  (kraft, 3,20 € / kg) + **Carton** (expédition, prix à compléter), **zéro carte « Vrac »** ;
  choix d'un emballage → remontée automatique mesurée (scrollTop 500 → 0).
- Conclusion : la capture provenait d'un **cache périmé de l'aperçu** (ancien bundle gardé
  en mémoire). Un rechargement forcé de l'aperçu (ou le bouton rafraîchir) montre la
  version corrigée ; un nouveau déploiement est publié pour rafraîchir l'aperçu.

**Fichiers modifiés** : aucun code changé (le comportement demandé était déjà en place et
vérifié) ; `RAPPORT.md` mis à jour.

**Vérifications réellement effectuées** : production (orrmkr.vercel.app) : Pomme =
Sachet + Carton, Vrac = 0, remontée auto 500 → 0 ; captures `/tmp/prod-pomme*.png`.

---

## Passage 8 — 25 novembre 2026 : aperçu « produit + emballage », emballages partout, remontée auto

**Demande** : en haut de la fiche, l'aperçu doit montrer le produit avec son emballage et se
répercuter quand on clique sur un emballage en bas (avec remontée automatique en haut) ;
tous les produits doivent avoir des emballages (plus de « vrac »), au même format que les
séchés/poudres ; préparer l'architecture photo (produit détouré + produit avec emballage)
pour la base de contrôle ; le marché reste tel quel.

**Fichiers modifiés**
- `screens/ProductScreen.tsx` : au choix d'un emballage, l'application **remonte toute
  seule en haut** (`scrollTo({y:0})`) ; l'emballage choisi se **répercute sur la scène**
  (pastille photo en haut à droite, fondu à chaque changement) ; dès qu'une photo
  « produit + emballage » (`preview`) existe pour le format, c'est elle qui habille
  l'anneau du carrousel à la place du produit détouré.
- `lib/data.ts` + `lib/catalog/schema.ts` + `embedded.ts` + `build.ts` : nouveau champ
  `preview` par format (photo du produit avec cet emballage, embarquée ou publiée) ;
  `PREVIEW_ASSETS` ; le marché et les cartes restent inchangés.
- `lib/catalog/build.ts` : plus aucun produit « en vrac » — quand le catalogue ne publie
  pas d'emballages, l'application en déduit deux au même format que les séchés :
  au kilo → **Sachet** (kraft, prix au kilo inchangé) + **Carton** (expédition, prix à
  compléter) ; à l'unité → l'emballage en vigueur (barquette, botte…) ou **Sachet** pour
  les pièces, + **Carton**. Aucun prix inventé : seul le prix particulier existant est repris.
- `scripts/test_app.py` : vérifie Sachet + Carton sur un produit frais et la remontée
  automatique (scrollTop 500 → 0 après choix d'un emballage).
- `lib/catalog/README.md` : champ `preview` documenté pour la base de contrôle.

**Vérifications réellement effectuées** : build web + 38 vérifications Playwright, 0 échec
(remontée auto mesurée, pastille emballage visible sur la scène, totaux/panier/pro/desktop
inchangés, marché inchangé).

**Points restants** : photos « produit + emballage » (`preview`) à publier depuis la base de
contrôle — jusqu'alors la pastille emballage + le produit détouré tiennent lieu d'aperçu ;
prix des cartons et de certains pots « à compléter ».

---

## Passage 7 — 25 novembre 2026 : héro retiré jusqu'à publication, filtres montés en haut

**Demande** : enlever le bloc héro du haut de l'accueil — il ne doit réapparaître que quand
l'équipe publiera des annonces depuis la base de contrôle ; et monter les filtres (rayons)
tout en haut, aux côtés de la recherche et du panier.

**Fichiers modifiés**
- `lib/data.ts` : `CAMPAIGNS` vidé (aucune annonce embarquée). Le design du bandeau reste
  prêt (image plein cadre + textes `photo`/`kicker`/`title`/`cta`) : dès qu'une campagne est
  publiée — aujourd'hui dans ce fichier, demain depuis la tour de contrôle — le bandeau
  réapparaît tout seul. Images de démonstration conservées dans `assets/campaigns/`.
- `screens/HomeScreen.tsx` : bandeau rendu uniquement si `CAMPAIGNS.length > 0` ; rangée de
  filtres extraite (`filtersList`) et **placée juste sous la barre recherche/logo/panier**
  sur téléphone ; la mise en page « ordinateur » (chantier `DESKTOP_WEB`) conserve les
  filtres à leur place d'origine ; `paddingTop` des filtres réduit (22 → 14).
- `scripts/test_app.py` : vérifie l'absence du héro (ni CTA ni kicker) et la position haute
  des filtres (au-dessus de « En ce moment », y < 260).
- Mémoire des prompts (point 6) mise à jour en conséquence.

**Vérifications réellement effectuées** : build web + 37 vérifications Playwright, 0 échec
(héro absent, filtres en haut, catégories/fiches/formats/panier/pro/desktop inchangés).

**Points restants** : la publication d'annonces depuis la base de contrôle reste à connecter
(`CATALOG_ENDPOINT` / `CONTROL_ENDPOINT` = `null`) ; en attendant, une annonce peut être
ajoutée manuellement dans `CAMPAIGNS` (image + textes libres).

---

## Passage 6 — 25 novembre 2026 : héro de campagne prêt à recevoir image + textes

**Demande** : préparer le design du héro pour recevoir une image de fond comme la référence
(mangue du Sénégal) et des textes ajoutables ; mémoriser toutes les corrections pour les
prochains prompts (application + tour de contrôle).

**Fichiers modifiés / ajoutés**
- `components/HomeHero.tsx` : quand une campagne fournit une `photo`, elle occupe tout le
  bandeau (contentFit cover) avec deux voiles dégradés (lisibilité du texte à gauche, points
  en bas) ; sinon l'ancienne composition détourée est conservée. Ajouts visuels de la
  référence : filet vert sous le kicker, mot final de l'accent en **or italique**
  (« du *Sénégal* »). Textes et image restent 100 % données (`CAMPAIGNS`).
- `lib/data.ts` : `CAMPAIGNS` accepte `photo`, `kicker`, `title`, `cta` (surcharges libres) ;
  les deux campagnes embarquées reçoivent leurs images de fond.
- `assets/campaigns/mangue.webp`, `assets/campaigns/melon.webp` (générées, 16:9).
- `scripts/test_app.py` : vérifications du héro (kicker, CTA « Voir la mangue », 2 points).
- `RAPPORT.md` : section « Mémoire pour les prochains prompts » (ci-dessus) + ce passage.

**Vérifications réellement effectuées** : build web + 38 vérifications Playwright, 0 échec
(héro avec kicker/CTA/points, formats, catégories, panier, pro, desktop inchangé).

**Points restants** : campagnes pilotables depuis la tour de contrôle dès que
`CATALOG_ENDPOINT`/`CONTROL_ENDPOINT` seront renseignés ; textes des campagnes actuelles
encore embarqués (données d'exemple).

---

## Passage 5 — 25 novembre 2026 : emballages généraux (carton, sachet, box…) + espace tour de contrôle

**Demande** : les formats sont des emballages au sens général (cartons, sachets, boxes…) ;
préparer l'espace et les liens pour raccorder tous les profils et toutes les données à la
future application de contrôle, afin de tout modifier depuis là-bas et éviter les erreurs.

**Fichiers modifiés / ajoutés**
- `lib/control.ts` (nouveau) : liste unique des **points de raccordement** à la tour de
  contrôle — Catalogue (produits, prix, unités, **formats/emballages : carton, sachet, box,
  pot…**, offres, règles), Demandes professionnelles, **Profils et comptes**, Vidéos — avec
  pour chacun ce qu'il permet de régler à distance et son état (connecté / non connecté).
- `lib/config.ts` : nouveau réglage `CONTROL_ENDPOINT` (adresse du futur service des
  profils ; `null` aujourd'hui, rien n'est connecté). Chaque raccordement est indépendant :
  renseigner une adresse active celui-ci sans toucher aux autres.
- `screens/ProfileScreen.tsx` : nouvelle carte **« Tour de contrôle »** dans le Profil —
  les 4 raccordements, leur périmètre et leur état, visibles dans l'application.
- `lib/data.ts` : la mangue séchée reçoit un 3ᵉ emballage **« Carton · Expédition »** sans
  prix (`Prix à compléter`) et sans photo (la case s'affiche avec l'icône cube) : démontre
  les emballages génériques et le chemin « à confirmer depuis la tour de contrôle ».
- `lib/catalog/README.md` : vocabulaire d'emballage libre documenté pour le logiciel de
  contrôle (« Carton », « Sachet », « Box », « Pot », barquette, filet, vrac…).
- `scripts/test_app.py` : vérifications ajoutées (carte Carton sur la mangue séchée,
  espace Tour de contrôle avec ses 4 raccordements « Non connecté » dans le Profil).

**Vérifications réellement effectuées** : build web `expo export` + 35 vérifications
Playwright, 0 échec : cartes d'emballage (Sachet/Pot/Carton), carte unique « Vrac · / kg »
sur produit frais, totaux et panier inchangés, parcours pro inchangé, desktop inchangé,
espace Tour de contrôle affiché dans le Profil.

**Points restants** : aucune adresse de contrôle n'est configurée (`CATALOG_ENDPOINT`,
`CONTROL_ENDPOINT`, `TEAM_ENDPOINT`, `VIDEOS_ENDPOINT` = `null`) : les raccordements sont
préparés et documentés mais **rien n'est connecté ni testé contre un vrai serveur** ;
prix du carton et des pots « à compléter » ; photos des emballages à fournir.

---

## Passage 4 — 25 novembre 2026 : section « Choisissez votre format » visible dès l'ouverture

**Demande** : sur la capture de la fiche Poudre de Baobab, la section n'apparaissait pas ;
corriger son affichage, conserver strictement la barre quantité/total/ajouter et le desktop,
et écrire un rapport.

**Diagnostic réellement effectué** : reproduction Playwright sur la fiche Baobab (espace
particulier) — la section existait bien dans le DOM (cartes Sachet + Pot présentes) mais
était placée **sous la carte « Saison »**, donc hors du premier écran sur ce produit :
le quai d'achat et son dégradé la masquaient tant qu'on ne défilait pas plus bas.

**Correction (minimale)**
- `screens/ProductScreen.tsx` : la section « Choisissez votre format » est déplacée **au-dessus
  de la carte « Saison »**, juste après la description (emplacement autorisé : « en dessous
  de saison ou bien en dessus »). Elle est désormais visible dès l'ouverture de la fiche,
  sur tous les produits qui ont des formats. Le quai quantité/total/ajouter n'est pas
  touché ; la mise en page desktop (colonne centrée) reste identique.
- `scripts/test_app.py` : nouvelle vérification — la section est dans le premier écran
  (coordonnée y < hauteur du viewport) sur une fiche ouverte.

**Vérifications réellement effectuées** : build web `expo export` + 33 vérifications
Playwright, 0 échec : section visible sans défilement, cartes Sachet/Pot du Baobab et du
Bissap, carte unique « Vrac · / kg » sur un produit frais, totaux/panier inchangés,
parcours pro (avion 500 kg, bateau conteneurs) inchangé, desktop inchangé.

**Points restants** : prix des pots « à compléter » (ananas séché, bissap) ; photos et prix
définitifs des emballages à saisir dans la tour de contrôle ; `CATALOG_ENDPOINT` toujours
nul (rien n'est connecté).

---

## Passage 3 — 25 novembre 2026 : choix du format pour TOUS les produits + terrain tour de contrôle

**Demande** : le choix du format / emballage ne doit plus être réservé aux séchés et
transformés — tous les produits l'ont ; certains avec un seul emballage en stock, d'autres
avec plusieurs. Le prix s'affiche avec son unité (« / kg » comme sur la référence). Et le
logiciel de contrôle (« tour de contrôle ») doit pouvoir régler tout ça plus tard.

**Fichiers modifiés**
- `lib/catalog/build.ts` : chaque produit sans `formats` publiés reçoit automatiquement un
  **emballage unique égal à son unité de vente actuelle** — `Vrac · Au poids` (prix au kilo,
  paliers conservés), `Barquette · 250 g`, `Pièce · À l'unité`… Aucun prix inventé : c'est
  l'offre particulière reprise telle quelle. Les produits à plusieurs emballages (séchés,
  transformés) gardent leurs cartes Sachet / Pot.
- `lib/data.ts` + `lib/catalog/schema.ts` + `lib/catalog/embedded.ts` : le format porte
  désormais `unit` (`'kg'` = au poids, `'unit'` = conditionnement), `step` et `unitLabel`,
  lisibles depuis un document publié : la tour de contrôle pourra créer, retirer ou ajuster
  les emballages de chaque produit sans toucher aux écrans.
- `lib/format.ts` : `withFormat` respecte les formats au kilo (paliers et bornes d'origine
  conservés : aucun changement de comportement sur les produits frais).
- `components/FormatPicker.tsx` : suffixe de prix selon l'unité — « / kg » pour le vrac
  (comme la référence), « / 500 g » pour un conditionnement.
- `lib/catalog/README.md` : section dédiée aux `formats` pour le futur logiciel de contrôle
  (champs, `price: null`, comportement sans `formats` publiés, `demo`).
- `scripts/test_app.py` : vérifie la section sur une fiche de produit frais (carte unique
  « Vrac », prix « / kg »).

**Tests réellement effectués** : build web + 32 vérifications Playwright, 0 échec
(section formats sur fiche frais et sur fiche séchée, totaux et panier inchangés, parcours
pro inchangé).

**Points restants** : prix des pots « à compléter » (ananas séché, bissap) ; photos et prix
définitifs des emballages à saisir dans la tour de contrôle ; `CATALOG_ENDPOINT` toujours
nul (rien n'est connecté).

---

## Passage 2 — 25 novembre 2026 : emballages visibles partout

**Demande** : la section « Choisissez votre format » n'était pas visible dans l'aperçu ;
il faut un emballage pour tous les produits séchés et transformés, la case doit exister
même sans photo, placée près de la carte « Saison », et un rapport écrit à chaque fois.

**Fichiers modifiés**
- `screens/ProductScreen.tsx` : la section formats n'est plus limitée aux écrans téléphone
  (`phone` supprimé) — elle s'affiche désormais dans la fiche sur **tous les écrans**
  (la colonne centrée est la même sur ordinateur). Position inchangée : juste **sous la
  carte « Saison »**, au-dessus de « Dans le même rayon ».
- `lib/data.ts` : **Poudre de Bissap** reçoit un second emballage « Pot · Premium · 200 g »
  avec `price: null` → la carte affiche « Prix à compléter » (aucun prix inventé).
  Les 4 produits séchés/transformés ont tous leurs emballages :
  - Mangue séchée : Sachet 500 g (3,20 €) + Pot 500 g (4,50 €) — démo
  - Ananas séché : Sachet 250 g (2,90 €) + Pot 250 g (prix à compléter) — démo
  - Poudre de Baobab : Sachet 200 g (3,90 €) + Pot 200 g (5,20 €) — démo
  - Poudre de Bissap : Sachet 200 g (3,50 €) + Pot 200 g (prix à compléter) — démo
- `components/FormatPicker.tsx` : si la photo d'un conditionnement manque (catalogue réel
  à venir), la case s'affiche quand même avec une icône « cube » en attendant.
- `scripts/test_app.py` : vérification mise à jour (la section formats doit maintenant
  apparaître aussi sur écran large ; fiche Bissap avec Sachet + Pot).
- `RAPPORT.md` (nouveau) : ce rapport, à compléter à chaque passage.

**Tests réellement effectués** : build web `expo export` + 29 vérifications Playwright
(0 échec) : section formats visible sur fiche mobile ET écran large, les 4 produits
séchés/transformés ont leurs cartes d'emballage, prix/totaux/panier inchangés, parcours
pro (avion 500 kg, bateau conteneurs 18 000 kg) toujours conforme.

**Points restants** : prix des pots « à compléter » (ananas séché, bissap) et toutes les
valeurs marquées « Données de démonstration » à remplacer par le catalogue réel ; photos
définitives des conditionnements à fournir (l'icône cube tient lieu de case vide).

---

## Passage 1 — 25 novembre 2026 : catégories séchés/transformés, formats, offres pro

**Réalisé** (détail complet dans le compte rendu de livraison) :
- Catégories **Séchés** et **Transformés** ajoutées (pastilles rondes illustrées, filtrage
  réel, recherche cohérente) + 4 produits : mangue séchée, ananas séché, poudre de baobab,
  poudre de bissap (photos détourées générées, ratios calculés).
- Fiche produit : carrousel en arc conservé à l'identique, bouclant désormais sur 42
  produits ; nouvelle section « Choisissez votre format » (cartes Sachet/Pot, choix coché,
  prix répercuté sur le total, le panier et la commande) ; quai quantité/total/ajouter
  strictement conservé.
- Offres pro : avion min 500 kg / paliers 500 kg, bateau min 1 conteneur + sélection
  rapide 1–4, poids par conteneur configurable par offre (démo 18 000 kg ; référence
  catalogue 22 000 kg « Europe »), totaux calculés uniquement sur prix configurés.
- Persistance : choix de format enregistré par compte (`formats` dans le store).
- Fichiers touchés : `lib/data.ts`, `lib/catalog/{schema,embedded,build}.ts`,
  `lib/ratios.ts`, `lib/format.ts`, `lib/store.tsx`, `components/FormatPicker.tsx` (nouveau),
  `screens/{ProductScreen,CartScreen,HomeScreen}.tsx`, `package.json`, `vercel.json`,
  `assets/produce/*` (4 nouvelles), `assets/formats/{sachet,pot}.png`.
- Tests : 27 vérifications Playwright (0 échec), mobile 390×844 et écran large.
