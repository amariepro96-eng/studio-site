// Photos du client : ce que montre chacune, analysé par Claude (vision), pour les placer
// au bon endroit du site (haut de page, à côté du bon service, à propos, galerie…) et ne
// faire créer par l'IA que les images qui manquent. Les informations sont rangées dans
// rec.imageInfo[idImage] (jamais dans le brief, que le questionnaire réécrit).
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { readImage } from './store.js';
import { parseJsonLoose } from '../engine/util.js';
import { ROLES, ROLES_ECARTES, IMAGE_ROLES } from '../engine/placement.js';

const TOUS_ROLES = [...ROLES, ...ROLES_ECARTES];
const MAX_INFOS = 80;

// Largeur et hauteur d'une image JPEG, PNG ou WebP (lues dans son en-tête)
export function dimensions(buf) {
  try {
    if (!buf || buf.length < 24) return null;
    if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const t = buf.toString('ascii', 12, 16);
      if (t === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
      if (t === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
      if (t === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) };
      }
      return null;
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const m = buf[i + 1];
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
          i += 2;
          continue;
        }
        const len = buf.readUInt16BE(i + 2);
        if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
          return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
        }
        i += 2 + len;
      }
    }
  } catch {}
  return null;
}

async function octets(clientId, imgId) {
  const res = await readImage(clientId, imgId).catch(() => null);
  if (!res) return null;
  const buffer = res.buffer || (res.stream ? Buffer.from(await new Response(res.stream).arrayBuffer()) : null);
  return buffer?.length ? { buffer, type: res.contentType || 'image/jpeg' } : null;
}

// Garde la table des informations à une taille raisonnable (images encore présentes d'abord)
export function rangerInfos(r) {
  const info = r.imageInfo && typeof r.imageInfo === 'object' ? r.imageInfo : {};
  const vivantes = new Set([...(r.brief?.photos || []), ...(r.aiImages || [])].map((p) => p.id));
  const cles = Object.keys(info);
  if (cles.length <= MAX_INFOS) return info;
  const garder = [...cles.filter((k) => vivantes.has(k)), ...cles.filter((k) => !vivantes.has(k)).slice(-(MAX_INFOS - vivantes.size))].slice(0, MAX_INFOS);
  return Object.fromEntries(garder.map((k) => [k, info[k]]));
}

// Image créée par l'IA : son rôle (d'après sa description) et sa taille
export function infoImageIa(r, img, { role, buffer }) {
  const d = dimensions(buffer);
  r.imageInfo = { ...(r.imageInfo || {}), [img.id]: { role: ROLES.includes(role) ? role : '', ...(d ? { w: d.w, h: d.h } : {}), ia: true } };
  r.imageInfo = rangerInfos(r);
}

// Le client remplace une image depuis son espace : la nouvelle garde la place de l'ancienne
export function heriterInfos(r, avant = [], apres = []) {
  const info = r.imageInfo;
  if (!info) return;
  const idsAvant = new Set(avant.map((p) => p?.id));
  const idsApres = new Set(apres.map((p) => p?.id));
  apres.forEach((p, i) => {
    const old = avant[i];
    if (!p?.id || !old?.id || p.id === old.id || idsAvant.has(p.id) || idsApres.has(old.id) || info[p.id] || !info[old.id]) return;
    const { role, service, choix } = info[old.id];
    info[p.id] = { ...(role ? { role } : {}), ...(service ? { service } : {}), ...(choix ? { choix } : {}), herite: true };
  });
  r.imageInfo = rangerInfos(r);
}

// Choix de l'agence pour une photo : 'oui' (l'utiliser), 'non' (l'écarter), '' (laisser l'IA décider)
export function choixPhoto(r, imgId, choix) {
  const info = { ...(r.imageInfo || {}) };
  const x = { ...(info[imgId] || {}) };
  if (choix === 'oui' || choix === 'non') x.choix = choix;
  else delete x.choix;
  info[imgId] = x;
  r.imageInfo = info;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['photos', 'style'],
  properties: {
    photos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['n', 'role', 'sujet', 'service', 'qualite', 'utilisable', 'raison'],
        properties: {
          n: { type: 'integer' },
          role: { type: 'string', enum: TOUS_ROLES },
          sujet: { type: 'string' },
          service: { type: 'string' },
          qualite: { type: 'string', enum: ['bonne', 'moyenne', 'faible'] },
          utilisable: { type: 'boolean' },
          raison: { type: 'string' },
        },
      },
    },
    style: { type: 'string' },
  },
};

const SYSTEM = `Tu prépares le site internet d'une petite entreprise française. Le client a envoyé ses propres photos. Pour chacune, tu dis ce qu'elle montre, si elle est assez bonne pour le site, et à quel service elle correspond, afin que chaque photo soit placée au bon endroit.

Rôles possibles (un seul par photo) :
- lieu : vue d'ensemble de la boutique, de la salle, de l'atelier, de la façade, de la vitrine, du cadre
- geste : quelqu'un au travail, des mains, le savoir-faire en action
- produit : un produit, un plat, une création, une réalisation, un chantier terminé, un avant/après
- ambiance : des clients, l'atmosphère, un moment de vie dans le lieu
- detail : une matière, un outil, un élément de décor, en gros plan
- equipe : portrait posé du gérant ou de l'équipe
- logo : le logo ou un visuel graphique de la marque
- document : capture d'écran, flyer, affiche, carte de visite, menu ou tarif photographié, texte, montage, mème

Qualité : « bonne » (nette, bien exposée, bien cadrée), « moyenne » (un peu floue, sombre ou petite : passable en petit), « faible » (floue, très sombre, de travers, très petite).
« utilisable » est faux pour : logo, document, qualité faible, photo sans rapport avec l'activité, image visiblement prise sur Internet (filigrane, banque d'images, autre marque). Dans ce cas, « raison » dit pourquoi en quelques mots simples (ex. « Photo floue », « Capture d'écran avec du texte »). Sinon « raison » est vide, sauf qualité moyenne (dis ce qui ne va pas).
« sujet » : ce que montre la photo, en français, 4 à 10 mots, sans « photo de » (il sert de texte alternatif pour les personnes malvoyantes). N'invente pas de nom de personne.
« service » : le nom EXACT d'un service de la liste quand la photo l'illustre clairement, sinon une chaîne vide.
« style » : en anglais, 25 mots au plus, l'allure réelle de l'entreprise visible sur les photos utilisables (décor, couleurs, matériaux, lumière, type de produits), pour que des images d'illustration créées ensuite leur ressemblent. Chaîne vide si les photos ne montrent pas assez le lieu ou les produits.
Réponds uniquement en JSON.`;

function textOf(msg) {
  return (msg.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

export class AnalyseError extends Error {
  constructor(message, code, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Envoie les photos à Claude et renvoie { infos: { id: {...} }, style }
export async function analyserPhotos(rec, { force = false } = {}) {
  const cfg = config();
  if (!cfg.apiKey) throw new AnalyseError('La clé Claude n’est pas configurée (ANTHROPIC_API_KEY) : les photos sont placées dans l’ordre du client.', 'no_key', 503);
  const photos = (rec.brief?.photos || []).filter((p) => p?.id).slice(0, 10);
  const deja = rec.imageInfo || {};
  const aFaire = photos.filter((p) => force || !deja[p.id]?.analyse);
  if (!aFaire.length) return { infos: {}, style: rec.photoStyle || '', analysees: 0 };

  const b = rec.brief || {};
  const services = [...new Set([...(rec.result?.content?.services || []).map((s) => s?.name), ...String(b.services || '').split('\n')].map((s) => String(s || '').trim()).filter(Boolean))].slice(0, 16);
  const contexte = [
    `Entreprise : ${b.businessName || rec.name || ''}`,
    b.sector ? `Secteur : ${b.sector}` : '',
    b.city ? `Ville : ${b.city}` : '',
    b.description ? `Activité : ${String(b.description).slice(0, 700)}` : '',
    services.length ? `Services (noms exacts) :\n${services.map((s) => '- ' + s).join('\n')}` : 'Services : aucun listé',
  ]
    .filter(Boolean)
    .join('\n');

  const content = [{ type: 'text', text: `${contexte}\n\nVoici ${aFaire.length} photo${aFaire.length > 1 ? 's' : ''} du client, numérotées.` }];
  const lues = [];
  for (const p of aFaire) {
    const o = await octets(rec.id, p.id);
    if (!o) continue;
    lues.push({ p, dim: dimensions(o.buffer) });
    const type = ['image/jpeg', 'image/png', 'image/webp'].includes(o.type) ? o.type : 'image/jpeg';
    content.push({ type: 'text', text: `Photo ${lues.length}${p.alt ? ` (légende du client : ${String(p.alt).slice(0, 120)})` : ''}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: type, data: o.buffer.toString('base64') } });
  }
  if (!lues.length) return { infos: {}, style: rec.photoStyle || '', analysees: 0 };
  content.push({ type: 'text', text: `Donne une entrée par photo (n de 1 à ${lues.length}), puis le style.` });

  const client = new Anthropic({
    apiKey: cfg.apiKey,
    maxRetries: 2,
    timeout: 110_000,
    ...(cfg.workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': cfg.workspaceId } } : {}),
  });
  const base = { model: cfg.model, max_tokens: 3000, system: SYSTEM, messages: [{ role: 'user', content }] };
  let msg;
  try {
    try {
      msg = await client.messages.create({ ...base, output_config: { format: { type: 'json_schema', schema: SCHEMA } } });
    } catch (e) {
      if (e?.status === 400 && /output_config|json_schema|schema|format/i.test(String(e?.message))) msg = await client.messages.create(base);
      else throw e;
    }
  } catch (e) {
    const status = e?.status;
    const message = String(e?.message || '');
    console.error('[photos]', status || '-', message.slice(0, 300));
    if (status === 401 || status === 403) throw new AnalyseError('La clé Claude a été refusée par Anthropic.', 'auth');
    if (status === 400 && /credit|balance|billing/i.test(message)) throw new AnalyseError('Le crédit API Claude est épuisé.', 'credit', 402);
    if (status === 429 || status === 529 || status === 503) throw new AnalyseError('Claude est momentanément surchargé : réessaie dans une minute.', 'overloaded', 503);
    throw new AnalyseError('L’analyse des photos a échoué.', 'failed');
  }
  let data;
  try {
    data = parseJsonLoose(textOf(msg));
  } catch {
    throw new AnalyseError('La réponse de l’IA était illisible.', 'invalid_json');
  }
  const S = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const at = new Date().toISOString();
  const infos = {};
  for (const x of Array.isArray(data?.photos) ? data.photos : []) {
    const l = lues[Number(x?.n) - 1];
    if (!l || infos[l.p.id]) continue;
    const role = TOUS_ROLES.includes(x.role) ? x.role : '';
    const qualite = ['bonne', 'moyenne', 'faible'].includes(x.qualite) ? x.qualite : 'bonne';
    const service = services.find((s) => s.toLowerCase() === S(x.service, 120).toLowerCase()) || '';
    const utilisable = x.utilisable !== false && qualite !== 'faible' && !['logo', 'document'].includes(role);
    infos[l.p.id] = {
      role,
      sujet: S(x.sujet, 100),
      ...(service ? { service } : {}),
      qualite,
      utilisable,
      ...(S(x.raison, 120) && (!utilisable || qualite !== 'bonne') ? { raison: S(x.raison, 120) } : {}),
      ...(l.dim ? { w: l.dim.w, h: l.dim.h } : {}),
      analyse: true,
      at,
    };
  }
  return { infos, style: S(data?.style, 200), analysees: Object.keys(infos).length };
}

// Range le résultat de l'analyse dans le dossier (le choix de l'agence est gardé)
export function enregistrerAnalyse(r, { infos, style }) {
  const info = { ...(r.imageInfo || {}) };
  for (const [id, x] of Object.entries(infos)) info[id] = { ...x, ...(info[id]?.choix ? { choix: info[id].choix } : {}) };
  r.imageInfo = info;
  if (style) r.photoStyle = style;
  r.imageInfo = rangerInfos(r);
  return r;
}

export { IMAGE_ROLES };
