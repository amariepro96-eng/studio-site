// Couleurs et logo de la facture, repris du modèle de site choisi par le client, pour que la
// facture Factur-X soit « aux couleurs de son site ». Renvoie null si pas de site/modèle.
import { resolveModel, computeTheme } from '../engine/render.js';

function logoDepuisBrief(brief) {
  const u = brief?.logoFile || brief?.logoUrl || '';
  const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(u));
  if (!m) return null;
  try {
    return { type: /^jp/i.test(m[1]) ? 'jpg' : 'png', bytes: Buffer.from(m[2].replace(/\s/g, ''), 'base64') };
  } catch {
    return null;
  }
}

export function themeDossier(rec) {
  try {
    const model = rec?.result?.models?.find((m) => m.id === rec?.choice?.modelId);
    if (!model) return null;
    const r = resolveModel(model);
    const t = computeTheme(r.arch, r.paletteIndex, rec?.brief?.color);
    // Si le client a choisi une couleur de marque au questionnaire, toute la facture est dans
    // cette couleur (sinon on garde les deux teintes de la palette du modèle, comme son site).
    const marque = /^#?[0-9a-f]{6}$/i.test(String(rec?.brief?.color || '').trim());
    return {
      primary: t.primary,
      accent: marque ? t.primary : t.accent,
      primarySoft: t.primarySoft,
      onPrimary: t.onPrimary,
      text: t.text,
      muted: t.muted,
      logo: logoDepuisBrief(rec.brief),
    };
  } catch {
    return null;
  }
}
