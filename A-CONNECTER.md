# À CONNECTER — réglages à faire par le propriétaire (le code est prêt)

## Checklist — brancher Vercel + Supabase en 5 étapes

1. **Supabase : créer la base.** Sur supabase.com, créez un projet. Dans **SQL Editor**, collez
   tout le fichier `supabase/schema.sql` du dépôt `Test-control`, puis **Run**. Dans **Storage**,
   créez deux espaces **publics** : `catalogue` (photos) et `publications` (vidéos, photos).
   *Vérifier* : **Table Editor** liste `products`, `orders`, `settings`, `product_requests`,
   `publication_reactions`… et **Storage** montre les deux espaces.

2. **Générer les deux secrets de la tour.** Lancez deux fois cette commande (deux valeurs
   **différentes**) et gardez-en une copie hors de Vercel (gestionnaire de mots de passe) :
   ```powershell
   [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```
   La première devient `SEAL_SECRET`, la seconde `VAULT_SECRET`. Perdre `VAULT_SECRET` rend les
   commandes enregistrées illisibles.
   *Vérifier* : deux chaînes de 64 caractères, différentes.

3. **Vercel, projet de la tour (`Test-control`) : coller les variables.** Au 27/11, aucun des deux
   dépôts n'est relié à Vercel (aucun déploiement ni statut sur GitHub). D'abord : Vercel → Add
   New → Project → importer `bn710024-droid/Test-control` (framework **Vite**, réglages proposés).
   Chaque PR aura ensuite sa preview. Puis Settings → Environment Variables, en cochant
   **Production** et **Preview** :
   `VITE_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_URL` = Project URL ; `VITE_SUPABASE_ANON_KEY` =
   clé `anon` ; `SUPABASE_SERVICE_ROLE_KEY` = clé `service_role` (Supabase → Project Settings →
   API) ; `SEAL_SECRET` et `VAULT_SECRET` (étape 2). Puis Deployments → **Redeploy**.
   *Vérifier* : la tour s'ouvre sans « Configuration manquante » ;
   `https://<tour>/api/catalog?v=2` renvoie un JSON qui commence par `{"schema":2` ;
   Réglages → « Vérifier le document publié » ne signale aucune erreur.

4. **Vercel, projet de l'application (`Test-app-tropicaura`) : coller l'adresse de la tour.**
   Importez le dépôt de la même façon (Add New → Project ; `vercel.json` fournit le build et le
   dossier `dist`). Puis Settings → Environment Variables (Production et Preview) :
   `EXPO_PUBLIC_CONTROL_TOWER_URL` = `https://<tour>`, **sans `/` final**. Puis **Redeploy** : la
   variable est lue au moment du build, un simple rechargement ne suffit pas.
   *Vérifier* : dans l'application, Profil → carte « Tour de contrôle » : « Reliée à la base de
   contrôle de notre équipe… » ; la ligne « Catalogue » dit « reçu de la base de contrôle » ;
   l'écran Commandes n'affiche plus l'encadré « Mode test ».

5. **Essai de bout en bout (5 minutes).** Dans la tour, changez le prix d'un produit. *Vérifier* :
   le nouveau prix apparaît dans l'application ouverte en **moins de 60 s**, sans recharger.
   Passez ensuite une commande test dans l'application. *Vérifier* : elle arrive dans la tour
   (Commandes) ; pointez le paiement, l'application affiche « Validée » en moins de 60 s.
   Remettez le prix d'origine.

En cas d'échec : l'onglet **Logs** du déploiement Vercel de la tour montre l'erreur de l'API
(variable manquante, table absente). Le détail de chaque réglage suit.

---

## Détail

Tout le branchement application ↔ tour de contrôle est codé et testé **contre une tour locale**
(base simulée, `npm run local` dans le dépôt de la tour). Il ne reste que de la configuration.
Rien ci-dessous n'a été fait cette nuit : ce sont des clés, des comptes ou des choix qui
vous appartiennent.

Branches à relire puis fusionner dans `main` : `nuit-branchement` des deux dépôts
(`bn710024-droid/Test-app-tropicaura`, `bn710024-droid/Test-control`).

---

## 1. Tour de contrôle — base Supabase (bloquant pour une tour en ligne)

Projet Vercel de la tour (dépôt `Test-control`) → Settings → Environment Variables :

| Variable | Valeur | Où la trouver |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<projet>.supabase.co` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | clé `anon` | idem |
| `NEXT_PUBLIC_SUPABASE_URL` | même URL que ci-dessus | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` (serveur uniquement) | idem |
| `SEAL_SECRET` | 32 caractères au moins, à générer | à conserver hors Vercel |
| `VAULT_SECRET` | 32 caractères au moins, **différent** du précédent | à conserver hors Vercel — le perdre rend les commandes illisibles |
| `VITE_GOOGLE_CLIENT_ID` | facultatif | connexion Google |

Dans l'éditeur SQL de Supabase, exécuter les nouvelles tables de `supabase/schema.sql` si elles
n'existent pas déjà : `product_requests`, `publication_reactions` (documentées cette nuit ; l'API
les utilisait déjà).

Pour développer sans base : `npm run local` (http://localhost:3000) — jamais en production.

## 2. Application — adresse de la tour (une seule variable)

`EXPO_PUBLIC_CONTROL_TOWER_URL=https://<adresse-de-la-tour>` (sans `/` final).

- **Local** : fichier `.env.local` de l'application (modèle : `.env.example`).
- **Web (Vercel)** : projet Vercel de l'application → Environment Variables →
  `EXPO_PUBLIC_CONTROL_TOWER_URL`. `vercel.json` est prêt (build `npx expo export --platform web`,
  `no-store` sur `/` et `/index.html`, `immutable` sur `/_expo/*`). La variable est lue **au
  moment du build** : redéployer après l'avoir changée.
- **iOS / Android (EAS)** : dans `eas.json`, ajouter à chaque profil :
  ```json
  "preview":    { "distribution": "internal", "env": { "EXPO_PUBLIC_CONTROL_TOWER_URL": "https://<tour>" } },
  "production": { "env": { "EXPO_PUBLIC_CONTROL_TOWER_URL": "https://<tour>" } }
  ```

Sans cette variable, l'application reste dans son mode actuel (catalogue d'exemple embarqué,
rien n'est envoyé, boutons « Mode test » visibles).

## 3. Identité de build de l'application (bloquant pour EAS)

`app.json` porte l'identité d'un autre projet : `name: "Agon Preview"`, `slug: "agon-preview"`,
`owner: "arcadalabs"`, `extra.eas.projectId` et `updates.url`. À remplacer par votre compte Expo,
votre `slug`, et les identifiants iOS (`ios.bundleIdentifier`) / Android (`android.package`).
Non modifié cette nuit (valeurs inconnues).

## 4. Réglages à saisir dans la tour une fois en ligne

- **Commandes › Livraison** : « Pays desservis par le GP » (nouveau) — sans pays, l'application
  ne propose aucune livraison GP ; le Sénégal reste servi par vos livreurs.
- **Publications** : vidéos, annonces (le bandeau d'accueil n'apparaît qu'avec une annonce en cours).
- **Introuvables › Message au client** : texte affiché quand une recherche ne donne rien.
- **Produits** : photos des emballages (`photo_url`) ; sans photo publiée, la carte d'emballage
  n'a pas d'image dans l'application.
- Remplacer les données d'exemple (42 produits marqués « Exemple ») par le catalogue réel.

## 5. Avant de relier de vrais clients (sécurité — volontairement non fait cette nuit)

- `shared/access.js` : `OPEN_ACCESS = true` → `false` (consigne : ne pas changer cette nuit).
- Supabase : exécuter la section « Sécurité par ligne » de `schema.sql`.
- Identifiant de compte de l'application prévisible ; réception des commandes non authentifiée ;
  CORS `*` : à renforcer (voir ERREURS.md).

## 6. Pas encore branché (demande un choix de votre part)

- **Publications photo** (`?public=photos`) : la tour les publie, mais l'application n'a pas
  d'écran pour les montrer. Il faut décider de l'écran (Favoris › Découvrir › Photos ?).
- **Messages de suivi** (`notifications` publiées par la tour à chaque statut) : reçus et
  enregistrés par l'application, pas affichés (afficher = modifier la carte de suivi).
- **Nom du compte avec les J'aime / commentaires** : envoyé vide tant que la fenêtre des
  commentaires ne prévient pas le client.
- **Encaissement réel** (Wave, Orange Money, carte) : aucun prestataire ; l'équipe pointe le
  paiement dans la tour.
- **Notifications push** (application fermée) : service tiers à choisir.
