// Moteur de rendu : transforme (brief + contenus + modèle) en pages HTML complètes.
import { ARCHETYPES, ARCHETYPE_MAP } from './archetypes.js';
import { COMPOSITIONS, DECO_SHAPES, DIVIDER_PATHS } from './compositions.js';
import { flavorOf, applyFlavor, applyFlavorComp } from './flavors.js';
import { BASE_CSS, ESPACE_CSS, MISE_CSS } from './css.js';
import { miseValide, modulesDeTrame, HEROS_MISE, herosDuStyle } from './trames.js';
import { art } from './art.js';
import { icon } from './icons.js';
import { esc, rng, pick, formatPrice, priceNumber, slugify, lines, hashString } from './util.js';
import { distributeur, imageUtilisable, memeService } from './placement.js';
import { mix, onColor, ensureContrast, isHex, luminance, alpha } from './color.js';
import { aujourdhui, jourValide, decaler, jourTexte, fenetreAnnonce, dansFenetre, texteAnnonce, iconeDe, iconeSvg, feteParId, motifUrl } from './espace.js';
import { accueilEdite, accueilLie, photosImposees, heroValide, nomModule, blocsDePage } from './edition.js';

const SERIF_FONTS = ['Fraunces', 'Cormorant Garamond', 'Young Serif', 'Lora', 'Alfa Slab One', 'Marcellus', 'Shippori Mincho', 'Playfair Display', 'Source Serif 4', 'Instrument Serif', 'Libre Caslon Display', 'Libre Caslon Text', 'Bodoni Moda', 'Cinzel', 'DM Serif Display', 'Alegreya', 'Zilla Slab', 'Gilda Display', 'EB Garamond', 'Libre Baskerville', 'Abril Fatface', 'Limelight', 'Prata', 'Italiana'];
const LIGHT_ART = ['serif', 'soft', 'grid', 'leaf', 'blob', 'arch', 'confetti', 'sunset'];

// ---------- Modèle & thème ----------

export function resolveModel(model) {
  const baseArch = ARCHETYPE_MAP[model.archetype] || ARCHETYPES[0];
  const baseComp = COMPOSITIONS[baseArch.id] || COMPOSITIONS.epure;
  // Déclinaison (versions 2 à 4) : polices, palettes, formes et compositions propres
  const flavor = model.flavor ? flavorOf(baseArch.id, model.flavor) : null;
  const arch = flavor ? applyFlavor(baseArch, flavor) : baseArch;
  const comp = flavor ? applyFlavorComp(baseComp, flavor) : baseComp;
  const seed = Number(model.seed) || 0;
  const rand = rng(seed * 131 + arch.id.length * 7 + 3);
  const choose = (list) => (seed === 0 ? list[0] : pick(list, rand));
  const variants = {};
  // Mise en page propre à ce modèle dans sa génération (trames.js) ; absente sur les sites d'avant
  const mise = miseValide(model.mise) ? model.mise : null;
  const pools = { ...arch.variants, hero: mise ? herosDuStyle(arch.id, comp.heroes) : comp.heroes };
  for (const [k, list] of Object.entries(pools)) variants[k] = model.variants?.[k] || (k === 'hero' && mise?.hero && list.includes(mise.hero) ? mise.hero : choose(list));
  // Recette : l'enchaînement des sections de la page d'accueil
  let tokens;
  let recipeIndex = 0;
  if (mise) {
    tokens = modulesDeTrame(mise.trame, comp, choose);
    variants.trame = mise.trame;
  } else {
    recipeIndex = seed === 0 ? 0 : Math.floor(rand() * comp.recipes.length) % comp.recipes.length;
    tokens = comp.recipes[recipeIndex].map((tok) => {
      const [name, pool] = tok.split(':');
      return { name, v: pool ? choose(pool.split('|')) : '' };
    });
  }
  variants.recipe = recipeIndex;
  variants.sections = tokens.map((x) => x.name + (x.v ? ':' + x.v : '')).join(',');
  const offerTok = tokens.find((x) => x.name === 'offer');
  const offerVariant = offerTok?.v || variants.services;
  const paletteIndex = Number.isInteger(model.paletteIndex) ? model.paletteIndex : seed % arch.palettes.length;
  return { ...model, seed, arch, comp, flavor, variants, tokens, offerVariant, paletteIndex, mise };
}

export function computeTheme(arch, paletteIndex, brandColor) {
  const p = { ...arch.palettes[paletteIndex % arch.palettes.length] };
  const brand = String(brandColor || '').trim();
  if (isHex(brand)) p.primary = brand.startsWith('#') ? brand : '#' + brand;
  const dark = luminance(p.bg) < 0.2;
  const t = {
    ...p,
    dark,
    third: p.third || mix(p.primary, p.accent, 0.5),
    onPrimary: onColor(p.primary),
    onAccent: onColor(p.accent),
    primaryInk: ensureContrast(p.primary, p.bg, 4.5),
    primarySoft: mix(p.primary, p.bg, dark ? 0.78 : 0.86),
    accentSoft: mix(p.accent, p.bg, 0.8),
    primaryDeep: mix(p.primary, '#000000', 0.32),
    line: p.text,
    lineSoft: mix(p.text, p.bg, dark ? 0.76 : 0.84),
  };
  switch (arch.footerMode) {
    case 'surface':
      t.footerBg = p.surface;
      t.footerText = p.text;
      break;
    case 'deep':
      t.footerBg = dark ? mix(p.bg, '#000000', 0.4) : mix(p.text, '#000000', 0.15);
      t.footerText = dark ? p.text : p.bg;
      break;
    case 'primary':
      t.footerBg = mix(p.primary, '#000000', 0.45);
      t.footerText = '#F7F7F2';
      break;
    case 'primary-deep':
      t.footerBg = mix(p.primary, '#000000', 0.55);
      t.footerText = '#FFFFFF';
      break;
    default:
      t.footerBg = p.text;
      t.footerText = p.bg;
  }
  t.footerLine = alpha(t.footerText, 0.2);
  return t;
}

function fontStack(f) {
  if (!f) return null;
  return `'${f.name}', ${SERIF_FONTS.includes(f.name) ? 'Georgia, "Times New Roman", serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif'}`;
}

export function fontsHref(arch) {
  const fams = [arch.fonts.display, arch.fonts.body].filter(Boolean);
  return 'https://fonts.googleapis.com/css2?' + fams.map((f) => 'family=' + f.spec).join('&') + '&display=swap';
}

function cssVars(arch, t) {
  const k = arch.tokens;
  const display = fontStack(arch.fonts.display);
  const body = fontStack(arch.fonts.body) || display;
  const r = parseInt(k.radius, 10) || 0;
  return `:root{--bg:${t.bg};--surface:${t.surface};--text:${t.text};--muted:${t.muted};--primary:${t.primary};--on-primary:${t.onPrimary};--primary-ink:${t.primaryInk};--primary-soft:${t.primarySoft};--primary-deep:${t.primaryDeep};--accent:${t.accent};--on-accent:${t.onAccent};--accent-soft:${t.accentSoft};--third:${t.third};--line:${t.line};--line-soft:${t.lineSoft};--footer-bg:${t.footerBg};--footer-text:${t.footerText};--footer-line:${t.footerLine};--header-bg:${t.bg};--radius:${k.radius};--radius-lg:${k.radiusLg};--radius-sm:${r > 10 ? '10px' : k.radius};--btn-radius:${k.btnRadius};--icon-radius:${k.iconRadius};--font-display:${display};--font-body:${body};--display-weight:${k.displayWeight};--display-tracking:${k.tracking};--display-case:${k.case};--display-lh:${k.lh};--h1:${k.h1};--h1-big:${k.h1Big};--h1-page:clamp(2.3rem,4.8vw,4.2rem);--h2:clamp(1.85rem,3.4vw,3rem);--body-size:${k.bodySize};--section-pad:${k.sectionPad};--max:1200px;color-scheme:${t.dark ? 'dark' : 'light'}}`;
}

// ---------- Pages ----------

export function servicesLabel(brief) {
  if (['restaurant', 'boulangerie'].includes(brief.sector)) return 'La carte';
  if (['beaute', 'sante'].includes(brief.sector)) return 'Prestations';
  return 'Services';
}

export function sitePages(brief, content) {
  const out = [{ slug: 'index', label: 'Accueil' }];
  if ((brief.pages || []).includes('services') && content.services?.length) out.push({ slug: 'services', label: servicesLabel(brief) });
  if (brief.siteType === 'boutique') out.push({ slug: 'boutique', label: 'Boutique' });
  if ((brief.pages || []).includes('apropos')) out.push({ slug: 'a-propos', label: 'À propos' });
  if ((brief.pages || []).includes('faq') && content.faq?.length) out.push({ slug: 'faq', label: 'FAQ' });
  out.push({ slug: 'contact', label: 'Contact' });
  return out;
}

function telHref(phone) {
  return 'tel:' + String(phone || '').replace(/[^\d+]/g, '');
}

function mapsHref(address) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
}

function parseReviews(text) {
  return lines(text)
    .map((l) => {
      const m = l.match(/^(.*?)[\s]*[—–-]\s*([^—–-]{2,40})$/);
      if (m && m[1].length > 8) return { text: m[1].replace(/^["«“\s]+|["»”\s]+$/g, ''), author: m[2].trim() };
      return { text: l.replace(/^["«“\s]+|["»”\s]+$/g, ''), author: '' };
    })
    .slice(0, 6);
}

// ---------- Contexte de rendu ----------

// La page affiche-t-elle une image à côté de chaque service ? (les photos d'un service lui sont alors gardées)
const VARIANTES_IMAGEES = new Set(['alternate', 'cards']);
function servicesIllustres(m, brief, content, page) {
  if (!(content.services || []).length) return false;
  const shop = brief.siteType === 'boutique';
  if (page === 'services') return VARIANTES_IMAGEES.has(shop ? m.variants?.services : m.offerVariant);
  if (page !== 'index' && page) return false;
  const t = (m.tokens || []).find((x) => x.name === (shop ? 'offer2' : 'offer'));
  return Boolean(t) && VARIANTES_IMAGEES.has(shop ? m.variants?.services : t.v || m.variants?.services);
}

function makeCtx({ brief, content, model, images, mode, page, imageSize, jour, editeur }) {
  const m = resolveModel(model);
  const arch = m.arch;
  const t = computeTheme(arch, m.paletteIndex, brief.color);
  const pages = sitePages(brief, content);
  const has = (slug) => pages.some((p) => p.slug === slug);
  const link = (slug) => (mode === 'export' ? `href="${slug}.html"` : `href="#${slug}" data-page="${slug}"`);
  const toutes = Array.isArray(images) ? images.filter((i) => i && i.url) : [];
  // Images « placées par rôle » : photos du client analysées par l'IA, images IA décrites.
  // Les photos écartées (floues, captures, logo…) ne vont pas dans le site.
  const parRoles = toutes.some((i) => i.role || i.choix || i.utilisable === false);
  const imgs = parRoles ? toutes.filter(imageUtilisable) : toutes;
  const n = imgs.length;
  let take;
  if (parRoles) {
    // Chaque emplacement (haut de page, service, à propos, galerie…) prend l'image qui lui va le mieux
    const choisir = distributeur(imgs, { graine: arch.id, avecServices: servicesIllustres(m, brief, content, page) });
    take = (k, kind = 'page', opts = {}) => {
      const eviter = new Set();
      return Array.from({ length: k }, () => {
        const i = choisir(kind, { ...opts, eviter });
        eviter.add(i);
        return i;
      });
    };
  } else {
    // Dossiers d'avant : chaque emplacement reçoit l'image suivante.
    // Sans photo du client, chaque style démarre sur une image différente.
    let ptr = n && imgs[0].source !== 'client' ? hashString(arch.id) % n : 0;
    take = (k) => Array.from({ length: k }, () => ptr++);
  }
  // Photos imposées depuis l'éditeur : l'emplacement en cours les prend d'abord, dans l'ordre choisi
  let imposees = [];
  if (content?.edition?.photos) {
    const parId = new Map(imgs.map((im, i) => [im.id, i]));
    const auto = take;
    take = (k, kind, opts) => {
      if (!imposees.length) return auto(k, kind, opts);
      const out = imposees.splice(0, k);
      return out.length < k ? [...out, ...auto(k - out.length, kind, opts)] : out;
    };
    take.imposer = (ids) => {
      imposees = (ids || []).map((id) => parId.get(id)).filter((i) => i !== undefined);
    };
  }
  const imposer = (ids) => take.imposer?.(ids);
  const takeDistinct = (k, kind) => take(n ? Math.min(k, n) : k, kind);

  const imgAt = (slot) => (n ? imgs[((slot % n) + n) % n] : null);
  const visualInner = (slot, artOpts = {}) => {
    const img = imgAt(slot);
    if (img) {
      const src = mode === 'export' ? img.file || img.url : imageSize === 'thumb' ? img.thumb || img.url : img.url;
      return `<img src="${esc(src)}" alt="${esc(img.alt || '')}" loading="lazy">`;
    }
    return art(arch.art, t, (m.seed + 1) * 97 + slot * 13, artOpts);
  };
  const visual = (cls, slot, artOpts) => `<div class="visual ${cls}">${visualInner(slot ?? take(1)[0], artOpts)}</div>`;

  const name = content.brand?.name || brief.businessName || 'Votre entreprise';
  const accueil = page === 'index' || !page ? accueilEdite(content, model) : null;
  const lie = accueilLie(content, model);
  return { brief, content, m, arch, t, pages, has, link, visual, visualInner, imgAt, take, takeDistinct, imposer, accueil, lie, editeur: editeur || null, mode, page, name, imgs, jour: jourValide(jour) ? jour : aujourdhui() };
}

// Éditeur : repère chaque section dans l'aperçu (clic pour la choisir) ; rien de tout ça dans le site publié
function marquer(ctx, id, nom, html) {
  if (!ctx.editeur || !html || !id) return html;
  const choisi = ctx.editeur.choisi === id ? ' data-ed-choisi' : '';
  return html.replace(/^\s*<([a-z]+)/i, (m0, tag) => `<${tag} data-ed="${esc(id)}" data-ed-nom="${esc(nom)}"${choisi}`);
}
// Textes du haut de page propres au site (éditeur)
const heroEdite = (ctx) => ctx.content?.edition?.hero || {};

function primaryCta(ctx) {
  const { brief, m, link, has } = ctx;
  const features = brief.features || [];
  let label = 'Nous contacter';
  let href = link('contact');
  // L'objectif principal passe avant les fonctionnalités cochées
  if (brief.goal === 'vente' && has('boutique')) {
    label = 'Voir la boutique';
    href = link('boutique');
  } else if (brief.goal === 'reservation') {
    label = 'Réserver';
  } else if (brief.goal === 'appel' && brief.phone) {
    label = 'Nous appeler';
    href = `href="${telHref(brief.phone)}"`;
  } else if (features.includes('reservation')) {
    label = 'Réserver';
  } else if (features.includes('devis')) {
    label = 'Demander un devis';
  }
  if (m.cta && String(m.cta).trim().length > 1) label = String(m.cta).trim();
  const impose = String(heroEdite(ctx).bouton || '').trim();
  if (impose) label = impose;
  return { label, href };
}

function secondaryCta(ctx) {
  const { link, has, brief } = ctx;
  if (has('boutique') && brief.goal !== 'vente') return { label: 'Voir la boutique', href: link('boutique') };
  if (has('services')) return { label: ctx.brief.sector === 'restaurant' || ctx.brief.sector === 'boulangerie' ? 'Voir la carte' : 'Nos ' + servicesLabel(brief).toLowerCase(), href: link('services') };
  if (has('a-propos')) return { label: 'Qui sommes-nous', href: link('a-propos') };
  return null;
}

function sectionHead(title, intro, center) {
  if (!title && !intro) return '';
  return `<div class="section-head${center ? ' center' : ''}">${title ? `<h2>${esc(title)}</h2>` : ''}${intro ? `<p>${esc(intro)}</p>` : ''}</div>`;
}

// Texte saisi sur plusieurs lignes (horaires) : retours à la ligne conservés
const multi = (s) => esc(String(s || '').trim()).replace(/\n/g, '<br>');

// ---------- Contenus datés (espace client) ----------
// Bloc visible seulement sur une période : rendu pour le jour de publication, puis
// rallumé ou éteint chaque jour par le script du site (le site reste statique).
function periode(ctx, f, html, tag = 'span', cls = '') {
  const on = dansFenetre(f, ctx.jour);
  const attrs = f.plages ? ` data-ss-plages="${f.plages.map((p) => p.join(':')).join(',')}"` : ` data-ss-du="${f.du}" data-ss-au="${f.au}"${f.annuel ? ' data-ss-annuel' : ''}`;
  return `<${tag}${cls ? ` class="${cls}"` : ''}${attrs}${on ? '' : ' hidden'}>${html}</${tag}>`;
}
const pendant = (fin) => ({ du: '2000-01-01', au: fin });
const apres = (fin) => ({ du: decaler(fin, 1), au: '2100-12-31' });
const enOffre = (it) => it?.statut === 'offre' && jourValide(it.offreFin) && priceNumber(it.offrePrix) > 0;

// Prix d'un service : prix barré et prix de l'offre jusqu'à la date de fin, puis prix habituel
function prixService(ctx, s) {
  const normal = formatPrice(s.price);
  if (!enOffre(s)) return normal ? esc(normal) : '';
  const promo = `${normal ? `<s class="ss-avant">${esc(normal)}</s> ` : ''}<span class="ss-promo">${esc(formatPrice(s.offrePrix))}</span>`;
  return periode(ctx, pendant(s.offreFin), promo) + (normal ? periode(ctx, apres(s.offreFin), esc(normal)) : '');
}

function tagService(ctx, s) {
  if (s.statut === 'indispo') return '<span class="ss-tag">Momentanément indisponible</span>';
  if (enOffre(s)) return periode(ctx, pendant(s.offreFin), `Offre jusqu’au ${esc(jourTexte(s.offreFin))}`, 'span', 'ss-tag ss-tag-offre');
  return '';
}
const classeService = (s) => (s.statut === 'indispo' ? ' ss-indispo' : '');

// Bandeaux d'annonces en haut de chaque page : fermetures, informations, fêtes
function annoncesBar(ctx) {
  const list = (ctx.content.annonces || []).filter((a) => a && jourValide(a.du) && jourValide(a.au) && String(texteAnnonce(a)).trim());
  if (!list.length) return '';
  const ordre = { fermeture: 0, info: 1, fete: 2 };
  const items = [...list]
    .sort((a, b) => (ordre[a.type] ?? 1) - (ordre[b.type] ?? 1))
    .map((a) => {
      const fete = a.type === 'fete' ? feteParId(a.fete) : null;
      const ico = `<span class="ss-ico">${iconeSvg(iconeDe(a), 20)}</span>`;
      const inner = `<div class="wrap">${ico}<p>${esc(texteAnnonce(a))}</p>${fete ? ico : ''}</div>`;
      return periode(ctx, fenetreAnnonce(a, ctx.jour), inner, 'div', `ss-annonce ss-${a.type === 'fermeture' ? 'fermeture' : a.type === 'fete' ? 'fete' : 'info'}${fete ? ' ss-f-' + fete.id : ''}`);
    });
  return `<div class="ss-annonces">${items.join('')}</div>`;
}

// Couleurs et motif des fêtes utilisées sur ce site
function annoncesCss(ctx) {
  const ids = [...new Set((ctx.content.annonces || []).filter((a) => a?.type === 'fete').map((a) => a.fete))];
  return ids
    .map(feteParId)
    .filter(Boolean)
    .map((f) => `.ss-f-${f.id}{--ss-band:${f.c.band};--ss-fg:${f.c.fg};--ss-motif:${motifUrl(f)}}`)
    .join('');
}

// ---------- Blocs ----------

function header(ctx) {
  const { m, arch, brief, pages, link, page, name, mode } = ctx;
  const v = m.variants.nav;
  const cta = primaryCta(ctx);
  const linksHtml = pages
    .filter((p) => p.slug !== 'index')
    .map((p) => `<li><a ${link(p.slug)}${p.slug === page ? ' aria-current="page"' : ''}>${esc(p.label)}</a></li>`)
    .join('');
  const logoSrc = mode === 'export' ? brief.logoFile : brief.logoUrl;
  const logo = logoSrc ? `<a class="logo logo-img" ${link('index')}><img src="${esc(logoSrc)}" alt="${esc(name)}"></a>` : `<a class="logo" ${link('index')}>${esc(name)}</a>`;
  const burger = `<button class="burger" type="button" aria-label="Ouvrir le menu" aria-expanded="false" data-burger>${icon('menu', { size: 22 })}</button>`;
  const ctaBtn = `<a class="btn small" ${cta.href}>${esc(cta.label)}</a>`;
  let inner;
  if (v === 'split') inner = `<ul class="nav-links">${linksHtml}</ul>${logo}<div class="nav-actions">${ctaBtn}${burger}</div>`;
  else if (v === 'center') inner = `${logo}<ul class="nav-links">${linksHtml}</ul><div class="nav-actions">${burger}</div>`;
  else inner = `${logo}<ul class="nav-links">${linksHtml}</ul><div class="nav-actions">${ctaBtn}${burger}</div>`;
  const mobile = `<div class="mobile-menu">${pages.map((p) => `<a ${link(p.slug)}>${esc(p.label)}</a>`).join('')}<a class="btn" ${cta.href}>${esc(cta.label)}</a></div>`;
  let topbar = '';
  if (arch.topbar && (brief.phone || brief.email)) {
    topbar = `<div class="topbar"><div class="wrap">${brief.phone ? `<a href="${telHref(brief.phone)}">${icon('phone', { size: 15 })}${esc(brief.phone)}</a>` : ''}${brief.email ? `<a href="mailto:${esc(brief.email)}">${icon('mail', { size: 15 })}${esc(brief.email)}</a>` : ''}</div></div>`;
  }
  return `${topbar}<header class="site-header" data-header><div class="wrap"><nav class="nav" aria-label="Navigation principale">${inner}</nav></div>${mobile}</header>`;
}

// ---------- Décor : formes dessinées et séparateurs ----------

function deco(ctx, where) {
  // Hors du héros, seuls les coins droits sont décorés pour ne jamais gêner les titres
  const list = (ctx.m.comp.deco || []).filter(([, pos]) => where === 'hero' || pos === 'tr' || pos === 'br');
  if (!list.length) return '';
  return `<div class="deco-layer deco-${where}" aria-hidden="true">${list
    .map(([shape, pos]) => `<span class="deco d-${shape} p-${pos}">${DECO_SHAPES[shape] || ''}</span>`)
    .join('')}</div>`;
}

const BG_VAR = { bg: 'var(--bg)', surface: 'var(--surface)', primary: 'var(--primary)', footer: 'var(--footer-bg)' };

function divider(kind, from, to) {
  const d = DIVIDER_PATHS[kind];
  if (!d || !BG_VAR[from] || !BG_VAR[to]) return '';
  return `<div class="divider dv-${kind}" aria-hidden="true" style="background:${BG_VAR[from]}"><svg viewBox="0 0 1440 64" preserveAspectRatio="none"><path d="${d}" style="fill:${BG_VAR[to]}"/></svg></div>`;
}

function sec(alt, extra = '') {
  return `section${alt ? ' alt' : ''}${extra ? ' ' + extra : ''}`;
}

// Légende lisible (on ignore les noms de fichiers d'appareil photo)
function caption(img) {
  const a = String(img?.alt || '').trim();
  if (!a || a.length > 90) return '';
  if (/^(img|dsc|pxl|photo|image|wp|screenshot|capture|whatsapp)[\s_-]*\d/i.test(a) || /\d{5,}/.test(a)) return '';
  return a;
}

// ---------- Héros ----------

function hero(ctx, impose) {
  const { m, content: c, visual, visualInner, brief, take } = ctx;
  const v = impose || m.variants.hero;
  const ed = heroEdite(ctx);
  const h = esc(String(ed.titre || '').trim() || m.headline || c.hero?.headline || c.brand?.tagline || ctx.name);
  const sub = esc(String(ed.sous || '').trim() || m.subheadline || c.hero?.subheadline || c.brand?.short || brief.description);
  const cta = primaryCta(ctx);
  const sc = secondaryCta(ctx);
  const actions = `<div class="hero-actions"><a class="btn" ${cta.href}>${esc(cta.label)}</a>${sc ? `<a class="btn ghost" ${sc.href}>${esc(sc.label)}</a>` : ''}</div>`;
  const text = `<h1>${h}</h1><p class="lead">${sub}</p>${actions}`;
  const dc = deco(ctx, 'hero');
  if (HEROS_MISE.includes(v)) return heroTendance(ctx, v, { h, sub, actions, dc });
  switch (v) {
    case 'overlay':
      return `<section class="hero hero-overlay"><div class="hero-bg visual">${visualInner(take(1, 'hero-bg')[0])}</div><div class="wrap hero-inner">${text}</div></section>`;
    case 'cover':
      return `<section class="hero hero-cover"><div class="hero-bg visual">${visualInner(take(1, 'hero-bg')[0])}</div><div class="wrap hero-inner"><h1>${h}</h1><div class="cover-foot"><p class="lead">${sub}</p>${actions}</div></div></section>`;
    case 'panel':
      return `<section class="hero hero-panel"><div class="hero-bg visual">${visualInner(take(1, 'hero-bg')[0])}</div><div class="wrap hero-inner"><div class="panel">${text}</div></div></section>`;
    case 'bigtype':
      return `<section class="hero hero-bigtype">${dc}<div class="wrap hero-inner"><h1>${h}</h1><div class="hero-row"><p class="lead">${sub}</p>${actions}</div>${visual('hero-visual', take(1, 'hero')[0])}</div></section>`;
    case 'centered':
      return `<section class="hero hero-centered">${dc}<div class="wrap"><div class="hero-inner">${text}</div>${visual('hero-visual', take(1, 'hero')[0])}</div></section>`;
    case 'framed':
      return `<section class="hero hero-framed">${dc}<div class="wrap hero-inner"><div class="frame">${visual('hero-visual', take(1, 'hero')[0])}</div><div>${text}</div></div></section>`;
    case 'mosaic': {
      const s = take(3, 'mosaic');
      return `<section class="hero hero-mosaic">${dc}<div class="wrap hero-inner"><div>${text}</div><div class="mosaic">${visual('', s[0])}${visual('', s[1])}${visual('', s[2])}</div></div></section>`;
    }
    case 'collage': {
      const s = take(3, 'mosaic');
      return `<section class="hero hero-collage">${dc}<div class="wrap hero-inner"><div>${text}</div><div class="collage">${visual('c1', s[0])}${visual('c2', s[1])}${visual('c3', s[2])}</div></div></section>`;
    }
    case 'split':
    default:
      return `<section class="hero hero-split">${dc}<div class="wrap hero-inner"><div>${text}</div>${visual('hero-visual', take(1, 'hero')[0])}</div></section>`;
  }
}

function heroBg(v) {
  return ['overlay', 'cover', 'panel', 'pied', 'diptyque', 'affiche'].includes(v) ? 'image' : 'bg';
}

// Mot géant calé exactement sur la largeur (nom en bandeau, en pied, en contour…) : texte SVG dont
// la longueur est imposée, quelle que soit la police du style. Décoratif : le nom est aussi dans l'en-tête.
function motGeant(texte, classe = '') {
  const mot = String(texte || '').trim().toLocaleUpperCase('fr');
  if (!mot) return '';
  const fs = Math.round(1000 / (Math.max(3, mot.length) * 0.62));
  const h = Math.round(fs * 0.9);
  return `<svg class="mot-geant ${classe}" viewBox="0 0 1000 ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><text x="0" y="${Math.round(fs * 0.8)}" textLength="1000" lengthAdjust="spacingAndGlyphs" style="font-size:${fs}px">${esc(mot)}</text></svg>`;
}

// Hauts de page inspirés de sites tendance (bandeau-titre, nom en deux, capsule, diptyque, nom en
// pied, objet seul, arche, affiche). Réservés aux modèles générés avec une mise en page.
function heroTendance(ctx, v, { h, sub, actions, dc }) {
  const { take, visual, visualInner, name } = ctx;
  const nom = esc(name);
  switch (v) {
    case 'masthead':
      return `<section class="hero hero-masthead">${dc}<div class="wrap">${motGeant(name, 'mast-nom')}<div class="mast-ligne"><h1>${h}</h1><div><p class="lead">${sub}</p>${actions}</div></div>${visual('mast-visual', take(1, 'hero')[0])}</div></section>`;
    case 'scinde': {
      const mots = String(name).split(/\s+/).filter(Boolean);
      const coupe = Math.max(1, Math.ceil(mots.length / 2));
      const [a, b] = mots.length > 1 ? [mots.slice(0, coupe).join(' '), mots.slice(coupe).join(' ')] : [name, ''];
      return `<section class="hero hero-scinde">${dc}<div class="wrap">${motGeant(a, 'sc-mot sc-a')}<div class="sc-milieu">${visual('sc-visual', take(1, 'hero')[0])}<div class="sc-texte"><h1>${h}</h1><p class="lead">${sub}</p>${actions}</div></div>${b ? motGeant(b, 'sc-mot sc-b') : ''}</div></section>`;
    }
    case 'capsule':
      return `<section class="hero hero-capsule">${dc}<div class="wrap"><div class="capsule"><div class="capsule-img visual">${visualInner(take(1, 'hero-bg')[0])}</div><div class="capsule-txt"><span class="orn" aria-hidden="true">• • • • • •</span><h1>${h}</h1><span class="orn" aria-hidden="true">• • • • • •</span></div></div><div class="capsule-pied"><p class="lead">${sub}</p>${actions}</div></div></section>`;
    case 'diptyque': {
      const s = take(2, 'duo');
      return `<section class="hero hero-diptyque"><div class="dip-img visual">${visualInner(s[0])}</div><div class="dip-img visual">${visualInner(s[1])}</div><div class="dip-carte"><p class="dip-nom">${nom}</p><h1>${h}</h1><p class="lead">${sub}</p>${actions}</div></section>`;
    }
    case 'pied':
      return `<section class="hero hero-pied"><div class="hero-bg visual">${visualInner(take(1, 'hero-bg')[0])}</div><div class="wrap hero-inner"><div class="pied-haut"><h1>${h}</h1><div><p class="lead">${sub}</p>${actions}</div></div>${motGeant(name, 'pied-nom')}</div></section>`;
    case 'objet':
      return `<section class="hero hero-objet">${dc}<div class="wrap"><p class="objet-nom">${nom}</p>${visual('objet-visual', take(1, 'hero')[0])}<div class="objet-texte"><h1>${h}</h1><p class="lead">${sub}</p>${actions}</div></div></section>`;
    case 'arche':
      return `<section class="hero hero-arche">${dc}<div class="wrap hero-inner"><div><h1>${h}</h1><p class="lead">${sub}</p>${actions}</div><div class="arche">${visual('arche-visual', take(1, 'hero')[0])}<span class="arche-sceau" aria-hidden="true">${nom}</span></div></div></section>`;
    case 'affiche': {
      // Tous les mots du titre restent : un titre long passe simplement un cran plus petit
      const mots = String(h).replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean);
      const lignes = mots.map((m, i) => (i % 3 === 2 ? `<span class="contour">${m}</span>` : m)).join(' ');
      return `<section class="hero hero-affiche"><div class="wrap"><h1 class="affiche-titre${mots.length > 8 ? ' affiche-long' : ''}">${lignes}</h1><div class="affiche-bas"><div><p class="lead">${sub}</p>${actions}</div>${visual('affiche-visual', take(1, 'hero')[0])}</div></div></section>`;
    }
    default:
      return '';
  }
}

function marquee(ctx) {
  const { content: c, name } = ctx;
  const words = [name, ...(c.highlights || []).map((h) => h.title)].filter(Boolean).slice(0, 4);
  const set = words.map((w) => `<span>${esc(w)}</span>`).join('');
  return `<div class="marquee" aria-hidden="true"><div class="marquee-track">${set}${set}${set}${set}</div></div>`;
}

// ---------- Sections de contenu ----------

function statement(ctx, alt, v = 'left') {
  const c = ctx.content;
  const text = c.statement || c.about?.quote || c.brand?.short;
  if (!text) return '';
  return `<section class="${sec(alt, `statement statement-${v}`)}">${deco(ctx, 'statement')}<div class="wrap"><p class="statement-text">${esc(text)}</p></div></section>`;
}

function highlights(ctx, alt, v) {
  const { m, content: c } = ctx;
  const items = (c.highlights || []).slice(0, 4);
  if (!items.length) return '';
  v = v || m.variants.features;
  const card = (it, extra = '') => `<article class="feature${extra}"><div class="f-icon">${icon(it.icon, { size: v === 'lined' ? 30 : 24 })}</div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></article>`;
  const head = sectionHead(c.highlightsTitle || 'Ce qui fait la différence', c.highlightsIntro, v === 'icons');
  if (v === 'bento') {
    const cells = items.map((it) => card(it, ' bento-card'));
    while (cells.length < 4) cells.push(`<div class="bento-card bento-accent"><p>${esc(c.brand?.tagline || ctx.name)}</p></div>`);
    return `<section class="${sec(alt)}"><div class="wrap">${head}<div class="bento">${cells[0]}${ctx.visual('bento-img', ctx.take(1, 'bento')[0])}${cells[1]}${cells[2]}${cells[3]}</div></div></section>`;
  }
  return `<section class="${sec(alt, `feat-${v}`)}"><div class="wrap">${head}<div class="features">${items.map((it) => card(it)).join('')}</div></div></section>`;
}

// Images des services : d'abord ceux qui ont leur propre photo, puis les autres
function slotsServices(ctx, items) {
  const slots = new Array(items.length);
  items.forEach((s, i) => {
    if (ctx.imgs.some((img) => memeService(img, s))) slots[i] = ctx.take(1, 'service', { service: s.name })[0];
  });
  items.forEach((s, i) => {
    if (slots[i] === undefined) slots[i] = ctx.take(1, 'service', { service: s.name })[0];
  });
  return slots;
}

function servicesList(ctx, items, v) {
  const { visual } = ctx;
  if (v === 'menu') {
    return `<div class="svc-menu">${items
      .map((s) => {
        const price = prixService(ctx, s);
        return `<div class="menu-row${classeService(s)}"><div class="menu-head"><h3>${esc(s.name)}</h3>${price ? `<span class="menu-dots"></span><span class="menu-price">${price}</span>` : ''}</div>${tagService(ctx, s)}${s.description ? `<p>${esc(s.description)}</p>` : ''}</div>`;
      })
      .join('')}</div>`;
  }
  if (v === 'alternate') {
    const slots = slotsServices(ctx, items);
    return `<div class="svc-alternate">${items
      .map((s, i) => {
        const price = prixService(ctx, s);
        return `<div class="alt-row${classeService(s)}">${visual('alt-visual', slots[i])}<div><h3>${esc(s.name)}</h3>${tagService(ctx, s)}${s.description ? `<p class="lead">${esc(s.description)}</p>` : ''}${price ? `<p class="price">${price}</p>` : ''}</div></div>`;
      })
      .join('')}</div>`;
  }
  if (v === 'cards') {
    const slots = slotsServices(ctx, items);
    return `<div class="svc-cards n-${items.length}">${items
      .map((s, i) => {
        const price = prixService(ctx, s);
        return `<article class="svc-imgcard${classeService(s)}">${visual('svc-img', slots[i])}<div class="svc-body"><h3>${esc(s.name)}</h3>${tagService(ctx, s)}${s.description ? `<p>${esc(s.description)}</p>` : ''}${price ? `<span class="price">${price}</span>` : ''}</div></article>`;
      })
      .join('')}</div>`;
  }
  return `<div class="svc-grid">${items
    .map((s) => {
      const price = prixService(ctx, s);
      return `<article class="svc-card${classeService(s)}"><div class="f-icon">${icon(s.icon)}</div><h3>${esc(s.name)}</h3>${tagService(ctx, s)}${s.description ? `<p>${esc(s.description)}</p>` : ''}${price ? `<div class="price">${price}</div>` : ''}</article>`;
    })
    .join('')}</div>`;
}

function servicesPreview(ctx, alt, v) {
  const { m, content: c, brief, has, link } = ctx;
  const all = c.services || [];
  if (!all.length) return '';
  v = v || m.variants.services;
  let limit = 6;
  if (v === 'alternate') limit = 3;
  if (v === 'cards') limit = all.length >= 6 ? 6 : all.length >= 3 ? 3 : all.length;
  const items = all.slice(0, limit);
  const more = has('services')
    ? `<div class="more"><a class="link-arrow" ${link('services')}>${all.length > limit ? 'Tout voir' : 'En savoir plus'} ${icon('arrow', { size: 18 })}</a></div>`
    : '';
  if (v === 'index') {
    const lignes = all.slice(0, 8)
      .map((x, i) => `<li class="idx-ligne"><span class="idx-num">${String(i + 1).padStart(2, '0')}</span><span class="idx-nom">${esc(x.name)}</span><span class="idx-info">${esc(String(x.desc || x.description || '').slice(0, 90))}${x.price !== null && x.price !== undefined && x.price !== '' ? `<strong>${esc(formatPrice(x.price))}</strong>` : ''}</span></li>`)
      .join('');
    return `<section class="${sec(alt, 'idx-sec')}"><div class="wrap">${sectionHead(c.servicesTitle || servicesLabel(brief), c.servicesIntro, false)}<ol class="idx-liste">${lignes}</ol>${more}</div></section>`;
  }
  return `<section class="${sec(alt)}"><div class="wrap">${sectionHead(c.servicesTitle || servicesLabel(brief), c.servicesIntro, false)}${servicesList(ctx, items, v)}${more}</div></section>`;
}

// Les produits gardent une illustration neutre : une image d'ambiance ne doit pas passer pour la photo d'un produit
function productCards(ctx, items) {
  const { m, arch, t } = ctx;
  const v = m.variants.products;
  const lightArt = LIGHT_ART.includes(arch.art);
  return `<div class="products${v === 'minimal' ? ' products-minimal' : ''}">${items
    .map((p, i) => {
      const price = priceNumber(p.price);
      const id = p.sid || slugify(p.name) + '-' + i;
      const rupture = p.statut === 'rupture';
      const offre = !rupture && enOffre(p) && price !== null && priceNumber(p.offrePrix) < price;
      const initials = String(p.name || '?')
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
      const pic = art(arch.art, t, (m.seed + 1) * 61 + i * 17, { label: initials, labelColor: lightArt ? t.text : '#ffffff' });
      const badgeNormal = p.badge ? `<span class="badge">${esc(p.badge)}</span>` : '';
      let badge = badgeNormal;
      let prix = price !== null ? esc(formatPrice(price)) : 'Prix sur demande';
      let bouton = price !== null ? `<button class="btn small" type="button" data-add="${esc(id)}" data-name="${esc(p.name)}" data-price="${price}">${icon('plus', { size: 16 })}Ajouter</button>` : '';
      if (rupture) {
        badge = '<span class="badge ss-badge-rupture">Rupture de stock</span>';
        bouton = `<button class="btn small" type="button" disabled data-ss-epuise="${esc(id)}">Épuisé</button>`;
      } else if (offre) {
        const promo = priceNumber(p.offrePrix);
        badge = periode(ctx, pendant(p.offreFin), '<span class="badge ss-badge-offre">Offre</span>') + (badgeNormal ? periode(ctx, apres(p.offreFin), badgeNormal) : '');
        prix = periode(ctx, pendant(p.offreFin), `<s class="ss-avant">${esc(formatPrice(price))}</s> <span class="ss-promo">${esc(formatPrice(promo))}</span>`) + periode(ctx, apres(p.offreFin), esc(formatPrice(price)));
        const prixDuJour = p.offreFin >= ctx.jour ? promo : price;
        bouton = `<button class="btn small" type="button" data-add="${esc(id)}" data-name="${esc(p.name)}" data-price="${prixDuJour}" data-ss-fin="${p.offreFin}" data-ss-prix="${price}" data-ss-offre="${promo}">${icon('plus', { size: 16 })}Ajouter</button>`;
      }
      return `<article class="product${rupture ? ' ss-rupture' : ''}" data-cat="${esc(slugify(p.category || 'tous'))}"><div class="visual p-visual">${badge}${pic}</div><h3>${esc(p.name)}</h3>${p.description ? `<p>${esc(p.description)}</p>` : ''}<div class="p-row"><span class="p-price">${prix}</span>${bouton}</div></article>`;
    })
    .join('')}</div>`;
}

function productsPreview(ctx, alt) {
  const { content: c, link } = ctx;
  const items = (c.products || []).slice(0, 4);
  if (!items.length) return '';
  return `<section class="${sec(alt)}"><div class="wrap">${sectionHead(c.productsTitle || 'Nos produits', c.productsIntro, false)}${productCards(ctx, items)}<div class="more"><a class="link-arrow" ${link('boutique')}>Voir toute la boutique ${icon('arrow', { size: 18 })}</a></div></div></section>`;
}

function aboutTeaser(ctx, alt, v) {
  const { m, content: c, has, link, visual } = ctx;
  const a = c.about || {};
  if (!a.intro && !a.title) return '';
  v = v || m.variants.about;
  const more = has('a-propos') ? `<a class="link-arrow" ${link('a-propos')}>Notre histoire ${icon('arrow', { size: 18 })}</a>` : '';
  if (v === 'quote') {
    return `<section class="${sec(alt)}"><div class="wrap about-quote"><blockquote>${esc(a.quote || a.intro)}</blockquote>${more}</div></section>`;
  }
  return `<section class="${sec(alt)}"><div class="wrap about-split">${visual('about-visual', ctx.take(1, 'about')[0])}<div><h2>${esc(a.title || 'Qui sommes-nous')}</h2><p class="lead">${esc(a.intro)}</p>${more}</div></div></section>`;
}

function gallery(ctx, alt, v = 'grid', { title } = {}) {
  const { imgs, content: c } = ctx;
  if (imgs.length < 3) return '';
  const want = { masonry: 6, grid: 6, strip: 8, polaroid: 5, bento: 4, asym: 5, eventail: 6 }[v] || 6;
  let slots = ctx.takeDistinct(want, 'gallery');
  if (v === 'grid' && slots.length > 3 && slots.length < 6) slots = slots.slice(0, 3);
  const ratios = ['4/5', '1/1', '3/4', '4/3', '1/1', '4/5'];
  const showCap = v === 'polaroid' || v === 'masonry' || v === 'eventail';
  const items = slots
    .map((sl, i) => {
      const cap = showCap ? caption(ctx.imgAt(sl)) : '';
      const style = v === 'masonry' ? ` style="aspect-ratio:${ratios[i % ratios.length]}"` : '';
      return `<figure class="gal-item"><div class="visual"${style}>${ctx.visualInner(sl)}</div>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`;
    })
    .join('');
  const head = sectionHead(title || c.galleryTitle || 'En images', title ? '' : c.galleryIntro, v === 'polaroid');
  return `<section class="${sec(alt, 'gallery-sec')}"><div class="wrap">${head}<div class="gal gal-${v} n-${slots.length}">${items}</div></div></section>`;
}

function band(ctx, v = 'plain') {
  const { content: c } = ctx;
  if (v === 'duo') {
    const s = ctx.take(2, 'duo');
    return `<section class="band band-duo">${ctx.visual('', s[0])}${ctx.visual('', s[1])}</section>`;
  }
  const q = c.about?.quote || c.statement;
  if (v === 'quote' && q) {
    return `<section class="band band-quote"><div class="band-bg visual">${ctx.visualInner(ctx.take(1, 'band')[0])}</div><div class="wrap band-inner"><blockquote>${esc(q)}</blockquote></div></section>`;
  }
  return `<section class="band band-plain">${ctx.visual('', ctx.take(1, 'band')[0])}</section>`;
}

function processBlock(ctx, alt, v = 'line') {
  const p = ctx.content.process;
  const steps = (p?.steps || []).filter((x) => x && x.title).slice(0, 4);
  if (steps.length < 2) return '';
  const head = sectionHead(p.title || 'Comment ça se passe', p.intro, false);
  const list = `<ol class="steps steps-${v === 'image' ? 'stack' : v}">${steps
    .map((st, i) => `<li class="step"><span class="step-num">${i + 1}</span><div><h3>${esc(st.title)}</h3>${st.text ? `<p>${esc(st.text)}</p>` : ''}</div></li>`)
    .join('')}</ol>`;
  if (v === 'image') {
    return `<section class="${sec(alt, 'process-sec')}"><div class="wrap process-image">${ctx.visual('process-visual', ctx.take(1, 'process')[0])}<div>${head}${list}</div></div></section>`;
  }
  return `<section class="${sec(alt, 'process-sec')}">${deco(ctx, 'process')}<div class="wrap">${head}${list}</div></section>`;
}

function reviewsBlock(ctx, alt) {
  const reviews = parseReviews(ctx.brief.reviews);
  if (!reviews.length) return '';
  return `<section class="section${alt ? ' alt' : ''}"><div class="wrap">${sectionHead(ctx.content.reviewsTitle || 'Ils nous font confiance', '', false)}<div class="reviews">${reviews
    .map((r) => `<figure class="review"><blockquote>« ${esc(r.text)} »</blockquote>${r.author ? `<figcaption>${esc(r.author)}</figcaption>` : ''}</figure>`)
    .join('')}</div></div></section>`;
}

function contactLinks(ctx) {
  const { brief } = ctx;
  const out = [];
  if (brief.phone) out.push(`<a href="${telHref(brief.phone)}">${icon('phone', { size: 18 })}${esc(brief.phone)}</a>`);
  if (brief.email) out.push(`<a href="mailto:${esc(brief.email)}">${icon('mail', { size: 18 })}${esc(brief.email)}</a>`);
  if (brief.address) out.push(`<a href="${mapsHref(brief.address)}" target="_blank" rel="noopener">${icon('pin', { size: 18 })}${esc(brief.address)}</a>`);
  return out;
}

function ctaVariant(ctx, v) {
  v = v || ctx.m.variants.cta;
  if (v === 'split' && !contactLinks(ctx).length) v = 'boxed';
  return v;
}

function ctaBlock(ctx, v, alt = false) {
  const { content: c } = ctx;
  const cta = primaryCta(ctx);
  const title = esc(c.ctaBand?.title || 'Parlons de votre projet');
  const text = c.ctaBand?.text ? esc(c.ctaBand.text) : '';
  v = ctaVariant(ctx, v);
  const links = contactLinks(ctx);
  if (v === 'boxed') {
    return `<section class="${sec(alt, 'cta-boxed')}"><div class="wrap"><div class="cta-box"><div><h2>${title}</h2>${text ? `<p>${text}</p>` : ''}</div><a class="btn" ${cta.href}>${esc(cta.label)}</a></div></div></section>`;
  }
  if (v === 'split') {
    return `<section class="${sec(alt, 'cta-split')}"><div class="wrap cta-inner"><div><h2>${title}</h2>${text ? `<p class="lead">${text}</p>` : ''}<a class="btn" ${cta.href}>${esc(cta.label)}</a></div><div class="cta-contact">${links.join('')}</div></div></section>`;
  }
  if (v === 'image') {
    return `<section class="cta-image"><div class="band-bg visual">${ctx.visualInner(ctx.take(1, 'band')[0])}</div><div class="wrap cta-image-inner"><h2>${title}</h2>${text ? `<p>${text}</p>` : ''}<a class="btn" ${cta.href}>${esc(cta.label)}</a></div></section>`;
  }
  return `<section class="cta-band"><div class="wrap"><div><h2>${title}</h2>${text ? `<p>${text}</p>` : ''}</div><a class="btn" ${cta.href}>${esc(cta.label)}</a></div></section>`;
}

function infoStrip(ctx, alt) {
  const { brief } = ctx;
  const items = [];
  if (brief.address) items.push(`<div class="info-item"><div class="f-icon">${icon('pin', { size: 20 })}</div><div><h3>Adresse</h3><a href="${mapsHref(brief.address)}" target="_blank" rel="noopener">${esc(brief.address)}</a></div></div>`);
  if (brief.hours) items.push(`<div class="info-item"><div class="f-icon">${icon('clock', { size: 20 })}</div><div><h3>Horaires</h3><p>${multi(brief.hours)}</p></div></div>`);
  if (brief.phone) items.push(`<div class="info-item"><div class="f-icon">${icon('phone', { size: 20 })}</div><div><h3>Téléphone</h3><a href="${telHref(brief.phone)}">${esc(brief.phone)}</a></div></div>`);
  if (brief.email && items.length < 3) items.push(`<div class="info-item"><div class="f-icon">${icon('mail', { size: 20 })}</div><div><h3>E-mail</h3><a href="mailto:${esc(brief.email)}">${esc(brief.email)}</a></div></div>`);
  if (items.length < 2) return '';
  return `<section class="section${alt ? ' alt' : ''}"><div class="wrap info-strip">${items.join('')}</div></section>`;
}

// Lien externe sûr : http(s) uniquement, « https:// » ajouté s'il manque
function safeHref(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return '';
  return 'https://' + v.replace(/^\/+/, '');
}

function socials(ctx) {
  const { brief } = ctx;
  const out = [];
  const instagram = safeHref(brief.instagram);
  const facebook = safeHref(brief.facebook);
  if (instagram) out.push(`<a href="${esc(instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${icon('instagram', { size: 18 })}</a>`);
  if (facebook) out.push(`<a href="${esc(facebook)}" target="_blank" rel="noopener" aria-label="Facebook">${icon('facebook', { size: 18 })}</a>`);
  return out.length ? `<div class="socials">${out.join('')}</div>` : '';
}

function newsletter(ctx) {
  const { brief } = ctx;
  if (!(brief.features || []).includes('newsletter') || !brief.email) return '';
  return `<form class="newsletter" data-mailto="${esc(brief.email)}" data-subject="Inscription à la newsletter"><label class="skip" for="nl-email">Votre e-mail</label><input id="nl-email" type="email" name="E-mail" placeholder="Votre e-mail" required><button class="btn" type="submit">S’inscrire</button><p class="form-ok" role="status">Merci, votre demande d’inscription est prête à être envoyée.</p></form>`;
}

function footer(ctx) {
  const { m, content: c, pages, link, brief, name, imgs } = ctx;
  const year = new Date().getFullYear();
  const pageLinks = pages.map((p) => `<li><a ${link(p.slug)}>${esc(p.label)}</a></li>`).join('');
  const contact = [
    brief.phone ? `<li><a href="${telHref(brief.phone)}">${esc(brief.phone)}</a></li>` : '',
    brief.email ? `<li><a href="mailto:${esc(brief.email)}">${esc(brief.email)}</a></li>` : '',
    brief.address ? `<li>${esc(brief.address)}</li>` : '',
  ].join('');
  const credits = imgs.some((i) => i.source === 'unsplash') ? ` · Photos : <a href="https://unsplash.com/?utm_source=studio_site&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a>` : '';
  const bottom = `<div class="footer-bottom"><span>© ${year} ${esc(name)}</span><span><a ${link('mentions-legales')}>Mentions légales</a>${credits}</span></div>`;
  const nl = newsletter(ctx);
  if (m.variants.footer === 'big') {
    // Taille calée sur le mot le plus long pour qu'aucun mot ne soit coupé
    const longest = Math.max(4, ...String(name).split(/\s+/).map((w) => w.length));
    const em = ctx.arch.id === 'audacieux' ? 1.2 : ctx.arch.tokens.case === 'uppercase' ? 0.92 : 0.7; // largeur moyenne d'une lettre
    const fs = `min(${Math.min(11, 88 / (longest * em)).toFixed(2)}vw,${Math.min(10, 1100 / (longest * em) / 16).toFixed(2)}rem)`;
    return `<footer class="site-footer footer-big"><div class="wrap"><p class="big-word" style="font-size:${fs}">${esc(name)}</p><div class="footer-row"><ul>${pageLinks}</ul><div>${contact ? `<ul>${contact}</ul>` : ''}${socials(ctx)}${nl}</div></div>${bottom}</div></footer>`;
  }
  const fourth = nl
    ? `<div><h4>Newsletter</h4><p>Les nouveautés, quelques fois par an.</p>${nl}</div>`
    : brief.hours
      ? `<div><h4>Horaires</h4><p>${multi(brief.hours)}</p></div>`
      : '<div></div>';
  return `<footer class="site-footer"><div class="wrap"><div class="footer-cols"><div><a class="logo" ${link('index')}>${esc(name)}</a><p>${esc(c.brand?.tagline || '')}</p>${socials(ctx)}</div><div><h4>Navigation</h4><ul>${pageLinks}</ul></div><div><h4>Contact</h4><ul>${contact || `<li><a ${link('contact')}>Nous écrire</a></li>`}</ul></div>${fourth}</div>${bottom}</div></footer>`;
}

function pageHero(ctx, title, lead) {
  return `<section class="page-hero"><div class="wrap"><h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</div></section>`;
}

function cartUi(ctx) {
  const { brief, name } = ctx;
  return `<button class="btn cart-fab" type="button" data-cart-open>${icon('bag', { size: 18 })}Panier <span class="cart-count" data-cart-count>0</span></button><div class="cart-overlay" data-cart-close></div><aside class="cart-drawer" aria-label="Panier"><div class="cart-head"><h2>Votre panier</h2><button class="icon-btn" type="button" data-cart-close aria-label="Fermer le panier">${icon('close', { size: 22 })}</button></div><div class="cart-body" data-cart-lines></div><form class="cart-foot" data-checkout data-mailto="${esc(brief.email || '')}" data-subject="Nouvelle commande"><div class="cart-total"><span>Total</span><span data-cart-total>0 €</span></div><div class="field"><label for="co-name">Nom</label><input id="co-name" name="Nom" required autocomplete="name"></div><div class="field"><label for="co-email">E-mail</label><input id="co-email" type="email" name="E-mail" required autocomplete="email"></div><div class="field"><label for="co-addr">Adresse de livraison</label><input id="co-addr" name="Adresse" autocomplete="street-address"></div><button class="btn" type="submit">Envoyer ma commande</button><p class="form-note">Votre commande sera envoyée par e-mail à ${esc(name)}, qui vous recontactera pour le paiement et la livraison.</p><p class="form-ok" role="status">Votre commande est prête : votre messagerie va s’ouvrir pour l’envoyer.</p></form></aside>`;
}

// ---------- Modules inspirés de sites tendance ----------
// Une phrase avec de petites photos glissées entre les mots
function motsImages(ctx, alt) {
  const c = ctx.content;
  const texte = String(c.statement || c.about?.quote || c.brand?.tagline || '').trim();
  const mots = texte.split(/\s+/).filter(Boolean);
  if (mots.length < 6 || ctx.imgs.length < 2) return '';
  const s = ctx.take(2, 'mots');
  const pastille = (sl) => `<span class="mi-img visual" aria-hidden="true">${ctx.visualInner(sl)}</span>`;
  const i1 = Math.round(mots.length / 3);
  const i2 = Math.round((mots.length * 2) / 3);
  const html = mots.map((m, i) => (i === i1 ? pastille(s[0]) + ' ' : i === i2 ? pastille(s[1]) + ' ' : '') + esc(m)).join(' ');
  return `<section class="${sec(alt, 'mots-images')}"><div class="wrap"><p class="mi-texte">${html}</p></div></section>`;
}

// Deux portes : deux grandes images côte à côte vers les deux offres principales
function portes(ctx, alt) {
  const { content: c, brief, has, link } = ctx;
  // Deux entrées vers le reste du site (l'offre, l'histoire ou la visite) : la liste détaillée de l'offre
  // suit déjà sur la page, les portes ne la répètent pas
  const sv = (c.services || []).filter((x) => x?.name);
  const offre = {
    titre: c.servicesTitle || servicesLabel(brief),
    texte: sv.length ? sv.slice(0, 3).map((x) => x.name).join(' · ') : c.servicesIntro || '',
    href: has('services') ? link('services') : link('contact'),
  };
  const histoire = c.about?.intro && has('a-propos') ? { titre: c.about?.title || 'Notre histoire', texte: c.about.intro, href: link('a-propos') } : null;
  const visite = { titre: 'Nous rendre visite', texte: [brief.address, brief.hours].filter(Boolean).join(' · '), href: link('contact') };
  const items = [offre, histoire || visite];
  if (ctx.imgs.length < 2) return '';
  const s = ctx.take(2, 'portes');
  return `<section class="${sec(alt, 'portes-sec')}"><div class="wrap portes">${items
    .map((x, i) => `<a class="porte" ${x.href}><span class="porte-img visual">${ctx.visualInner(s[i])}</span><span class="porte-txt"><span class="porte-titre">${esc(x.titre)}</span>${x.texte ? `<span class="porte-texte">${esc(String(x.texte).slice(0, 110))}</span>` : ''}<span class="porte-lien">Découvrir ${icon('arrow', { size: 18 })}</span></span></a>`)
    .join('')}</div></section>`;
}

// Manifeste : bande de la couleur principale, grand texte en capitales
function manifeste(ctx) {
  const c = ctx.content;
  const texte = c.about?.quote || c.statement || c.brand?.tagline;
  if (!texte) return '';
  const intro = c.about?.intro ? `<p class="mf-intro">${esc(String(c.about.intro).slice(0, 320))}</p>` : '';
  return `<section class="manifeste"><div class="wrap"><span class="mf-etiquette">${esc(c.about?.title || 'Notre engagement')}</span><p class="mf-texte">${esc(texte)}</p><span class="mf-orn" aria-hidden="true">✳ ✳ ✳</span>${intro}</div></section>`;
}

// Le nom en très grand, en contour, sur toute la largeur
function grandMot(ctx, alt) {
  const { name, content: c } = ctx;
  return `<section class="${sec(alt, 'grand-mot')}"><div class="wrap">${motGeant(name, 'gm-mot')}${c.brand?.tagline ? `<p class="gm-ligne">${esc(c.brand.tagline)}</p>` : ''}</div></section>`;
}

// ---------- Modules de mise en page : deux blocs côte à côte, sommaire du site ----------
// Chaque demi-bloc est une version compacte d'un module ; s'il manque de quoi le remplir, l'autre
// moitié est affichée seule, en module complet.
function demiBloc(ctx, kind) {
  const { content: c, brief, has, link } = ctx;
  switch (kind) {
    case 'about': {
      const a = c.about || {};
      if (!a.intro && !a.title) return '';
      const more = has('a-propos') ? `<a class="link-arrow" ${link('a-propos')}>Notre histoire ${icon('arrow', { size: 18 })}</a>` : '';
      return `<h2>${esc(a.title || 'Qui sommes-nous')}</h2><p class="lead">${esc(a.intro || '')}</p>${more}`;
    }
    case 'highlights': {
      const items = (c.highlights || []).slice(0, 4);
      if (!items.length) return '';
      return `<h2>${esc(c.highlightsTitle || 'Ce qui fait la différence')}</h2><ul class="duo-list">${items
        .map((it) => `<li><span class="f-icon">${icon(it.icon, { size: 22 })}</span><div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div></li>`)
        .join('')}</ul>`;
    }
    case 'reviews': {
      const reviews = parseReviews(brief.reviews).slice(0, 2);
      if (!reviews.length) return '';
      return `<h2>${esc(c.reviewsTitle || 'Ils nous font confiance')}</h2><div class="duo-reviews">${reviews
        .map((r) => `<figure class="review"><blockquote>« ${esc(r.text)} »</blockquote>${r.author ? `<figcaption>${esc(r.author)}</figcaption>` : ''}</figure>`)
        .join('')}</div>`;
    }
    case 'info': {
      const items = [];
      if (brief.address) items.push(`<li><span class="f-icon">${icon('pin', { size: 20 })}</span><div><h3>Adresse</h3><a href="${mapsHref(brief.address)}" target="_blank" rel="noopener">${esc(brief.address)}</a></div></li>`);
      if (brief.hours) items.push(`<li><span class="f-icon">${icon('clock', { size: 20 })}</span><div><h3>Horaires</h3><p>${multi(brief.hours)}</p></div></li>`);
      if (brief.phone) items.push(`<li><span class="f-icon">${icon('phone', { size: 20 })}</span><div><h3>Téléphone</h3><a href="${telHref(brief.phone)}">${esc(brief.phone)}</a></div></li>`);
      if (brief.email) items.push(`<li><span class="f-icon">${icon('mail', { size: 20 })}</span><div><h3>E-mail</h3><a href="mailto:${esc(brief.email)}">${esc(brief.email)}</a></div></li>`);
      if (items.length < 2) return '';
      return `<h2>Infos pratiques</h2><ul class="duo-list">${items.join('')}</ul>`;
    }
    case 'process': {
      const p = c.process;
      const steps = (p?.steps || []).filter((x) => x && x.title).slice(0, 4);
      if (steps.length < 2) return '';
      return `<h2>${esc(p.title || 'Comment ça se passe')}</h2><ol class="steps steps-stack">${steps
        .map((st, i) => `<li class="step"><span class="step-num">${i + 1}</span><div><h3>${esc(st.title)}</h3>${st.text ? `<p>${esc(st.text)}</p>` : ''}</div></li>`)
        .join('')}</ol>`;
    }
    case 'statement': {
      const text = c.statement || c.about?.quote || c.brand?.short;
      return text ? `<p class="statement-text">${esc(text)}</p>` : '';
    }
    case 'visual':
      return ctx.visual('duo-visual', ctx.take(1, 'duo')[0]);
    default:
      return '';
  }
}

// Module complet correspondant (quand l'autre moitié du duo est vide)
function moduleSeul(ctx, kind, alt) {
  switch (kind) {
    case 'about':
      return aboutTeaser(ctx, alt, 'split');
    case 'highlights':
      return highlights(ctx, alt);
    case 'reviews':
      return reviewsBlock(ctx, alt);
    case 'info':
      return infoStrip(ctx, alt);
    case 'process':
      return processBlock(ctx, alt, 'line');
    case 'statement':
      return statement(ctx, alt, 'left');
    default:
      return '';
  }
}

function duo(ctx, alt, v) {
  const [a, b] = String(v || '').split('+');
  const ha = demiBloc(ctx, a);
  const hb = demiBloc(ctx, b);
  // Une photo seule ne suffit pas : il faut au moins une moitié avec du contenu
  const texte = (h, k) => Boolean(h) && k !== 'visual';
  if (!texte(ha, a) && !texte(hb, b)) return '';
  // Une moitié vide : l'autre est affichée seule, en module complet
  if (!ha) return moduleSeul(ctx, b, alt);
  if (!hb) return moduleSeul(ctx, a, alt);
  return cellsDuo(ha, a, hb, b, alt);
}

function cellsDuo(ha, a, hb, b, alt) {
  const cell = (h, k) => `<div class="duo-cell duo-${k}">${h}</div>`;
  return `<section class="${sec(alt, `duo-sec duo-${a}-${b}`)}"><div class="wrap duo">${cell(ha, a)}${cell(hb, b)}</div></section>`;
}

// Sommaire : les pages du site en grandes tuiles numérotées
function sommaire(ctx, alt) {
  const { content: c, pages, link, brief } = ctx;
  const texte = {
    services: c.servicesIntro || (c.services || []).slice(0, 3).map((s) => s.name).join(' · '),
    boutique: c.productsIntro || (c.products || []).slice(0, 3).map((x) => x.name).join(' · '),
    'a-propos': c.about?.intro || c.about?.title || '',
    faq: (c.faq || [])[0]?.q || (c.faq || [])[0]?.question || 'Les réponses à vos questions',
    contact: [brief.address, brief.phone].filter(Boolean).join(' · ') || 'Nous écrire',
  };
  const tuiles = pages.filter((p) => p.slug !== 'index');
  if (tuiles.length < 3) return '';
  return `<section class="${sec(alt, 'sommaire-sec')}"><div class="wrap"><nav class="sommaire" aria-label="Sommaire">${tuiles
    .map(
      (p, i) =>
        `<a class="som-tuile" ${link(p.slug)}><span class="som-num">${String(i + 1).padStart(2, '0')}</span><span class="som-titre">${esc(p.label)}</span><span class="som-texte">${esc(String(texte[p.slug] || '').slice(0, 120))}</span><span class="som-fleche">${icon('arrow', { size: 20 })}</span></a>`
    )
    .join('')}</nav></div></section>`;
}

// Badge rond qui tourne doucement, en bas de l'écran : l'action principale (réserver, appeler…)
function badgeTournant(ctx) {
  const cta = primaryCta(ctx);
  const mot = esc(String(cta.label).toUpperCase());
  const unite = `${mot} · `;
  const boucle = unite.repeat(Math.max(1, Math.round(26 / unite.length)));
  const cote = ctx.brief.siteType === 'boutique' ? ' badge-gauche' : '';
  return `<a class="badge-tournant${cote}" ${cta.href} aria-label="${esc(cta.label)}"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><path id="bt-cercle" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"/></defs><text><textPath href="#bt-cercle" textLength="286" lengthAdjust="spacing">${boucle}</textPath></text></svg><span class="bt-coeur">${icon('arrow', { size: 22 })}</span></a>`;
}

// ---------- Pages complètes ----------

// Assemblage de la page d'accueil selon la recette du style
const SOLID = new Set(['bg', 'surface', 'primary']);

function homeBody(ctx) {
  const { m, arch, brief } = ctx;
  const shop = brief.siteType === 'boutique';
  const kind = m.comp.divider;
  const out = [];
  let prev = null;
  let altNext = false;
  let push = (html, bg) => {
    if (!html) return;
    if (kind && SOLID.has(prev) && SOLID.has(bg) && prev !== bg) out.push(divider(kind, prev, bg));
    out.push(html);
    prev = bg;
  };
  // Rythme de la mise en page : bandes alternées (par défaut), filets (fond uni), panneaux (tous « alt »)
  const rythme = m.mise?.rythme || 'bandes';
  const plain = (fn) => {
    const alt = rythme === 'filets' ? false : rythme === 'cartes' ? true : altNext;
    const html = fn(alt);
    if (!html) return;
    push(html, alt ? 'surface' : 'bg');
    altNext = !altNext;
  };
  // Sections modifiées dans l'éditeur (ordre, masquées, style) ; sinon celles du modèle
  const edite = ctx.accueil;
  const sections = edite ? edite.filter((s) => !s.cache).map((s) => ({ name: s.t, v: s.v, id: s.id })) : m.tokens.map((x, i) => ({ ...x, id: `${x.name}${i}` }));
  const offreIndex = sections.some((t) => t.name === 'offer' && t.v === 'index');
  const marque = (html, id, name) => (ctx.editeur ? marquer(ctx, id, nomModule(name, { boutique: shop, offre: servicesLabel(brief) }), html) : html);
  for (const { name, v, id } of sections) {
    if (ctx.lie) ctx.imposer(photosImposees(ctx.content, id));
    // plain() passe par push() : un seul repère par section
    const pushAvant = push;
    if (ctx.editeur) push = (html, bg) => pushAvant(marque(html, id, name), bg);
    switch (name) {
      case 'hero': {
        const hv = edite && heroValide(v) ? v : m.variants.hero;
        push(hero(ctx, hv), heroBg(hv));
        altNext = heroBg(hv) === 'bg';
        break;
      }
      case 'marquee':
        push(marquee(ctx), 'primary');
        break;
      case 'stripes':
        push('<div class="stripes"></div>', 'other');
        break;
      case 'statement':
        plain((alt) => statement(ctx, alt, v || 'left'));
        break;
      case 'highlights':
        plain((alt) => highlights(ctx, alt, v));
        break;
      case 'offer':
        plain((alt) => (shop ? productsPreview(ctx, alt) : servicesPreview(ctx, alt, v)));
        break;
      case 'offer2':
        if (shop) plain((alt) => servicesPreview(ctx, alt, offreIndex ? 'index' : m.variants.services));
        break;
      case 'motsimages':
        plain((alt) => motsImages(ctx, alt));
        break;
      case 'portes':
        plain((alt) => portes(ctx, alt));
        break;
      case 'manifeste':
        push(manifeste(ctx), 'image');
        break;
      case 'grandmot':
        plain((alt) => grandMot(ctx, alt));
        break;
      case 'gallery':
        plain((alt) => gallery(ctx, alt, v || 'grid'));
        break;
      case 'band':
        push(band(ctx, v || 'plain'), 'image');
        break;
      case 'process':
        plain((alt) => processBlock(ctx, alt, v || 'line'));
        break;
      case 'about':
        plain((alt) => aboutTeaser(ctx, alt, v));
        break;
      case 'reviews':
        plain((alt) => reviewsBlock(ctx, alt));
        break;
      case 'cta': {
        const cv = ctaVariant(ctx, v);
        if (cv === 'band') push(ctaBlock(ctx, cv), 'primary');
        else if (cv === 'image') push(ctaBlock(ctx, cv), 'image');
        else plain((alt) => ctaBlock(ctx, cv, alt));
        break;
      }
      case 'info':
        plain((alt) => infoStrip(ctx, alt));
        break;
      case 'duo':
        plain((alt) => duo(ctx, alt, v));
        break;
      case 'sommaire':
        plain((alt) => sommaire(ctx, alt));
        break;
      default:
        break;
    }
    push = pushAvant;
    if (ctx.lie) ctx.imposer(null);
  }
  if (kind && !arch.stripes && SOLID.has(prev)) out.push(divider(kind, prev, 'footer'));
  return out.join('');
}

function aboutBody(ctx) {
  const { content: c, visual, m } = ctx;
  const a = c.about || {};
  const story = (a.story || []).map((p) => `<p>${esc(p)}</p>`).join('');
  const values = (a.values || [])
    .map((v) => `<article class="feature"><div class="f-icon">${icon(v.icon || 'heart')}</div><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></article>`)
    .join('');
  const galTok = m.tokens.find((x) => x.name === 'gallery');
  const b = blocsEditeur(ctx);
  ctx.imposer(photosImposees(c, 'p-a-propos'));
  const histoire = `<section class="section"><div class="wrap prose-grid"><div class="story">${story}</div>${visual('about-visual', ctx.take(1, 'about')[0])}</div></section>`;
  ctx.imposer(photosImposees(c, 'p-a-propos-galerie'));
  const galerie = gallery(ctx, false, galTok?.v === 'strip' ? 'strip' : 'grid');
  ctx.imposer(null);
  return (
    b('tete', pageHero(ctx, a.title || 'À propos', a.intro)) +
    b('histoire', histoire) +
    (values ? b('valeurs', `<section class="section alt"><div class="wrap">${sectionHead(a.valuesTitle || 'Ce qui nous guide', '', false)}<div class="values">${values}</div></div></section>`) : '') +
    b('galerie', galerie) +
    b('cta', ctaBlock(ctx))
  );
}

// Repères des blocs d'une page intérieure, pour l'éditeur
function blocsEditeur(ctx) {
  if (!ctx.editeur) return (id, html) => html;
  const blocs = blocsDePage(ctx.page, { boutique: ctx.brief.siteType === 'boutique', offre: servicesLabel(ctx.brief) });
  return (id, html) => marquer(ctx, `p-${id}`, blocs.find((x) => x.id === id)?.label || '', html);
}

function servicesBody(ctx) {
  const { content: c, brief, m, imgs } = ctx;
  const v = brief.siteType === 'boutique' ? m.variants.services : m.offerVariant;
  const b = blocsEditeur(ctx);
  ctx.imposer(photosImposees(c, 'p-services'));
  const pic = imgs.length ? `<div class="wrap">${ctx.visual('page-visual', ctx.take(1)[0])}</div>` : '';
  ctx.imposer(null);
  return b('tete', pageHero(ctx, c.servicesTitle || servicesLabel(brief), c.servicesIntro)) + b('photo', pic) + b('liste', `<section class="section"><div class="wrap">${servicesList(ctx, c.services || [], v)}</div></section>`) + b('cta', ctaBlock(ctx));
}

function shopBody(ctx) {
  const { content: c } = ctx;
  const products = c.products || [];
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const filters =
    cats.length > 1
      ? `<div class="shop-filters" role="group" aria-label="Filtrer les produits"><button class="chip" type="button" data-filter="*" aria-pressed="true">Tout</button>${cats
          .map((cat) => `<button class="chip" type="button" data-filter="${esc(slugify(cat))}" aria-pressed="false">${esc(cat)}</button>`)
          .join('')}</div>`
      : '';
  const b = blocsEditeur(ctx);
  return b('tete', pageHero(ctx, c.productsTitle || 'Boutique', c.productsIntro)) + b('liste', `<section class="section"><div class="wrap">${filters}${productCards(ctx, products)}</div></section>`);
}

function faqBody(ctx) {
  const { content: c } = ctx;
  const items = (c.faq || []).map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  const b = blocsEditeur(ctx);
  return b('tete', pageHero(ctx, 'Questions fréquentes', c.faqIntro)) + b('faq', `<section class="section"><div class="wrap faq">${items}</div></section>`) + b('cta', ctaBlock(ctx));
}

function contactBody(ctx) {
  const { brief, content: c } = ctx;
  const features = brief.features || [];
  const booking = brief.goal === 'reservation' || features.includes('reservation');
  const quote = features.includes('devis');
  const info = [];
  if (brief.phone) info.push(`<div class="info-item"><div class="f-icon">${icon('phone', { size: 20 })}</div><div><h3>Téléphone</h3><a href="${telHref(brief.phone)}">${esc(brief.phone)}</a></div></div>`);
  if (brief.email) info.push(`<div class="info-item"><div class="f-icon">${icon('mail', { size: 20 })}</div><div><h3>E-mail</h3><a href="mailto:${esc(brief.email)}">${esc(brief.email)}</a></div></div>`);
  if (brief.address) info.push(`<div class="info-item"><div class="f-icon">${icon('pin', { size: 20 })}</div><div><h3>Adresse</h3><p>${esc(brief.address)}</p><a class="link-arrow map-link" href="${mapsHref(brief.address)}" target="_blank" rel="noopener">Voir sur la carte</a></div></div>`);
  if (brief.hours) info.push(`<div class="info-item"><div class="f-icon">${icon('clock', { size: 20 })}</div><div><h3>Horaires</h3><p>${multi(brief.hours)}</p></div></div>`);
  const svcOptions = (c.services || []).map((s) => `<option>${esc(s.name)}</option>`).join('');
  // Ton du formulaire : « Demande de devis » cochée l'emporte sur la prise de rendez-vous,
  // sauf si l'objectif principal du site est de recevoir des réservations
  const mode = quote && brief.goal !== 'reservation' ? 'devis' : booking ? 'reservation' : quote ? 'devis' : 'message';
  const subject = { devis: 'Demande de devis', reservation: 'Demande de réservation', message: 'Message depuis le site' }[mode];
  const submit = { devis: 'Envoyer ma demande de devis', reservation: 'Envoyer ma demande de réservation', message: 'Envoyer le message' }[mode];
  const formTitle = { devis: 'Votre demande de devis', reservation: 'Réserver', message: 'Écrivez-nous' }[mode];
  const form = `<form class="form" data-mailto="${esc(brief.email || '')}" data-subject="${subject}"><h2 style="font-size:1.6rem;margin:0">${esc(c.contact?.formTitle || formTitle)}</h2><div class="row"><div class="field"><label for="f-name">Nom</label><input id="f-name" name="Nom" required autocomplete="name"></div><div class="field"><label for="f-phone">Téléphone</label><input id="f-phone" name="Téléphone" type="tel" autocomplete="tel"></div></div><div class="field"><label for="f-email">E-mail</label><input id="f-email" name="E-mail" type="email" required autocomplete="email"></div>${booking ? `<div class="row"><div class="field"><label for="f-date">Date souhaitée</label><input id="f-date" name="Date souhaitée" type="date"></div><div class="field"><label for="f-time">Heure</label><input id="f-time" name="Heure" type="time"></div></div>` : ''}${quote && svcOptions ? `<div class="field"><label for="f-svc">Prestation concernée</label><select id="f-svc" name="Prestation">${svcOptions}<option>Autre</option></select></div>` : ''}<div class="field"><label for="f-msg">Message</label><textarea id="f-msg" name="Message" rows="5" required></textarea></div><button class="btn" type="submit">${submit}</button><p class="form-ok" role="status">Merci ! Votre messagerie va s’ouvrir avec votre message prêt à envoyer.</p></form>`;
  const b = blocsEditeur(ctx);
  return b('tete', pageHero(ctx, c.contact?.title || 'Contact', c.contact?.intro)) + b('contact', `<section class="section"><div class="wrap contact-grid"><div class="contact-list">${info.join('')}</div>${form}</div></section>`);
}

function legalBody(ctx) {
  const { brief, name } = ctx;
  const todo = (s) => `<span class="todo">[${esc(s)}]</span>`;
  const val = (k, label) => (String(brief[k] || '').trim() ? esc(brief[k]) : todo(label));
  // Infos légales venues du questionnaire ; ce qui manque reste entre crochets
  const form = String(brief.legalForm || '').trim();
  const capital = String(brief.capital || '').trim();
  const status = form ? esc(form) + (capital ? ` au capital de ${esc(capital)}` : '') : todo('forme juridique et capital');
  const seat = String(brief.siege || '').trim() || String(brief.address || '').trim();
  const register = /^EI|association/i.test(form) && !String(brief.rcs || '').trim() ? '' : ` — RCS ${val('rcs', 'ville')}`;
  return (
    pageHero(ctx, 'Mentions légales', '') +
    `<section class="section"><div class="wrap legal">
<h2>Éditeur du site</h2><p>${esc(String(brief.legalName || '').trim() || name)} — ${status}<br>Siège : ${seat ? esc(seat) : todo('adresse')}<br>SIRET : ${val('siret', 'numéro SIRET')}${register}<br>Directeur de la publication : ${val('publisher', 'nom du dirigeant')}<br>Contact : ${brief.email ? esc(brief.email) : todo('e-mail')}${brief.phone ? ' — ' + esc(brief.phone) : ''}</p>
<h2>Hébergement</h2><p>${String(brief.hosting || '').trim() ? esc(brief.hosting) : todo('Nom, adresse et téléphone de l’hébergeur')}</p>
<h2>Propriété intellectuelle</h2><p>L’ensemble des contenus de ce site (textes, visuels, logo) est la propriété de ${esc(name)}, sauf mention contraire. Toute reproduction sans autorisation est interdite.</p>
<h2>Données personnelles</h2><p>Les informations transmises via les formulaires servent uniquement à répondre à vos demandes. Elles ne sont ni vendues ni cédées. Conformément au RGPD, vous pouvez demander l’accès, la rectification ou la suppression de vos données en écrivant à ${brief.email ? esc(brief.email) : todo('e-mail')}.</p>
<h2>Cookies</h2><p>Ce site n’utilise pas de cookies de mesure d’audience ni de publicité. Les polices de caractères sont chargées depuis Google Fonts.</p>
</div></section>`
  );
}

const SCRIPT = (preview, jour) => `(function(){var d=document,P=${preview ? 'true' : 'false'};
var b=d.querySelector('[data-burger]'),h=d.querySelector('[data-header]');
if(b&&h){b.addEventListener('click',function(){var o=h.classList.toggle('menu-open');b.setAttribute('aria-expanded',o?'true':'false');});}
if(P){d.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var p=a.getAttribute('data-page');e.preventDefault();if(p){parent.postMessage({type:'site-nav',page:p},'*');}});var st=0;addEventListener('scroll',function(){clearTimeout(st);st=setTimeout(function(){parent.postMessage({type:'site-scroll',y:scrollY},'*');},150);},{passive:true});addEventListener('message',function(e){if(e.source===parent&&e.data&&e.data.type==='site-scroll-to')scrollTo(0,+e.data.y||0);});}
function fmt(n){return n.toLocaleString('fr-FR',{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2})+' €';}
function lines(f){var out=[];new FormData(f).forEach(function(v,k){if(String(v).trim())out.push(k+' : '+v);});return out;}
function send(f,extra){var to=f.getAttribute('data-mailto'),s=f.getAttribute('data-subject')||'Message';var body=(extra||[]).concat(lines(f)).join('\\n');var ok=f.querySelector('.form-ok');if(ok)ok.style.display='block';if(!P&&to){location.href='mailto:'+to+'?subject='+encodeURIComponent(s)+'&body='+encodeURIComponent(body);}}
d.querySelectorAll('form[data-mailto]:not([data-checkout])').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();send(f);});});
d.querySelectorAll('[data-filter]').forEach(function(c){c.addEventListener('click',function(){var v=c.getAttribute('data-filter');d.querySelectorAll('[data-filter]').forEach(function(x){x.setAttribute('aria-pressed',x===c?'true':'false');});d.querySelectorAll('.product').forEach(function(p){p.hidden=!(v==='*'||p.getAttribute('data-cat')===v);});});});
var J=P?'${jour}':(function(){try{var p={};new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;});if(p.year&&p.month&&p.day)return p.year+'-'+p.month+'-'+p.day;}catch(e){}var x=new Date();return x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2);})();
d.querySelectorAll('[data-ss-du],[data-ss-plages]').forEach(function(el){var on=false,pl=el.getAttribute('data-ss-plages');if(pl!==null){pl.split(',').forEach(function(r){var q=r.split(':');if(J>=q[0]&&J<=q[1])on=true;});}else{var a=el.getAttribute('data-ss-du'),z=el.getAttribute('data-ss-au');if(el.hasAttribute('data-ss-annuel')){var m=J.slice(5),x=a.slice(5),y=z.slice(5);on=x<=y?(m>=x&&m<=y):(m>=x||m<=y);}else{on=J>=a&&J<=z;}}el.hidden=!on;});
d.querySelectorAll('[data-ss-fin]').forEach(function(el){el.setAttribute('data-price',J>el.getAttribute('data-ss-fin')?el.getAttribute('data-ss-prix'):el.getAttribute('data-ss-offre'));});
var lb=d.querySelector('[data-cart-lines]');if(!lb)return;
var K='panier-'+location.pathname.split('/').slice(0,-1).join('/'),cart=[];try{cart=JSON.parse(localStorage.getItem(K))||[];}catch(e){}
var ep={},bt={};d.querySelectorAll('[data-ss-epuise]').forEach(function(x){ep[x.getAttribute('data-ss-epuise')]=1;});d.querySelectorAll('[data-add]').forEach(function(x){bt[x.getAttribute('data-add')]=x;});
cart=Array.isArray(cart)?cart.filter(function(it){if(!it||ep[it.id])return false;var b=bt[it.id];if(b)it.p=parseFloat(b.getAttribute('data-price'));return true;}):[];
function save(){try{localStorage.setItem(K,JSON.stringify(cart));}catch(e){}}
function render(){var n=0,t=0;lb.innerHTML='';cart.forEach(function(it,i){n+=it.q;t+=it.q*it.p;var row=d.createElement('div');row.className='cart-line';var nm=d.createElement('strong');nm.textContent=it.n;var pr=d.createElement('span');pr.textContent=fmt(it.q*it.p);var q=d.createElement('div');q.className='qty';q.innerHTML='<button type="button" aria-label="Retirer un">−</button><span></span><button type="button" aria-label="Ajouter un">+</button>';q.querySelector('span').textContent=it.q;q.children[0].onclick=function(){it.q--;if(it.q<1)cart.splice(i,1);save();render();};q.children[2].onclick=function(){it.q++;save();render();};row.appendChild(nm);row.appendChild(pr);row.appendChild(q);lb.appendChild(row);});
if(!cart.length){lb.innerHTML='<p class="cart-empty">Votre panier est vide.</p>';}
d.querySelector('[data-cart-count]').textContent=n;d.querySelector('[data-cart-total]').textContent=fmt(t);}
d.addEventListener('click',function(e){var a=e.target.closest('[data-add]');if(a){var id=a.getAttribute('data-add'),f=null;cart.forEach(function(x){if(x.id===id)f=x;});if(f)f.q++;else cart.push({id:id,n:a.getAttribute('data-name'),p:parseFloat(a.getAttribute('data-price')),q:1});save();render();d.body.classList.add('cart-open');return;}
if(e.target.closest('[data-cart-open]')){d.body.classList.add('cart-open');}
if(e.target.closest('[data-cart-close]')){d.body.classList.remove('cart-open');}});
var co=d.querySelector('[data-checkout]');co.addEventListener('submit',function(e){e.preventDefault();if(!cart.length)return;var t=0;var ls=cart.map(function(x){t+=x.q*x.p;return x.q+' × '+x.n+' — '+fmt(x.q*x.p);});send(co,['Commande :'].concat(ls).concat(['Total : '+fmt(t),'']));});
render();})();`;

function favicon(name, t) {
  const letter = esc(String(name || '?').trim().charAt(0).toUpperCase() || '?');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${t.primary}"/><text x="32" y="44" text-anchor="middle" font-family="Georgia,serif" font-size="36" fill="${t.onPrimary}">${letter}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// Aperçu de l'éditeur : survol et section choisie bien visibles, clic = choisir la section
const EDITEUR_CSS = `[data-ed]{cursor:pointer;position:relative}[data-ed]:hover{outline:2px dashed #3b6cf6;outline-offset:-2px}[data-ed][data-ed-choisi]{outline:3px solid #3b6cf6;outline-offset:-3px}[data-ed]:hover::before,[data-ed][data-ed-choisi]::before{content:attr(data-ed-nom);position:absolute;top:0;left:0;z-index:60;background:#3b6cf6;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:6px 9px;border-radius:0 0 6px 0;pointer-events:none}`;
const EDITEUR_SCRIPT = `(function(){var d=document;d.addEventListener('click',function(e){var s=e.target.closest('[data-ed]');if(!s)return;e.preventDefault();e.stopPropagation();parent.postMessage({type:'ed-choisir',id:s.getAttribute('data-ed')},'*');},true);addEventListener('message',function(e){if(e.source!==parent||!e.data||e.data.type!=='ed-voir')return;var s=d.querySelector('[data-ed="'+String(e.data.id).replace(/"/g,'')+'"]');if(s){s.scrollIntoView({block:'center',behavior:e.data.doux?'smooth':'auto'});parent.postMessage({type:'ed-vu',id:e.data.id},'*');}});})();`;

export function renderPage(slug, { brief, content, model, images, mode = 'preview', imageSize = 'full', jour, editeur = null }) {
  const ctx = makeCtx({ brief, content, model, images, mode, page: slug, imageSize, jour, editeur: mode === 'preview' ? editeur : null });
  const { arch, t, m, name, pages } = ctx;
  let body;
  switch (slug) {
    case 'a-propos':
      body = aboutBody(ctx);
      break;
    case 'services':
      body = servicesBody(ctx);
      break;
    case 'boutique':
      body = shopBody(ctx);
      break;
    case 'faq':
      body = faqBody(ctx);
      break;
    case 'contact':
      body = contactBody(ctx);
      break;
    case 'mentions-legales':
      body = legalBody(ctx);
      break;
    default:
      body = homeBody(ctx);
  }
  const label = pages.find((p) => p.slug === slug)?.label || (slug === 'mentions-legales' ? 'Mentions légales' : '');
  const title = slug === 'index' ? content.seo?.title || `${name} — ${content.brand?.tagline || ''}` : `${label} — ${name}`;
  const description = content.seo?.description || content.brand?.short || brief.description || '';
  const shop = brief.siteType === 'boutique' && (content.products || []).length ? cartUi(ctx) : '';
  const stripes = arch.stripes ? '<div class="stripes"></div>' : '';
  const mise = m.mise ? ` tt-${m.mise.tetes} ry-${m.mise.rythme} tr-${m.mise.trame}${m.mise.deco ? ' deco-' + m.mise.deco : ''}` : '';
  const badge = m.mise?.deco === 'badge' ? badgeTournant(ctx) : '';
  // Une page d'accueil réorganisée dans l'éditeur peut recevoir les modules récents : leurs styles suivent
  const avecMise = Boolean(m.mise || content.edition?.accueil);
  const outils = ctx.editeur ? `<style>${EDITEUR_CSS}</style><script>${EDITEUR_SCRIPT}</script>` : '';
  return `<!doctype html><html lang="fr" class="a-${arch.id}${m.flavor ? ' fl-' + m.flavor.id : ''} nav-${m.variants.nav}${mise}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(String(description).slice(0, 160))}"><link rel="icon" href="${favicon(name, t)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fontsHref(arch)}"><style>${cssVars(arch, t)}${BASE_CSS}${arch.css}${m.comp.css || ''}${avecMise ? MISE_CSS : ''}${ESPACE_CSS}${annoncesCss(ctx)}</style></head><body><a class="skip" href="#main">Aller au contenu</a>${annoncesBar(ctx)}${header(ctx)}<main id="main">${body}</main>${stripes}${footer(ctx)}${shop}${badge}<script>${SCRIPT(mode !== 'export', ctx.jour)}</script>${outils}</body></html>`;
}

export function allPageSlugs(brief, content) {
  return [...sitePages(brief, content).map((p) => p.slug), 'mentions-legales'];
}
