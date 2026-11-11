// Agent d'inspiration : quand un questionnaire arrive, il cherche des sites remarquables du même
// métier (et ceux que le client aime), les visite avec un navigateur sans écran, fait des captures,
// relève leurs fonctionnalités, les fait analyser par Claude (vision), puis rédige des pistes pour
// ce client. Les pistes nourrissent la génération des 10 modèles ; les fiches forment une
// bibliothèque commune (page Inspiration), réutilisée d'un client à l'autre du même métier.
//
// Le travail se fait par étapes de moins de 5 minutes (limite d'une fonction Vercel) : l'agent se
// relance lui-même tant qu'il reste des sites à voir, et la surveillance (toutes les 5 minutes)
// reprend un dossier resté en plan. Rien n'est jamais copié : les sites servent d'idées.
import crypto from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import {
  getClient, updateClient, getSettings, getInspirationIndex, updateInspirationIndex, getInspirationAttente, updateInspirationAttente,
  getFicheSite, saveFicheSite, saveCapture, storageMode,
} from './store.js';
import { signer } from './securite.js';
import { ouvrirNavigateur, visiterSite, VisiteError } from './navigateur.js';
import {
  FONCTIONNALITES, IDS_FONCTIONNALITES, ARCHETYPE_IDS, normaliserUrl, domaineDe, adressesDansTexte, estUnSiteEntreprise, enCoursInspiration,
} from '../engine/inspiration.js';
import { SECTORS, sectorLabel } from '../engine/questions.js';
import { ARCHETYPES, MOODS } from '../engine/archetypes.js';
import { parseJsonLoose } from '../engine/util.js';

export const MAX_SITES_CLIENT = 4; // sites cités par le client
export const MAX_SITES_RECHERCHE = 5; // nouveaux sites du métier trouvés à chaque dossier
export const MAX_SITES_REUTILISES = 4; // fiches déjà dans la bibliothèque, pour le même métier
const FRAICHEUR_JOURS = 365; // au-delà, un site est revisité
const BAIL_MS = 6 * 60_000; // un passage de l'agent bloque les autres pendant 6 minutes au plus
// Un passage tient dans les 5 minutes d'une fonction Vercel : visite ≤ 75 s, analyse ≤ 75 s
const DEBUT_SITE_MAX_MS = 120_000; // après 2 minutes de travail, plus de nouveau site dans ce passage
const SYNTHESE_MAX_MS = 200_000; // la synthèse ne commence pas après 3 min 20
const SITE_MAX_MS = 75_000;
const IA_MAX_MS = 75_000;
const MAX_PASSAGES = 14;

export class InspirationError extends Error {
  constructor(message, code = 'failed') {
    super(message);
    this.code = code;
  }
}

const S = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const liste = (v, n, max) => (Array.isArray(v) ? v.map((x) => S(x, max)).filter(Boolean).slice(0, n) : []);
const maintenant = () => new Date().toISOString();

// Identifiant stable d'un site : domaine (sans www) + chemin
export function siteIdDe(url) {
  let chemin = '/';
  try {
    chemin = new URL(url).pathname.replace(/\/+$/, '') || '/';
  } catch {}
  return crypto.createHash('sha256').update('inspiration:' + domaineDe(url) + chemin).digest('hex').slice(0, 16);
}

export function inspirationDisponible() {
  const cfg = config();
  const missing = [];
  if (!cfg.apiKey) missing.push('ANTHROPIC_API_KEY');
  if (storageMode() === 'none') missing.push('stockage Blob');
  return { configured: missing.length === 0, missing };
}

// ---------- Claude ----------
function claude() {
  const cfg = config();
  if (!cfg.apiKey) throw new InspirationError('La clé Claude n’est pas configurée (ANTHROPIC_API_KEY).', 'no_key');
  return new Anthropic({
    apiKey: cfg.apiKey,
    maxRetries: 2,
    timeout: 150_000,
    ...(cfg.workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': cfg.workspaceId } } : {}),
  });
}

function erreurClaude(e, quoi) {
  if (e instanceof InspirationError) return e;
  const status = e?.status;
  const message = String(e?.message || '');
  console.error('[inspiration]', quoi, status || '-', message.slice(0, 300));
  if (status === 401 || status === 403) return new InspirationError('La clé Claude a été refusée par Anthropic (ANTHROPIC_API_KEY).', 'auth');
  if (status === 400 && /credit|balance|billing/i.test(message)) return new InspirationError('Le crédit API Claude est épuisé : l’agent reprendra au prochain essai.', 'credit');
  if (status === 404) return new InspirationError('Le modèle Claude configuré est introuvable (CLAUDE_MODEL).', 'model');
  if (status === 429 || status === 529 || status === 503 || status === 500) return new InspirationError('Claude est momentanément surchargé.', 'overloaded');
  return new InspirationError(`L’IA n’a pas pu ${quoi}.`, 'failed');
}

const texteDe = (msg) =>
  (msg?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

// Réponse JSON imposée par un schéma quand le modèle le permet, sinon demandée dans la consigne
async function demanderJson(client, params, schema, quoi) {
  const cfg = config();
  const base = { model: cfg.model, ...params };
  const options = { timeout: IA_MAX_MS, maxRetries: 1 };
  let msg;
  try {
    try {
      msg = await client.messages.create(schema ? { ...base, output_config: { format: { type: 'json_schema', schema } } } : base, options);
    } catch (e) {
      if (schema && e?.status === 400 && /output_config|json_schema|schema|format/i.test(String(e?.message))) msg = await client.messages.create(base, options);
      else throw e;
    }
  } catch (e) {
    throw erreurClaude(e, quoi);
  }
  if (msg.stop_reason === 'refusal') throw new InspirationError(`L’IA a refusé de ${quoi}.`, 'refused');
  try {
    return parseJsonLoose(texteDe(msg));
  } catch {
    throw new InspirationError(`La réponse de l’IA était illisible (${quoi}).`, 'invalid_json');
  }
}

function resumeBrief(b) {
  const moods = (b.moods || []).map((m) => MOODS.find((x) => x.id === m)?.label || m).join(', ');
  return [
    `Entreprise : ${S(b.businessName, 120)}`,
    `Métier : ${sectorLabel(b) || 'non précisé'}`,
    b.city ? `Ville / zone : ${S(b.city, 120)}` : '',
    b.description ? `Activité : ${S(b.description, 700)}` : '',
    b.siteType === 'boutique' ? 'Type de site : boutique en ligne' : 'Type de site : site vitrine',
    moods ? `Ambiance souhaitée : ${moods}` : '',
    b.audience ? `Public : ${S(b.audience, 200)}` : '',
    b.strengths ? `Ce qui le différencie : ${S(b.strengths, 400)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ---------- 1. Trouver les sites ----------
function consigneRecherche(b, { combien, connus, webOk }) {
  const cites = S(b.inspirations, 600);
  return `Tu aides une agence web française à trouver de l'inspiration avant de créer le site d'un client.

<client>
${resumeBrief(b)}
</client>
${cites ? `\nSites ou marques que le client aime : « ${cites} »\n` : ''}
Tâches :
${cites ? `1. Pour chaque site ou marque cité par le client, donne l'adresse de son site officiel (source "client"). Jamais une page Facebook, Instagram ou d'annuaire : si la marque n'a pas de site à elle, laisse-la de côté.\n2.` : '1.'} Trouve ${combien} sites internet remarquables d'entreprises indépendantes du même métier (source "metier") : beaux, actuels, faciles à utiliser sur téléphone, avec de bonnes idées (présentation des produits ou des prestations, réservation, mise en valeur du savoir-faire, de l'équipe, du lieu…). Varie les styles. Au moins 3 en France, 1 ou 2 à l'étranger.
- Évite les concurrents directs ${b.city ? `de ${S(b.city, 60)} et de ses environs` : 'de la même ville'}, les chaînes et franchises, les annuaires, places de marché, réseaux sociaux et pages de plateformes (Planity, TheFork, Doctolib, Uber Eats…).
- Donne l'adresse de la page d'accueil du site, telle qu'elle existe aujourd'hui.${connus.length ? `\n- Ces sites sont déjà connus, ne les redonne pas : ${connus.slice(0, 40).join(', ')}.` : ''}${
    webOk ? '\n- Vérifie avec la recherche web que chaque site existe et est en ligne.' : '\n- Tu n’as pas accès à internet : ne propose que des sites dont tu es sûr de l’adresse.'
  }

Réponds uniquement avec ce JSON :
{"sites":[{"url":"https://…","nom":"…","source":"${cites ? 'client|metier' : 'metier'}","pourquoi":"une phrase : ce qu'il a d'inspirant"}]}`;
}

async function appelRecherche(client, b, opts) {
  const cfg = config();
  const tools = opts.webOk ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8, user_location: { type: 'approximate', country: 'FR', timezone: 'Europe/Paris' } }] : undefined;
  const messages = [{ role: 'user', content: consigneRecherche(b, opts) }];
  let msg;
  for (let tour = 0; tour < 4; tour++) {
    msg = await client.messages.create({ model: cfg.model, max_tokens: 4000, messages, ...(tools ? { tools } : {}) }, { timeout: 120_000, maxRetries: 1 });
    if (msg.stop_reason !== 'pause_turn') break;
    // Recherche longue mise en pause par l'API : on renvoie la réponse telle quelle pour qu'elle continue
    messages.push({ role: 'assistant', content: msg.content });
  }
  return parseJsonLoose(texteDe(msg));
}

// Erreur de lecture du JSON (pas d'erreur de l'API) : message clair
const illisible = (e) => !e?.status && /JSON|illisible/i.test(String(e?.message || ''));

export async function rechercherSites(b, { combien = MAX_SITES_RECHERCHE, connus = [] } = {}) {
  const client = claude();
  let data;
  let recherche = 'web';
  let note = '';
  try {
    data = await appelRecherche(client, b, { combien, connus, webOk: true });
  } catch (e) {
    if (illisible(e)) throw new InspirationError('La réponse de l’IA était illisible (recherche).', 'invalid_json');
    if (!(e?.status === 400 && /web.?search/i.test(String(e?.message || '')))) throw erreurClaude(e, 'chercher les sites');
    // Recherche web coupée dans la console Claude : propositions de mémoire, vérifiées à la visite
    recherche = 'memoire';
    note = 'Recherche web désactivée dans la console Claude (platform.claude.com › Settings › Capabilities) : sites proposés de mémoire par l’IA, sans vérification.';
    try {
      data = await appelRecherche(client, b, { combien, connus, webOk: false });
    } catch (e2) {
      if (illisible(e2)) throw new InspirationError('La réponse de l’IA était illisible (recherche).', 'invalid_json');
      throw erreurClaude(e2, 'chercher les sites');
    }
  }
  const vus = new Set(connus.map(domaineDe));
  const sites = [];
  for (const x of Array.isArray(data?.sites) ? data.sites : []) {
    const url = normaliserUrl(x?.url);
    if (!url || !estUnSiteEntreprise(url)) continue;
    const d = domaineDe(url);
    if (vus.has(d)) continue;
    vus.add(d);
    sites.push({ url, nom: S(x.nom, 80) || d, source: x.source === 'client' ? 'client' : 'metier', pourquoi: S(x.pourquoi, 200) });
  }
  return { sites, recherche, note };
}

// ---------- 2. Analyser un site visité ----------
const SCHEMA_ANALYSE = {
  type: 'object',
  additionalProperties: false,
  required: ['nom', 'metier', 'resume', 'ambiance', 'palette', 'typographies', 'miseEnPage', 'fonctionnalites', 'idees', 'pointsFaibles', 'styleProche', 'note', 'identite'],
  properties: {
    nom: { type: 'string' },
    metier: { type: 'string', enum: SECTORS.map((s) => s.id) },
    resume: { type: 'string' },
    ambiance: { type: 'array', items: { type: 'string' } },
    palette: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['hex', 'usage'], properties: { hex: { type: 'string' }, usage: { type: 'string' } } } },
    typographies: { type: 'object', additionalProperties: false, required: ['titres', 'texte'], properties: { titres: { type: 'string' }, texte: { type: 'string' } } },
    miseEnPage: { type: 'array', items: { type: 'string' } },
    fonctionnalites: { type: 'array', items: { type: 'string', enum: IDS_FONCTIONNALITES } },
    idees: { type: 'array', items: { type: 'string' } },
    pointsFaibles: { type: 'array', items: { type: 'string' } },
    styleProche: { type: 'string', enum: ARCHETYPE_IDS },
    note: { type: 'integer' },
    identite: { type: 'string' },
  },
};

const SYSTEM_ANALYSE = `Tu es directeur artistique dans une agence web française. Tu analyses le site d'une entreprise à partir de captures d'écran et d'un relevé technique, pour en tirer de l'inspiration : ce qui le rend réussi (ou non), son style, ses fonctionnalités. Tu décris des idées réutilisables, jamais des éléments à copier (pas de slogan, de texte, de nom ni de logo à reprendre).

Réponds uniquement en JSON :
- nom : le nom de l'entreprise tel qu'il apparaît.
- metier : l'identifiant du métier de l'entreprise, parmi : ${SECTORS.map((s) => `${s.id} (${s.label})`).join(', ')}.
- resume : 2 phrases : ce que fait ce site de bien (ou de mal), concrètement.
- ambiance : 3 à 5 mots ou courtes expressions (ex. « minimaliste », « chaleureux », « photo plein écran »).
- palette : 3 à 6 couleurs dominantes en hexadécimal, chacune avec son usage (fond, texte, accent, boutons…).
- typographies : style des titres et du texte, en mots simples (ex. « serif fine et élégante », « sans-serif géométrique grasse »), sans deviner de nom de police.
- miseEnPage : 3 à 6 observations sur la mise en page (haut de page, enchaînement des sections, menu, mobile).
- fonctionnalites : celles réellement présentes, parmi : ${FONCTIONNALITES.map((f) => `${f.id} (${f.label})`).join(', ')}.
- idees : 3 à 6 idées concrètes qu'une agence pourrait réutiliser pour un autre client de ce métier, formulées comme des idées (ex. « Afficher les horaires du jour dès le haut de page »).
- pointsFaibles : 0 à 3 défauts à ne pas reproduire.
- styleProche : la direction artistique de Studio Site la plus proche, parmi : ${ARCHETYPES.map((a) => `${a.id} (${a.name})`).join(', ')}.
- note : de 1 à 5, l'intérêt de ce site comme source d'inspiration (5 = remarquable).
- identite : pour le site actuel du client seulement, ce qu'il faut garder de son identité (couleurs, logo, ton) en une ou deux phrases ; sinon chaîne vide.`;

const NOMS_CAPTURES = { ecran: 'Haut de la page d’accueil sur ordinateur', accueil: 'Page d’accueil entière sur ordinateur', mobile: 'Page d’accueil sur téléphone', 'page-1': 'Une page intérieure', 'page-2': 'Une autre page intérieure' };

export async function analyserVisite(visite, { brief, source }) {
  const client = claude();
  const r = visite.releve || {};
  const contexte = [
    source === 'actuel' ? 'Ce site est le SITE ACTUEL du client que nous allons refaire : relève son identité à garder (couleurs, logo, ton) dans « identite ».' : '',
    source === 'client' ? 'Ce site a été cité par le client comme un site qu’il aime.' : '',
    source === 'metier' ? `Ce site a été trouvé comme source d'inspiration pour un client du métier : ${sectorLabel(brief) || 'non précisé'}.` : '',
    `Adresse : ${visite.url}`,
    r.titre ? `Titre : ${S(r.titre, 160)}` : '',
    r.description ? `Description : ${S(r.description, 300)}` : '',
    r.nav?.length ? `Menu : ${r.nav.slice(0, 20).join(' · ')}` : '',
    r.titres?.length ? `Titres de la page d'accueil : ${r.titres.slice(0, 16).join(' · ')}` : '',
    r.boutons?.length ? `Boutons : ${r.boutons.slice(0, 12).join(' · ')}` : '',
    r.indices?.length ? `Indices techniques de fonctionnalités (à confirmer sur les captures) : ${r.indices.join(', ')}` : '',
    r.polices?.titres ? `Polices déclarées : titres ${S(r.polices.titres, 80)} ; texte ${S(r.polices.texte, 80)}` : '',
    r.couleurs?.length ? `Couleurs relevées : ${r.couleurs.slice(0, 8).join(', ')}` : '',
    r.outil ? `Outil de création : ${S(r.outil, 40)}` : '',
    visite.pages?.length > 1 ? `Pages intérieures vues : ${visite.pages.slice(1).map((p) => S(p.titre, 60) || p.url).join(' · ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const content = [{ type: 'text', text: contexte }];
  for (const nom of ['ecran', 'accueil', 'mobile', 'page-1']) {
    const c = visite.captures.find((x) => x.nom === nom);
    if (!c) continue;
    content.push({ type: 'text', text: NOMS_CAPTURES[nom] + ' :' });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c.buffer.toString('base64') } });
  }
  content.push({ type: 'text', text: 'Donne ton analyse en JSON.' });
  const data = await demanderJson(client, { max_tokens: 2500, system: SYSTEM_ANALYSE, messages: [{ role: 'user', content }] }, SCHEMA_ANALYSE, 'analyser le site');
  const hex = (h) => (/^#[0-9a-f]{6}$/i.test(String(h || '').trim()) ? String(h).trim().toLowerCase() : '');
  return {
    nom: S(data?.nom, 80),
    metier: SECTORS.some((s) => s.id === data?.metier) ? data.metier : '',
    resume: S(data?.resume, 400),
    ambiance: liste(data?.ambiance, 5, 40),
    palette: (Array.isArray(data?.palette) ? data.palette : []).map((p) => ({ hex: hex(p?.hex), usage: S(p?.usage, 40) })).filter((p) => p.hex).slice(0, 6),
    typographies: { titres: S(data?.typographies?.titres, 120), texte: S(data?.typographies?.texte, 120) },
    miseEnPage: liste(data?.miseEnPage, 6, 200),
    fonctionnalites: [...new Set((Array.isArray(data?.fonctionnalites) ? data.fonctionnalites : []).filter((f) => IDS_FONCTIONNALITES.includes(f)))],
    idees: liste(data?.idees, 6, 220),
    pointsFaibles: liste(data?.pointsFaibles, 3, 200),
    styleProche: ARCHETYPE_IDS.includes(data?.styleProche) ? data.styleProche : '',
    note: Math.max(1, Math.min(5, Math.round(Number(data?.note) || 3))),
    identite: source === 'actuel' ? S(data?.identite, 300) : '',
  };
}

// ---------- 3. Pistes pour ce client ----------
const SCHEMA_PISTES = {
  type: 'object',
  additionalProperties: false,
  required: ['resume', 'stylesConseilles', 'fonctionnalites', 'idees', 'ton', 'aEviter', 'siteActuel'],
  properties: {
    resume: { type: 'string' },
    stylesConseilles: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['archetype', 'pourquoi'], properties: { archetype: { type: 'string', enum: ARCHETYPE_IDS }, pourquoi: { type: 'string' } } } },
    fonctionnalites: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'pourquoi'], properties: { id: { type: 'string', enum: IDS_FONCTIONNALITES }, pourquoi: { type: 'string' } } } },
    idees: { type: 'array', items: { type: 'string' } },
    ton: { type: 'string' },
    aEviter: { type: 'array', items: { type: 'string' } },
    siteActuel: { type: 'string' },
  },
};

export async function synthetiser(brief, fiches) {
  const client = claude();
  const sites = fiches
    .map((f, i) => {
      const a = f.analyse || {};
      return [
        `Site ${i + 1} — ${a.nom || f.domaine} (${f.source === 'actuel' ? 'SITE ACTUEL DU CLIENT' : f.source === 'client' ? 'cité par le client' : 'même métier'}, note ${a.note || '?'}/5)`,
        a.resume ? `Résumé : ${a.resume}` : '',
        a.ambiance?.length ? `Ambiance : ${a.ambiance.join(', ')}` : '',
        a.styleProche ? `Style proche : ${a.styleProche}` : '',
        a.fonctionnalites?.length ? `Fonctionnalités : ${a.fonctionnalites.join(', ')}` : '',
        a.miseEnPage?.length ? `Mise en page : ${a.miseEnPage.join(' ; ')}` : '',
        a.idees?.length ? `Idées : ${a.idees.join(' ; ')}` : '',
        a.pointsFaibles?.length ? `Défauts : ${a.pointsFaibles.join(' ; ')}` : '',
        a.identite ? `Identité à garder : ${a.identite}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
  const deja = [...new Set([...(brief.features || []), ...(brief.pages || [])])].join(', ') || 'aucune';
  const prompt = `Voici le brief d'un client et l'analyse de sites qui peuvent l'inspirer. Rédige des pistes concrètes pour créer SON site : personnel, authentique, adapté à son métier et à ce qu'il a écrit. Les sites sont des sources d'idées, jamais des modèles à copier.

<client>
${resumeBrief(brief)}
Pages et fonctionnalités déjà demandées : ${deja}
</client>

<sites>
${sites}
</sites>

Réponds uniquement en JSON :
- resume : 2 ou 3 phrases pour l'agence : ce qui ressort de ces sites pour ce client.
- stylesConseilles : 3 à 5 directions artistiques de Studio Site, de la plus adaptée à la moins adaptée, chacune avec une raison courte. Directions : ${ARCHETYPES.map((a) => `${a.id} (${a.name})`).join(', ')}.
- fonctionnalites : 3 à 8 fonctionnalités utiles à ce client, chacune avec une raison courte, parmi : ${IDS_FONCTIONNALITES.join(', ')}.
- idees : 6 à 10 idées de sections, de contenus ou d'angles pour SON site, concrètes et adaptées à ce qu'il a écrit (ex. « Une section "La journée au fournil" avec 3 étapes en photos »). Aucune idée ne doit supposer un fait absent du brief (prix, label, année, livraison…).
- ton : le ton et le vocabulaire qui marchent dans ce métier, en une phrase.
- aEviter : 2 à 5 erreurs vues sur ces sites à ne pas reproduire.
- siteActuel : si un SITE ACTUEL DU CLIENT figure dans la liste, ce qu'il faut garder de son identité, en une phrase ; sinon chaîne vide.`;
  const data = await demanderJson(client, { max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }, SCHEMA_PISTES, 'rédiger les pistes');
  const styles = [];
  for (const x of Array.isArray(data?.stylesConseilles) ? data.stylesConseilles : []) {
    if (ARCHETYPE_IDS.includes(x?.archetype) && !styles.some((s) => s.archetype === x.archetype)) styles.push({ archetype: x.archetype, pourquoi: S(x.pourquoi, 160) });
  }
  const fonctions = [];
  for (const x of Array.isArray(data?.fonctionnalites) ? data.fonctionnalites : []) {
    if (IDS_FONCTIONNALITES.includes(x?.id) && !fonctions.some((f) => f.id === x.id)) fonctions.push({ id: x.id, pourquoi: S(x.pourquoi, 160) });
  }
  return {
    resume: S(data?.resume, 600),
    stylesConseilles: styles.slice(0, 5),
    fonctionnalites: fonctions.slice(0, 8),
    idees: liste(data?.idees, 10, 220),
    ton: S(data?.ton, 300),
    aEviter: liste(data?.aEviter, 5, 200),
    siteActuel: S(data?.siteActuel, 300),
  };
}

// ---------- Bibliothèque ----------
// Résumé d'une fiche pour l'index (page Inspiration, réutilisation par métier)
export function entreeIndex(fiche, metiers = []) {
  const a = fiche.analyse || {};
  return {
    id: fiche.id,
    url: fiche.url,
    domaine: fiche.domaine,
    nom: a.nom || fiche.nom || fiche.domaine,
    metiers: [...new Set([...(metiers || []), a.metier].filter(Boolean))].slice(0, 6),
    source: fiche.source,
    visiteLe: fiche.visiteLe,
    note: a.note || 0,
    ambiance: (a.ambiance || []).slice(0, 4),
    styleProche: a.styleProche || '',
    fonctionnalites: a.fonctionnalites || [],
    vignette: (fiche.captures || []).find((c) => c.nom === 'ecran')?.id || fiche.captures?.[0]?.id || '',
  };
}

const frais = (iso) => iso && Date.now() - Date.parse(iso) < FRAICHEUR_JOURS * 86400_000;

async function noterDansIndex(fiche, metier) {
  await updateInspirationIndex((idx) => {
    const avant = idx.sites[fiche.id];
    idx.sites[fiche.id] = entreeIndex(fiche, [...(avant?.metiers || []), metier]);
    return idx;
  });
}

async function ajouterMetier(siteId, metier) {
  if (!metier || metier === 'autre') return;
  await updateInspirationIndex((idx) => {
    const e = idx.sites[siteId];
    if (!e || e.metiers?.includes(metier)) return null;
    e.metiers = [...(e.metiers || []), metier].slice(0, 6);
    return idx;
  });
}

// ---------- Déroulé d'un dossier ----------
async function majDossier(id, patch) {
  return updateClient(id, (r) => {
    r.inspiration = { ...(r.inspiration || {}), ...(typeof patch === 'function' ? patch(r.inspiration || {}) : patch), majLe: maintenant() };
    return r;
  });
}

async function noterAttente(id, present) {
  await updateInspirationAttente((a) => {
    if (present) a.dossiers[id] = { depuis: a.dossiers[id]?.depuis || maintenant(), majLe: maintenant() };
    else if (a.dossiers[id]) delete a.dossiers[id];
    else return null;
    return a;
  }).catch(() => {});
}

async function reserver(id) {
  let pris = false;
  const rec = await updateClient(id, (r) => {
    pris = false;
    const i = r.inspiration || {};
    if (i.enCours && Date.now() - Date.parse(i.enCours) < BAIL_MS) return null;
    pris = true;
    r.inspiration = { ...i, enCours: maintenant(), passages: (i.passages || 0) + 1 };
    return r;
  });
  return rec && pris ? rec : null;
}

// Les sites à visiter pour ce dossier : ceux du client, son site actuel, la bibliothèque, la recherche
async function preparerCandidats(rec) {
  const b = rec.brief || {};
  const candidats = [];
  const ajoute = (c) => {
    const url = normaliserUrl(c.url);
    if (!url || candidats.some((x) => domaineDe(x.url) === domaineDe(url))) return;
    candidats.push({ ...c, url, siteId: siteIdDe(url) });
  };
  // Son site actuel (domaine qu'il possède déjà)
  if (b.domainOwned === 'oui' && String(b.domain || '').trim()) ajoute({ url: String(b.domain).trim(), nom: 'Site actuel du client', source: 'actuel', pourquoi: 'Son site actuel : identité à garder' });
  // Les adresses qu'il a écrites lui-même
  for (const url of adressesDansTexte(b.inspirations).slice(0, MAX_SITES_CLIENT)) if (estUnSiteEntreprise(url)) ajoute({ url, nom: domaineDe(url), source: 'client', pourquoi: 'Cité par le client' });

  // Fiches récentes de la bibliothèque, pour le même métier
  const idx = await getInspirationIndex();
  const memeMetier = Object.values(idx.sites)
    .filter((e) => b.sector && b.sector !== 'autre' && e.metiers?.includes(b.sector) && e.source !== 'actuel' && frais(e.visiteLe) && (e.note || 0) >= 3)
    .sort((x, y) => (y.note || 0) - (x.note || 0) || String(y.visiteLe).localeCompare(String(x.visiteLe)))
    .slice(0, MAX_SITES_REUTILISES);
  for (const e of memeMetier) ajoute({ url: e.url, nom: e.nom, source: 'metier', pourquoi: 'Déjà dans la bibliothèque', reutilise: true });

  // Recherche : marques citées sans adresse + nouveaux sites du métier
  const connus = [...candidats.map((c) => domaineDe(c.url)), ...Object.values(idx.sites).map((e) => e.domaine)];
  const { sites, recherche, note } = await rechercherSites(b, { combien: MAX_SITES_RECHERCHE, connus });
  let nbClient = candidats.filter((c) => c.source === 'client').length;
  let nbMetier = 0;
  for (const s of sites) {
    if (s.source === 'client' && nbClient < MAX_SITES_CLIENT) {
      ajoute(s);
      nbClient++;
    } else if (s.source === 'metier' && nbMetier < MAX_SITES_RECHERCHE) {
      ajoute(s);
      nbMetier++;
    }
  }
  return { candidats, recherche, note };
}

function avecDelai(promesse, ms, message) {
  let t;
  promesse.catch(() => {}); // une visite abandonnée qui échoue plus tard ne doit rien faire tomber
  return Promise.race([promesse, new Promise((_, rej) => (t = setTimeout(() => rej(new VisiteError(message, 'lent')), ms)))]).finally(() => clearTimeout(t));
}

// Visite (un navigateur neuf par site, fermé juste après), analyse et rangement dans la bibliothèque
async function traiterSite(c, rec) {
  let visite;
  let navigateur;
  try {
    navigateur = await ouvrirNavigateur();
  } catch (e) {
    const detail = String(e?.message || e || '').split('\n')[0].replace(/\/[^\s'"]*\//g, '…/').slice(0, 160);
    console.error('[inspiration] navigateur', e?.name, String(e?.message || '').slice(0, 1000));
    throw new InspirationError(`Le navigateur de l’agent n’a pas pu démarrer sur le serveur (document 22, §E). Détail : ${detail}`, 'navigateur');
  }
  try {
    visite = await avecDelai(visiterSite(navigateur, c.url), SITE_MAX_MS, 'La visite du site a pris trop de temps.');
  } finally {
    await navigateur.close().catch(() => {});
  }
  const analyse = await analyserVisite(visite, { brief: rec.brief || {}, source: c.source });
  const siteId = c.siteId;
  const captures = [];
  for (const cap of visite.captures) {
    const id = `${siteId}-${cap.nom}`;
    await saveCapture(id, cap.buffer);
    captures.push({ id, nom: cap.nom, page: cap.page });
  }
  const fiche = {
    id: siteId,
    url: c.url,
    urlFinale: visite.url,
    domaine: domaineDe(c.url),
    nom: analyse.nom || c.nom,
    source: c.source,
    pourquoi: c.pourquoi || '',
    visiteLe: maintenant(),
    pages: visite.pages,
    releve: { ...visite.releve },
    analyse,
    captures,
  };
  await saveFicheSite(siteId, fiche);
  await noterDansIndex(fiche, rec.brief?.sector && rec.brief.sector !== 'autre' ? rec.brief.sector : '');
  return fiche;
}

/**
 * Fait avancer l'agent d'un dossier pendant au plus ~4 minutes.
 * Renvoie { raison } si rien n'a été fait, sinon { continuer, statut }.
 */
export async function avancerInspiration(id, { budgetSiteMs = DEBUT_SITE_MAX_MS, budgetSyntheseMs = SYNTHESE_MAX_MS } = {}) {
  const debut = Date.now();
  const rec = await reserver(id);
  if (!rec) return { raison: (await getClient(id)) ? 'occupe' : 'introuvable' };
  let insp = rec.inspiration || {};
  let continuer = false;
  let progres = false; // au moins une étape utile dans ce passage (recherche ou site) avant de s'arrêter sur le temps
  try {
    if (!enCoursInspiration(insp)) return { raison: 'rien' };
    if ((insp.passages || 0) > MAX_PASSAGES) throw new InspirationError('L’agent a dépassé le nombre d’étapes prévu : relance-le.', 'passages');

    if (insp.statut === 'attente' || insp.statut === 'recherche' || !Array.isArray(insp.candidats)) {
      await majDossier(id, { statut: 'recherche' });
      const { candidats, recherche, note } = await preparerCandidats(rec);
      const r2 = await majDossier(id, { statut: 'visite', candidats, recherche, note: note || '', faits: [], sites: [], ecartes: [] });
      insp = r2.inspiration;
      progres = true;
    }

    for (const c of insp.candidats || []) {
      if ((insp.faits || []).includes(c.siteId)) continue;
      if (progres && Date.now() - debut > budgetSiteMs) {
        continuer = true;
        break;
      }
      let ok = false;
      let raison = '';
      try {
        // Déjà visité récemment (pour ce dossier ou un autre) : la fiche est reprise telle quelle
        const fiche = await getFicheSite(c.siteId);
        if (fiche?.analyse && frais(fiche.visiteLe) && c.source !== 'actuel') {
          await ajouterMetier(c.siteId, rec.brief?.sector);
          ok = true;
        } else {
          await traiterSite(c, rec);
          ok = true;
        }
      } catch (e) {
        // Problème de Claude (clé, crédit, surcharge) : inutile de continuer avec les autres sites
        if (e instanceof InspirationError && ['no_key', 'auth', 'credit', 'model', 'overloaded', 'navigateur'].includes(e.code)) throw e;
        raison = e instanceof VisiteError || e instanceof InspirationError ? e.message : 'Le site n’a pas pu être analysé.';
        if (!(e instanceof VisiteError) && !(e instanceof InspirationError)) console.warn('[inspiration] site', domaineDe(c.url), e?.name, String(e?.message || '').slice(0, 200));
      }
      const r3 = await majDossier(id, (i) => ({
        alerte: '',
        faits: [...new Set([...(i.faits || []), c.siteId])],
        sites: ok ? [...new Set([...(i.sites || []), c.siteId])] : i.sites || [],
        ecartes: ok ? i.ecartes || [] : [...(i.ecartes || []), { url: c.url, nom: c.nom, raison: S(raison, 160) }].slice(-20),
      }));
      insp = r3.inspiration;
      progres = true;
      await noterAttente(id, true);
    }

    // Synthèse dans ce passage s'il reste assez de temps (ou si ce passage n'a encore rien fait)
    if (!continuer && progres && Date.now() - debut > budgetSyntheseMs) continuer = true;
    if (!continuer) {
      const ids = insp.sites || [];
      if (!ids.length) {
        throw new InspirationError(
          (insp.candidats || []).length ? 'Aucun des sites trouvés n’a pu être visité (voir la liste des sites écartés) : relance plus tard.' : 'La recherche n’a trouvé aucun site à visiter : relance plus tard.',
          'aucun'
        );
      }
      await majDossier(id, { statut: 'synthese' });
      const fiches = (await Promise.all(ids.map((s) => getFicheSite(s)))).filter(Boolean);
      const sources = Object.fromEntries((insp.candidats || []).map((c) => [c.siteId, c.source]));
      const pistes = await synthetiser(rec.brief || {}, fiches.map((f) => ({ ...f, source: sources[f.id] || f.source })));
      const nb = fiches.length;
      await updateClient(id, (r) => {
        r.inspiration = { ...(r.inspiration || {}), statut: 'pret', pistes, erreur: null, alerte: '', finLe: maintenant(), majLe: maintenant(), enCours: null };
        r.log = [...(r.log || []), { at: maintenant(), what: `Inspiration : ${nb} site${nb > 1 ? 's' : ''} analysé${nb > 1 ? 's' : ''}, pistes prêtes` }];
        return r;
      });
      await noterAttente(id, false);
      return { continuer: false, statut: 'pret' };
    }
    return { continuer: true, statut: insp.statut };
  } catch (e) {
    // Claude surchargé : le dossier reste en cours, la surveillance le reprendra dans quelques minutes
    if (e instanceof InspirationError && e.code === 'overloaded') {
      await majDossier(id, { alerte: 'Claude était surchargé : l’agent reprend tout seul dans quelques minutes.' }).catch(() => {});
      return { continuer: false, statut: insp.statut, attente: true };
    }
    const message = e instanceof InspirationError ? e.message : 'L’agent d’inspiration a rencontré un problème.';
    if (!(e instanceof InspirationError)) console.error('[inspiration]', e?.name, String(e?.message || '').slice(0, 300));
    await updateClient(id, (r) => {
      r.inspiration = { ...(r.inspiration || {}), statut: 'erreur', erreur: S(message, 300), alerte: '', majLe: maintenant(), enCours: null };
      r.log = [...(r.log || []), { at: maintenant(), what: `Inspiration en échec (${S(message, 140)})` }];
      return r;
    }).catch(() => {});
    await noterAttente(id, false);
    return { continuer: false, statut: 'erreur', erreur: message };
  } finally {
    // Libère le dossier pour le passage suivant
    await updateClient(id, (r) => {
      if (!r.inspiration?.enCours) return null;
      r.inspiration = { ...r.inspiration, enCours: null };
      return r;
    }).catch(() => {});
  }
}

// ---------- Démarrage et relances ----------
// Appelle la route de l'agent (fonction séparée, avec son propre temps de travail)
export async function relancerAgent(origine, id) {
  const exp = Math.floor(Date.now() / 1000) + 600;
  try {
    const r = await fetch(`${origine}/api/agence/inspiration/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-studio-agent': signer({ t: 'agent', id, exp }) },
      body: JSON.stringify({ id }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok && r.status !== 202) console.warn('[inspiration] relance refusée', r.status);
    return r.ok;
  } catch (e) {
    console.warn('[inspiration] relance impossible', e?.name, String(e?.message || '').slice(0, 120));
    return false;
  }
}

// Remet un dossier « en attente » (première fois, ou relance demandée par l'agence).
// Renvoie { lance: true, client } ou { raison: 'off' | 'coupe' | 'introuvable' | 'demo' | 'vide' | 'pret' | 'encours' }
export async function preparerInspiration(id, { force = false, auto = false } = {}) {
  if (!inspirationDisponible().configured) return { raison: 'off' };
  if (auto && (await getSettings()).inspirationAuto === false) return { raison: 'coupe' };
  let motif = '';
  const rec = await updateClient(id, (r) => {
    motif = '';
    const i = r.inspiration || {};
    if (r.demo) motif = 'demo';
    else if (!String(r.brief?.businessName || '').trim()) motif = 'vide';
    else if (enCoursInspiration(i) && i.enCours && Date.now() - Date.parse(i.enCours) < BAIL_MS) motif = 'encours';
    else if (!force && (i.statut === 'pret' || enCoursInspiration(i))) motif = i.statut === 'pret' ? 'pret' : 'encours';
    if (motif) return null;
    // Une relance garde les pistes précédentes jusqu'à ce que les nouvelles soient prêtes
    r.inspiration = { statut: 'attente', demandeLe: maintenant(), majLe: maintenant(), passages: 0, candidats: null, faits: [], sites: [], ecartes: [], pistes: i.pistes || null, erreur: null, note: '', alerte: '' };
    return r;
  });
  if (!rec) return { raison: 'introuvable' };
  if (motif) return { raison: motif, client: rec };
  await noterAttente(id, true);
  return { lance: true, client: rec };
}

// Démarrage automatique (questionnaire reçu, brief rempli par l'agence)
export async function demarrerInspiration(id, origine, opts = {}) {
  const res = await preparerInspiration(id, { auto: true, ...opts });
  if (res.lance) await relancerAgent(origine, id);
  return res;
}

// Surveillance : reprend les dossiers restés en plan (passage coupé, serveur redémarré)
export async function reprendreInspirations(origine, { max = 3 } = {}) {
  if (!inspirationDisponible().configured) return 0;
  const attente = await getInspirationAttente();
  let relances = 0;
  for (const [id, x] of Object.entries(attente.dossiers || {})) {
    const age = Date.now() - Date.parse(x.majLe || x.depuis || 0);
    if (Date.now() - Date.parse(x.depuis || 0) > 6 * 3600_000) {
      // Bloqué depuis des heures : on arrête et on le dit dans le dossier
      await updateClient(id, (r) => {
        if (!enCoursInspiration(r.inspiration)) return null;
        r.inspiration = { ...r.inspiration, statut: 'erreur', erreur: 'L’agent s’est arrêté en route : relance-le.', enCours: null, majLe: maintenant() };
        return r;
      }).catch(() => {});
      await noterAttente(id, false);
      continue;
    }
    if (age < 7 * 60_000 || relances >= max) continue;
    const rec = await getClient(id).catch(() => null);
    if (!rec || !enCoursInspiration(rec.inspiration)) {
      await noterAttente(id, false);
      continue;
    }
    if (await relancerAgent(origine, id)) relances++;
  }
  return relances;
}

// Ce que l'écran du dossier affiche
export function vueInspiration(rec, index) {
  const i = rec?.inspiration || null;
  if (!i) return null;
  const sites = (i.sites || []).map((s) => index?.sites?.[s]).filter(Boolean);
  const sources = Object.fromEntries((i.candidats || []).map((c) => [c.siteId, c.source]));
  return {
    statut: i.statut,
    demandeLe: i.demandeLe || null,
    finLe: i.finLe || null,
    majLe: i.majLe || null,
    enCours: enCoursInspiration(i),
    total: (i.candidats || []).length,
    faits: (i.faits || []).length,
    recherche: i.recherche || '',
    note: i.alerte || i.note || '',
    erreur: i.erreur || '',
    ecartes: (i.ecartes || []).slice(-10),
    pistes: i.pistes || null,
    sites: sites.map((e) => ({ ...e, source: sources[e.id] || e.source })),
  };
}
