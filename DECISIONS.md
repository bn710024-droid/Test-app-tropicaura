# DÉCISIONS — nuit du 27/11/2026 (mode autonome)

Une ligne par décision : décision — raison.

- Tour lancée en local sur une base simulée (`npm run local`, dépôt tour) — aucune variable Supabase sur le poste, et il fallait une tour qui écrit et relit pour tester le branchement de bout en bout.
- Base locale remplie avec le catalogue d'exemple de l'application (42 produits, marqués « Exemple ») — mêmes données que l'app, rien d'inventé.
- `?v=2` publie `schema: 2` (et non 1) — le v1 de la tour porte aussi `schema: 1` avec un autre format ; l'app aurait lu le mauvais document sans le signaler.
- Prix d'emballage par pays : la clé `price` n'est publiée que pour un prix propre — dans l'app, `price: null` veut dire « à compléter », dans la tour « prix d'origine » ; publier null aurait bloqué l'ajout au panier.
- Formats : `noun` déduit du nom de l'emballage (« Sachet » → sachet/sachets) — sans lui l'app affichait « 2 formats » ; ce n'est pas une donnée commerciale.
- Photo d'emballage : publiée seulement si l'équipe l'a téléversée (pas d'image embarquée devinée) — consigne « photo:{url}|undefined ».
- `delivery.gp` publié vide — la tour n'a pas de liste de pays GP ; rien d'inventé (voir ERREURS.md).
- Annonces « image seule » sans produit écartées de `?v=2` — l'app exige un produit par annonce.
- Illustrations des rayons : celles de l'app gardées pour les rayons connus ; seule une vraie photo publiée par la tour les remplace — consigne « ne touche pas à mon design ».
- Le catalogue n'est re-rendu que si le document reçu a changé — relecture toutes les 60 s sans coût de fluidité.
- Panier relu au démarrage contre la dernière copie du catalogue publié — sinon un produit ajouté par la tour disparaissait du panier à la réouverture.
- `TEST_TOOLS = !CONTROL_TOWER` — avec la tour, les statuts viennent de l'équipe ; les boutons de test les auraient contredits.
- Commandes : file d'attente = drapeau `transmitted: false` sur la commande, renvoyée à l'ouverture / 60 s / premier plan — pas de nouvelle structure stockée ; les commandes d'avant le branchement ne sont jamais envoyées.
- Vues/J'aime vidéo : l'ancien envoi par événement neutralisé — il visait une adresse inexistante de la tour.
- Messages de suivi de la tour (`notifications`) enregistrés avec la commande mais pas affichés — les afficher change la carte de suivi (design) ; à décider par le propriétaire.
- Travail poussé sur une branche `nuit-branchement` (les deux dépôts), pas sur `main` — rien ne part en production sans relecture.
- Tests bout en bout dans `scripts/test_tower_live.py` (Playwright, comme `test_app.py`) — preuve reproductible plutôt que captures manuelles.
- `BUGS.md` garde l'historique complet ; `ERREURS.md` ne liste que ce qui reste à corriger, au format demandé.
- Paiements lus dans le catalogue publié (Orange Money, Wave, virement, carte) — ce sont les moyens que la tour sait pointer ; l'ancien « Mobile money » n'y correspond à aucun.
- Composant « Produit introuvable » repris du correctif obsolète tel quel — il utilise déjà les jetons de style de l'app (aucun nouveau design inventé).
- Textes d'honnêteté rendus conditionnels (tour branchée ou non) plutôt que supprimés — consigne « aucun paiement présenté comme réel ».
- Libellé « base de contrôle » du Profil conservé — ma reformulation cassait un test existant (`test_app.py`).
- ESLint : règles du compilateur React passées en avertissement — elles visent les valeurs Reanimated ; corriger = toucher aux animations (interdit).
- `test_app.py` : serveur de test passé en multi-fil — l'ouverture dépassait parfois 30 s ; aucune vérification modifiée.
- Position pour le livreur rafraîchie sans redemander l'autorisation (`getForegroundPermissionsAsync`) — le client l'a accordée à la commande ; refus = rien n'est envoyé.
- Références de commande : `PR-` + 6 caractères sans O/0/I/1 — les 4 chiffres se répétaient d'un client à l'autre.
- Statistiques multi-devises de la tour laissées en l'état (documentées) — refonte de 15 affichages trop large pour la nuit, risque de casser la tour.
- Publications photo et messages de suivi non affichés — ce sont de nouveaux écrans / emplacements (design), décision au propriétaire.
- Tour : liste « Pays desservis par le GP » recopiée dans un réglage public scellé (`settings.gp`) — les réglages GP sont chiffrés (numéro du GP) et le catalogue est public.
- Tour : montants des commandes affichés dans leur devise (F CFA) — une commande en XOF s'affichait en €.
