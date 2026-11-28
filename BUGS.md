# BUGS — Application (nuit du 27/11/2026)

Constats faits en branchant l'application sur la tour de contrôle. « Corrigé » = corrigé cette nuit et vérifié.

| # | Gravité | Constat | État |
|---|---|---|---|
| 1 | Bloquant | `parseCatalog` n'acceptait que `schema: 1` ; le catalogue de la tour (format différent) aurait été lu sans emballages ni visibilité. | **Corrigé** : lecture de `schema: 2` (`<tour>/api/catalog?v=2`), clés en plus acceptées. |
| 2 | Élevée | Catalogue lu une seule fois à l'ouverture ; aucune relecture. | **Corrigé** : relecture à l'ouverture, toutes les 60 s, au retour au premier plan ; rendu seulement si le document change ; copie hors ligne conservée. |
| 3 | Élevée | Panier relu au démarrage contre le catalogue d'exemple : un produit ajouté par la tour aurait disparu du panier à la réouverture. | **Corrigé** : le panier se relit contre la dernière copie du catalogue publié. |
| 4 | Élevée | Prix par pays (`countryPrices`) ignorés. | **Corrigé** : `forCountry` applique le prix du pays du client (adresse → compte → appareil), particuliers et pros. |
| 5 | Moyenne | Vues / J'aime / commentaires : `post()` aurait appelé `<tour>/api/publications?public=videos/views` (adresse inexistante). | **Corrigé** : ancien envoi neutralisé ; état complet envoyé à `?public=reactions` (sans le nom du compte). |
| 6 | Moyenne | Numéro de commande sur 4 chiffres (`PR-1234`) : collisions possibles entre clients. | **Corrigé** : 6 caractères aléatoires sans ambiguïté (`PR-7KQ2MX`). |
| 7 | Sécurité | Identifiant de compte prévisible (dérivé de l'heure) : le suivi `GET ?compte=` ne livre que des statuts, mais à renforcer. | Non corrigé (phase de test). |
| 8 | Faible | `app.json` : identité de build d'un autre projet (`Agon Preview`, `arcadalabs`, projectId EAS). | Non touché (valeurs à fournir par le propriétaire). |
| 9 | Moyenne | Textes faux une fois branchée : « aucune commande n'est transmise » (Validation), « Prototype sans serveur » (Profil). | **Corrigé** : texte selon que la tour est branchée. |
| 10 | Moyenne | Bandeau d'annonces construit sur les produits embarqués : annonce d'un produit créé dans la tour ignorée. | **Corrigé** : produits publiés. |
| 11 | Moyenne | Moyens de paiement codés (« Mobile money ») ≠ tour (Orange Money, Wave, virement, carte). | **Corrigé** : lus dans le catalogue. |
| 12 | Faible | Recherche vide dans « Tout » : « dans ce rayon ». | **Corrigé**. |
| 13 | Faible | Pas d'ESLint configuré ; `expo lint` l'installe. | **Corrigé** : 0 erreur, 26 avertissements Reanimated (ERREURS.md n° 10). |
| 14 | Faible | `test_app.py` : serveur mono-fil, premier écran parfois > 30 s. | **Corrigé** : serveur multi-fil (63/63). |
| 15 | Moyenne | Position pour le livreur envoyée une seule fois (à la commande), jamais rafraîchie. | **Corrigé** : rafraîchie à chaque relecture tant que `tracking`, sans redemander l'accord (testé). |
| 16 | Faible | `DesktopHero` (mise en page ordinateur, désactivée) lisait les annonces embarquées. | **Corrigé** : annonces et produits publiés. |
| 17 | Faible | Emballage publié par la tour : « 14,50 € le cagette de 5000 g » (article deviné, grammes). | **Corrigé** : la tour publie `unitLabel` neutre « par cagette de 5 kg » (vérifié). |
