// Composition propre à chaque direction artistique : enchaînement des sections
// (2 recettes par style, choisies par la graine), héros possibles, séparateurs,
// motifs décoratifs et traitement des photos.
//
// Jetons de recette : 'section' ou 'section:varianteA|varianteB'
//   hero · marquee · stripes · statement · highlights · offer (services ou produits)
//   offer2 (services d'une boutique) · gallery · band · process · about · reviews · cta · info

export const COMPOSITIONS = {
  epure: {
    heroes: ['bigtype', 'split'],
    recipes: [
      ['hero', 'statement:left', 'offer:menu', 'band:plain', 'highlights:lined', 'gallery:grid', 'offer2', 'reviews', 'cta:band', 'info'],
      ['hero', 'highlights:lined', 'gallery:strip', 'offer:grid', 'offer2', 'process:line', 'about:quote', 'cta:boxed', 'info'],
    ],
    divider: null,
    deco: [],
    css: `
.a-epure .visual img{filter:grayscale(1) contrast(1.08)}
.a-epure .gal-item figcaption{font-size:.85rem}
.a-epure .statement-text{font-weight:500;letter-spacing:-.03em}`,
  },
  editorial: {
    heroes: ['framed', 'cover'],
    recipes: [
      ['hero', 'statement:left', 'gallery:masonry', 'offer:menu', 'offer2', 'band:quote', 'process:line', 'reviews', 'cta:boxed', 'info'],
      ['hero', 'about:split', 'offer:alternate', 'offer2', 'gallery:grid', 'highlights:lined', 'cta:split', 'info'],
    ],
    divider: null,
    deco: [],
    css: `
.a-editorial .visual img{filter:saturate(.9) contrast(1.04)}
.a-editorial .gal-item figcaption{font-family:var(--font-display);font-style:italic;font-size:.95rem}
.a-editorial .statement-text::first-letter{float:left;font-size:3.3em;line-height:.8;padding:.06em .1em 0 0;color:var(--primary-ink)}
.a-editorial .band-quote blockquote{font-style:italic}`,
  },
  luxe: {
    heroes: ['overlay', 'panel'],
    recipes: [
      ['hero', 'statement:center', 'band:duo', 'offer:alternate', 'offer2', 'gallery:strip', 'band:quote', 'cta:band', 'info'],
      ['hero', 'highlights:icons', 'offer:menu', 'offer2', 'band:plain', 'gallery:masonry', 'about:quote', 'cta:image', 'info'],
    ],
    divider: null,
    deco: [['sparkle', 'tr'], ['sparkle', 'bl']],
    css: `
.a-luxe .visual img{filter:brightness(.9) contrast(1.06) saturate(.85)}
.a-luxe .visual::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.35))}
.a-luxe .statement-text{font-style:italic}
.a-luxe .step-num{font-style:italic}`,
  },
  artisan: {
    heroes: ['mosaic', 'collage', 'split'],
    recipes: [
      ['hero', 'highlights:cards', 'offer:cards', 'offer2', 'process:cards', 'gallery:polaroid', 'about:split', 'reviews', 'cta:boxed', 'info'],
      ['hero', 'statement:center', 'offer:grid', 'offer2', 'gallery:masonry', 'process:image', 'reviews', 'cta:image', 'info'],
    ],
    divider: 'scallop',
    deco: [['scribble', 'tl'], ['dots', 'br']],
    css: `
.a-artisan .visual img{filter:sepia(.14) saturate(1.06) contrast(1.02)}`,
  },
  tech: {
    heroes: ['centered', 'split'],
    recipes: [
      ['hero', 'highlights:bento', 'offer:cards', 'offer2', 'process:line', 'gallery:grid', 'cta:boxed', 'info'],
      ['hero', 'offer:grid', 'offer2', 'band:plain', 'process:cards', 'highlights:cards', 'reviews', 'cta:band', 'info'],
    ],
    divider: null,
    deco: [['plus', 'tl'], ['ring', 'br']],
    css: `
.a-tech .visual::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,var(--primary) 0%,transparent 55%,var(--accent) 120%);opacity:.32;mix-blend-mode:soft-light}
.a-tech .gal-item .visual,.a-tech .svc-imgcard{box-shadow:0 1px 2px rgba(10,14,40,.06),0 14px 34px -14px rgba(10,14,40,.22)}`,
  },
  ludique: {
    heroes: ['collage', 'split'],
    recipes: [
      ['hero', 'highlights:tiles', 'offer:cards', 'offer2', 'gallery:polaroid', 'process:cards', 'reviews', 'cta:band', 'info'],
      ['hero', 'statement:center', 'gallery:bento', 'offer:grid', 'offer2', 'process:line', 'cta:boxed', 'info'],
    ],
    divider: 'zigzag',
    deco: [['star', 'tr'], ['squiggle', 'bl'], ['ring', 'tl']],
    css: `
.a-ludique .visual img{filter:saturate(1.18) contrast(1.04)}
.a-ludique .gal-item .visual,.a-ludique .svc-imgcard{border:2.5px solid var(--text);box-shadow:6px 6px 0 var(--text)}
.a-ludique .step-num{background:var(--third);color:#1D1A2F;border:2.5px solid var(--text)}
.a-ludique .collage .visual{border:8px solid #fff;outline:2.5px solid var(--text);border-radius:6px;box-shadow:8px 8px 0 var(--text)}
.a-ludique .collage .c1{transform:rotate(-6deg)}
.a-ludique .collage .c2{transform:rotate(4deg)}
.a-ludique .collage .c3{transform:rotate(-2deg)}`,
  },
  brutal: {
    heroes: ['bigtype', 'cover'],
    recipes: [
      ['hero', 'marquee', 'offer:menu', 'offer2', 'gallery:grid', 'statement:left', 'band:plain', 'cta:band', 'info'],
      ['hero', 'marquee', 'highlights:tiles', 'gallery:bento', 'offer:cards', 'offer2', 'process:cards', 'cta:band', 'info'],
    ],
    divider: null,
    deco: [['asterisk', 'tr'], ['arrow', 'bl']],
    css: `
.a-brutal .visual img{filter:grayscale(.35) contrast(1.22) saturate(1.25)}
.a-brutal .gal-item .visual,.a-brutal .svc-imgcard,.a-brutal .band .visual{border:3px solid #000}
.a-brutal .gal-item .visual,.a-brutal .svc-imgcard{box-shadow:8px 8px 0 #000}
.a-brutal .step-num{background:var(--primary);color:var(--on-primary);border:3px solid #000}`,
  },
  nature: {
    heroes: ['panel', 'overlay', 'split'],
    recipes: [
      ['hero', 'highlights:icons', 'about:split', 'gallery:masonry', 'offer:alternate', 'offer2', 'process:image', 'cta:boxed', 'info'],
      ['hero', 'statement:center', 'offer:cards', 'offer2', 'band:quote', 'gallery:strip', 'reviews', 'cta:band', 'info'],
    ],
    divider: 'wave',
    deco: [['leaf', 'tr'], ['leaf', 'bl']],
    css: `
.a-nature .visual img{filter:saturate(.92) sepia(.1) contrast(1.02)}
.a-nature .gal-masonry .visual{border-radius:var(--radius-lg)}`,
  },
  corporate: {
    heroes: ['split', 'overlay'],
    recipes: [
      ['hero', 'highlights:cards', 'offer:cards', 'offer2', 'process:line', 'band:plain', 'about:split', 'reviews', 'cta:split', 'info'],
      ['hero', 'offer:grid', 'offer2', 'process:image', 'gallery:grid', 'highlights:icons', 'cta:band', 'info'],
    ],
    divider: null,
    deco: [],
    css: `
.a-corporate .step-num{background:var(--primary);color:var(--on-primary)}`,
  },
  retro: {
    heroes: ['centered', 'framed'],
    recipes: [
      ['hero', 'stripes', 'offer:menu', 'offer2', 'gallery:polaroid', 'statement:center', 'process:cards', 'cta:band', 'info'],
      ['hero', 'stripes', 'highlights:cards', 'band:quote', 'offer:cards', 'offer2', 'gallery:grid', 'cta:boxed', 'info'],
    ],
    divider: 'zigzag',
    deco: [['sunburst', 'tr'], ['sparkle', 'bl']],
    css: `
.a-retro .visual img{filter:sepia(.38) saturate(1.25) contrast(.96) hue-rotate(-6deg)}
.a-retro .visual::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.22;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")}
.a-retro .gal-item .visual,.a-retro .svc-imgcard{border:3px solid var(--text)}
.a-retro .step-num{background:var(--primary);color:var(--on-primary)}`,
  },
  audacieux: {
    heroes: ['cover', 'bigtype'],
    recipes: [
      ['hero', 'marquee', 'highlights:bento', 'band:duo', 'offer:cards', 'offer2', 'statement:left', 'cta:band', 'info'],
      ['hero', 'marquee', 'gallery:bento', 'offer:grid', 'offer2', 'band:quote', 'process:line', 'cta:image', 'info'],
    ],
    divider: 'diagonal',
    deco: [['asterisk', 'tr'], ['ring', 'bl']],
    css: `
.a-audacieux .visual{background:var(--primary)}
.a-audacieux .visual img{filter:grayscale(1) contrast(1.15) brightness(1.05);mix-blend-mode:multiply}
.a-audacieux .band-quote .band-bg,.a-audacieux .hero-cover .hero-bg,.a-audacieux .cta-image .band-bg{background:var(--primary)}
.a-audacieux .step-num{color:var(--accent)}`,
  },
  doux: {
    heroes: ['centered', 'collage'],
    recipes: [
      ['hero', 'highlights:icons', 'gallery:strip', 'offer:alternate', 'offer2', 'band:quote', 'process:cards', 'cta:boxed', 'info'],
      ['hero', 'statement:center', 'offer:cards', 'offer2', 'gallery:masonry', 'reviews', 'cta:image', 'info'],
    ],
    divider: 'wave-soft',
    deco: [['blob', 'tr'], ['ring', 'bl']],
    css: `
.a-doux .visual img{filter:saturate(.85) brightness(1.04) contrast(.96)}
.a-doux .visual::after{content:"";position:absolute;inset:0;pointer-events:none;background:var(--primary-soft);mix-blend-mode:soft-light;opacity:.55}
.a-doux .gal-strip .visual,.a-doux .collage .visual{border-radius:999px 999px var(--radius) var(--radius)}`,
  },
};

// Formes décoratives dessinées (couleurs prises dans la palette du site)
export const DECO_SHAPES = {
  star: '<svg viewBox="0 0 100 100"><path d="M50 5l13 29 32 3-24 21 7 32-28-17-28 17 7-32L5 37l32-3z" style="fill:var(--third);stroke:var(--text);stroke-width:4;stroke-linejoin:round"/></svg>',
  squiggle: '<svg viewBox="0 0 170 40"><path d="M6 22q14-20 28 0t28 0 28 0 28 0 28 0 18-6" style="fill:none;stroke:var(--primary);stroke-width:7;stroke-linecap:round"/></svg>',
  ring: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" style="fill:none;stroke:var(--accent);stroke-width:7"/></svg>',
  dots: '<svg viewBox="0 0 100 100">' + Array.from({ length: 25 }, (_, i) => `<circle cx="${10 + (i % 5) * 20}" cy="${10 + Math.floor(i / 5) * 20}" r="3.2" style="fill:var(--text);opacity:.45"/>`).join('') + '</svg>',
  scribble: '<svg viewBox="0 0 160 110"><path d="M20 60c4-30 52-48 92-38s40 46 6 62-90 12-104-14c-6-12 4-26 24-34" style="fill:none;stroke:var(--primary);stroke-width:4;stroke-linecap:round"/></svg>',
  sunburst: '<svg viewBox="0 0 200 200">' + Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8; const a2 = a + Math.PI / 16; return `<path d="M100 100L${(100 + Math.cos(a) * 98).toFixed(1)} ${(100 + Math.sin(a) * 98).toFixed(1)}L${(100 + Math.cos(a2) * 98).toFixed(1)} ${(100 + Math.sin(a2) * 98).toFixed(1)}Z" style="fill:var(--third);opacity:.55"/>`; }).join('') + '<circle cx="100" cy="100" r="36" style="fill:var(--primary)"/></svg>',
  sparkle: '<svg viewBox="0 0 100 100"><path d="M50 4C53 36 64 47 96 50 64 53 53 64 50 96 47 64 36 53 4 50 36 47 47 36 50 4Z" style="fill:var(--primary)"/></svg>',
  leaf: '<svg viewBox="0 0 120 160"><path d="M60 156C60 110 58 60 62 8" style="fill:none;stroke:var(--primary);stroke-width:3;stroke-linecap:round"/><path d="M61 120C38 118 18 100 14 78c22 0 40 14 47 42zM61 92c22-4 40-20 44-42-22 2-38 18-44 42zM62 62C42 58 28 42 26 22c20 4 32 18 36 40zM62 40c14-8 24-20 26-36-16 4-24 16-26 36z" style="fill:var(--primary);opacity:.85"/></svg>',
  blob: '<svg viewBox="0 0 200 200"><path d="M150 40c26 22 36 62 20 94s-58 52-96 42S10 132 14 96 46 26 82 18s46 0 68 22z" style="fill:var(--primary-soft)"/></svg>',
  plus: '<svg viewBox="0 0 120 120">' + Array.from({ length: 9 }, (_, i) => { const x = 20 + (i % 3) * 40; const y = 20 + Math.floor(i / 3) * 40; return `<path d="M${x - 7} ${y}h14M${x} ${y - 7}v14" style="stroke:var(--primary);stroke-width:3;stroke-linecap:round"/>`; }).join('') + '</svg>',
  asterisk: '<svg viewBox="0 0 100 100"><g style="fill:var(--accent)"><rect x="43" y="4" width="14" height="92"/><rect x="43" y="4" width="14" height="92" transform="rotate(45 50 50)"/><rect x="43" y="4" width="14" height="92" transform="rotate(90 50 50)"/><rect x="43" y="4" width="14" height="92" transform="rotate(135 50 50)"/></g></svg>',
  arrow: '<svg viewBox="0 0 160 80"><path d="M6 40h136M112 10l34 30-34 30" style="fill:none;stroke:var(--text);stroke-width:9;stroke-linecap:square"/></svg>',
};

// Séparateurs entre deux sections de couleurs différentes
export const DIVIDER_PATHS = {
  wave: 'M0,32 C240,64 480,0 720,32 C960,64 1200,0 1440,32 L1440,64 L0,64 Z',
  'wave-soft': 'M0,48 C360,0 1080,0 1440,48 L1440,64 L0,64 Z',
  diagonal: 'M0,64 L1440,0 L1440,64 Z',
  zigzag: 'M0,64 ' + Array.from({ length: 37 }, (_, i) => `L${i * 40},${i % 2 ? 40 : 64}`).join(' ') + ' L1440,64 Z',
  scallop: 'M0,64 ' + Array.from({ length: 24 }, (_, i) => `L${i * 60},64 A30,30 0 0 1 ${i * 60 + 60},64`).join(' ') + ' L1440,64 Z',
};
