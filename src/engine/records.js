// Dossiers clients : étapes du parcours et images (code partagé navigateur / serveur)

// Le « chemin de fer » d'un dossier : 6 étapes, dans l'ordre
export const STAGES = [
  { id: 'sent', label: 'Questionnaire envoyé', short: 'Envoyé', waiting: 'client' },
  { id: 'answered', label: 'Réponses reçues', short: 'Réponses', waiting: 'agence' },
  { id: 'generated', label: 'Propositions générées', short: 'Générées', waiting: 'agence' },
  { id: 'proposed', label: 'Sélection envoyée', short: 'Sélection', waiting: 'client' },
  { id: 'chosen', label: 'Modèle choisi', short: 'Choisi', waiting: 'agence' },
  { id: 'live', label: 'Site en ligne', short: 'En ligne', waiting: null },
];

export const stageIndex = (status) => Math.max(0, STAGES.findIndex((s) => s.id === status));
export const stageOf = (status) => STAGES[stageIndex(status)];

// Ce qu'il reste à faire, du point de vue de l'agence
export function nextAction(rec) {
  switch (rec.status) {
    case 'sent':
      return rec.qStep > 0 ? `Le client remplit le questionnaire (étape ${Math.min(rec.qStep + 1, 7)} sur 7)` : 'En attente des réponses du client';
    case 'answered':
      return 'Générer les 10 propositions';
    case 'generated':
      return 'Choisir 2 à 5 modèles et les envoyer';
    case 'proposed':
      return 'En attente du choix du client';
    case 'chosen':
      return 'Mettre le site en service';
    case 'live':
      return rec.liveUrl ? rec.liveUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'Site en ligne';
    default:
      return '';
  }
}

export const MIN_PICK = 2;
export const MAX_PICK = 5;

export const CHECKS = [
  { id: 'texts', label: 'Relire textes, prix et horaires avec le brief' },
  { id: 'images', label: 'Remplacer les images d’ambiance par de vraies photos si le client en a' },
  { id: 'legal', label: 'Vérifier les mentions légales (plus aucun crochet)' },
  { id: 'domain', label: 'Nom de domaine acheté au nom du client' },
  { id: 'publish', label: 'Site publié et cadenas HTTPS actif' },
  { id: 'access', label: 'Accès et e-mail de livraison envoyés au client' },
];

const extOf = (img) => (img.ext === 'png' ? 'png' : img.ext === 'webp' ? 'webp' : 'jpg');

// Ordre d'utilisation dans les sites : photos du client, images IA, puis photos libres de droits
export function recordImages(rec) {
  const photos = (rec.brief?.photos || []).map((p) => ({ ...p, source: 'client' }));
  const ai = (rec.aiImages || []).map((p) => ({ ...p, source: 'ia' }));
  const stock = ai.length ? [] : (rec.stockImages || []).map((p) => ({ ...p, source: 'unsplash' }));
  return [...photos, ...ai, ...stock];
}

// Images prêtes pour le moteur de rendu (adresse d'aperçu + nom de fichier dans le .zip)
export function renderImages(rec, origin = '') {
  return recordImages(rec).map((img) => {
    if (img.source === 'unsplash') return { ...img };
    const url = `${origin}/api/files/${rec.id}/${img.id}`;
    // Une image d'illustration remplacée par une vraie photo (espace client) garde sa place dans le site
    const name = img.source === 'ia' && !img.reel ? 'image-ia' : 'photo';
    return { ...img, url, thumb: url, file: `images/${name}-${img.id.slice(-6).toLowerCase()}.${extOf(img)}` };
  });
}

// Brief prêt pour le rendu : logo et hébergeur ajoutés
export function renderBrief(rec, origin = '', hosting = '') {
  const b = { ...(rec.brief || {}) };
  if (b.logo?.id && b.logoInHeader !== false) {
    b.logoUrl = `${origin}/api/files/${rec.id}/${b.logo.id}`;
    b.logoFile = `images/logo.${extOf(b.logo)}`;
  }
  if (hosting && !b.hosting) b.hosting = hosting;
  return b;
}

export function plural(n, one, many) {
  return `${n} ${n > 1 ? many : one}`;
}

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '';
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'hier';
  if (d < 31) return `il y a ${d} jours`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
