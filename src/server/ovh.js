// Zone DNS chez OVHcloud : Studio Site règle lui-même les entrées qui relient le domaine
// d'un client à son projet Vercel, après ton clic dans le dossier.
//
// Il ne touche qu'à :
//   - l'entrée A du domaine seul (et retire son AAAA, qui enverrait une partie des visiteurs ailleurs) ;
//   - toutes les entrées de « www » (un CNAME ne peut cohabiter avec aucune autre entrée) ;
//   - les TXT de vérification demandés par Vercel (seulement s'il en demande).
// Jamais MX, NS, SPF, DKIM, SRV, CAA ni les autres sous-domaines : les e-mails du client restent intacts.
//
// Variables Vercel (clé API créée sur la page createToken d'OVHcloud, document 14, §F) :
//   OVH_APPLICATION_KEY     clé d'application
//   OVH_APPLICATION_SECRET  secret d'application
//   OVH_CONSUMER_KEY        clé client (droits GET, POST, PUT, DELETE sur /domain/zone/*)
//   OVH_ENDPOINT            facultatif : adresse de l'API (par défaut https://eu.api.ovh.com/1.0)
import crypto from 'node:crypto';
import { StoreError } from './store.js';

const DEFAUT = 'https://eu.api.ovh.com/1.0';

export function ovhEnv() {
  return {
    appKey: (process.env.OVH_APPLICATION_KEY || '').trim(),
    secret: (process.env.OVH_APPLICATION_SECRET || '').trim(),
    consumer: (process.env.OVH_CONSUMER_KEY || '').trim(),
    endpoint: (process.env.OVH_ENDPOINT || DEFAUT).trim().replace(/\/+$/, ''),
  };
}

// État affiché dans Réglages et dans le dossier (jamais les clés elles-mêmes)
export function ovhStatus() {
  const e = ovhEnv();
  const missing = [];
  if (!e.appKey) missing.push('OVH_APPLICATION_KEY');
  if (!e.secret) missing.push('OVH_APPLICATION_SECRET');
  if (!e.consumer) missing.push('OVH_CONSUMER_KEY');
  return { configured: missing.length === 0, missing };
}

// ---------- Appels signés ----------
// Signature OVHcloud : "$1$" + SHA1_HEX(secret + "+" + clé client + "+" + méthode + "+" + URL complète + "+" + corps + "+" + horodatage)
export function signature({ secret, consumer, method, url, body, timestamp }) {
  return '$1$' + crypto.createHash('sha1').update([secret, consumer, method, url, body, timestamp].join('+')).digest('hex');
}

let decalage = null;
async function horodatage(endpoint) {
  // L'heure du serveur OVHcloud fait foi : une horloge décalée ferait refuser la signature
  if (decalage === null) {
    try {
      const r = await fetch(endpoint + '/auth/time', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      const t = Number((await r.text()).trim());
      decalage = Number.isFinite(t) && t > 0 ? t - Math.floor(Date.now() / 1000) : 0;
    } catch {
      decalage = 0;
    }
  }
  return Math.floor(Date.now() / 1000) + decalage;
}

async function ovh(method, path, body) {
  const e = ovhEnv();
  const url = e.endpoint + path;
  const texte = body === undefined ? '' : JSON.stringify(body);
  const timestamp = await horodatage(e.endpoint);
  let r;
  try {
    r = await fetch(url, {
      method,
      headers: {
        'X-Ovh-Application': e.appKey,
        'X-Ovh-Consumer': e.consumer,
        'X-Ovh-Timestamp': String(timestamp),
        'X-Ovh-Signature': signature({ secret: e.secret, consumer: e.consumer, method, url, body: texte, timestamp }),
        ...(texte ? { 'Content-Type': 'application/json' } : {}),
      },
      body: texte || undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new StoreError('OVHcloud ne répond pas. Réessaie dans un instant.', 'ovh_down', 502);
  }
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  return { ok: r.ok, status: r.status, data };
}

function ovhFail(res, quoi, zone) {
  const msg = String(res.data?.message || '');
  if (/invalid (application|consumer|signature|key)|expired|credential/i.test(msg) || res.status === 401)
    return new StoreError('La clé OVHcloud est refusée (expirée, révoquée ou mal recopiée) : recrée-la (document 14, §F), remplace les variables OVH_… dans Vercel, puis redéploie.', 'ovh_auth', 502);
  if (res.status === 403 && /not been granted|not granted|forbidden/i.test(msg))
    return new StoreError(`Ta clé OVHcloud n’a pas le droit de faire : ${quoi}. Recrée-la avec GET, POST, PUT et DELETE sur /domain/zone/* (document 14, §F).`, 'ovh_forbidden', 502);
  if (res.status === 404 && zone)
    return new StoreError(`La zone DNS ${zone} n’est pas dans ton compte OVHcloud : vérifie que le client t’a nommé contact technique de sa zone DNS (document 14, §C), et que le domaine est bien chez OVHcloud.`, 'ovh_zone', 404);
  return new StoreError(`OVHcloud a refusé l’opération (${quoi}, erreur ${res.status}${msg ? ' : ' + msg.slice(0, 160) : ''}).`, 'ovh_failed', 502);
}

// Exécute des tâches avec au plus `n` en parallèle
async function parLots(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    })
  );
  return out;
}

// ---------- Lecture de la zone ----------
export async function lireZone(zone) {
  const z = encodeURIComponent(zone);
  const info = await ovh('GET', `/domain/zone/${z}`);
  if (!info.ok) throw ovhFail(info, 'lecture de la zone DNS', zone);
  const ids = await ovh('GET', `/domain/zone/${z}/record`);
  if (!ids.ok) throw ovhFail(ids, 'lecture des entrées DNS', zone);
  const liste = Array.isArray(ids.data) ? ids.data : [];
  if (liste.length > 400) throw new StoreError(`La zone ${zone} contient ${liste.length} entrées : trop pour un réglage automatique. Fais-le à la main (document 14, §D).`, 'ovh_big', 409);
  const records = await parLots(liste, 6, async (id) => {
    const res = await ovh('GET', `/domain/zone/${z}/record/${id}`);
    if (!res.ok) throw ovhFail(res, 'lecture d’une entrée DNS', zone);
    const r = res.data || {};
    return { id: r.id ?? id, fieldType: String(r.fieldType || ''), subDomain: String(r.subDomain || ''), target: String(r.target || ''), ttl: r.ttl ?? 0 };
  });
  return records;
}

// ---------- Ce qu'il faut changer (aucun appel réseau) ----------
const bas = (s) => String(s || '').trim().toLowerCase();
const point = (s) => (String(s || '').trim().endsWith('.') ? String(s).trim() : String(s || '').trim() + '.');
const sansGuillemets = (s) => String(s || '').trim().replace(/^"|"$/g, '');

// records : entrées actuelles de la zone ; voulu : { ip, cname, txt: [{ nom, valeur }] }
// Renvoie la liste ordonnée des actions : suppressions, puis modifications, puis ajouts
// (OVHcloud refuse un CNAME tant qu'une autre entrée occupe « www »).
export function planDns(records, { ip, cname, txt = [] }) {
  const sup = [];
  const mod = [];
  const add = [];
  const cible = point(cname);
  const decrire = (r) => ({ id: r.id, type: r.fieldType, sousDomaine: r.subDomain, avant: r.target });

  // Domaine seul : une seule entrée A, vers Vercel
  const apexA = records.filter((r) => r.subDomain === '' && r.fieldType === 'A');
  const gardeA = apexA.find((r) => r.target === ip) || apexA[0];
  if (!gardeA) add.push({ op: 'ajouter', type: 'A', sousDomaine: '', apres: ip });
  else if (gardeA.target !== ip) mod.push({ op: 'modifier', ...decrire(gardeA), apres: ip });
  for (const r of apexA) if (r !== gardeA) sup.push({ op: 'supprimer', ...decrire(r) });
  // Domaine seul : plus d'IPv6 (l'ancienne adresse de l'hébergement OVHcloud)
  for (const r of records) if (r.subDomain === '' && r.fieldType === 'AAAA') sup.push({ op: 'supprimer', ...decrire(r) });

  // www : un seul CNAME, vers Vercel, et rien d'autre
  const www = records.filter((r) => bas(r.subDomain) === 'www');
  const cnames = www.filter((r) => r.fieldType === 'CNAME');
  const gardeC = cnames.find((r) => bas(point(r.target)) === bas(cible)) || cnames[0];
  for (const r of www) if (r !== gardeC) sup.push({ op: 'supprimer', ...decrire(r) });
  if (!gardeC) add.push({ op: 'ajouter', type: 'CNAME', sousDomaine: 'www', apres: cible });
  else if (bas(point(gardeC.target)) !== bas(cible)) mod.push({ op: 'modifier', ...decrire(gardeC), apres: cible });

  // Vérifications TXT demandées par Vercel (rare : domaine déjà utilisé ailleurs sur Vercel)
  for (const t of txt) {
    const nom = String(t.nom || '');
    if (!nom || bas(nom) === 'www') continue;
    const deja = records.some((r) => r.fieldType === 'TXT' && bas(r.subDomain) === bas(nom) && sansGuillemets(r.target) === String(t.valeur));
    if (!deja) add.push({ op: 'ajouter', type: 'TXT', sousDomaine: nom, apres: String(t.valeur) });
  }
  return [...sup, ...mod, ...add];
}

// ---------- Application ----------
export async function appliquerDns(zone, actions) {
  const z = encodeURIComponent(zone);
  for (const a of actions) {
    let res;
    if (a.op === 'supprimer') res = await ovh('DELETE', `/domain/zone/${z}/record/${a.id}`);
    else if (a.op === 'modifier') res = await ovh('PUT', `/domain/zone/${z}/record/${a.id}`, { subDomain: a.sousDomaine, target: a.apres, ttl: 0 });
    else res = await ovh('POST', `/domain/zone/${z}/record`, { fieldType: a.type, subDomain: a.sousDomaine, target: a.apres, ttl: 0 });
    // Déjà supprimée entre-temps : rien à faire
    if (!res.ok && !(a.op === 'supprimer' && res.status === 404)) throw ovhFail(res, `${a.op} l’entrée ${a.type} ${a.sousDomaine || '(domaine seul)'}`, zone);
  }
  // Publie la zone modifiée sur les serveurs DNS d'OVHcloud
  const refresh = await ovh('POST', `/domain/zone/${z}/refresh`);
  if (!refresh.ok) throw ovhFail(refresh, 'publication de la zone', zone);
}

// Texte lisible d'une action, pour l'écran et l'historique
export function libelle(a) {
  const ou = a.sousDomaine ? a.sousDomaine : 'domaine seul';
  if (a.op === 'supprimer') return `Supprimer ${a.type} (${ou}) : ${a.avant}`;
  if (a.op === 'modifier') return `Modifier ${a.type} (${ou}) : ${a.avant} → ${a.apres}`;
  return `Ajouter ${a.type} (${ou}) → ${a.apres}`;
}
