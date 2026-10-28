# Studio Site

Agent IA qui crée un site internet à partir d'un questionnaire et propose **10 modèles uniques**, rédigés pour l'activité du client.

Le parcours client se gère depuis l'**espace agence** (`/agence`, protégé par mot de passe) :

1. **Nouveau client** : un dossier est créé avec un lien privé de questionnaire (`/questionnaire/…`) et un message prêt à copier.
2. **Questionnaire** : le client répond chez lui en 7 étapes (activité, site, offre, style, logo et photos, coordonnées, infos légales et domaine). Ses réponses sont enregistrées à chaque étape. Il ne voit jamais la génération.
3. **Génération privée** : l'agence lance les 10 modèles depuis le dossier.
4. **Sélection** : l'agence retient 2 à 5 modèles et écrit un message. Le client les découvre sur sa page privée (`/propositions/…`).
5. **Choix** : le client choisit un modèle et laisse un commentaire.
6. **Mise en service** : aperçu complet, téléchargement du .zip (mentions légales et logo déjà remplis), liste de contrôle, puis « Site en ligne ».
7. **Espace client** (`/espace/…`) : livré avec le site, il permet au client de modifier lui-même ses horaires, prix, annonces et photos (voir plus bas).

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
| `GITHUB_PUBLISH_TOKEN` | Clé GitHub à grain fin, propriétaire : l'organisation des sites clients (Administration et Contents en écriture) | Pour la mise en ligne automatique |
| `GITHUB_PUBLISH_ORG` | Organisation GitHub des sites clients (défaut : `Station-Site`) | Non |
| `VERCEL_PUBLISH_TOKEN` | Clé Vercel limitée à l'équipe Pro | Pour la mise en ligne automatique |
| `VERCEL_TEAM_ID` | Identifiant de l'équipe Vercel, seulement si la clé en voit plusieurs | Non |
| `OVH_APPLICATION_KEY`, `OVH_APPLICATION_SECRET`, `OVH_CONSUMER_KEY` | Clé API OVHcloud (droits GET, POST, PUT, DELETE sur `/domain/zone/*`) : Studio Site règle lui-même la zone DNS du client | Non (sinon, saisie à la main) |
| `OVH_ENDPOINT` | Adresse de l'API OVHcloud (défaut : `https://eu.api.ovh.com/1.0`) | Non |
| `BREVO_API_KEY` | Clé API Brevo : envoi des accès, des liens de connexion et des notifications de l'espace client | Non (sinon, messages à copier) |
| `EMAIL_FROM` | Adresse d'expédition validée dans Brevo (ex. `contact@ton-domaine.fr`) | Avec Brevo |
| `EMAIL_FROM_NAME` | Nom affiché comme expéditeur (défaut : le nom du studio dans Réglages) | Non |
| `DRIVE_WEBHOOK_URL` | Adresse de l'application Web du script « Automatisation dossiers clients » (finit par `/exec`) | Pour Google Drive |
| `DRIVE_WEBHOOK_SECRET` | Clé affichée par **Clients › Connecter Studio Site** dans le tableau Suivi clients | Pour Google Drive |

### Mise en ligne automatique

Dans le dossier d'un client, une fois son modèle choisi, le bouton **Mettre en ligne** crée le dépôt privé `site-identifiant` dans l'organisation GitHub, crée le projet Vercel relié, dépose le site (sans `LISEZ-MOI.txt`) et suit Vercel jusqu'à « Ready ». Le bouton **Ajouter dans Vercel** relie ensuite le domaine du client (avec et sans www) et affiche les valeurs DNS à saisir chez OVHcloud.

Avec la clé API OVHcloud, le bloc **Zone DNS chez OVHcloud** compare la zone du client aux valeurs que Vercel recommande pour ce projet (à l'ajout du domaine et à chaque **Vérifier**), affiche les changements, puis **Régler chez OVHcloud** les applique : entrée A du domaine seul, suppression de son AAAA, un seul CNAME sur `www` (les autres entrées de `www` sont retirées), TXT de vérification Vercel si besoin, puis publication de la zone. Les entrées MX, NS, SPF, DKIM, SRV et les autres sous-domaines ne sont jamais touchées.

Garde-fous : coupée tant qu'elle n'est pas activée dans **Réglages** ; mentions légales incomplètes (passages entre crochets) signalées en avertissement, sans bloquer la publication, et notées dans l'historique du dossier ; jamais d'écriture dans un dépôt qui n'a pas été créé pour ce dossier ; confirmation demandée si le dépôt a été modifié à la main sur GitHub depuis la dernière publication. Chaque étape est notée dans l'historique du dossier.

### Google Drive

Avec `DRIVE_WEBHOOK_URL` et `DRIVE_WEBHOOK_SECRET`, Studio Site range lui-même chaque dossier dans le Drive de l'agence, côté serveur et sans faire attendre personne : la ligne du tableau Suivi clients et la fiche brief (à la réception du questionnaire, puis à chaque génération si les réponses ont changé), les photos et le logo du client (`2-Photos et logo`), et le site en .zip (`3-Versions du site`) à chaque mise en ligne depuis le dossier, s'il a changé. Le bloc **Google Drive** du dossier montre ce qui est rangé, le lien du dossier, et renvoie ce qui manque après un échec. Rien ne part vers Drive depuis l'espace client. L'ancienne route publique `/api/drive` est fermée.

### Espace client

Chaque site livré a son espace, ouvert depuis le dossier du client (bloc **Espace client**) :

- **Ce que le client modifie** : horaires, fermetures exceptionnelles (bandeau affiché 3 semaines avant), coordonnées, services ou carte (prix, offre datée, indisponible), boutique (rupture de stock, offre datée), annonces et fêtes (Noël, Halloween, Pâques… allumées et éteintes toutes seules, chaque année), réponses de la FAQ liées aux horaires, photos. L'aperçu se met à jour pendant la saisie, page par page, à la date de son choix.
- **Toujours cohérent avec son modèle** : le client ne change que des valeurs ; le site est reconstruit par le moteur avec les blocs du modèle choisi, puis publié par la mise en ligne automatique. Les contenus datés (offres, bandeaux) basculent seuls grâce au petit script du site, sans republier.
- **Accès** : lien personnel à usage unique (7 jours) dans le message de livraison ; le client clique « Ouvrir mon espace » et son appareil reste reconnu (cookie HttpOnly, Secure, SameSite=Strict, limité à `/api/espace/<dossier>`). Lien de 15 minutes pour un autre appareil, ou par e-mail si Brevo est branché. Seule l'empreinte des liens est enregistrée ; chaque appareil se retire séparément ; **Couper l'accès du client** déconnecte tout.
- **Qui fait les mises à jour** : le client choisit « Je m'en occupe », « À deux » ou « Mon prestataire s'en occupe », avec, s'il le veut, la validation de chaque publication de l'agence. L'agence ouvre l'espace en **vue agence**.
- **Garde-fous** : contrôles refaits côté serveur, photos vérifiées sur leur contenu réel (JPEG, PNG, WebP), fusion avec les changements faits entre-temps, historique des versions avec retour en arrière, 20 publications par jour au plus. Si la mise en ligne automatique est coupée ou que le dépôt GitHub a été modifié à la main, les changements restent enregistrés et partent avec « Publier une nouvelle version ».
- **Demandes** : page en plus, nouveau style… le client écrit, l'agence répond par un devis (ou « inclus dans l'entretien »), le client l'accepte dans son espace (accord daté).

Un site qui a un espace client se modifie depuis Studio Site (dossier ou vue agence), plus à la main dans GitHub : une modification faite directement dans le dépôt serait remplacée à la publication suivante.

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
  espace/[id]             Espace client : modifications du site en ligne (lien personnel, puis appareil reconnu)
  api/agence/…            Dossiers, images, réglages, mise en ligne et espace client (réservé à l'agence)
  api/espace/[id]         Espace client : lecture, publication, demandes, appareils ; …/images pour les photos
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
src/server/publish.js     Mise en ligne automatique (GitHub + Vercel)
src/server/espace.js      Espace client : liens, appareils, versions, publication
src/server/mail.js        E-mails par Brevo (facultatif)
src/server/drive.js       Rangement dans Google Drive : fiche brief, photos, .zip des versions (facultatif)
src/engine/espace.js      Ce que le client peut modifier, contrôles, fusion, fêtes et annonces datées
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
- La limite de générations est en mémoire : suffisante pour un test, à remplacer par une base (ex. Vercel KV) en production.
- Les mentions légales sont remplies avec les infos du questionnaire ; ce qui manque reste entre crochets.
- Sans Brevo, l'application n'envoie ni e-mail ni SMS : elle prépare les messages, que l'agence envoie elle-même. Avec Brevo, elle envoie les accès de l'espace client et ses notifications.
- L'espace client s'ouvre sur l'adresse de Studio Site, pas sur le domaine du client.
- Les images IA sont des illustrations d'ambiance : elles ne doivent pas présenter de faux produits, lieux ou personnes comme réels.
