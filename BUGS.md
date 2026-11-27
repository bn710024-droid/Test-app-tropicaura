# BUGS — Application (nuit du 27/11/2026)

Constats faits en branchant l'application sur la tour de contrôle. « Corrigé » = corrigé cette nuit et vérifié.

| # | Gravité | Constat | État |
|---|---|---|---|
| 1 | Bloquant | `parseCatalog` n'acceptait que `schema: 1` ; le catalogue de la tour (format différent) aurait été lu sans emballages ni visibilité. | **Corrigé** : lecture de `schema: 2` (`<tour>/api/catalog?v=2`), clés en plus acceptées. |
| 2 | Élevée | Catalogue lu une seule fois à l'ouverture ; aucune relecture. | **Corrigé** : relecture à l'ouverture, toutes les 60 s, au retour au premier plan ; rendu seulement si le document change ; copie hors ligne conservée. |
| 3 | Élevée | Panier relu au démarrage contre le catalogue d'exemple : un produit ajouté par la tour aurait disparu du panier à la réouverture. | **Corrigé** : le panier se relit contre la dernière copie du catalogue publié. |
| 4 | Élevée | Prix par pays (`countryPrices`) ignorés. | **Corrigé** : `forCountry` applique le prix du pays du client (adresse → compte → appareil), particuliers et pros. |
| 5 | Moyenne | Vues / J'aime / commentaires : `post()` aurait appelé `<tour>/api/publications?public=videos/views` (adresse inexistante). | **Neutralisé** : rien ne part ; l'envoi d'état complet vers `?public=reactions` reste à brancher. |
| 6 | Moyenne | Numéro de commande sur 4 chiffres (`PR-1234`) : collisions possibles entre clients (la tour distingue par compte, donc pas de mélange, mais lecture ambiguë pour l'équipe). | Non corrigé. |
| 7 | Sécurité | Identifiant de compte prévisible (dérivé de l'heure) : le suivi `GET ?compte=` ne livre que des statuts, mais à renforcer. | Non corrigé (phase de test). |
| 8 | Faible | `app.json` : identité de build d'un autre projet (`Agon Preview`, `arcadalabs`, projectId EAS). | Non touché (valeurs à fournir par le propriétaire). |
