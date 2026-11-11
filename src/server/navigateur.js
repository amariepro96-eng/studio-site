// Navigateur sans écran de l'agent d'inspiration : il ouvre un site comme un visiteur, fait des
// captures (ordinateur, téléphone, pages intérieures) et relève ce que le site contient.
// En ligne (Vercel) : le Chromium compressé de @sparticuz/chromium ; en local : celui de Playwright.
//
// Sécurité : seules les adresses publiques sont visitées (jamais le réseau interne du serveur),
// robots.txt est respecté, aucun cookie n'est accepté (bannières refusées ou masquées), aucun
// formulaire n'est rempli. Les captures restent privées, dans l'espace agence.
import dns from 'node:dns/promises';
import net from 'node:net';

export const AGENT = 'StudioSiteInspiration';
const UA_BUREAU = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 ${AGENT}/1.0`;
const UA_MOBILE = `Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1 ${AGENT}/1.0`;
const HAUT_BUREAU = 7000; // pixels gardés au plus pour la page d'accueil entière
const HAUT_MOBILE = 2600;
const HAUT_INTERIEURE = 4000;

export class VisiteError extends Error {
  constructor(message, code = 'visite') {
    super(message);
    this.code = code;
  }
}

// ---------- Adresses autorisées ----------
// En local seulement (tests) : INSPIRATION_AUTORISER_LOCAL=1 permet de visiter des sites de test sur 127.0.0.1
const autoriserLocal = () => !process.env.VERCEL && process.env.INSPIRATION_AUTORISER_LOCAL === '1';

function ipv4Privee(ip) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}
// IPv6 développée en 8 groupes de 16 bits (accepte « :: » et une fin en IPv4 pointée)
function groupesIPv6(ip) {
  let x = String(ip).toLowerCase().replace(/%.*$/, '');
  const v4 = x.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    x = x.slice(0, -v4[0].length) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  if (x.split('::').length > 2) return null;
  const [gauche, droite] = x.split('::');
  const g = gauche ? gauche.split(':') : [];
  const dr = droite !== undefined && droite ? droite.split(':') : [];
  const manque = x.includes('::') ? 8 - g.length - dr.length : 0;
  const tout = [...g, ...Array(Math.max(0, manque)).fill('0'), ...dr].map((h) => parseInt(h || '0', 16));
  return tout.length === 8 && tout.every((n) => n >= 0 && n <= 0xffff) ? tout : null;
}
export function ipPrivee(ip) {
  if (net.isIPv4(ip)) return ipv4Privee(ip);
  const g = groupesIPv6(ip);
  if (!g) return true;
  const v4De = (hi, lo) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  if (g.slice(0, 7).every((n) => n === 0)) return true; // :: et ::1
  // IPv4 cachée dans une IPv6 (::ffff:a.b.c.d, ::a.b.c.d) : on juge l'IPv4
  if (g.slice(0, 5).every((n) => n === 0) && (g[5] === 0xffff || g[5] === 0)) return ipv4Privee(v4De(g[6], g[7]));
  const p = g[0];
  return (
    (p & 0xfe00) === 0xfc00 || // fc00::/7 réseau local
    (p & 0xffc0) === 0xfe80 || // fe80::/10 lien local
    (p & 0xff00) === 0xff00 || // multicast
    (p === 0x64 && g[1] === 0xff9b) || // NAT64
    p === 0x2002 || // 6to4
    (p === 0x2001 && (g[1] === 0 || g[1] === 0xdb8)) // Teredo, documentation
  );
}

// Une adresse que le navigateur a le droit d'ouvrir (le résultat est gardé le temps d'une visite)
export function gardien() {
  const vus = new Map();
  return async function sure(url) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return false;
    }
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    if (autoriserLocal()) return true;
    if (u.port && !['80', '443'].includes(u.port)) return false;
    const h = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (vus.has(h)) return vus.get(h);
    let ok = false;
    if (h === 'localhost' || /\.(localhost|local|internal|lan|home|corp)$/.test(h)) ok = false;
    else if (net.isIP(h)) ok = !ipPrivee(h);
    else {
      try {
        const adresses = await dns.lookup(h, { all: true });
        ok = adresses.length > 0 && adresses.every((a) => !ipPrivee(a.address));
      } catch {
        ok = false;
      }
    }
    vus.set(h, ok);
    return ok;
  };
}

// ---------- robots.txt ----------
// Règles du groupe qui nous vise (StudioSiteInspiration), sinon du groupe « * ». La règle la plus
// longue l'emporte ; à longueur égale, Allow gagne. Sans robots.txt lisible : visite permise.
export function robotsPermet(texte, chemin = '/') {
  const groupes = [];
  let cur = null;
  let dernierEtaitAgent = false;
  for (const brut of String(texte || '').split(/\r?\n/)) {
    const ligne = brut.replace(/#.*/, '').trim();
    if (!ligne) continue;
    const m = ligne.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const cle = m[1].toLowerCase();
    const val = m[2].trim();
    if (cle === 'user-agent') {
      if (!cur || !dernierEtaitAgent) {
        cur = { agents: [], regles: [] };
        groupes.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      dernierEtaitAgent = true;
    } else if ((cle === 'allow' || cle === 'disallow') && cur) {
      cur.regles.push({ allow: cle === 'allow', motif: val });
      dernierEtaitAgent = false;
    } else {
      dernierEtaitAgent = false;
    }
  }
  const nous = AGENT.toLowerCase();
  let vise = groupes.filter((g) => g.agents.some((a) => a !== '*' && nous.includes(a)));
  if (!vise.length) vise = groupes.filter((g) => g.agents.includes('*'));
  // « Disallow: » vide = tout est permis : seules les règles avec un motif comptent
  const regles = vise.flatMap((g) => g.regles).filter((r) => r.motif !== '');
  let meilleure = null;
  for (const r of regles) {
    const re = new RegExp('^' + r.motif.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (!re.test(chemin)) continue;
    const longueur = r.motif.length;
    if (!meilleure || longueur > meilleure.longueur || (longueur === meilleure.longueur && r.allow)) meilleure = { longueur, allow: r.allow };
  }
  return meilleure ? meilleure.allow : true;
}

export async function lireRobots(origine, sure) {
  if (!(await sure(origine + '/robots.txt'))) return '';
  try {
    const r = await fetch(origine + '/robots.txt', { headers: { 'user-agent': UA_BUREAU }, redirect: 'manual', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return '';
    return (await r.text()).slice(0, 300_000);
  } catch {
    return '';
  }
}

// ---------- Lancement ----------
export async function ouvrirNavigateur() {
  const { chromium } = await import('playwright-core');
  if (process.env.VERCEL || process.env.INSPIRATION_CHROMIUM_SERVERLESS === '1') {
    const sparticuz = (await import('@sparticuz/chromium')).default;
    if ('setGraphicsMode' in sparticuz) sparticuz.setGraphicsMode = false;
    // Les protections du navigateur restent actives (sites inconnus) : on retire ces deux réglages
    const args = sparticuz.args.filter((a) => !['--disable-web-security', '--allow-running-insecure-content'].includes(a));
    return chromium.launch({ args, executablePath: await sparticuz.executablePath(), headless: true });
  }
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  return chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
}

// ---------- Une visite ----------
const CSS_BANNIERES = `
#onetrust-banner-sdk,#onetrust-consent-sdk,#didomi-host,#didomi-popup,.didomi-popup-open .didomi-popup-backdrop,#axeptio_overlay,#axeptio_main_button,
#tarteaucitronRoot,#tarteaucitronAlertBig,.cc-window,.cc-banner,.cky-consent-container,.cky-overlay,#CybotCookiebotDialog,#cookiescript_injected,
#cmplz-cookiebanner-container,.cmplz-cookiebanner,#usercentrics-root,#qc-cmp2-container,.qc-cmp2-container,#sp_message_container,.fc-consent-root,
#cookie-notice,#cookie-law-info-bar,.cookie-notice,.cookie-banner,.cookies-banner,#cookie-banner,#cookies-banner,[id*="cookie-consent"],[class*="cookie-consent"],
[aria-label*="cookie" i][role="dialog"],[aria-label*="cookies" i][role="dialog"],.klaro,.cm-wrapper{display:none!important;visibility:hidden!important}
html,body{overflow:auto!important;position:static!important}`;

const REFUSER = /^(tout refuser|refuser tout|refuser|je refuse|refuser les cookies|refuser et fermer|continuer sans accepter|non merci|reject all|decline( all)?|reject)$/i;

async function bannieres(page) {
  for (const frame of page.frames().slice(0, 4)) {
    try {
      const bouton = frame.getByRole('button', { name: REFUSER }).first();
      if (await bouton.isVisible({ timeout: 400 })) {
        await bouton.click({ timeout: 1500 });
        await page.waitForTimeout(400);
        break;
      }
    } catch {}
    try {
      const lien = frame.getByRole('link', { name: REFUSER }).first();
      if (await lien.isVisible({ timeout: 200 })) {
        await lien.click({ timeout: 1500 });
        await page.waitForTimeout(400);
        break;
      }
    } catch {}
  }
  await page.addStyleTag({ content: CSS_BANNIERES }).catch(() => {});
}

// Fait défiler la page pour que les images « paresseuses » se chargent, puis remonte
async function defiler(page, max) {
  await page
    .evaluate(async (limite) => {
      const pause = (ms) => new Promise((r) => setTimeout(r, ms));
      let y = 0;
      while (y < Math.min(document.documentElement.scrollHeight, limite)) {
        y += 700;
        window.scrollTo(0, y);
        await pause(120);
      }
      window.scrollTo(0, 0);
      await pause(300);
    }, max)
    .catch(() => {});
}

// Relevé fait dans la page : titres, menu, boutons, polices, couleurs, indices de fonctionnalités
function releve() {
  const txt = (el) => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const q = (s) => Array.from(document.querySelectorAll(s));
  const corps = String(document.body?.innerText || '').slice(0, 120000);
  const bas = corps.toLowerCase();
  const html = document.documentElement.outerHTML.slice(0, 600000).toLowerCase();
  const liens = q('a[href]')
    .map((a) => ({ t: txt(a).slice(0, 60), h: a.href }))
    .filter((l) => /^https?:/.test(l.h));
  const nav = [...new Set(q('header a[href], nav a[href], [role="navigation"] a[href]').map(txt).filter((t) => t && t.length < 40))].slice(0, 24);
  const titres = q('h1, h2').map(txt).filter(Boolean).slice(0, 24).map((t) => t.slice(0, 140));
  const boutons = [...new Set(q('button, [role="button"], a[class*="btn" i], a[class*="button" i], a[class*="cta" i]').map(txt).filter((t) => t && t.length < 40))].slice(0, 16);
  const externes = [...liens.map((l) => l.h), ...q('iframe[src]').map((f) => f.src), ...q('script[src]').map((s) => s.src)].join(' ').toLowerCase();
  const menuTexte = nav.join(' ').toLowerCase();
  const indices = {
    reservation_en_ligne: /zenchef|thefork|lafourchette|planity|calendly|resy\.com|opentable|sevenrooms|guestonline|bookingkit|treatwell|simplybook|setmore|doctolib|booksy|kalendes/.test(externes) || /réserver|réservez|reservation|prendre rendez-vous|prise de rendez-vous|book now|book a table/.test(bas),
    commande_en_ligne: /click ?(&|and|et) ?collect|commander en ligne|commande en ligne|à emporter|order online/.test(bas) || /ubereats|deliveroo|just-?eat/.test(externes),
    livraison: /livraison|livrons|delivery/.test(bas),
    boutique: /ajouter au panier|add to cart|mon panier|votre panier/.test(bas) || /cdn\.shopify|woocommerce|prestashop/.test(html),
    carte_cadeau: /carte[ -]cadeau|bon[ -]cadeau|gift card/.test(bas),
    avis_clients: /avis clients|ils nous font confiance|témoignage|temoignage|nos clients parlent|trustpilot|guest ?suite|avis google/.test(bas) || /trustpilot|elfsight|trustindex|guestsuite/.test(externes),
    video: q('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0,
    telephone_clic: q('a[href^="tel:"]').length > 0,
    messagerie: /wa\.me|api\.whatsapp|crisp\.chat|tawk\.to|intercom|m\.me\//.test(externes),
    formulaire_contact: q('form textarea').length > 0,
    newsletter: /newsletter|abonnez-vous|inscrivez-vous à|mailchimp|klaviyo/.test(bas + ' ' + externes),
    reseaux_sociaux: /instagram\.com|facebook\.com|tiktok\.com|linkedin\.com|pinterest\./.test(externes),
    plan_acces: /google\.[a-z.]+\/maps|maps\.google|openstreetmap|mapbox|leaflet/.test(externes + ' ' + html.slice(0, 300000)),
    faq: /questions fréquentes|foire aux questions|\bfaq\b/.test(bas) || q('details summary').length > 2,
    blog: /blog|actualités|actus|journal|news/.test(menuTexte),
    horaires: /horaires|ouvert du|du mardi au|du lundi au|fermé le/.test(bas),
    multilingue: q('link[hreflang]').length > 1,
    pdf: q('a[href$=".pdf" i]').length > 0,
    allergenes: /allergène|allergene/.test(bas),
    prix_affiches: /\d+(?:[,.]\d{1,2})?\s?€|€\s?\d+/.test(corps),
    equipe: /notre équipe|l['’]équipe|our team|qui sommes-nous/.test(bas),
    evenements: /agenda|événements|evenements|ateliers|workshop/.test(menuTexte),
    galerie: /galerie|réalisations|portfolio|nos créations/.test(menuTexte) || q('img').length > 24,
    devis: /demande de devis|devis gratuit|obtenir un devis/.test(bas),
    zone_intervention: /zone d['’]intervention|nous intervenons|secteur d['’]intervention/.test(bas),
    urgence: /urgence|24 ?h ?\/ ?24|7 ?j ?\/ ?7|dépannage/.test(bas),
    references: /ils nous font confiance|nos références|nos partenaires|vu dans|presse/.test(bas),
  };
  const st = (el, p) => (el ? getComputedStyle(el)[p] : '');
  const polices = {
    titres: st(document.querySelector('h1') || document.querySelector('h2'), 'fontFamily').slice(0, 120),
    texte: st(document.querySelector('main p') || document.querySelector('p') || document.body, 'fontFamily').slice(0, 120),
  };
  const comptes = {};
  const ajoute = (c, poids) => {
    if (!c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c)) return;
    comptes[c] = (comptes[c] || 0) + poids;
  };
  for (const el of q('body, header, nav, main, section, footer, aside, div').slice(0, 500)) {
    const r = el.getBoundingClientRect();
    const aire = r.width * r.height;
    if (aire < 8000) continue;
    ajoute(st(el, 'backgroundColor'), Math.min(aire, 1.5e6) / 1e4);
  }
  for (const el of q('button, a[class*="btn" i], a[class*="button" i]').slice(0, 30)) ajoute(st(el, 'backgroundColor'), 60);
  for (const el of q('h1, h2, h3, p, a').slice(0, 120)) ajoute(st(el, 'color'), 6);
  const couleurs = Object.entries(comptes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([c]) => c);
  const outil =
    document.querySelector('meta[name="generator"]')?.getAttribute('content') ||
    (/wp-content|wp-includes/.test(html) ? 'WordPress' : /cdn\.shopify/.test(html) ? 'Shopify' : /wixstatic|wix\.com/.test(html) ? 'Wix' : /squarespace/.test(html) ? 'Squarespace' : /webflow/.test(html) ? 'Webflow' : '');
  return {
    titre: String(document.title || '').slice(0, 160),
    description: String(document.querySelector('meta[name="description"]')?.getAttribute('content') || '').slice(0, 300),
    langue: document.documentElement.lang || '',
    nav,
    titres,
    boutons,
    indices: Object.keys(indices).filter((k) => indices[k]),
    polices,
    couleurs,
    outil: String(outil).slice(0, 60),
    hauteur: document.documentElement.scrollHeight,
    images: q('img').length,
    liensInternes: liens.filter((l) => l.h.startsWith(location.origin)).slice(0, 200),
  };
}

// rgb(12, 34, 56) → #0c2238
export function enHex(c) {
  const m = String(c || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) return '';
  return '#' + [m[1], m[2], m[3]].map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0')).join('');
}

// Pages intérieures les plus parlantes : carte, prestations, tarifs, boutique, réservation, histoire
const PRIORITE = [
  /carte|menu|plats|nos-vins/,
  /prestation|services?|soins|tarif|prix|forfait/,
  /boutique|shop|produits|collection|catalogue/,
  /reserv|rendez-vous|booking|rdv|command|order|click-and-collect/,
  /realisation|galerie|portfolio|projets|creations/,
  /a-propos|apropos|about|histoire|qui-sommes|notre-maison|equipe/,
];
const EXCLURE = /mentions|cgv|cgu|conditions|cookies|confidentialit|privacy|politique|panier|\bcart\b|checkout|compte|account|login|connexion|wp-admin|feed|tel:|mailto:/;
const FICHIER = /\.(pdf|jpe?g|png|webp|gif|svg|zip|docx?|xlsx?|pptx?|mp4|mp3)$/i;
export function pagesInterieures(liens, accueil, combien = 2) {
  const base = new URL(accueil);
  const vus = new Set([base.pathname.replace(/\/$/, '') || '/']);
  const candidats = [];
  for (const l of liens || []) {
    let u;
    try {
      u = new URL(l.h);
    } catch {
      continue;
    }
    if (u.host !== base.host) continue;
    u.hash = '';
    const chemin = u.pathname.replace(/\/$/, '') || '/';
    const cle = (chemin + ' ' + (l.t || '')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (vus.has(chemin) || EXCLURE.test(cle) || FICHIER.test(chemin)) continue;
    // Pages parlantes d'abord ; les autres pages du site (« Nos pains », « Commander »…) en dernier recours
    const trouve = PRIORITE.findIndex((re) => re.test(cle));
    const rang = trouve === -1 ? PRIORITE.length + candidats.length : trouve;
    vus.add(chemin);
    candidats.push({ url: u.toString(), titre: l.t || '', rang });
  }
  candidats.sort((a, b) => a.rang - b.rang);
  // Une page par type d'abord (carte puis prestations…), pour varier
  const out = [];
  const rangs = new Set();
  for (const c of candidats) {
    if (out.length >= combien || rangs.has(c.rang)) continue;
    out.push(c);
    rangs.add(c.rang);
  }
  for (const c of candidats) if (out.length < combien && !out.includes(c)) out.push(c);
  return out;
}

async function contexte(browser, { mobile = false } = {}, sure) {
  const ctx = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, userAgent: UA_MOBILE, locale: 'fr-FR', serviceWorkers: 'block', acceptDownloads: false }
      : { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, userAgent: UA_BUREAU, locale: 'fr-FR', serviceWorkers: 'block', acceptDownloads: false }
  );
  // Chaque requête (page, image, script…) passe par le gardien : jamais d'adresse interne
  await ctx.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    if (!(await sure(url))) return route.abort('blockedbyclient');
    return route.continue();
  });
  // Pas de WebSocket (inutile pour des captures, et hors du contrôle du gardien)
  if (typeof ctx.routeWebSocket === 'function') await ctx.routeWebSocket(/.*/, (ws) => ws.close()).catch(() => {});
  ctx.setDefaultTimeout(8000);
  return ctx;
}

async function ouvrir(page, url) {
  let reponse;
  try {
    reponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  } catch (e) {
    const m = String(e?.message || '');
    if (/ERR_NAME_NOT_RESOLVED/.test(m)) throw new VisiteError('Adresse introuvable (le domaine n’existe pas ou plus).', 'introuvable');
    if (/ERR_BLOCKED_BY_CLIENT/.test(m)) throw new VisiteError('Adresse refusée (réseau privé).', 'refuse');
    if (/Timeout/i.test(m)) throw new VisiteError('Le site a mis trop de temps à répondre.', 'lent');
    throw new VisiteError('Le site n’a pas pu être ouvert.', 'ouverture');
  }
  const statut = reponse?.status() || 0;
  if (statut >= 400) throw new VisiteError(`Le site répond ${statut}.`, 'http');
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  return reponse;
}

async function capture(page, hauteurMax, { pleinePage = true } = {}) {
  const vue = page.viewportSize();
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => vue.height);
  const h = pleinePage ? Math.max(vue.height, Math.min(hauteur || vue.height, hauteurMax)) : vue.height;
  return page.screenshot({ type: 'jpeg', quality: 58, fullPage: pleinePage, clip: { x: 0, y: 0, width: vue.width, height: h }, animations: 'disabled', timeout: 20_000 });
}

/**
 * Visite un site : accueil (ordinateur et téléphone) puis jusqu'à `interieures` pages intérieures.
 * Renvoie { url, titre, releve, captures: [{ nom, buffer, page }], pages: [{ url, titre }] }.
 * Un navigateur neuf par site : l'appelant le ferme ensuite. Les contextes ne sont jamais fermés
 * un par un (avec le Chromium en ligne, en « single-process », fermer un contexte ferme tout).
 */
export async function visiterSite(browser, url, { interieures = 2 } = {}) {
  const sure = gardien();
  if (!(await sure(url))) throw new VisiteError('Adresse refusée (réseau privé ou adresse invalide).', 'refuse');
  const origine = new URL(url).origin;
  const robots = await lireRobots(origine, sure);
  if (!robotsPermet(robots, new URL(url).pathname || '/')) throw new VisiteError('Le site demande aux robots de ne pas le visiter (robots.txt) : il est laissé de côté.', 'robots');

  const captures = [];
  const pages = [];
  const bureau = await contexte(browser, {}, sure);
  let final = url;
  let rel;
  try {
    const page = await bureau.newPage();
    await ouvrir(page, url);
    final = page.url();
    if (!(await sure(final))) throw new VisiteError('Adresse refusée après redirection.', 'refuse');
    await bannieres(page);
    await defiler(page, HAUT_BUREAU);
    rel = await page.evaluate(releve);
    rel.couleurs = (rel.couleurs || []).map(enHex).filter(Boolean);
    captures.push({ nom: 'ecran', buffer: await capture(page, 900, { pleinePage: false }), page: final });
    captures.push({ nom: 'accueil', buffer: await capture(page, HAUT_BUREAU), page: final });
    pages.push({ url: final, titre: rel.titre });

    // Pages intérieures (même site, autorisées par robots.txt)
    let n = 0;
    for (const p of pagesInterieures(rel.liensInternes, final, interieures + 2)) {
      if (n >= interieures) break;
      if (!robotsPermet(robots, new URL(p.url).pathname)) continue;
      try {
        await ouvrir(page, p.url);
        await bannieres(page);
        await defiler(page, HAUT_INTERIEURE);
        const titre = await page.title().catch(() => p.titre);
        n++;
        captures.push({ nom: `page-${n}`, buffer: await capture(page, HAUT_INTERIEURE), page: page.url() });
        pages.push({ url: page.url(), titre: String(titre || p.titre).slice(0, 160) });
      } catch {
        // Une page intérieure qui ne s'ouvre pas n'empêche pas l'analyse du site
      }
    }
  } finally {
    await bureau.clearCookies().catch(() => {});
  }

  // Même accueil sur téléphone
  const mobile = await contexte(browser, { mobile: true }, sure);
  try {
    const page = await mobile.newPage();
    await ouvrir(page, final);
    await bannieres(page);
    await defiler(page, HAUT_MOBILE);
    captures.push({ nom: 'mobile', buffer: await capture(page, HAUT_MOBILE), page: page.url() });
  } catch {
    // Sans capture téléphone, la fiche reste utile
  }
  delete rel.liensInternes;
  return { url: final, titre: rel.titre, releve: rel, captures, pages };
}
