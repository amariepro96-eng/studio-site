# Studio Site

Agent IA qui crée un site internet à partir d'un questionnaire et propose **10 modèles uniques**, rédigés pour l'activité du client.

- **Mode client** (`/`) : le client répond seul à 5 étapes de questions, choisit parmi 10 propositions et télécharge son site.
- **Mode agence** (`/agence`) : vous remplissez le brief sur une seule page, comparez les 10 modèles, variez la mise en page ou la palette, puis livrez le site (.zip). Protégé par mot de passe.

## Comment ça marche

1. Le questionnaire produit un **brief** (activité, offre, style, coordonnées).
2. Trois demandes partent en parallèle vers l'API Claude :
   - choix et classement de 10 directions artistiques parmi 12, avec une accroche différente pour chacune ;
   - textes principaux (atouts, services, histoire, appel à l'action, référencement) ;
   - pages secondaires (FAQ, contact, produits pour une boutique).
3. Le **moteur de rendu** assemble chaque modèle selon la composition propre à son style (2 recettes par style : galeries, bandeaux photo, étapes, manifeste, bento…) à partir de blocs validés : polices, palettes, mises en page et visuels propres à chaque direction. Le rendu reste professionnel quel que soit le texte.
4. **Images** : les photos envoyées par le client (redimensionnées dans son navigateur, jamais envoyées au serveur) passent en premier. Gemini complète jusqu'à 10 visuels en créant jusqu'à 8 images d'ambiance réalistes à partir de descriptions rédigées par Claude. Sans clé Gemini, des photos Unsplash (si configuré) ou des illustrations graphiques prennent le relais.
5. Le client choisit un modèle : le site complet (accueil, services, boutique, à propos, FAQ, contact, mentions légales) se prévisualise sur ordinateur, tablette et mobile, puis se télécharge en .zip prêt à héberger.

Sans clé API, l'application fonctionne en **mode démo** avec des textes génériques.

## Mettre en ligne (Vercel)

1. Créez un dépôt GitHub et envoyez-y ce dossier.
2. Sur [vercel.com](https://vercel.com), **Add New → Project**, importez le dépôt, gardez les réglages proposés (Next.js).
3. Dans **Settings → Environment Variables**, ajoutez au minimum `ANTHROPIC_API_KEY` et `AGENCY_PASSWORD`, puis redéployez.

## Variables d'environnement

| Variable | Rôle | Obligatoire |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clé API créée sur platform.claude.com | Oui, pour l'IA |
| `AGENCY_PASSWORD` | Mot de passe de `/agence` | Fortement conseillé |
| `ANTHROPIC_WORKSPACE_ID` | Seulement si la clé Claude n'est rattachée à aucun workspace | Non |
| `CLAUDE_MODEL` | Modèle utilisé (défaut : `claude-sonnet-5-5`) | Non |
| `GEMINI_API_KEY` | Clé Google AI Studio pour créer les images par IA | Non (conseillé) |
| `GEMINI_IMAGE_MODEL` | Modèle d'image (défaut : `gemini-nano-banana-2.1`) | Non |
| `IMAGES_PER_HOUR` | Images IA autorisées par visiteur et par heure (défaut : 80) | Non |
| `UNSPLASH_ACCESS_KEY` | Photos libres de droits, utilisées si Gemini n'est pas configuré | Non |
| `GENERATIONS_PER_HOUR` | Générations autorisées par visiteur et par heure (défaut : 10) | Non |
| `NEXT_PUBLIC_APP_NAME` | Nom affiché de l'outil | Non |

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
  page.js                 Mode client
  agence/page.js          Mode agence (mot de passe)
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
src/ui/                   Interface (questionnaire, galerie, aperçu)
src/artifact/entry.jsx    Version démo publiée sur claude.ai
```

### Ajouter une direction artistique

Ajoutez un objet dans `src/engine/archetypes.js` (polices Google Fonts, 2 palettes, variantes de mise en page, CSS spécifique, ambiances et secteurs associés). Elle est automatiquement proposée à l'IA et au classement.

## Limites de cette version (V1)

- Les formulaires ouvrent la messagerie du visiteur ; pas encore d'envoi direct (service de formulaires à brancher).
- Boutique : panier et commande par e-mail ; pas de paiement en ligne (Stripe à brancher en V2).
- Pas encore de comptes clients ni d'hébergement automatique des sites générés.
- La limite de générations est en mémoire : suffisante pour un test, à remplacer par une base (ex. Vercel KV) en production.
- Les mentions légales sont un modèle à compléter.
- Les photos du client ne sont pas conservées si la page est fermée avant le téléchargement.
- Les images IA sont des illustrations d'ambiance : elles ne doivent pas présenter de faux produits, lieux ou personnes comme réels.
