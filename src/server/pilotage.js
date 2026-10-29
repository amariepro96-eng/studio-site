// Onglet Contrôle (ex-Pilotage) : état réel de chaque site client, vérifié à la demande (toutes les 30 s quand la page
// est ouverte) : réponse du site, cadenas HTTPS, dernière mise en ligne Vercel, domaine, demandes
// de l'espace client, rangement Google Drive. Chaque problème est expliqué en clair (bulle).
//
// Ce qui est déjà constaté (début de chaque problème, journal) est gardé dans pilotage.json.
import dns from 'node:dns/promises';
import net from 'node:net';
import { listClients, getSettings, getPilotage, updatePilotage } from './store.js';
import { publishEnv, vc, equipe } from './publish.js';
import { espaceDe } from './espace.js';
import { GESTIONS, peutModifier } from '../engine/espace.js';
import { stageOf, nextAction } from '../engine/records.js';
import { resumeFinances, aujourdhuiParis, etatClient } from '../engine/finances.js';

export const INTERVALLE_S = 30;
const LENT_MS = 4000;
const NIVEAUX = ['panne', 'travaux', 'attention', 'action'];
const RANG = { panne: 0, attention: 1, action: 2, travaux: 3, ok: 4, prepa: 5 };

// ---------- Petits outils ----------
const memo = new Map();
async function enCache(cle, ttl, fn) {
  const m = memo.get(cle);
  if (m && ttl > 0 && Date.now() - m.at < ttl) return m.val;
  const val = await fn();
  memo.set(cle, { at: Date.now(), val });
  if (memo.size > 2000) memo.clear();
  return val;
}

function avecDelai(promesse, ms, valeur) {
  let t;
  return Promise.race([promesse.finally(() => clearTimeout(t)), new Promise((r) => (t = setTimeout(() => r(valeur), ms)))]);
}

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

const minutes = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : 0);
const duree = (min) => (min < 1 ? 'moins d’une minute' : min < 60 ? `${min} min` : min < 48 * 60 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} jours`);
const quand = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');
const sansProto = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

// ---------- Vérification d'une adresse (jamais vers le réseau interne) ----------
// Adresses internes, réservées ou de réseau privé (y compris leurs formes IPv6 « mappées »)
const INTERNES = new net.BlockList();
for (const [a, p] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3]]) INTERNES.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 96], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]]) INTERNES.addSubnet(a, p, 'ipv6');
function ipPrivee(ip) {
  const type = net.isIPv4(ip) ? 'ipv4' : net.isIPv6(ip) ? 'ipv6' : '';
  if (!type) return true;
  try {
    return INTERNES.check(ip, type);
  } catch {
    return true;
  }
}
const localAutorise = () => !process.env.VERCEL && process.env.PILOTAGE_AUTORISER_LOCAL === '1';

async function hotePublic(hote) {
  const h = hote.replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return localAutorise() ? { ok: true } : { ok: false, code: 'interdit' };
  if (net.isIP(h)) return ipPrivee(h) && !localAutorise() ? { ok: false, code: 'interdit' } : { ok: true };
  try {
    const adresses = await dns.lookup(h, { all: true, verbatim: true });
    if (!adresses.length) return { ok: false, code: 'dns' };
    if (!localAutorise() && adresses.some((a) => ipPrivee(a.address))) return { ok: false, code: 'interdit' };
    return { ok: true };
  } catch (e) {
    return { ok: false, code: ['ENOTFOUND', 'ENODATA', 'ESERVFAIL', 'EAI_AGAIN'].includes(e?.code) ? 'dns' : 'reseau', detail: e?.code || '' };
  }
}

function codeErreur(e) {
  const c = String(e?.cause?.code || e?.code || '');
  const nom = String(e?.name || '');
  if (nom === 'TimeoutError' || nom === 'AbortError' || /TIMEOUT/.test(c)) return { code: 'delai', detail: 'pas de réponse en 9 s' };
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/.test(c)) return { code: 'certificat', detail: c };
  if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return { code: 'dns', detail: c };
  if (c === 'ECONNREFUSED') return { code: 'refus', detail: 'connexion refusée' };
  if (c === 'ECONNRESET' || c === 'UND_ERR_SOCKET') return { code: 'coupure', detail: 'connexion coupée' };
  return { code: 'reseau', detail: c || String(e?.message || '').slice(0, 80) };
}

export async function sonder(adresse) {
  const t0 = Date.now();
  let url;
  try {
    url = new URL(adresse);
  } catch {
    return { ok: false, code: 'adresse', ms: 0 };
  }
  for (let saut = 0; saut < 5; saut++) {
    if (!['https:', 'http:'].includes(url.protocol)) return { ok: false, code: 'adresse', ms: 0 };
    const sur = await hotePublic(url.hostname);
    if (!sur.ok) return { ok: false, code: sur.code, detail: sur.detail || '', ms: Date.now() - t0, url: url.href };
    let r;
    try {
      r = await fetch(url, { method: 'GET', redirect: 'manual', cache: 'no-store', headers: { 'User-Agent': 'StudioSite-Pilotage/1.0', Accept: 'text/html' }, signal: AbortSignal.timeout(9000) });
    } catch (e) {
      return { ok: false, ...codeErreur(e), ms: Date.now() - t0, url: url.href };
    }
    try {
      await r.body?.cancel();
    } catch {}
    const loc = r.headers.get('location');
    if ([301, 302, 303, 307, 308].includes(r.status) && loc) {
      url = new URL(loc, url);
      continue;
    }
    return { ok: r.status < 400, http: r.status, ms: Date.now() - t0, url: url.href };
  }
  return { ok: false, code: 'redirections', ms: Date.now() - t0 };
}

const sonde = (adresse, force) => enCache('http:' + adresse, force ? 0 : 25_000, () => sonder(adresse));

// ---------- Vercel ----------
async function lireVercel(chemin, teamId) {
  try {
    return await avecDelai(vc(chemin, { teamId }), 8000, { status: 0, ok: false, data: null, delai: true });
  } catch {
    return { status: 0, ok: false, data: null };
  }
}

function etatVercel(pub, teamId, force) {
  return enCache('vc:' + pub.projectId, force ? 0 : 45_000, async () => {
    const res = await lireVercel(`/v6/deployments?projectId=${encodeURIComponent(pub.projectId)}&target=production&limit=5`, teamId);
    if (res.status === 404) return { introuvable: true };
    if (res.status === 401 || res.status === 403) return { refuse: true };
    if (!res.ok) return { indisponible: true };
    const list = res.data?.deployments || [];
    const d = list[0];
    if (!d) return { aucun: true };
    const etat = d.readyState || d.state || '';
    const out = { etat, le: new Date(d.createdAt || d.created || Date.now()).toISOString(), inspectorUrl: d.inspectorUrl || '', message: '' };
    if (['ERROR', 'CANCELED', 'BLOCKED'].includes(etat)) {
      const det = await lireVercel(`/v13/deployments/${encodeURIComponent(d.uid)}`, teamId);
      out.message = String(det.data?.errorMessage || det.data?.errorCode || '').slice(0, 300);
      out.bloque = etat === 'BLOCKED' || Boolean(det.data?.seatBlock?.blockCode);
    }
    return out;
  });
}

function etatDomaine(pub, teamId, force) {
  return enCache(`dom:${pub.projectId}:${pub.domain}`, force ? 0 : 300_000, async () => {
    const [cfg, dom] = await Promise.all([
      lireVercel(`/v6/domains/${encodeURIComponent(pub.domain)}/config?projectIdOrName=${encodeURIComponent(pub.projectId)}`, teamId),
      lireVercel(`/v9/projects/${encodeURIComponent(pub.projectId)}/domains/${encodeURIComponent(pub.domain)}`, teamId),
    ]);
    return {
      malRegle: cfg.ok ? cfg.data?.misconfigured === true : null,
      nonVerifie: dom.ok ? dom.data?.verified === false : null,
      absent: dom.status === 404,
    };
  });
}

// ---------- Les explications ----------
const VERCEL_STATUS = { label: 'Voir l’état de Vercel', href: 'https://www.vercel-status.com', externe: true };
const REVERIFIER = { label: 'Revérifier maintenant', verifier: true };

function dossier(id, ancre = '') {
  return { label: 'Ouvrir le dossier', href: `/agence/clients/${id}${ancre}` };
}

function problemeAcces(f, s, { domaine, provisoireOk }) {
  const hote = sansProto(s.url || f.url);
  const ailleurs = provisoireOk ? `Le site lui-même fonctionne (adresse provisoire ${sansProto(f.urlProvisoire)}) : seul le nom de domaine pose problème.` : '';
  const tech = [
    { label: 'Adresse vérifiée', valeur: s.url || f.url },
    ...(s.http ? [{ label: 'Réponse', valeur: `code ${s.http}` }] : []),
    ...(s.detail ? [{ label: 'Détail', valeur: s.detail }] : []),
    { label: 'Temps', valeur: `${(s.ms / 1000).toFixed(1).replace('.', ',')} s` },
  ];
  const base = { niveau: 'panne', tech, actions: [REVERIFIER, dossier(f.id)] };
  if (s.code === 'dns')
    return {
      ...base,
      id: 'dns',
      titre: 'Le nom de domaine ne mène nulle part',
      resume: `${hote} n’est plus trouvé sur internet.`,
      quoi: 'Quand on tape l’adresse du site, internet ne sait pas où aller : le nom de domaine ne pointe vers aucun serveur.',
      pourquoi: [
        'Le domaine a expiré : le renouvellement n’a pas été payé sur le compte OVHcloud du client (cause la plus fréquente).',
        'Les réglages DNS du domaine ont été supprimés ou modifiés chez OVHcloud.',
        'Le domaine vient d’être acheté : sa mise en service peut prendre quelques heures.',
      ],
      consequence: ailleurs || 'Personne ne peut ouvrir le site : les visiteurs voient « Ce site est inaccessible ».',
      etapes: [
        'Demande au client d’ouvrir son compte OVHcloud › Web Cloud › Noms de domaine, et de vérifier la date d’expiration.',
        'S’il a expiré : renouvellement immédiat. Après expiration, le délai pour récupérer le domaine est court (document 14).',
        'Sinon : dossier › Mise en ligne › « Vérifier », pour comparer les réglages DNS à ceux attendus.',
      ],
      dns: domaine?.dns || null,
    };
  if (s.code === 'certificat')
    return {
      ...base,
      id: 'certificat',
      titre: 'Le cadenas HTTPS est en erreur',
      resume: 'Le navigateur affiche « Connexion non sécurisée ».',
      quoi: 'Le certificat de sécurité du site est absent, expiré, ou ne correspond pas au nom de domaine.',
      pourquoi: [
        'Le domaine vient d’être relié : Vercel crée le certificat tout seul, en général en quelques minutes, dès que les réglages DNS sont corrects.',
        'Les réglages DNS envoient vers un autre serveur que Vercel (ancien hébergeur, page OVHcloud).',
        'Une entrée « CAA » dans la zone DNS chez OVHcloud empêche Vercel de créer le certificat.',
      ],
      consequence: 'Les navigateurs bloquent le site derrière un avertissement rouge : la plupart des visiteurs repartent.',
      etapes: [
        'Domaine relié il y a moins d’une heure : patiente, puis revérifie.',
        'Sinon : dossier › Mise en ligne › « Vérifier ». Les entrées A et www doivent être vertes.',
        'Dans Vercel › projet du site › Settings › Domains, lis le message affiché à côté du domaine.',
      ],
      dns: domaine?.dns || null,
    };
  if (s.http >= 500)
    return {
      ...base,
      id: 'http5xx',
      titre: 'Le site renvoie une erreur serveur',
      resume: `Erreur ${s.http} à l’ouverture de la page d’accueil.`,
      quoi: 'Le serveur répond, mais il signale une panne au lieu d’afficher le site.',
      pourquoi: ['Incident en cours chez Vercel, l’hébergeur des sites.', 'Une version incomplète a été mise en ligne.'],
      consequence: 'Les visiteurs voient une page d’erreur.',
      etapes: ['Regarde l’état de Vercel : si un incident est signalé, il n’y a qu’à attendre.', 'Sinon, depuis le dossier › Mise en ligne, publie à nouveau la version.'],
      actions: [REVERIFIER, VERCEL_STATUS, dossier(f.id)],
    };
  if (s.http === 401 || s.http === 403)
    return {
      ...base,
      id: 'protege',
      titre: 'Le site est fermé aux visiteurs',
      resume: `Les visiteurs reçoivent une erreur ${s.http} (accès refusé).`,
      quoi: 'Le site demande une connexion avant de s’afficher : ni ton client ni ses visiteurs ne peuvent l’ouvrir.',
      pourquoi: ['La protection « Vercel Authentication » (Deployment Protection) est active sur la version en ligne du projet.', 'Une règle du pare-feu Vercel bloque les visiteurs.'],
      consequence: 'Le site est invisible pour tout le monde, sauf toi quand tu es connecté à Vercel.',
      etapes: ['Vercel › projet du site › Settings › Deployment Protection.', 'Règle « Vercel Authentication » sur « Only Preview Deployments » (ou désactive-la), puis Save.', 'Reviens ici et touche « Revérifier maintenant ».'],
      actions: [REVERIFIER, ...(f.projetVercel ? [{ label: 'Ouvrir Vercel', href: 'https://vercel.com/dashboard', externe: true }] : []), dossier(f.id)],
    };
  if (s.http === 404)
    return {
      ...base,
      id: 'http404',
      titre: 'La page d’accueil est introuvable',
      resume: 'Le site répond « page introuvable » (erreur 404).',
      quoi: 'Le serveur répond, mais il n’a pas de page d’accueil pour ce site.',
      pourquoi: ['La dernière version déposée ne contient pas la page d’accueil.', 'Le domaine est relié à un autre projet Vercel que celui du site.', 'Le projet Vercel du site a été supprimé ou renommé.'],
      consequence: 'Les visiteurs voient « 404 : page introuvable ».',
      etapes: ['Depuis le dossier › Mise en ligne, publie une nouvelle version.', 'Dans Vercel › projet du site › Settings › Domains, vérifie que le domaine est bien relié à ce projet.'],
    };
  if (s.http)
    return {
      ...base,
      id: 'http',
      titre: `Le site répond avec une erreur ${s.http}`,
      resume: `Erreur ${s.http} à l’ouverture de la page d’accueil.`,
      quoi: 'Le site ne s’affiche pas normalement.',
      pourquoi: ['Réglage inhabituel du projet Vercel ou du domaine.'],
      consequence: 'Les visiteurs voient une page d’erreur.',
      etapes: ['Ouvre l’adresse du site dans ton navigateur pour voir ce qu’il affiche.', 'Depuis le dossier › Mise en ligne, publie à nouveau la version.'],
    };
  if (s.code === 'interdit' || s.code === 'adresse' || s.code === 'redirections')
    return {
      ...base,
      niveau: 'attention',
      id: 'adresse',
      titre: 'Adresse du site impossible à vérifier',
      resume: s.code === 'redirections' ? 'Le site renvoie vers lui-même en boucle.' : 'L’adresse enregistrée dans le dossier n’est pas une adresse publique.',
      quoi: s.code === 'redirections' ? 'La page d’accueil redirige sans fin vers une autre adresse : les navigateurs abandonnent.' : 'Studio Site ne vérifie que des adresses publiques (https://…).',
      pourquoi: s.code === 'redirections' ? ['Redirection mal réglée dans Vercel › Settings › Domains (le domaine et www renvoient l’un vers l’autre).'] : ['Adresse mal saisie dans le dossier.'],
      consequence: s.code === 'redirections' ? 'Les visiteurs voient « Trop de redirections ».' : 'Studio Site ne peut pas surveiller ce site.',
      etapes: s.code === 'redirections' ? ['Dans Vercel › projet du site › Settings › Domains : le domaine principal ne doit pas rediriger, seul www redirige vers lui.'] : ['Corrige l’adresse du site dans le dossier.'],
    };
  return {
    ...base,
    id: 'injoignable',
    titre: 'Le site ne répond pas',
    resume: `${hote} ne répond pas (${s.code === 'delai' ? 'aucune réponse en 9 secondes' : s.detail || 'connexion impossible'}).`,
    quoi: 'L’adresse existe, mais le serveur ne répond pas ou coupe la connexion.',
    pourquoi: ['Incident en cours chez Vercel : regarde son état.', 'Les réglages DNS envoient vers un autre serveur (ancien hébergeur).', 'Coupure réseau passagère.'],
    consequence: ailleurs || 'Les visiteurs voient une page d’erreur ou une page blanche.',
    etapes: ['Revérifie dans 2 minutes : si tout revient, c’était passager.', 'Si ça dure, regarde l’état de Vercel.', 'Puis dossier › Mise en ligne › « Vérifier », pour contrôler le domaine.'],
    actions: [REVERIFIER, VERCEL_STATUS, dossier(f.id)],
    dns: domaine?.dns || null,
  };
}

const RAISONS_AGENCE = {
  publish_off: 'La mise en ligne automatique est coupée dans Réglages : réactive-la.',
  not_ready: 'Ce site est mis en ligne à la main : publie la nouvelle version depuis le dossier.',
  github_changed: 'Le dépôt GitHub a été modifié à la main : confirme le remplacement depuis le dossier.',
  legal_missing: 'Les mentions légales doivent être complétées avant la prochaine mise en ligne.',
};

// ---------- Un site ----------
async function ficheSite(rec, { jour, teamId, vercelBranche, force }) {
  const pub = rec.publication || null;
  const e = rec.espace?.creeLe ? espaceDe(rec) : null;
  const stage = stageOf(rec.status);
  const demandes = e ? e.demandes.filter((d) => ['envoyee', 'acceptee'].includes(d.statut)) : [];
  const fin = etatClient(rec.facturation, jour);
  const urlProvisoire = pub?.url || '';
  const url = pub?.domain ? `https://${pub.domain}` : urlProvisoire || rec.liveUrl || '';
  const f = {
    id: rec.id,
    nom: rec.brief?.businessName || rec.name || 'Client sans nom',
    formule: rec.formula || '',
    contact: rec.contact || '',
    url,
    urlProvisoire,
    domaine: pub?.domain || '',
    version: pub?.version || 0,
    publieLe: pub?.publishedAt || rec.liveAt || null,
    projetVercel: Boolean(pub?.projectId),
    inspectorUrl: pub?.inspectorUrl || '',
    etape: stage.label,
    prochaine: nextAction(rec),
    tour: rec.status === 'live' ? null : stage.waiting,
    espace: e
      ? { gestion: e.gestion, gestionLabel: GESTIONS[e.gestion]?.titre || '', peutModifier: peutModifier(e.gestion, 'agence'), validation: Boolean(e.validation), demandes: demandes.length, aPublier: Boolean(e.aPublier) }
      : null,
    finances: { mensuel: fin.mensuel, retard: fin.retard.total, attente: fin.attente.total },
    problemes: [],
    mesure: null,
  };
  const enLigne = Boolean(url) && (rec.status === 'live' || Boolean(pub?.url));
  if (!enLigne) return { ...f, etat: 'prepa' };

  const problemes = [];
  // Vercel : dernière mise en ligne et domaine (si le site est publié par Studio Site)
  const [dep, dom] = vercelBranche && pub?.projectId ? await Promise.all([etatVercel(pub, teamId, force), pub.domain ? etatDomaine(pub, teamId, force) : null]) : [null, null];
  // Le site lui-même
  const s = await sonde(url, force);
  let provisoireOk = false;
  if (!s.ok && pub?.domain && urlProvisoire) provisoireOk = (await sonde(urlProvisoire, force)).ok;
  f.mesure = { ok: s.ok, http: s.http || 0, ms: s.ms || 0, code: s.code || '' };
  const domaine = pub?.domain ? { dns: Array.isArray(pub.dns) ? pub.dns.map((r) => ({ type: r.type, nom: r.nom || '@', valeur: r.valeur, ok: r.ok })) : null } : null;
  if (!s.ok) problemes.push(problemeAcces(f, s, { domaine, provisoireOk }));
  else if (s.ms > LENT_MS)
    problemes.push({
      id: 'lent',
      niveau: 'attention',
      titre: 'Le site répond lentement',
      resume: `${(s.ms / 1000).toFixed(1).replace('.', ',')} s pour ouvrir la page d’accueil (moins d’une seconde d’habitude).`,
      quoi: 'Le site s’affiche, mais il met longtemps à répondre.',
      pourquoi: ['Ralentissement passager chez Vercel ou sur le réseau.', 'Photos très lourdes sur la page d’accueil.'],
      consequence: 'Sur téléphone, une partie des visiteurs abandonne avant que la page s’affiche.',
      etapes: ['Revérifie dans quelques minutes : si ça ne dure pas, rien à faire.', 'Si ça dure : remplace les photos les plus lourdes depuis l’espace du client.'],
      tech: [{ label: 'Temps de réponse', valeur: `${s.ms} ms` }],
      actions: [REVERIFIER, VERCEL_STATUS],
    });

  if (dep?.introuvable)
    problemes.push({
      id: 'projet',
      niveau: 'panne',
      titre: 'Le projet Vercel du site n’existe plus',
      resume: 'Vercel ne trouve plus le projet qui héberge ce site.',
      quoi: 'Le projet Vercel enregistré dans le dossier a été supprimé ou déplacé dans une autre équipe.',
      pourquoi: ['Suppression ou transfert du projet dans Vercel.', 'Clé Vercel de Studio Site créée pour une autre équipe.'],
      consequence: s.ok ? 'Le site s’affiche encore, mais plus aucune mise à jour ne peut partir.' : 'Le site est hors ligne.',
      etapes: ['Dans Vercel, vérifie que le projet du site existe dans ton équipe Pro.', 'S’il a disparu : dossier › Mise en ligne, relance les étapes. Studio Site recrée le projet relié au dépôt GitHub.'],
      actions: [dossier(f.id), { label: 'Ouvrir Vercel', href: 'https://vercel.com/dashboard', externe: true }],
    });
  else if (dep && ['ERROR', 'CANCELED', 'BLOCKED'].includes(dep.etat))
    problemes.push({
      id: 'deploiement',
      niveau: s.ok ? 'attention' : 'panne',
      depuis: dep.le,
      titre: 'La dernière mise en ligne a échoué',
      resume: s.ok ? 'La version précédente reste en ligne : les derniers changements ne sont pas visibles.' : 'La nouvelle version n’a pas pu partir en ligne.',
      quoi: `Vercel n’a pas réussi à mettre en ligne la version déposée le ${quand(dep.le)}.`,
      pourquoi: dep.bloque
        ? ['Vercel exige que chaque version vienne d’un membre de ton équipe : ton compte GitHub doit être relié à ton compte Vercel (Account Settings › Authentication).']
        : ['Problème passager chez Vercel.', 'Fichier du site refusé par Vercel (le journal le précise).'],
      consequence: s.ok ? 'Les changements de la dernière publication (toi ou le client) ne sont pas encore visibles.' : 'Le site n’affiche pas la nouvelle version.',
      etapes: ['Ouvre le journal Vercel pour lire l’erreur exacte.', dep.bloque ? 'Relie ton compte GitHub à ton compte Vercel, puis publie à nouveau depuis le dossier.' : 'Depuis le dossier › Mise en ligne, publie à nouveau la version.'],
      tech: [{ label: 'État Vercel', valeur: dep.etat }, ...(dep.message ? [{ label: 'Message de Vercel', valeur: dep.message }] : [])],
      actions: [...(dep.inspectorUrl ? [{ label: 'Ouvrir le journal Vercel', href: dep.inspectorUrl, externe: true }] : []), dossier(f.id)],
    });
  else if (dep && ['QUEUED', 'BUILDING', 'INITIALIZING'].includes(dep.etat)) {
    const min = minutes(dep.le);
    problemes.push(
      min > 15
        ? {
            id: 'deploiement-long',
            niveau: 'attention',
            titre: 'La mise en ligne est bloquée',
            resume: `Une nouvelle version attend depuis ${duree(min)}.`,
            quoi: 'Vercel a reçu la nouvelle version mais ne la met pas en ligne. En temps normal, ça prend environ une minute.',
            pourquoi: ['File d’attente chargée chez Vercel.', 'Mise en ligne coincée : il faut l’annuler et recommencer.'],
            consequence: 'La version précédente reste en ligne.',
            etapes: ['Ouvre le journal Vercel : s’il ne bouge plus, annule (Cancel Deployment).', 'Publie à nouveau depuis le dossier.'],
            tech: [{ label: 'État Vercel', valeur: dep.etat }],
            actions: [...(dep.inspectorUrl ? [{ label: 'Ouvrir le journal Vercel', href: dep.inspectorUrl, externe: true }] : []), dossier(f.id), VERCEL_STATUS],
          }
        : { id: 'deploiement-en-cours', niveau: 'travaux', titre: 'Mise en ligne en cours', resume: `Nouvelle version en route (depuis ${duree(min)}). Elle sera visible dans une minute environ.`, quoi: '', pourquoi: [], etapes: [], actions: [] }
    );
  }

  if (dom && !dom.absent && (dom.malRegle || dom.nonVerifie)) {
    const dejaPanne = problemes.some((p) => p.niveau === 'panne' && ['dns', 'injoignable', 'certificat'].includes(p.id));
    if (dejaPanne) {
      const p = problemes.find((x) => ['dns', 'injoignable', 'certificat'].includes(x.id));
      p.pourquoi = ['Vercel confirme que les réglages DNS du domaine ne pointent pas vers lui.', ...p.pourquoi];
    } else
      problemes.push({
        id: 'domaine',
        niveau: 'attention',
        escalade: { apresH: 24, niveau: 'panne', titre: 'Le domaine n’affiche pas le site' },
        titre: 'Le domaine n’est pas encore relié au site',
        resume: dom.nonVerifie && !dom.malRegle ? 'Vercel attend une preuve que le domaine est bien au client (entrée TXT).' : `${f.domaine} n’envoie pas encore les visiteurs vers Vercel.`,
        quoi: dom.nonVerifie && !dom.malRegle ? 'Ce domaine a déjà servi sur Vercel ailleurs : Vercel demande d’ajouter une entrée TXT pour prouver qu’il appartient au client.' : 'Les réglages DNS du domaine chez OVHcloud ne correspondent pas à ceux que Vercel attend. Une page qui répond peut être celle d’OVHcloud ou de l’ancien hébergeur.',
        pourquoi: ['Domaine relié il y a peu : les changements DNS mettent de quelques minutes à quelques heures à se propager.', 'Entrées A ou www absentes, ou encore réglées sur l’ancien hébergeur.'],
        consequence: 'Les visiteurs qui tapent le nom de domaine ne voient pas le site (ou voient une ancienne page).',
        etapes: [
          'Dossier › Mise en ligne › « Vérifier » : chaque entrée doit passer au vert.',
          'Clé OVHcloud branchée : « Régler la zone DNS » corrige tout, après ton clic.',
          'Sinon, saisis les entrées ci-dessous dans la zone DNS du domaine chez OVHcloud (document 14, §D).',
        ],
        dns: domaine?.dns || null,
        actions: [dossier(f.id), REVERIFIER],
      });
  }

  if (e?.aPublier)
    problemes.push({
      id: 'a-publier',
      niveau: 'action',
      depuis: e.aPublier.at || null,
      titre: 'Changements du client pas encore en ligne',
      resume: RAISONS_AGENCE[e.aPublier.raison] || 'Des changements enregistrés attendent la prochaine mise en ligne.',
      quoi: `Des changements faits ${e.aPublier.par === 'agence' ? 'par toi' : 'par le client'} dans l’espace du site sont enregistrés, mais pas encore visibles sur le site.`,
      pourquoi: [RAISONS_AGENCE[e.aPublier.raison] || 'Publication en attente.'],
      consequence: 'Le site affiche encore l’ancienne version (horaires, prix, annonces).',
      etapes: ['Ouvre le dossier et touche « Publier une nouvelle version ».'],
      actions: [dossier(f.id)],
    });
  if (demandes.length) {
    const plusAncienne = demandes.map((d) => d.envoyee || d.accepteeLe).filter(Boolean).sort()[0];
    const h = minutes(plusAncienne) / 60;
    problemes.push({
      id: 'demandes',
      niveau: 'action',
      depuis: plusAncienne || null,
      titre: demandes.length > 1 ? `${demandes.length} demandes du client` : 'Une demande du client',
      resume: demandes
        .slice(0, 2)
        .map((d) => `« ${String(d.titre || 'Demande').slice(0, 60)} »`)
        .join(', ') + (h > 48 ? ` · en attente depuis ${duree(minutes(plusAncienne))}` : ''),
      quoi: 'Le client a fait une demande depuis son espace (page en plus, changement de style, question).',
      pourquoi: [],
      consequence: h > 48 ? 'Ton message de livraison promet une réponse sous 48 h ouvrées.' : 'Le client attend ta réponse.',
      etapes: ['Ouvre l’espace du client (vue agence) › Demandes : accepte, envoie un devis ou réponds.'],
      actions: [...(e ? [{ label: 'Ouvrir l’espace du client', href: `/espace/${rec.id}?vue=agence` }] : []), dossier(f.id)],
    });
  }
  if (rec.drive?.erreur)
    problemes.push({
      id: 'drive',
      niveau: 'attention',
      depuis: rec.drive.erreur.at || null,
      titre: 'Rangement Google Drive en échec',
      resume: String(rec.drive.erreur.message || 'L’envoi vers Google Drive a échoué.').slice(0, 140),
      quoi: 'La fiche, les photos ou le .zip de ce client ne sont pas arrivés dans son dossier Google Drive.',
      pourquoi: ['Script Google « Automatisation dossiers clients » arrêté ou adresse changée.', 'Clé DRIVE_WEBHOOK_SECRET différente dans Vercel et dans le script.'],
      consequence: 'Le site n’est pas touché. Seul ton classement dans Drive est incomplet.',
      etapes: ['Dossier › bloc Google Drive › « Réessayer ».', 'Si ça échoue encore : document 11, §H.'],
      actions: [dossier(f.id)],
    });

  f.problemes = problemes.map((p) => ({ pourquoi: [], etapes: [], actions: [], tech: [], ...p }));
  return f;
}

// ---------- Tous les sites ----------
let dernier = null;
let enCours = null;

export function etatPilotage({ force = false } = {}) {
  if (!force && dernier && Date.now() - dernier.at < 20_000) return Promise.resolve(dernier.data);
  if (enCours) return enCours;
  enCours = calculer(force).finally(() => (enCours = null));
  return enCours;
}

async function calculer(force) {
  const [clients, settings, deja] = await Promise.all([listClients(), getSettings(), getPilotage()]);
  const jour = aujourdhuiParis();
  const env = publishEnv();
  const avecVercel = clients.some((c) => c.publication?.projectId);
  let alerte = null;
  let teamId = '';
  let vercelBranche = false;
  if (avecVercel && !env.vercelToken)
    alerte = { niveau: 'attention', titre: 'Statuts Vercel indisponibles', texte: 'La clé VERCEL_PUBLISH_TOKEN est absente : Studio Site vérifie que les sites répondent, mais ne voit plus les mises en ligne ni les domaines.' };
  else if (avecVercel) {
    try {
      teamId = await avecDelai(equipe(), 8000, '');
      vercelBranche = Boolean(teamId);
      if (!teamId) alerte = { niveau: 'attention', titre: 'Vercel ne répond pas', texte: 'Les statuts de mise en ligne seront mis à jour à la prochaine vérification.' };
    } catch (e) {
      alerte = { niveau: 'panne', titre: 'Studio Site ne peut plus lire Vercel', texte: `${e?.message || 'Clé Vercel refusée.'} Tant que ce n’est pas réglé, les mises en ligne et les publications des espaces clients échouent aussi (document 13).` };
    }
  }

  const sites = await parLots(clients, 6, (rec) => ficheSite(rec, { jour, teamId, vercelBranche, force }));
  if (vercelBranche && sites.some((s) => s.problemes.some((p) => p.id === 'projet')) && sites.every((s) => !s.projetVercel || s.problemes.some((p) => p.id === 'projet')))
    alerte = { niveau: 'panne', titre: 'La clé Vercel ne voit plus les projets des sites', texte: 'Aucun projet n’est trouvé : la clé VERCEL_PUBLISH_TOKEN a sans doute été recréée pour une autre équipe (document 13).' };

  // Depuis quand chaque problème dure, journal des apparitions et résolutions
  const maintenant = new Date().toISOString();
  const avant = deja.problemes || {};
  const apres = {};
  for (const s of sites) {
    const vus = {};
    for (const p of s.problemes) {
      // Date propre au problème (demande envoyée, mise en ligne…) sinon première fois constaté
      p.depuis = p.depuis || avant[s.id]?.[p.id]?.depuis || maintenant;
      if (p.escalade && minutes(p.depuis) > p.escalade.apresH * 60) {
        p.niveau = p.escalade.niveau;
        p.titre = p.escalade.titre;
      }
      delete p.escalade;
      if (p.niveau !== 'travaux') vus[p.id] = { depuis: p.depuis, titre: p.titre, niveau: p.niveau };
    }
    if (Object.keys(vus).length) apres[s.id] = vus;
  }
  const noms = Object.fromEntries(sites.map((s) => [s.id, s.nom]));
  let journal = deja.journal || [];
  if (JSON.stringify(apres) !== JSON.stringify(avant) || !deja.initialise) {
    try {
      // Comparaison refaite sur la version enregistrée : deux appareils ouverts n'écrivent pas deux fois
      const enr = await updatePilotage((p) => {
        const prec = p.problemes || {};
        const fusion = {};
        for (const [cid, liste] of Object.entries(apres)) {
          fusion[cid] = {};
          for (const [pid, v] of Object.entries(liste)) fusion[cid][pid] = { ...v, depuis: prec[cid]?.[pid]?.depuis || v.depuis };
        }
        if (p.initialise && JSON.stringify(fusion) === JSON.stringify(prec)) return null;
        const ev = [];
        if (p.initialise) {
          for (const [cid, liste] of Object.entries(fusion))
            for (const [pid, v] of Object.entries(liste)) if (!prec[cid]?.[pid]) ev.push({ at: maintenant, clientId: cid, nom: noms[cid] || '', type: 'apparu', titre: v.titre, niveau: v.niveau });
          for (const [cid, liste] of Object.entries(prec))
            for (const [pid, v] of Object.entries(liste)) if (!fusion[cid]?.[pid] && noms[cid]) ev.push({ at: maintenant, clientId: cid, nom: noms[cid], type: 'resolu', titre: v.titre, niveau: v.niveau });
        }
        return { ...p, initialise: true, problemes: fusion, journal: [...ev, ...(p.journal || [])].slice(0, 60) };
      });
      journal = enr.journal || journal;
    } catch (e) {
      console.warn('[pilotage]', e?.message);
    }
  }

  for (const s of sites) {
    s.etat = s.etat === 'prepa' ? 'prepa' : s.problemes.reduce((pire, p) => (RANG[p.niveau] < RANG[pire] ? p.niveau : pire), 'ok');
    s.problemes.sort((a, b) => RANG[a.niveau] - RANG[b.niveau]);
  }
  sites.sort((a, b) => RANG[a.etat] - RANG[b.etat] || a.nom.localeCompare(b.nom, 'fr'));

  const compte = (etat) => sites.filter((s) => s.etat === etat).length;
  const fin = resumeFinances(
    clients.map((c) => ({ id: c.id, nom: c.brief?.businessName || c.name || 'Client sans nom', formule: c.formula, facturation: c.facturation })),
    settings.charges || [],
    jour,
    settings.fraisFixesHisto || []
  );
  const data = {
    verifieLe: maintenant,
    intervalle: INTERVALLE_S,
    alerte,
    resume: {
      total: sites.length,
      enLigne: sites.filter((s) => s.etat !== 'prepa').length,
      ok: compte('ok'),
      travaux: compte('travaux'),
      attention: compte('attention'),
      panne: compte('panne'),
      action: compte('action'),
      prepa: compte('prepa'),
      demandes: sites.reduce((n, s) => n + (s.espace?.demandes || 0), 0),
    },
    sites,
    journal: journal.slice(0, 15),
    finances: { mrr: fin.mrr, encaisseMois: fin.encaisseMois, attente: fin.attente.total, retard: fin.retard.total, retardClients: fin.retard.clients, charges: fin.chargesMensuelles, marge: fin.marge, abonnes: fin.abonnes, mois: fin.mois },
  };
  dernier = { at: Date.now(), data };
  return data;
}

export { NIVEAUX };
