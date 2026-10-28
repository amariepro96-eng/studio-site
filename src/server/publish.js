// Mise en ligne automatique d'un site client : GitHub (organisation dédiée) puis Vercel.
//
// Rien ne part sans un clic dans l'espace agence, et seulement si la mise en ligne
// automatique est activée dans Réglages. Les deux clés restent ici, côté serveur :
//   GITHUB_PUBLISH_TOKEN   clé GitHub limitée à l'organisation des sites clients
//   GITHUB_PUBLISH_ORG     nom de l'organisation (par défaut : Station-Site)
//   VERCEL_PUBLISH_TOKEN   clé Vercel limitée à l'équipe Pro
//   VERCEL_TEAM_ID         facultatif : identifiant de l'équipe, si la clé en voit plusieurs
//
// Étapes, dans l'ordre, chacune peut être relancée sans risque :
//   depot   crée le dépôt privé site-identifiant dans l'organisation
//   vercel  crée le projet Vercel relié à ce dépôt
//   fichiers  dépose le site (une seule version, à ton nom) : Vercel le met en ligne tout seul
//   etat    suit la mise en ligne jusqu'à « Ready »
//   domaine / verifierDomaine  ajoute le domaine du client et vérifie les réglages DNS
import { renderPage, allPageSlugs } from '../engine/render.js';
import { renderImages, renderBrief } from '../engine/records.js';
import { readImage, getSettings, StoreError } from './store.js';

const GH = 'https://api.github.com';
const VC = 'https://api.vercel.com';

export function publishEnv() {
  return {
    githubToken: (process.env.GITHUB_PUBLISH_TOKEN || '').trim(),
    org: (process.env.GITHUB_PUBLISH_ORG || 'Station-Site').trim(),
    vercelToken: (process.env.VERCEL_PUBLISH_TOKEN || '').trim(),
    teamId: (process.env.VERCEL_TEAM_ID || '').trim(),
  };
}

// État affiché dans Réglages et dans le dossier (jamais les clés elles-mêmes)
export function publishStatus(settings) {
  const e = publishEnv();
  const missing = [];
  if (!e.githubToken) missing.push('GITHUB_PUBLISH_TOKEN');
  if (!e.vercelToken) missing.push('VERCEL_PUBLISH_TOKEN');
  return { configured: missing.length === 0, missing, org: e.org, enabled: Boolean(settings?.autoPublish) };
}

// ---------- Identifiant : même règle que le tableau Suivi clients ----------
export function identifiantDe(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}
const ID_OK = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
export const identifiantValide = (id) => ID_OK.test(String(id || '')) && !String(id).includes('--');

// ---------- Appels GitHub ----------
async function gh(path, { method = 'GET', body } = {}) {
  const { githubToken } = publishEnv();
  let r;
  try {
    r = await fetch(GH + path, {
      method,
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'studio-site',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new StoreError('GitHub ne répond pas. Réessaie dans un instant.', 'github_down', 502);
  }
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  return { status: r.status, ok: r.ok, data };
}

function ghFail(res, quoi) {
  const { org } = publishEnv();
  const msg = String(res.data?.message || '');
  if (res.status === 401) return new StoreError('La clé GitHub est refusée (expirée ou supprimée) : remplace GITHUB_PUBLISH_TOKEN dans Vercel.', 'github_auth', 502);
  if (res.status === 403 && /rate limit/i.test(msg)) return new StoreError('GitHub limite les appels pour le moment. Réessaie dans quelques minutes.', 'github_rate', 429);
  if (res.status === 403 || (res.status === 404 && quoi === 'création du dépôt'))
    return new StoreError(`La clé GitHub n’a pas le droit de faire : ${quoi}. Elle doit appartenir à l’organisation ${org}, avec Administration et Contents en lecture et écriture.`, 'github_forbidden', 502);
  return new StoreError(`GitHub a refusé l’opération (${quoi}, erreur ${res.status}${msg ? ' : ' + msg.slice(0, 140) : ''}).`, 'github_failed', 502);
}

// ---------- Appels Vercel ----------
async function vc(path, { method = 'GET', body, teamId } = {}) {
  const { vercelToken } = publishEnv();
  const url = new URL(VC + path);
  if (teamId) url.searchParams.set('teamId', teamId);
  let r;
  try {
    r = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${vercelToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new StoreError('Vercel ne répond pas. Réessaie dans un instant.', 'vercel_down', 502);
  }
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  return { status: r.status, ok: r.ok, data };
}

function vcFail(res, quoi) {
  const msg = String(res.data?.error?.message || '');
  if (res.status === 401 || (res.status === 403 && /token|authoriz|forbidden/i.test(res.data?.error?.code || msg)))
    return new StoreError('La clé Vercel est refusée (expirée, supprimée ou pas sur la bonne équipe) : remplace VERCEL_PUBLISH_TOKEN dans Vercel.', 'vercel_auth', 502);
  if (res.status === 402) return new StoreError('Vercel demande de régler la facturation de l’équipe (Settings › Billing) avant de continuer.', 'vercel_billing', 502);
  return new StoreError(`Vercel a refusé l’opération (${quoi}, erreur ${res.status}${msg ? ' : ' + msg.slice(0, 160) : ''}).`, 'vercel_failed', 502);
}

let teamCache = '';
async function equipe() {
  const { teamId } = publishEnv();
  if (teamId) return teamId;
  if (teamCache) return teamCache;
  const res = await vc('/v2/teams?limit=20');
  if (!res.ok) throw vcFail(res, 'lecture des équipes');
  const teams = res.data?.teams || [];
  if (teams.length === 1) return (teamCache = teams[0].id);
  if (!teams.length) throw new StoreError('La clé Vercel ne donne accès à aucune équipe : recrée-la avec la portée (Scope) de ton équipe Pro.', 'vercel_team', 502);
  throw new StoreError(
    `La clé Vercel voit plusieurs équipes (${teams.map((t) => t.slug).join(', ')}). Ajoute la variable VERCEL_TEAM_ID avec l’identifiant de l’équipe Pro (Settings › General › Team ID), puis redéploie.`,
    'vercel_team',
    400
  );
}

// ---------- Contrôles avant d'agir ----------
async function assertActive() {
  const status = publishStatus(await getSettings());
  if (!status.configured) throw new StoreError(`Mise en ligne automatique pas branchée : il manque ${status.missing.join(' et ')} dans Vercel.`, 'publish_off', 503);
  if (!status.enabled) throw new StoreError('La mise en ligne automatique est désactivée dans Réglages.', 'publish_off', 403);
}

// ---------- Le site à publier ----------
function decode(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// Pages HTML (sans LISEZ-MOI.txt) et images à déposer, comme dans le .zip
export async function siteFiles(rec, settings) {
  const model = rec.result?.models?.find((m) => m.id === rec.choice?.modelId);
  if (!rec.result?.content || !model) throw new StoreError('Le modèle choisi est introuvable : enregistre d’abord le choix du client.', 'no_model', 409);
  const brief = renderBrief(rec, '', settings?.hosting || '');
  const images = renderImages(rec, '');
  const content = rec.result.content;
  const pages = allPageSlugs(brief, content).map((slug) => ({ path: `${slug}.html`, text: renderPage(slug, { brief, content, model, images, mode: 'export' }) }));
  const binaries = [];
  const seen = new Set();
  for (const img of images) {
    if (img.source === 'unsplash' || !img.file || seen.has(img.file)) continue;
    seen.add(img.file);
    binaries.push({ path: img.file, id: img.id });
  }
  if (brief.logoFile && rec.brief?.logo?.id && !seen.has(brief.logoFile)) binaries.push({ path: brief.logoFile, id: rec.brief.logo.id });
  // Passages encore entre crochets (mentions légales incomplètes)
  const manques = new Set();
  for (const p of pages) for (const m of p.text.matchAll(/<span class="todo">\[([^\]<]{1,120})\]<\/span>/g)) manques.add(decode(m[1]));
  return { pages, binaries, manques: [...manques] };
}

async function imageBuffer(clientId, imgId) {
  const res = await readImage(clientId, imgId);
  if (!res) throw new StoreError('Une image du site est introuvable dans le dossier : remplace-la, puis réessaie.', 'missing_image', 409);
  if (res.buffer) return res.buffer;
  return Buffer.from(await new Response(res.stream).arrayBuffer());
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

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function teteDuDepot(repo, branch) {
  for (let essai = 0; essai < 6; essai++) {
    const res = await gh(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    if (res.ok && res.data?.object?.sha) return res.data.object.sha;
    // Juste après la création, GitHub met parfois quelques secondes à exposer la branche
    if ([404, 409].includes(res.status)) {
      await pause(1200);
      continue;
    }
    throw ghFail(res, 'lecture du dépôt');
  }
  throw new StoreError('Le dépôt vient d’être créé et GitHub ne l’a pas encore préparé. Réessaie dans une minute.', 'github_not_ready', 409);
}

// Ce qui a été fait sur GitHub depuis la dernière publication
async function changementsDepuis(pub) {
  const head = await teteDuDepot(pub.repo, pub.branch || 'main');
  if (!pub.commit || head === pub.commit) return null;
  const res = await gh(`/repos/${pub.repo}/commits?sha=${encodeURIComponent(pub.branch || 'main')}&per_page=20`);
  if (!res.ok) throw ghFail(res, 'lecture de l’historique');
  const list = [];
  for (const c of res.data || []) {
    if (c.sha === pub.commit) break;
    list.push({ message: String(c.commit?.message || '').split('\n')[0].slice(0, 120), date: c.commit?.author?.date || '', auteur: c.commit?.author?.name || '' });
  }
  return { nombre: list.length, dernier: list[0] || null };
}

// Vue publique de la publication enregistrée dans le dossier
export function vuePublication(pub) {
  if (!pub) return null;
  const { identifiant, repo, repoUrl, projectId, projectName, url, inspectorUrl, version, commit, publishedAt, domain, dns, domainOk, domainCheckedAt } = pub;
  return { identifiant, repo, repoUrl, projectId, projectName, url, inspectorUrl, version, commit: commit ? commit.slice(0, 7) : '', publishedAt, domain, dns, domainOk, domainCheckedAt };
}

// ---------- Vérification (aucune écriture) ----------
export async function verifier(rec, { identifiant } = {}) {
  const env = publishEnv();
  const settings = await getSettings();
  const status = publishStatus(settings);
  const pub = rec.publication || null;
  const fixe = Boolean(pub?.repo);
  // Par défaut, le même identifiant que le dossier Google Drive du client (tableau Suivi clients)
  const id = fixe ? pub.identifiant : identifiantDe(identifiant || rec.drive?.identifiant || rec.brief?.businessName || rec.name);
  const { pages, binaries, manques } = await siteFiles(rec, settings);
  const out = {
    status,
    identifiant: id,
    identifiantFixe: fixe,
    repo: fixe ? pub.repo : `${env.org}/site-${id}`,
    pages: pages.map((p) => p.path),
    images: binaries.length,
    manques,
    bloquants: [],
    changementsGitHub: null,
    publication: vuePublication(pub),
    domaine: pub?.domain || rec.brief?.domain || '',
  };
  // Mentions légales incomplètes : simple avertissement (out.manques), la mise en ligne reste possible
  if (!fixe && !identifiantValide(id)) out.bloquants.push('Identifiant invalide : lettres minuscules, chiffres et tirets uniquement.');
  if (!status.configured || !status.enabled) return out;

  if (!fixe && identifiantValide(id)) {
    const res = await gh(`/repos/${env.org}/site-${id}`);
    if (res.ok) out.bloquants.push(`Le dépôt ${env.org}/site-${id} existe déjà : choisis un autre identifiant (par exemple ${id}-2).`);
    else if (res.status === 401) throw ghFail(res, 'lecture des dépôts');
  }
  if (pub?.repo && pub?.commit) out.changementsGitHub = await changementsDepuis(pub);
  return out;
}

// ---------- Étape 1 : le dépôt ----------
export async function etapeDepot(rec, identifiant) {
  await assertActive();
  const env = publishEnv();
  const pub = rec.publication || {};
  if (pub.repo) {
    const res = await gh(`/repos/${pub.repo}`);
    if (res.ok) return {};
    if (res.status === 404) throw new StoreError(`Le dépôt ${pub.repo} n’existe plus sur GitHub. Il a été supprimé ou transféré : vérifie avant de continuer.`, 'repo_gone', 409);
    throw ghFail(res, 'lecture du dépôt');
  }
  const id = identifiantDe(identifiant || rec.drive?.identifiant || rec.brief?.businessName || rec.name);
  if (!identifiantValide(id)) throw new StoreError('Identifiant invalide : lettres minuscules, chiffres et tirets uniquement.', 'bad_id', 400);
  const name = `site-${id}`;
  const existe = await gh(`/repos/${env.org}/${name}`);
  if (existe.ok) throw new StoreError(`Le dépôt ${env.org}/${name} existe déjà : choisis un autre identifiant.`, 'repo_exists', 409);
  const nom = String(rec.brief?.businessName || rec.name || id).slice(0, 80);
  const res = await gh(`/orgs/${encodeURIComponent(env.org)}/repos`, {
    method: 'POST',
    body: { name, description: `Site de ${nom}`, private: true, auto_init: true, has_issues: false, has_wiki: false, has_projects: false },
  });
  if (res.status === 422) throw new StoreError(`GitHub refuse le nom ${name} (déjà pris ou invalide) : choisis un autre identifiant.`, 'repo_exists', 409);
  if (!res.ok) throw ghFail(res, 'création du dépôt');
  return { identifiant: id, repo: res.data.full_name, repoId: res.data.id, repoUrl: res.data.html_url, branch: res.data.default_branch || 'main', repoCreatedAt: new Date().toISOString() };
}

// ---------- Étape 2 : le projet Vercel ----------
export async function etapeVercel(rec) {
  await assertActive();
  const pub = rec.publication || {};
  if (!pub.repo) throw new StoreError('Crée d’abord le dépôt.', 'no_repo', 409);
  const teamId = await equipe();
  if (pub.projectId) {
    const res = await vc(`/v9/projects/${encodeURIComponent(pub.projectId)}`, { teamId });
    if (res.ok) return { teamId };
    if (res.status !== 404) throw vcFail(res, 'lecture du projet');
  }
  const name = pub.repo.split('/')[1].toLowerCase();
  const exist = await vc(`/v9/projects/${encodeURIComponent(name)}`, { teamId });
  if (exist.ok) {
    const link = exist.data?.link || {};
    const meme = String(link.org || '').toLowerCase() + '/' + String(link.repo || '').toLowerCase() === pub.repo.toLowerCase();
    if (!meme) throw new StoreError(`Un projet Vercel s’appelle déjà ${name} et n’est pas relié à ce dépôt. Renomme-le ou supprime-le dans Vercel, puis réessaie.`, 'project_exists', 409);
    return { projectId: exist.data.id, projectName: exist.data.name, teamId };
  }
  if (exist.status !== 404) throw vcFail(exist, 'lecture du projet');
  const res = await vc('/v11/projects', { method: 'POST', teamId, body: { name, framework: null, gitRepository: { type: 'github', repo: pub.repo } } });
  if (!res.ok) {
    const msg = String(res.data?.error?.message || '');
    if (res.status === 400 && /repo|git|install|access/i.test(msg))
      throw new StoreError(`Vercel ne voit pas le dépôt ${pub.repo}. Vérifie que l’application Vercel est installée sur l’organisation avec « All repositories », et que ton équipe Vercel est en Pro.`, 'vercel_repo', 502);
    throw vcFail(res, 'création du projet');
  }
  return { projectId: res.data.id, projectName: res.data.name, teamId };
}

// ---------- Étape 3 : les fichiers ----------
export async function etapeFichiers(rec, { remplacer = false } = {}) {
  await assertActive();
  const pub = rec.publication || {};
  if (!pub.repo || !pub.projectId) throw new StoreError('Crée d’abord le dépôt et le projet Vercel.', 'not_ready', 409);
  const settings = await getSettings();
  // Les passages entre crochets (mentions légales incomplètes) ne bloquent pas : ils sont
  // renvoyés dans `manques` pour l'avertissement et l'historique du dossier
  const { pages, binaries, manques } = await siteFiles(rec, settings);
  const branch = pub.branch || 'main';
  const head = await teteDuDepot(pub.repo, branch);
  if (pub.commit && head !== pub.commit && !remplacer) {
    throw new StoreError('Le dépôt a été modifié sur GitHub depuis ta dernière publication. Confirme pour remplacer ces changements.', 'github_changed', 409);
  }
  // Contenu : pages en texte, images lues dans le dossier
  const items = [...pages.map((p) => ({ path: p.path, text: p.text })), ...binaries];
  const shas = await parLots(items, 4, async (it) => {
    const body = it.text != null ? { content: it.text, encoding: 'utf-8' } : { content: (await imageBuffer(rec.id, it.id)).toString('base64'), encoding: 'base64' };
    const res = await gh(`/repos/${pub.repo}/git/blobs`, { method: 'POST', body });
    if (!res.ok) throw ghFail(res, 'envoi des fichiers');
    return res.data.sha;
  });
  const tree = await gh(`/repos/${pub.repo}/git/trees`, { method: 'POST', body: { tree: items.map((it, i) => ({ path: it.path, mode: '100644', type: 'blob', sha: shas[i] })) } });
  if (!tree.ok) throw ghFail(tree, 'préparation de la version');
  const current = await gh(`/repos/${pub.repo}/git/commits/${head}`);
  if (!current.ok) throw ghFail(current, 'lecture de la version en ligne');
  if (current.data?.tree?.sha === tree.data.sha) return { patch: {}, inchange: true, manques };
  const version = (pub.version || 0) + 1;
  const commit = await gh(`/repos/${pub.repo}/git/commits`, { method: 'POST', body: { message: `Site v${version} publié depuis Studio Site`, tree: tree.data.sha, parents: [head] } });
  if (!commit.ok) throw ghFail(commit, 'enregistrement de la version');
  const ref = await gh(`/repos/${pub.repo}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: { sha: commit.data.sha, force: false } });
  if (ref.status === 422) throw new StoreError('Le dépôt a changé pendant la publication. Réessaie.', 'github_race', 409);
  if (!ref.ok) throw ghFail(ref, 'publication de la version');
  return { patch: { commit: commit.data.sha, version, publishedAt: new Date().toISOString(), deployState: 'QUEUED', files: items.length }, inchange: false, manques };
}

// ---------- Étape 4 : suivi de la mise en ligne ----------
function adresseProvisoire(aliases, projectName) {
  const list = (aliases || []).filter((a) => typeof a === 'string' && a.endsWith('.vercel.app'));
  const exact = list.find((a) => a === `${projectName}.vercel.app`);
  if (exact) return exact;
  return list.filter((a) => !a.includes('-git-')).sort((a, b) => a.length - b.length)[0] || list[0] || '';
}

export async function etapeEtat(rec) {
  const pub = rec.publication || {};
  if (!pub.projectId || !pub.commit) throw new StoreError('Aucune publication en cours.', 'not_ready', 409);
  const teamId = pub.teamId || (await equipe());
  const res = await vc(`/v7/deployments?projectId=${encodeURIComponent(pub.projectId)}&sha=${encodeURIComponent(pub.commit)}&limit=5`, { teamId });
  if (!res.ok) throw vcFail(res, 'suivi de la mise en ligne');
  const list = res.data?.deployments || [];
  const d = list.find((x) => x.target === 'production') || list[0];
  if (!d) return { state: 'QUEUED', patch: {} };
  const state = d.readyState || d.state || 'QUEUED';
  const inspectorUrl = d.inspectorUrl || '';
  if (state === 'READY') {
    const full = await vc(`/v13/deployments/${encodeURIComponent(d.uid)}`, { teamId });
    const alias = full.ok ? adresseProvisoire(full.data?.alias, pub.projectName) : '';
    const url = 'https://' + (alias || d.url);
    return { state, url, patch: { deployState: 'READY', url, inspectorUrl } };
  }
  if (['ERROR', 'CANCELED', 'BLOCKED', 'DELETED'].includes(state)) {
    let message = d.errorMessage || '';
    if (state === 'BLOCKED' || d.seatBlock?.blockCode) message = 'Vercel a bloqué la mise en ligne : la version doit venir d’un membre de ton équipe Vercel. Vérifie que ton compte GitHub est relié à ton compte Vercel (Account Settings › Authentication).';
    return { state, message, patch: { deployState: state, inspectorUrl } };
  }
  return { state, patch: { deployState: state, inspectorUrl } };
}

// ---------- Étape 5 : le domaine du client ----------
export function domaineDe(texte) {
  return String(texte || '')
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/\.$/, '')
    .replace(/^www\./, '');
}
const DOMAINE_OK = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

async function ajouterAuProjet(pub, teamId, body) {
  const res = await vc(`/v10/projects/${encodeURIComponent(pub.projectId)}/domains`, { method: 'POST', teamId, body });
  if (res.ok) return;
  const msg = String(res.data?.error?.message || '');
  const code = String(res.data?.error?.code || '');
  // Déjà sur ce projet : rien à faire
  if (res.status === 400 && /already|exists/i.test(msg + code)) {
    const deja = await vc(`/v9/projects/${encodeURIComponent(pub.projectId)}/domains/${encodeURIComponent(body.name)}`, { teamId });
    if (deja.ok) return;
  }
  if (res.status === 409) throw new StoreError(`Le domaine ${body.name} est déjà utilisé par un autre projet Vercel. Retire-le de ce projet, puis réessaie.`, 'domain_taken', 409);
  if (res.status === 403) throw new StoreError(`Vercel refuse le domaine ${body.name} pour ce compte. Vérifie l’orthographe, puis réessaie.`, 'domain_denied', 403);
  throw vcFail(res, 'ajout du domaine');
}

async function reglagesDns(pub, teamId, apex) {
  const lire = async (name) => {
    const [cfg, dom] = await Promise.all([
      vc(`/v6/domains/${encodeURIComponent(name)}/config?projectIdOrName=${encodeURIComponent(pub.projectId)}`, { teamId }),
      vc(`/v9/projects/${encodeURIComponent(pub.projectId)}/domains/${encodeURIComponent(name)}`, { teamId }),
    ]);
    if (!cfg.ok) throw vcFail(cfg, 'lecture des réglages du domaine');
    return { cfg: cfg.data || {}, dom: dom.ok ? dom.data || {} : {} };
  };
  const [a, w] = await Promise.all([lire(apex), lire('www.' + apex)]);
  const rank1 = (list) => (Array.isArray(list) ? [...list].sort((x, y) => (x.rank || 99) - (y.rank || 99))[0] : null);
  const ip = (rank1(a.cfg.recommendedIPv4)?.value || [])[0] || '76.76.21.21';
  const cname = String(rank1(w.cfg.recommendedCNAME)?.value || 'cname.vercel-dns.com').replace(/\.$/, '');
  const txt = [...(a.dom.verified === false ? a.dom.verification || [] : []), ...(w.dom.verified === false ? w.dom.verification || [] : [])]
    .filter((v) => v.type === 'TXT')
    .map((v) => ({ type: 'TXT', nom: String(v.domain || '').replace(new RegExp(`\\.?${apex.replace(/\./g, '\\.')}$`), ''), valeur: v.value, pour: v.domain }));
  const records = [
    { type: 'A', nom: '', valeur: ip, pour: apex, ok: a.cfg.misconfigured === false },
    { type: 'CNAME', nom: 'www', valeur: cname + '.', pour: 'www.' + apex, ok: w.cfg.misconfigured === false },
    ...txt.map((t) => ({ ...t, ok: false })),
  ];
  return { records, ok: records.every((r) => r.ok) };
}

export async function etapeDomaine(rec, texte) {
  await assertActive();
  const pub = rec.publication || {};
  if (!pub.projectId || pub.deployState !== 'READY') throw new StoreError('Mets d’abord le site en ligne sur son adresse provisoire.', 'not_ready', 409);
  const apex = domaineDe(texte);
  if (!DOMAINE_OK.test(apex)) throw new StoreError('Adresse de domaine invalide. Exemple : boulangerie-martin.fr', 'bad_domain', 400);
  if (pub.domain && pub.domain !== apex) throw new StoreError(`Le domaine ${pub.domain} est déjà relié. Pour en changer, retire-le d’abord dans Vercel (Settings › Domains).`, 'domain_set', 409);
  const teamId = pub.teamId || (await equipe());
  await ajouterAuProjet(pub, teamId, { name: apex });
  await ajouterAuProjet(pub, teamId, { name: 'www.' + apex, redirect: apex, redirectStatusCode: 308 });
  const dns = await reglagesDns(pub, teamId, apex);
  return { domain: apex, dns: dns.records, domainOk: dns.ok, domainCheckedAt: new Date().toISOString() };
}

export async function etapeVerifierDomaine(rec) {
  const pub = rec.publication || {};
  if (!pub.domain) throw new StoreError('Aucun domaine relié pour le moment.', 'no_domain', 409);
  const teamId = pub.teamId || (await equipe());
  // Défi TXT éventuel (domaine déjà utilisé ailleurs sur Vercel) : on demande à Vercel de revérifier
  for (const name of [pub.domain, 'www.' + pub.domain]) {
    const dom = await vc(`/v9/projects/${encodeURIComponent(pub.projectId)}/domains/${encodeURIComponent(name)}`, { teamId });
    if (dom.ok && dom.data?.verified === false) await vc(`/v9/projects/${encodeURIComponent(pub.projectId)}/domains/${encodeURIComponent(name)}/verify`, { method: 'POST', teamId });
  }
  const dns = await reglagesDns(pub, teamId, pub.domain);
  return { dns: dns.records, domainOk: dns.ok, domainCheckedAt: new Date().toISOString() };
}
