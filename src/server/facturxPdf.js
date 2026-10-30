// Facture Factur-X : un PDF lisible et soigné (pdf-lib) avec le XML réglementaire embarqué
// (factur-x.xml, profil BASIC, EN 16931). Le visuel est libre ; seul le XML est normalisé.
// Design bi-tons repris du modèle choisi par le client (primary = structure, accent = éléments
// mis en avant), sinon un bleu nuit sobre.
import { PDFDocument, rgb, AFRelationship } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { xmlFacturX } from '../engine/facturx.js';
import { ligneHT, totaux, tauxLabel, NATURES } from '../engine/devis.js';
import { DEJAVU_REGULAR, DEJAVU_BOLD } from './fonts/dejavu.js';

const eur = (c) => (Math.round(Number(c) || 0) / 100).toFixed(2).replace('.', ',') + ' €';
const qteTxt = (n) => (Math.round((Number(n) || 0) * 10000) / 10000).toString().replace('.', ',');
const jour = (ymd) => {
  const [a, m, j] = String(ymd || '').split('-');
  return a && m && j ? `${j}/${m}/${a}` : String(ymd || '');
};
const parseHex = (h) => {
  const s = String(h || '').replace('#', '');
  if (s.length < 6) return null;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const mixC = (a, b, w) => a.map((v, i) => Math.round(v * (1 - w) + b[i] * w));
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const darken = (c, ratio) => mixC(c, [0, 0, 0], ratio);
const onColor = (c) => (lum(c) < 0.52 ? [255, 255, 255] : [26, 31, 28]);
// S'assure qu'une couleur de remplissage foncée (texte blanc dessus) est assez sombre
const pourFond = (c) => (lum(c) > 0.62 ? darken(c, 0.45) : c);

export async function pdfFacturX(f, theme = null) {
  const v = f.vendeur || {};
  const c = f.client || {};
  const franchise = v.franchise === true;
  const t = totaux(f.lignes, { franchise });
  const net = Math.max(0, t.ttc - (Number(f.acompteVerse) || 0));

  // ---- Couleurs ----
  const PRIM = pourFond(parseHex(theme?.primary) || [31, 42, 74]); // bleu nuit par défaut
  const ACC = pourFond(parseHex(theme?.accent) || PRIM); // 2e teinte ; monochrome si pas de modèle
  const primTint = mixC(PRIM, [255, 255, 255], 0.9);
  const accTint = mixC(ACC, [255, 255, 255], 0.88);
  const rowTint = mixC(PRIM, [255, 255, 255], 0.955);
  const INK = [26, 31, 28];
  const GREY = [107, 112, 110];
  const LINE = [224, 226, 224];

  // ---- Document ----
  const doc = await PDFDocument.create();
  doc.setTitle(`Facture ${f.numero || ''}`);
  doc.setAuthor(v.nom || 'Studio Site');
  doc.setProducer('Studio Site');
  doc.setCreator('Studio Site — Factur-X');
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(Buffer.from(DEJAVU_REGULAR, 'base64'), { subset: true });
  const bold = await doc.embedFont(Buffer.from(DEJAVU_BOLD, 'base64'), { subset: true });
  const W = 595.28,
    H = 841.89,
    M = 46,
    Rx = W - 34;
  const yHdr = H - 50;
  let page = doc.addPage([W, H]);

  const col = (c3) => rgb(c3[0] / 255, c3[1] / 255, c3[2] / 255);
  const txt = (s, x, y, { size = 9.5, f = font, color = INK } = {}) => page.drawText(String(s == null ? '' : s), { x, y, size, font: f, color: col(color) });
  const right = (s, xR, y, o = {}) => txt(s, xR - (o.f || font).widthOfTextAtSize(String(s == null ? '' : s), o.size || 9.5), y, o);
  const center = (s, xC, y, o = {}) => txt(s, xC - (o.f || font).widthOfTextAtSize(String(s == null ? '' : s), o.size || 9.5) / 2, y, o);
  const rect = (x, y, w, h, c3) => page.drawRectangle({ x, y, width: w, height: h, color: col(c3) });
  const wrap = (s, max, size = 9, f = font) => {
    const out = [];
    let cur = '';
    for (const w of String(s || '').split(/\s+/)) {
      const test = cur ? cur + ' ' + w : w;
      if (f.widthOfTextAtSize(test, size) > max && cur) {
        out.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) out.push(cur);
    return out;
  };

  // Bande latérale de marque
  rect(0, 0, 10, H, PRIM);

  let y = yHdr;
  // ---- En-tête : logo + nom (gauche) | pavé FACTURE (droite) ----
  let nameY = y;
  if (theme?.logo?.bytes) {
    try {
      const img = theme.logo.type === 'jpg' ? await doc.embedJpg(theme.logo.bytes) : await doc.embedPng(theme.logo.bytes);
      const sc = Math.min(42 / img.height, 170 / img.width, 1);
      page.drawImage(img, { x: M, y: y - img.height * sc + 10, width: img.width * sc, height: img.height * sc });
      nameY = y - img.height * sc - 4;
    } catch {}
  }
  txt(v.nom || '', M, nameY, { size: 20, f: bold, color: PRIM });
  // Pavé FACTURE
  const fw = 150,
    fx = Rx - fw;
  rect(fx, y - 14, fw, 36, ACC);
  center('FACTURE', fx + fw / 2, y + 1, { size: 17, f: bold, color: onColor(ACC) });
  // N° de facture sous le pavé
  rect(fx, y - 40, fw, 20, accTint);
  txt('N° FACTURE', fx + 8, y - 34, { size: 7, f: bold, color: GREY });
  right(f.numero || '', fx + fw - 8, y - 34, { size: 10, f: bold, color: PRIM });
  right(v.siret ? `N° SIRET : ${v.siret}` : '', Rx, y - 54, { size: 7.5, color: GREY });

  y = nameY - 18;
  // Slogan / secteur éventuels : rien de stocké, on laisse respirer.

  // ---- Vendeur (gauche) + Client (droite) ----
  const colW = (Rx - M - 24) / 2;
  const clientX = M + colW + 24;
  let yl = y,
    yr = yHdr - 62; // la colonne client commence sous le pavé N° FACTURE
  const vendeurLignes = [
    [v.forme && v.capital ? `${v.forme} au capital de ${v.capital}` : v.forme, GREY],
    ...String(v.adresse || '')
      .split('\n')
      .filter(Boolean)
      .map((l) => [l, GREY]),
    [v.telephone ? `Tél : ${v.telephone}` : '', GREY],
    [v.email ? `E-mail : ${v.email}` : '', GREY],
    [v.site || '', GREY],
    [v.rcs || '', GREY],
    [franchise ? 'TVA non applicable, art. 293 B du CGI' : v.tva ? `TVA : ${v.tva}` : '', GREY],
  ].filter(([s]) => s);
  for (const [s, cl] of vendeurLignes) {
    yl -= 13;
    txt(s, M, yl, { size: 8.5, color: cl });
  }
  // Client
  txt('ADRESSE CLIENT', clientX, yr, { size: 9, f: bold, color: ACC });
  yr -= 16;
  txt(c.nom || '', clientX, yr, { size: 11, f: bold, color: INK });
  for (const s of [...String(c.adresse || '').split('\n'), c.siret ? `SIRET : ${c.siret}` : '', c.email ? `E-mail : ${c.email}` : ''].filter(Boolean)) {
    yr -= 13;
    txt(s, clientX, yr, { size: 8.5, color: GREY });
  }
  y = Math.min(yl, yr) - 24;

  // ---- Bandeau dates ----
  if (f.objet) {
    txt('Objet : ', M, y, { size: 9, f: bold, color: INK });
    txt(f.objet, M + bold.widthOfTextAtSize('Objet : ', 9) + 2, y, { size: 9 });
    y -= 18;
  }
  const metas = [
    ['Date d’émission', jour(f.emiseLe)],
    ...(f.datePrestation && f.datePrestation !== f.emiseLe ? [['Date de la prestation', jour(f.datePrestation)]] : []),
    ['Date d’échéance', jour(f.echeance)],
  ];
  const mw = (Rx - M - (metas.length - 1) * 10) / metas.length;
  metas.forEach(([label, val], i) => {
    const bx = M + i * (mw + 10);
    rect(bx, y - 20, mw, 26, primTint);
    txt(label, bx + 8, y - 2, { size: 7.5, color: GREY });
    txt(val, bx + 8, y - 15, { size: 10, f: bold, color: PRIM });
  });
  y -= 42;

  // ---- Tableau ----
  const C = { des: M + 8, qte: M + 274, pu: M + 342, uni: M + 392, mont: M + 452, tva: Rx - 6 };
  const headH = 20;
  const drawHead = () => {
    rect(M, y - headH + 14, Rx - M - 52, headH, PRIM);
    rect(Rx - 52, y - headH + 14, 52, headH, ACC);
    const o = { size: 8.5, f: bold, color: onColor(PRIM) };
    txt('Désignation', C.des, y, o);
    right('Qté', C.qte, y, o);
    right('P.U HT', C.pu, y, o);
    right('Unité', C.uni, y, o);
    right('Montant', C.mont, y, o);
    right('TVA', C.tva, y, { ...o, color: onColor(ACC) });
    y -= headH + 6;
  };
  drawHead();
  let z = 0;
  for (const l of f.lignes || []) {
    const lines = wrap(l.designation || 'Prestation', C.qte - C.des - 55, 9);
    const rowH = Math.max(1, lines.length) * 12 + 6;
    if (z % 2 === 0) rect(M, y - rowH + 12, Rx - M, rowH, rowTint);
    lines.forEach((ln, i) => txt(ln, C.des, y - i * 12, { size: 9 }));
    right(qteTxt(l.quantite), C.qte, y, { size: 9 });
    right(eur(l.prixHT), C.pu, y, { size: 9 });
    right(l.unite === 'u' ? 'Unité' : l.unite || 'Unité', C.uni, y, { size: 8.5, color: GREY });
    right(eur(ligneHT(l)), C.mont, y, { size: 9, f: bold });
    right(franchise ? '—' : tauxLabel(l.tva), C.tva, y, { size: 8.5, color: GREY });
    y -= rowH;
    z++;
    if (y < 210) {
      page = doc.addPage([W, H]);
      rect(0, 0, 10, H, PRIM);
      y = H - 60;
      drawHead();
    }
  }
  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: Rx, y: y + 8 }, thickness: 0.8, color: col(LINE) });
  y -= 10;

  // ---- Totaux ----
  const tLab = Rx - 230,
    tVal = Rx - 6;
  const totLine = (label, val, o = {}) => {
    if (o.band) rect(tLab - 10, y - 5, Rx - (tLab - 10), 19, o.accentBand ? accTint : primTint);
    const cl = o.band ? (o.accentBand ? ACC : PRIM) : o.color || INK;
    txt(label, tLab, y, { size: o.size || 9.5, f: o.f || font, color: cl });
    right(val, tVal, y, { size: o.size || 9.5, f: o.f || font, color: cl });
    y -= o.gap || 15;
  };
  totLine('Total HT', eur(t.ht));
  if (franchise) totLine('Total TVA', 'non applicable', { color: GREY });
  else {
    totLine('Total TVA', eur(t.tva), { color: GREY });
  }
  const acompte = Number(f.acompteVerse) > 0;
  y -= 3;
  totLine('Total TTC', eur(t.ttc), { f: bold, size: 11.5, band: !acompte, gap: 20 });
  if (acompte) {
    totLine('Acompte versé', '- ' + eur(f.acompteVerse), { color: GREY });
    totLine('Net à payer', eur(net), { f: bold, size: 11.5, band: true, gap: 20 });
  }
  y -= 12;

  // ---- Coordonnées bancaires ----
  if (v.iban) {
    txt('COORDONNÉES BANCAIRES / BANK DETAILS', M, y, { size: 8.5, f: bold, color: PRIM });
    right('Règlement / Payment : Virement', Rx, y, { size: 8.5, color: GREY });
    y -= 14;
    const bank = [`Titulaire / Account holder : ${v.nom || ''}`, `IBAN : ${v.iban}`, v.bic ? `BIC : ${v.bic}` : ''].filter(Boolean);
    for (const b of bank) {
      txt(b, M, y, { size: 8.5, color: INK });
      y -= 12;
    }
    y -= 8;
  }

  // ---- Remerciement + mentions ----
  center('Merci pour votre confiance. — Thank you for your business.', (M + Rx) / 2, y, { size: 9, f: bold, color: ACC });
  y -= 16;
  const mentions = [];
  if (v.penalites) mentions.push(v.penalites);
  else mentions.push('En cas de retard : pénalités au taux légal et indemnité forfaitaire de recouvrement de 40 € (entre professionnels).');
  if (franchise) mentions.push('TVA non applicable, article 293 B du CGI.');
  if (v.nature && NATURES?.[v.nature]) mentions.push(`Nature des opérations : ${NATURES[v.nature]}.`);
  if (v.tvaDebits) mentions.push('TVA acquittée d’après les débits.');
  if (v.conditions) mentions.push(v.conditions);
  if (v.mentions) mentions.push(v.mentions);
  mentions.push('Facture électronique au format Factur-X (profil BASIC, norme EN 16931).');
  for (const m of mentions) {
    for (const ln of wrap(m, Rx - M, 7.5)) {
      if (y < 34) break;
      txt(ln, M, y, { size: 7.5, color: GREY });
      y -= 10;
    }
  }

  // ---- XML réglementaire embarqué (le fichier DOIT s'appeler factur-x.xml) ----
  await doc.attach(new TextEncoder().encode(xmlFacturX(f)), 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'Facture électronique Factur-X',
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Data,
  });

  return doc.save();
}
