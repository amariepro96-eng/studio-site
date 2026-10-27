# Studio Site

Agent IA qui crée un site internet à partir d'un questionnaire et propose **10 modèles uniques**, rédigés pour l'activité du client.

Le parcours client se gère depuis l'**espace agence** (`/agence`, protégé par mot de passe) :

1. **Nouveau client** : un dossier est créé avec un lien privé de questionnaire (`/questionnaire/…`) et un message prêt à copier.
2. **Questionnaire** : le client répond chez lui en 7 étapes (activité, site, offre, style, logo et photos, coordonnées, infos légales et domaine). Ses réponses sont enregistrées à chaque étape. Il ne voit jamais la génération.
3. **Génération privée** : l'agence lance les 10 modèles depuis le dossier.
4. **Sélection** : l'agence retient 2 à 5 modèles et écrit un message. Le client les découvre sur sa page privée (`/propositions/…`).
5. **Choix** : le client choisit un modèle et laisse un commentaire.
6. **Mise en service** : aperçu complet, téléchargement du .zip (mentions légales et logo déjà remplis), liste de contrôle, puis « Site en ligne ».

L'**Atelier libre** (`/agence/atelier`) garde l'ancien fonctionnement : brief sur une page, 10 modèles, .zip, sans rien enregistrer. La page d'accueil (`/`) ne génère plus rien : elle oriente les visiteurs.

## Comment ça marche

1. Le questionnaire produit un **brief** (activité, offre, style, coordonnées).
2. Trois demandes partent **l'une après l'autre** vers l'API Claude, avec un format JSON imposé (sorties structurées). Chaque réponse est contrôlée et redemandée si elle est incomplète ; en cas d'échec persistant, la génération s'arrête et reprend à l'étape interrompue. Aucun texte générique ne remplace une réponse de l'IA :
   - choix et classement de 10 directions artistiques parmi 12, avec une accroche différente pour chacune ;
   - textes principaux (atouts, services, histoire, appel à l'action, référencement) ;
   - pages secondaires (FAQ, contact, produits pour une boutique).
3. Le **moteur de rendu** assemble chaque modèle selon la composition propre à son style (2 recettes par style : galeries, bandeaux photo, étapes, manifeste, bento…) à partir de blocs validés : polices, palettes, mises en page et visuels propres à chaque direction. Le rendu reste professionnel quel que soit le texte.
4. **Images** : les photos envoyées par le client (redimensionnées dans son navigateur, puis rangées dans le stockage privé de son dossier) passent en premier. Gemini complète jusqu'à 10 visuels en créant jusqu'à 8 images d'ambiance réalistes à partir de descriptions rédigées par Claude. Sans clé Gemini, des photos Unsplash (si configuré) ou des illustrations graphiques prennent le relais.
5. Le client choisit un modèle : le site complet (accueil, services, boutique, à propos, FAQ, contact, mentions légales) se prévisualise sur ordinateur, tablette et mobile, puis se télécharge en .zip prêt à héberger.

Sans clé API, l'application fonctionne en **mode démo** avec des textes génériques.

## Mettre en ligne (Vercel)

1. Créez un dépôt GitHub et envoyez-y ce dossier.
2. Sur [vercel.com](https://vercel.com), **Add New → Project**, importez le dépôt, gardez les réglages proposés (Next.js).
3. Dans **Settings → Environment Variables**, ajoutez au minimum `ANTHROPIC_API_KEY` et `AGENCY_PASSWORD`.
4. **Stockage des dossiers** : onglet **Storage** › **Create** › **Blob** › accès **Private** › reliez-le au projet. Vercel ajoute seul `BLOB_STORE_ID` (et `BLOB_READ_WRITE_TOKEN`). Redéployez.

Sans stockage, l'espace agence affiche la marche à suivre ; seul l'Atelier libre fonctionne. En local (`npm run dev`) sans Vercel Blob, les dossiers sont rangés dans `.data/`.

## Variables d'environnement

| Variable | Rôle | Obligatoire |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clé API créée sur platform.claude.com | Oui, pour l'IA |
| `AGENCY_PASSWORD` | Mot de passe de l’espace agence (sans lui, l’espace reste fermé en ligne) | Oui |
| `ANTHROPIC_WORKSPACE_ID` | Seulement si la clé Claude n'est rattachée à aucun workspace | Non |
| `AI_EFFORT` | Effort de Claude : `low`, `medium` (défaut) ou `high` | Non |
| `CLAUDE_MODEL` | Modèle utilisé (défaut : `claude-sonnet-5-5`) | Non |
| `GEMINI_API_KEY` | Clé Google AI Studio pour créer les images par IA | Non (conseillé) |
| `GEMINI_IMAGE_MODEL` | Modèle d'image (défaut : `gemini-nano-banana-2.1`) | Non |
| `IMAGES_PER_HOUR` | Images IA autorisées par visiteur et par heure (défaut : 80) | Non |
| `UNSPLASH_ACCESS_KEY` | Photos libres de droits, utilisées si Gemini n'est pas configuré | Non |
| `GENERATIONS_PER_HOUR` | Générations autorisées par visiteur et par heure (défaut : 20) | Non |
| `NEXT_PUBLIC_APP_NAME` | Nom affiché de l'outil (modifiable aussi dans Réglages) | Non |
| `BLOB_STORE_ID`, `BLOB_READ_WRITE_TOKEN` | Ajoutées par Vercel quand le stockage Blob est relié au projet | Oui, pour les dossiers clients |

Chaque génération complète fait 3 appels à l'API Claude, plus 0 à 8 images Gemini selon le nombre de photos fournies. Les coûts dépendent des modèles choisis : consultez les grilles tarifaires (platform.claude.com, ai.google.dev/pricing) et fixez une limite de dépenses dans chaque console.

Google fait évoluer ses modèles d'image : si la génération renvoie « modèle introuvable », mettez à jour `GEMINI_IMAGE_MODEL` d'après la liste de ai.google.dev/gemini-api/docs/image-generation.

## Développement local

```bash
npm install
cp .env.example .env.local   # puis renseignez la clé
npm run dev                  # http://localhost:3000 et http://localhost:3000/agence
npm run build:demo           # construit dist/studio-site-demo.html (démo autonome)
```

## Organisation du code

```
app/                      Pages Next.js et routes API
  page.js                 Accueil (oriente vers les liens privés et l'espace agence)
  agence/page.js          Tableau de bord des clients (mot de passe)
  agence/clients/[id]     Dossier d'un client, de l'envoi du questionnaire à la mise en ligne
  agence/atelier          Atelier libre (génération sans dossier)
  agence/reglages         Nom affiché, prénom, contact, hébergeur des mentions légales
  questionnaire/[id]      Questionnaire du client (lien privé)
  propositions/[id]       Sélection de modèles et choix du client (lien privé)
  api/agence/…            Dossiers, images et réglages (réservé à l'agence)
  api/q/[id], api/p/[id]  Questionnaire et propositions (lien privé du client)
  api/files/[id]/[img]    Photos, logo et images IA d'un dossier
  api/generate            Appel à l'API Claude (la clé reste côté serveur)
  api/images              Recherche de photos Unsplash (facultatif)
  api/images/generate     Création d'une image avec Gemini (la clé reste côté serveur)
  api/status, api/agence-login
src/engine/               Le cœur, sans dépendance au framework
  questions.js            Questionnaire, secteurs, exemples
  archetypes.js           Les 12 directions artistiques (polices, palettes, variantes, CSS)
  compositions.js         Composition propre à chaque style : enchaînement des sections, héros, séparateurs, motifs, traitement des photos
  render.js               Assemblage des pages HTML
  css.js                  Feuille de style commune des sites générés
  art.js                  Visuels graphiques quand il n'y a pas de photo
  content.js              Textes de démo, nettoyage des réponses de l'IA, classement
  prompts.js              Consignes envoyées à l'IA
  zip.js                  Export .zip
src/ai/generate.js        Orchestration des 3 appels
src/ai/images.js          Photos du client (redimensionnement) et images Gemini
  records.js              Étapes d'un dossier, images et brief prêts pour le rendu
src/server/store.js       Stockage (Vercel Blob privé, lecture cohérente, écriture conditionnelle ; .data/ en local)
src/server/http.js        Accès agence, erreurs, nettoyage des réponses
src/ui/                   Interface (questionnaire, galerie, aperçu)
src/ui/agency/            Tableau de bord, dossier client, réglages
src/ui/client/            Pages ouvertes par le client
src/artifact/entry.jsx    Version démo publiée sur claude.ai
```

### Ajouter une direction artistique

Ajoutez un objet dans `src/engine/archetypes.js` (polices Google Fonts, 2 palettes, variantes de mise en page, CSS spécifique, ambiances et secteurs associés). Elle est automatiquement proposée à l'IA et au classement.

## Limites de cette version (V1)

- Les formulaires ouvrent la messagerie du visiteur ; pas encore d'envoi direct (service de formulaires à brancher).
- Boutique : panier et commande par e-mail ; pas de paiement en ligne (Stripe à brancher en V2).
- Pas d'hébergement automatique des sites générés : le .zip passe par GitHub et Vercel.
- La limite de générations est en mémoire : suffisante pour un test, à remplacer par une base (ex. Vercel KV) en production.
- Les mentions légales sont remplies avec les infos du questionnaire ; ce qui manque reste entre crochets.
- L'application n'envoie ni e-mail ni SMS : elle prépare les messages, que l'agence envoie elle-même.
- Les images IA sont des illustrations d'ambiance : elles ne doivent pas présenter de faux produits, lieux ou personnes comme réels.
