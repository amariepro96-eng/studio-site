// Visuels de remplacement dessinés en SVG quand aucune photo n'est disponible.
// Chaque direction artistique a son propre style graphique.
import { rng, esc } from './util.js';
import { mix, alpha } from './color.js';

const SVG_OPEN = (bg) =>
  `<svg class="art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="400" height="400" fill="${bg}"/>`;

function blobPath(cx, cy, r, rand, points = 7) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (0.75 + rand() * 0.45);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  let d = '';
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    if (i === 0) d += `M${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

function leaf(x, y, len, angle, fill, vein) {
  return `<g transform="translate(${x} ${y}) rotate(${angle})"><path d="M0,0 C${len * 0.35},${-len * 0.32} ${len * 0.75},${-len * 0.3} ${len},0 C${len * 0.75},${len * 0.3} ${len * 0.35},${len * 0.32} 0,0Z" fill="${fill}"/><path d="M4,0 L${len - 6},0" stroke="${vein}" stroke-width="2" opacity=".5"/></g>`;
}

export function art(kind, t, seed = 1, opts = {}) {
  const rand = rng(seed * 7919 + 13);
  const P = t.primary;
  const A = t.accent;
  const B = t.bg;
  const S = t.surface;
  const T = t.text;
  const third = t.third || mix(P, A, 0.5);
  const label = opts.label ? esc(opts.label) : '';
  let s = '';

  switch (kind) {
    case 'grid': {
      s += SVG_OPEN(S);
      for (let i = 0; i <= 400; i += 40) {
        s += `<path d="M${i} 0V400M0 ${i}H400" stroke="${T}" stroke-opacity=".09" stroke-width="1"/>`;
      }
      const cx = 160 + rand() * 120;
      const cy = 150 + rand() * 100;
      s += `<circle cx="${cx}" cy="${cy}" r="${110 + rand() * 30}" fill="${P}"/>`;
      s += `<rect x="${40 + Math.round(rand() * 4) * 40}" y="${200 + Math.round(rand() * 2) * 40}" width="80" height="80" fill="${T}"/>`;
      s += `<path d="M0 ${320 - rand() * 40}H400" stroke="${T}" stroke-width="2"/>`;
      break;
    }
    case 'serif': {
      s += SVG_OPEN(S);
      s += `<path d="M30 60H370M30 340H370" stroke="${T}" stroke-opacity=".35"/>`;
      const letter = label || 'A';
      s += `<text x="200" y="${300 + rand() * 20}" text-anchor="middle" font-size="330" style="font-family:var(--font-display);font-style:italic" fill="${P}" fill-opacity=".92">${letter.slice(0, 1)}</text>`;
      s += `<circle cx="${300 + rand() * 40}" cy="${110 + rand() * 30}" r="26" fill="${A}"/>`;
      break;
    }
    case 'arch': {
      const bg = mix(S, '#000000', t.dark ? 0.15 : 0);
      s += SVG_OPEN(bg);
      const cx = 200;
      for (let i = 0; i < 6; i++) {
        const r = 40 + i * 30;
        s += `<path d="M${cx - r} 400V${300 - r * 0.6}A${r} ${r} 0 0 1 ${cx + r} ${300 - r * 0.6}V400" fill="none" stroke="${P}" stroke-opacity="${0.85 - i * 0.12}" stroke-width="1.2"/>`;
      }
      s += `<circle cx="${cx}" cy="${120 + rand() * 30}" r="18" fill="${P}"/>`;
      break;
    }
    case 'blob': {
      s += SVG_OPEN(S);
      s += `<path d="${blobPath(150 + rand() * 40, 170 + rand() * 40, 130, rand)}" fill="${P}"/>`;
      s += `<path d="${blobPath(280 + rand() * 30, 260 + rand() * 30, 90, rand)}" fill="${A}"/>`;
      s += `<path d="${blobPath(110, 300, 50, rand)}" fill="${mix(P, B, 0.55)}"/>`;
      for (let i = 0; i < 9; i++) s += `<circle cx="${250 + (i % 3) * 18}" cy="${70 + Math.floor(i / 3) * 18}" r="3.2" fill="${T}" fill-opacity=".55"/>`;
      break;
    }
    case 'mesh': {
      const id = 'm' + Math.floor(rand() * 1e6);
      s += `<svg class="art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><radialGradient id="${id}a" cx="${20 + rand() * 30}%" cy="${20 + rand() * 30}%" r="70%"><stop offset="0" stop-color="${P}"/><stop offset="1" stop-color="${P}" stop-opacity="0"/></radialGradient><radialGradient id="${id}b" cx="${60 + rand() * 30}%" cy="${60 + rand() * 30}%" r="65%"><stop offset="0" stop-color="${A}"/><stop offset="1" stop-color="${A}" stop-opacity="0"/></radialGradient></defs><rect width="400" height="400" fill="${t.dark ? S : mix(P, '#ffffff', 0.86)}"/><rect width="400" height="400" fill="url(#${id}a)"/><rect width="400" height="400" fill="url(#${id}b)"/>`;
      for (let x = 20; x < 400; x += 28) for (let y = 20; y < 400; y += 28) s += `<circle cx="${x}" cy="${y}" r="1.3" fill="#fff" fill-opacity=".35"/>`;
      s += `<rect x="110" y="120" width="180" height="160" rx="22" fill="#fff" fill-opacity=".16" stroke="#fff" stroke-opacity=".45"/>`;
      break;
    }
    case 'confetti': {
      s += SVG_OPEN(third);
      const cols = [P, A, '#ffffff', T];
      for (let i = 0; i < 14; i++) {
        const x = rand() * 400;
        const y = rand() * 400;
        const c = cols[i % cols.length];
        const k = i % 4;
        if (k === 0) s += `<circle cx="${x}" cy="${y}" r="${14 + rand() * 26}" fill="${c}" stroke="${T}" stroke-width="3"/>`;
        else if (k === 1) s += `<path d="M${x} ${y}q15 -18 30 0t30 0t30 0" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`;
        else if (k === 2) s += `<rect x="${x}" y="${y}" width="${30 + rand() * 20}" height="${30 + rand() * 20}" rx="8" fill="${c}" stroke="${T}" stroke-width="3" transform="rotate(${rand() * 40 - 20} ${x} ${y})"/>`;
        else s += `<path d="M${x} ${y - 18}l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="${c}" stroke="${T}" stroke-width="2.5" stroke-linejoin="round"/>`;
      }
      break;
    }
    case 'blocks': {
      s += SVG_OPEN(P);
      s += `<rect x="${30 + rand() * 40}" y="${40 + rand() * 30}" width="190" height="190" fill="${T}"/>`;
      s += `<circle cx="${260 + rand() * 40}" cy="${250 + rand() * 30}" r="95" fill="${A}" stroke="${T}" stroke-width="8"/>`;
      s += `<rect x="60" y="300" width="300" height="34" fill="#fff" stroke="${T}" stroke-width="8"/>`;
      s += `<path d="M330 40l40 40M370 40l-40 40" stroke="${T}" stroke-width="10"/>`;
      break;
    }
    case 'leaf': {
      s += SVG_OPEN(S);
      const fills = [P, A, mix(P, B, 0.4), mix(A, B, 0.35)];
      for (let i = 0; i < 9; i++) {
        s += leaf(40 + rand() * 300, 60 + rand() * 300, 80 + rand() * 90, rand() * 360, fills[i % fills.length], B);
      }
      break;
    }
    case 'lines': {
      const deep = mix(P, '#000000', 0.35);
      const id = 'l' + Math.floor(rand() * 1e6);
      s += `<svg class="art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P}"/><stop offset="1" stop-color="${deep}"/></linearGradient></defs><rect width="400" height="400" fill="url(#${id})"/>`;
      for (let i = -400; i < 400; i += 26) s += `<path d="M${i} 400L${i + 400} 0" stroke="#fff" stroke-opacity=".07" stroke-width="10"/>`;
      s += `<circle cx="${270 + rand() * 40}" cy="${150 + rand() * 40}" r="110" fill="none" stroke="${A}" stroke-width="16"/>`;
      s += `<rect x="${50 + rand() * 30}" y="230" width="110" height="110" rx="6" fill="#fff" fill-opacity=".9"/><rect x="${120 + rand() * 30}" y="190" width="70" height="70" rx="6" fill="${A}"/>`;
      break;
    }
    case 'sunset': {
      s += SVG_OPEN(third);
      const cy = 230 + rand() * 30;
      s += `<circle cx="200" cy="${cy}" r="150" fill="${P}"/>`;
      for (let i = 0; i < 5; i++) s += `<rect x="0" y="${cy - 20 + i * 26}" width="400" height="${6 + i * 3}" fill="${third}"/>`;
      s += `<path d="M0 330 Q100 290 200 330 T400 330 V400 H0Z" fill="${A}"/>`;
      s += `<path d="M0 360 Q100 330 200 360 T400 360 V400 H0Z" fill="${T}" fill-opacity=".85"/>`;
      break;
    }
    case 'stripes': {
      s += SVG_OPEN(P);
      for (let i = -2; i < 8; i++) s += `<path d="M${i * 90} 400L${i * 90 + 400} 0" stroke="${i % 2 ? A : B}" stroke-width="38"/>`;
      s += `<circle cx="${200 + rand() * 60 - 30}" cy="${200 + rand() * 60 - 30}" r="120" fill="${B}"/>`;
      s += `<circle cx="200" cy="200" r="120" fill="none" stroke="${A}" stroke-width="3" transform="translate(${18} ${-14})"/>`;
      break;
    }
    case 'soft':
    default: {
      const id = 's' + Math.floor(rand() * 1e6);
      s += `<svg class="art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="38"/></filter></defs><rect width="400" height="400" fill="${S}"/>`;
      s += `<g filter="url(#${id})"><circle cx="${130 + rand() * 40}" cy="${140 + rand() * 40}" r="120" fill="${alpha(P, 0.55)}"/><circle cx="${270 + rand() * 40}" cy="${260 + rand() * 40}" r="120" fill="${alpha(A, 0.6)}"/></g>`;
      s += `<path d="M120 400V220A80 80 0 0 1 280 220V400" fill="none" stroke="${T}" stroke-opacity=".35" stroke-width="1.5"/>`;
      s += `<circle cx="200" cy="150" r="8" fill="${P}"/>`;
      break;
    }
  }

  if (opts.label && kind !== 'serif') {
    s += `<text x="200" y="226" text-anchor="middle" font-size="96" style="font-family:var(--font-display)" fill="${opts.labelColor || '#ffffff'}" fill-opacity=".92">${label.slice(0, 2)}</text>`;
  }
  return s + '</svg>';
}
