// Outils couleur : contraste, mélange, couleur de texte lisible

export function hexToRgb(hex) {
  let h = String(hex ?? '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(rgb) {
  return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

export function isHex(hex) {
  return !!hexToRgb(hex);
}

export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const a = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

export function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return a;
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}

// Texte lisible posé sur une couleur de fond
export function onColor(bg) {
  return contrast(bg, '#ffffff') >= 3.2 ? '#ffffff' : '#111111';
}

// Ajuste une couleur jusqu'à obtenir un contraste suffisant sur un fond
export function ensureContrast(fg, bg, min = 4.5) {
  if (!isHex(fg) || !isHex(bg)) return fg;
  const target = luminance(bg) > 0.35 ? '#000000' : '#ffffff';
  let c = fg;
  for (let i = 0; i < 12 && contrast(c, bg) < min; i++) c = mix(c, target, 0.14);
  return c;
}

export function alpha(hex, a) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}
