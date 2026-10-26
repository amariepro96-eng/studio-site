// Les 12 directions artistiques. Chacune a ses polices, palettes, mises en page
// possibles (variantes) et un peu de CSS qui lui donne son caractère.

const gf = (name, weights) => ({ name, spec: `${name.replace(/ /g, '+')}:wght@${weights}` });

export const ARCHETYPES = [
  {
    id: 'epure',
    name: 'Épuré',
    pitch: 'Minimal à la suisse : grille nette, grands titres, beaucoup de blanc, une seule couleur forte.',
    fonts: { display: gf('Hanken Grotesk', '400;500;600;700'), body: null },
    tokens: { radius: '0px', radiusLg: '0px', btnRadius: '0px', iconRadius: '0px', displayWeight: 600, tracking: '-0.035em', case: 'none', lh: 1.02, h1: 'clamp(2.6rem, 6.2vw, 5.8rem)', h1Big: 'clamp(3rem, 9vw, 8.5rem)', bodySize: '17px', sectionPad: 'clamp(72px, 9vw, 128px)' },
    palettes: [
      { bg: '#FFFFFF', surface: '#F2F2EF', text: '#000000', muted: '#565656', primary: '#E2231A', accent: '#000000' },
      { bg: '#F1F1EC', surface: '#FFFFFF', text: '#101010', muted: '#5A5A55', primary: '#0040E6', accent: '#101010' },
    ],
    variants: { nav: ['bar'], hero: ['bigtype', 'split'], features: ['lined'], services: ['menu', 'grid'], about: ['split', 'quote'], cta: ['band', 'boxed'], footer: ['big', 'columns'], products: ['minimal'] },
    art: 'grid',
    footerMode: 'invert',
    moods: { minimaliste: 3, moderne: 2, pro: 1 },
    sectors: ['conseil', 'juridique', 'photo', 'tech', 'immobilier', 'commerce'],
    css: `
.a-epure .section + .section{border-top:1px solid var(--line)}
.a-epure .section.alt{border-top:0}
.a-epure .svc-card{border:0;border-top:1px solid var(--line);border-radius:0;padding:22px 0 8px;background:transparent}
.a-epure .hero-visual img,.a-epure .about-visual img{filter:grayscale(1) contrast(1.06)}
.a-epure .btn.ghost{border-width:1px}
.a-epure .logo{font-weight:700;letter-spacing:-0.04em}
.a-epure .cta-band{text-align:left}
.a-epure .cta-band .wrap{display:flex;justify-content:space-between;align-items:flex-end;gap:32px;flex-wrap:wrap}
.a-epure .page-hero{border-bottom:1px solid var(--line)}`,
  },
  {
    id: 'editorial',
    name: 'Éditorial',
    pitch: 'Esprit magazine : grande typographie à empattements, lettrines, mise en page de revue.',
    fonts: { display: gf('Fraunces', '400;500;600'), body: gf('Commissioner', '400;500;600') },
    tokens: { radius: '2px', radiusLg: '2px', btnRadius: '2px', iconRadius: '50%', displayWeight: 400, tracking: '-0.02em', case: 'none', lh: 1.04, h1: 'clamp(2.6rem, 5.6vw, 5.2rem)', h1Big: 'clamp(3rem, 8vw, 7.4rem)', bodySize: '17px', sectionPad: 'clamp(72px, 9vw, 120px)' },
    palettes: [
      { bg: '#F8F5EF', surface: '#EFE9DF', text: '#1F1B17', muted: '#5E554C', primary: '#7B1E2C', accent: '#2C4A5A' },
      { bg: '#FFFFFF', surface: '#F1EFEA', text: '#16181D', muted: '#575B63', primary: '#1D3F8F', accent: '#B5452F' },
    ],
    variants: { nav: ['center'], hero: ['framed', 'bigtype'], features: ['lined', 'icons'], services: ['menu', 'alternate'], about: ['quote', 'split'], cta: ['boxed', 'split'], footer: ['columns'], products: ['minimal'] },
    art: 'serif',
    footerMode: 'surface',
    moods: { luxe: 1, minimaliste: 1, chaleureux: 1, retro: 1 },
    sectors: ['restaurant', 'photo', 'mode', 'juridique', 'tourisme', 'immobilier', 'beaute'],
    css: `
.a-editorial h1,.a-editorial h2{font-variation-settings:"opsz" 144}
.a-editorial h1 em,.a-editorial .logo{font-style:italic}
.a-editorial .site-header{border-bottom:1px solid var(--line)}
.a-editorial .nav-center .nav-links{border-top:1px solid var(--line-soft);padding-top:12px}
.a-editorial .story p:first-child::first-letter{float:left;font-family:var(--font-display);font-size:4.2em;line-height:.82;padding:6px 12px 0 0;color:var(--primary-ink)}
.a-editorial .feat-lined .feature{border-top:1px solid var(--line)}
.a-editorial .about-quote blockquote{font-style:italic}
.a-editorial .hero-bigtype h1{max-width:18ch}`,
  },
  {
    id: 'luxe',
    name: 'Luxe',
    pitch: 'Haut de gamme : fond profond, or discret, typographie classique et beaucoup d’espace.',
    fonts: { display: gf('Cormorant Garamond', '500;600'), body: gf('Jost', '300;400;500') },
    tokens: { radius: '0px', radiusLg: '0px', btnRadius: '0px', iconRadius: '50%', displayWeight: 500, tracking: '-0.005em', case: 'none', lh: 1.06, h1: 'clamp(2.8rem, 6vw, 5.6rem)', h1Big: 'clamp(3rem, 8vw, 7rem)', bodySize: '16.5px', sectionPad: 'clamp(88px, 10vw, 150px)' },
    palettes: [
      { bg: '#15120F', surface: '#1F1A16', text: '#EEE7DC', muted: '#A99F91', primary: '#C9A66B', accent: '#C9A66B' },
      { bg: '#F6F1EA', surface: '#EDE5D9', text: '#1E1915', muted: '#6B6056', primary: '#8C6A3F', accent: '#1E1915' },
    ],
    variants: { nav: ['split', 'center'], hero: ['overlay', 'centered'], features: ['icons'], services: ['menu', 'alternate'], about: ['quote', 'split'], cta: ['band'], footer: ['big', 'columns'], products: ['minimal'] },
    art: 'arch',
    footerMode: 'deep',
    moods: { luxe: 3, zen: 1 },
    sectors: ['immobilier', 'beaute', 'mode', 'tourisme', 'restaurant', 'evenementiel', 'auto'],
    css: `
.a-luxe body{font-weight:300}
.a-luxe .logo{letter-spacing:.3em;text-transform:uppercase;font-size:1.05rem;font-weight:600}
.a-luxe .btn{background:transparent;color:var(--primary-ink);border:1px solid currentColor;text-transform:uppercase;letter-spacing:.2em;font-size:.74rem;font-weight:500;padding:1.25em 2.2em}
.a-luxe .btn:hover{background:var(--primary);color:var(--on-primary);border-color:var(--primary)}
.a-luxe .hero-overlay .btn{color:#fff}
.a-luxe .btn.ghost{opacity:.8}
.a-luxe .f-icon{background:transparent!important;border:1px solid var(--primary-ink);color:var(--primary-ink)!important}
.a-luxe .hero-visual,.a-luxe .about-visual,.a-luxe .alt-visual{border-radius:999px 999px 0 0!important}
.a-luxe .menu-dots{border-bottom-style:solid;border-bottom-width:1px;opacity:.4}
.a-luxe .hero-centered h1,.a-luxe .page-hero h1{font-style:italic}
.a-luxe .cta-band{background:var(--surface);color:var(--text)}
.a-luxe .cta-band .btn{background:transparent;color:var(--primary-ink)}`,
  },
  {
    id: 'artisan',
    name: 'Artisan chaleureux',
    pitch: 'Chaleureux et fait main : tons terre, formes douces, typographie généreuse.',
    fonts: { display: gf('Young Serif', '400'), body: gf('Figtree', '400;500;600;700') },
    tokens: { radius: '18px', radiusLg: '28px', btnRadius: '14px', iconRadius: '16px', displayWeight: 400, tracking: '-0.01em', case: 'none', lh: 1.08, h1: 'clamp(2.5rem, 5.4vw, 4.6rem)', h1Big: 'clamp(2.8rem, 7vw, 6.2rem)', bodySize: '17px', sectionPad: 'clamp(64px, 8vw, 112px)' },
    palettes: [
      { bg: '#FBF4EA', surface: '#F2E4D0', text: '#2C1E14', muted: '#6B5646', primary: '#A4441C', accent: '#3D5A47' },
      { bg: '#F7F1E8', surface: '#EADCC6', text: '#2A1D17', muted: '#6A584B', primary: '#6E3B2A', accent: '#C9902A' },
    ],
    variants: { nav: ['bar', 'pill'], hero: ['split', 'mosaic'], features: ['cards', 'icons'], services: ['grid', 'menu'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
    art: 'blob',
    footerMode: 'invert',
    moods: { chaleureux: 3, retro: 1, nature: 1 },
    sectors: ['restaurant', 'boulangerie', 'artisan', 'commerce', 'tourisme', 'association'],
    css: `
.a-artisan .hero-split .hero-visual{border-radius:240px 240px 28px 28px}
.a-artisan .feat-cards .feature{background:var(--bg);border:1.5px solid var(--line-soft)}
.a-artisan .section.alt .feat-cards .feature{background:var(--bg)}
.a-artisan .about-visual{border-radius:28px 28px 240px 28px}
.a-artisan .logo{font-size:1.5rem}`,
  },
  {
    id: 'tech',
    name: 'Moderne',
    pitch: 'Moderne et dynamique : dégradés lumineux, cartes nettes, typographie géométrique.',
    fonts: { display: gf('Space Grotesk', '500;600;700'), body: gf('Plus Jakarta Sans', '400;500;600') },
    tokens: { radius: '16px', radiusLg: '24px', btnRadius: '999px', iconRadius: '12px', displayWeight: 600, tracking: '-0.03em', case: 'none', lh: 1.04, h1: 'clamp(2.6rem, 5.8vw, 5rem)', h1Big: 'clamp(3rem, 8vw, 6.8rem)', bodySize: '16.5px', sectionPad: 'clamp(72px, 8vw, 116px)' },
    palettes: [
      { bg: '#F7F8FC', surface: '#FFFFFF', text: '#0E1330', muted: '#545B7A', primary: '#4C3BFF', accent: '#00A99A' },
      { bg: '#0B1020', surface: '#141B36', text: '#E8ECFF', muted: '#9AA3C7', primary: '#7C6CFF', accent: '#2BD9C6' },
    ],
    variants: { nav: ['pill', 'bar'], hero: ['centered', 'split'], features: ['cards'], services: ['grid'], about: ['split'], cta: ['boxed', 'band'], footer: ['columns'], products: ['cards'] },
    art: 'mesh',
    footerMode: 'deep',
    moods: { tech: 3, moderne: 2, pro: 1 },
    sectors: ['tech', 'conseil', 'education', 'sport', 'evenementiel', 'auto'],
    css: `
.a-tech .hero{background:radial-gradient(55% 60% at 12% 8%,var(--primary-soft),transparent 70%),radial-gradient(45% 55% at 92% 18%,var(--accent-soft),transparent 70%)}
.a-tech .feat-cards .feature,.a-tech .svc-card,.a-tech .cta-boxed .cta-box{background:var(--surface);border:1px solid var(--line-soft);box-shadow:0 1px 2px rgba(10,14,40,.05),0 12px 32px -12px rgba(10,14,40,.12)}
.a-tech .f-icon{background:linear-gradient(135deg,var(--primary),var(--accent))!important;color:#fff!important}
.a-tech .cta-boxed .cta-box{background:linear-gradient(120deg,var(--primary),var(--accent));color:#fff;border:0}
.a-tech .cta-boxed .cta-box .btn{background:#fff;color:#0E1330}
.a-tech .cta-boxed .cta-box p{color:rgba(255,255,255,.85)}`,
  },
  {
    id: 'ludique',
    name: 'Coloré & ludique',
    pitch: 'Joyeux et accessible : couleurs vives, contours épais, ombres décalées, formes rondes.',
    fonts: { display: gf('Fredoka', '500;600;700'), body: gf('Nunito', '400;600;700') },
    tokens: { radius: '22px', radiusLg: '28px', btnRadius: '999px', iconRadius: '16px', displayWeight: 600, tracking: '-0.01em', case: 'none', lh: 1.04, h1: 'clamp(2.6rem, 6vw, 5rem)', h1Big: 'clamp(3rem, 8vw, 6.6rem)', bodySize: '17px', sectionPad: 'clamp(64px, 8vw, 108px)' },
    palettes: [
      { bg: '#FFF8E7', surface: '#FFFFFF', text: '#1D1A2F', muted: '#565269', primary: '#FF5C4D', accent: '#22A699', third: '#FFC93C' },
      { bg: '#EEF5FF', surface: '#FFFFFF', text: '#151833', muted: '#4F5578', primary: '#6C4CF5', accent: '#FF8A3D', third: '#3DD6A3' },
    ],
    variants: { nav: ['pill', 'bar'], hero: ['split', 'centered'], features: ['tiles', 'cards'], services: ['grid'], about: ['split'], cta: ['band', 'boxed'], footer: ['columns'], products: ['cards'] },
    art: 'confetti',
    footerMode: 'invert',
    moods: { fun: 3, chaleureux: 1 },
    sectors: ['education', 'association', 'commerce', 'evenementiel', 'boulangerie', 'sport'],
    css: `
.a-ludique .btn{border:2.5px solid var(--text);box-shadow:4px 4px 0 var(--text);transition:transform .15s,box-shadow .15s}
.a-ludique .btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--text)}
.a-ludique .btn.ghost{background:var(--surface);color:var(--text)}
.a-ludique .feat-cards .feature,.a-ludique .svc-card,.a-ludique .product .p-visual,.a-ludique .cta-boxed .cta-box{border:2.5px solid var(--text);box-shadow:6px 6px 0 var(--text);background:var(--surface)}
.a-ludique .hero-visual,.a-ludique .about-visual{border:3px solid var(--text);box-shadow:10px 10px 0 var(--third);transform:rotate(-1.5deg)}
.a-ludique .nav-pill .nav{border:2.5px solid var(--text);box-shadow:4px 4px 0 var(--text)}
.a-ludique .feat-tiles .feature{border:2.5px solid var(--text)}
.a-ludique .feat-tiles .feature:nth-child(3n){background:var(--third);color:#1D1A2F}`,
  },
  {
    id: 'brutal',
    name: 'Brutaliste',
    pitch: 'Brut et percutant : bordures noires épaisses, capitales massives, couleurs franches.',
    fonts: { display: gf('Archivo Black', '400'), body: gf('Archivo', '400;500;700') },
    tokens: { radius: '0px', radiusLg: '0px', btnRadius: '0px', iconRadius: '0px', displayWeight: 400, tracking: '-0.02em', case: 'uppercase', lh: 0.95, h1: 'clamp(2.6rem, 6.6vw, 6rem)', h1Big: 'clamp(3rem, 10vw, 9rem)', bodySize: '17px', sectionPad: 'clamp(64px, 8vw, 110px)' },
    palettes: [
      { bg: '#FFFFFF', surface: '#F0EEE6', text: '#000000', muted: '#2E2E2E', primary: '#FFE14D', accent: '#FF4F1F' },
      { bg: '#ECEAE3', surface: '#FFFFFF', text: '#000000', muted: '#2E2E2E', primary: '#3D5AFE', accent: '#FFD600' },
    ],
    variants: { nav: ['bar'], hero: ['bigtype', 'framed'], features: ['tiles', 'lined'], services: ['grid', 'menu'], about: ['quote'], cta: ['band'], footer: ['big'], products: ['cards'] },
    art: 'blocks',
    footerMode: 'invert',
    marquee: true,
    moods: { audacieux: 2, urbain: 3, moderne: 1 },
    sectors: ['sport', 'photo', 'mode', 'artisan', 'auto', 'tech', 'evenementiel'],
    css: `
.a-brutal .site-header{border-bottom:3px solid #000}
.a-brutal .section{border-bottom:3px solid #000}
.a-brutal .svc-card,.a-brutal .feat-tiles .feature,.a-brutal .product .p-visual,.a-brutal .hero-visual,.a-brutal .about-visual,.a-brutal .faq details{border:3px solid #000;box-shadow:8px 8px 0 #000}
.a-brutal .btn{border:3px solid #000;box-shadow:5px 5px 0 #000;text-transform:uppercase;font-weight:700;letter-spacing:.02em}
.a-brutal .btn.ghost{background:#fff;color:#000}
.a-brutal .logo{font-size:1.5rem}
.a-brutal .feat-tiles .feature:nth-child(3n+2){background:var(--accent);color:var(--on-accent)}
.a-brutal .cta-band .btn{border-color:#000}
.a-brutal input,.a-brutal textarea,.a-brutal select{border:2px solid #000!important;border-radius:0!important}`,
  },
  {
    id: 'nature',
    name: 'Nature',
    pitch: 'Naturel et apaisant : verts profonds, formes organiques, typographie douce et lisible.',
    fonts: { display: gf('Lora', '500;600'), body: gf('Karla', '400;500;700') },
    tokens: { radius: '14px', radiusLg: '32px', btnRadius: '999px', iconRadius: '0 50% 0 50%', displayWeight: 500, tracking: '-0.015em', case: 'none', lh: 1.1, h1: 'clamp(2.5rem, 5.4vw, 4.6rem)', h1Big: 'clamp(2.8rem, 7.4vw, 6.4rem)', bodySize: '17px', sectionPad: 'clamp(68px, 8vw, 116px)' },
    palettes: [
      { bg: '#F3F5EE', surface: '#E4EADA', text: '#1F2A1F', muted: '#556252', primary: '#3F6B45', accent: '#B98A2E' },
      { bg: '#FAF8F2', surface: '#EDE8DA', text: '#24261C', muted: '#5D5F4E', primary: '#5B7F3A', accent: '#B8643A' },
    ],
    variants: { nav: ['bar', 'center'], hero: ['split', 'overlay', 'framed'], features: ['icons', 'cards'], services: ['alternate', 'grid'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
    art: 'leaf',
    footerMode: 'primary',
    moods: { nature: 3, zen: 1, chaleureux: 1 },
    sectors: ['sante', 'tourisme', 'boulangerie', 'association', 'education', 'commerce'],
    css: `
.a-nature .hero-split .hero-visual{border-radius:58% 42% 52% 48% / 46% 54% 46% 54%}
.a-nature .about-visual{border-radius:42% 58% 46% 54% / 52% 44% 56% 48%}
.a-nature .feat-cards .feature{background:var(--bg)}`,
  },
  {
    id: 'corporate',
    name: 'Professionnel',
    pitch: 'Sérieux et rassurant : structure claire, bleu de confiance, informations faciles à trouver.',
    fonts: { display: gf('Manrope', '500;700;800'), body: null },
    tokens: { radius: '10px', radiusLg: '16px', btnRadius: '8px', iconRadius: '10px', displayWeight: 800, tracking: '-0.03em', case: 'none', lh: 1.06, h1: 'clamp(2.4rem, 5vw, 4.4rem)', h1Big: 'clamp(2.8rem, 7vw, 6rem)', bodySize: '16.5px', sectionPad: 'clamp(64px, 7.5vw, 104px)' },
    palettes: [
      { bg: '#FFFFFF', surface: '#F2F5F9', text: '#0F1B2D', muted: '#4D5B70', primary: '#123C8C', accent: '#1592B8' },
      { bg: '#FFFFFF', surface: '#F1F5F2', text: '#0F211B', muted: '#4A5C55', primary: '#0E5C4A', accent: '#D49A1F' },
    ],
    variants: { nav: ['bar'], hero: ['split', 'overlay'], features: ['cards', 'icons'], services: ['grid'], about: ['split'], cta: ['band', 'split'], footer: ['columns'], products: ['cards'] },
    art: 'lines',
    footerMode: 'primary-deep',
    topbar: true,
    moods: { pro: 3, moderne: 1 },
    sectors: ['conseil', 'juridique', 'immobilier', 'artisan', 'sante', 'auto', 'education'],
    css: `
.a-corporate .feat-cards .feature{background:var(--bg);border:1px solid var(--line-soft);border-top:4px solid var(--primary)}
.a-corporate .svc-card{border-left:4px solid var(--primary)}
.a-corporate .topbar{background:var(--primary);color:var(--on-primary)}`,
  },
  {
    id: 'retro',
    name: 'Rétro',
    pitch: 'Vintage et sympathique : couleurs années 70, titres épais, bandes et soleils couchants.',
    fonts: { display: gf('Alfa Slab One', '400'), body: gf('Libre Franklin', '400;500;600') },
    tokens: { radius: '14px', radiusLg: '22px', btnRadius: '999px', iconRadius: '50%', displayWeight: 400, tracking: '0em', case: 'none', lh: 1.04, h1: 'clamp(2.4rem, 5.6vw, 4.8rem)', h1Big: 'clamp(2.8rem, 8vw, 6.6rem)', bodySize: '17px', sectionPad: 'clamp(64px, 8vw, 110px)' },
    palettes: [
      { bg: '#F4EAD5', surface: '#EADBB9', text: '#2B2118', muted: '#5F5040', primary: '#C8442F', accent: '#1F6F78', third: '#E6A93A' },
      { bg: '#EFE7DA', surface: '#E2D5BF', text: '#1F2622', muted: '#56584F', primary: '#2E5E4E', accent: '#E07A2E', third: '#E8B84A' },
    ],
    variants: { nav: ['center', 'bar'], hero: ['centered', 'split'], features: ['cards', 'icons'], services: ['menu', 'grid'], about: ['quote', 'split'], cta: ['band'], footer: ['big', 'columns'], products: ['cards'] },
    art: 'sunset',
    footerMode: 'invert',
    stripes: true,
    moods: { retro: 3, fun: 1, chaleureux: 1 },
    sectors: ['restaurant', 'boulangerie', 'commerce', 'auto', 'evenementiel', 'mode'],
    css: `
.a-retro .btn{box-shadow:0 4px 0 var(--primary-deep)}
.a-retro .btn:hover{transform:translateY(1px);box-shadow:0 3px 0 var(--primary-deep)}
.a-retro .btn.ghost{box-shadow:none}
.a-retro .stripes{height:18px;background:linear-gradient(var(--third) 0 33%,var(--primary) 33% 66%,var(--accent) 66%)}
.a-retro .feat-cards .feature{background:var(--bg);border:2px solid var(--text)}
.a-retro .hero-visual,.a-retro .about-visual{border:3px solid var(--text)}
.a-retro .logo{font-size:1.45rem}`,
  },
  {
    id: 'audacieux',
    name: 'Audacieux',
    pitch: 'Impactant : fond profond, titres géants, couleurs vibrantes et rythme graphique.',
    fonts: { display: gf('Syne', '700;800'), body: gf('DM Sans', '400;500;700') },
    tokens: { radius: '0px', radiusLg: '0px', btnRadius: '999px', iconRadius: '50%', displayWeight: 800, tracking: '-0.035em', case: 'uppercase', lh: 0.95, h1: 'clamp(2.6rem, 6.4vw, 6rem)', h1Big: 'clamp(3rem, 10vw, 9.4rem)', bodySize: '17px', sectionPad: 'clamp(72px, 9vw, 128px)' },
    palettes: [
      { bg: '#1B1940', surface: '#25225A', text: '#FFFFFF', muted: '#C3C1EA', primary: '#FF6B3D', accent: '#F5C542' },
      { bg: '#0F2D29', surface: '#163D38', text: '#F2FBF8', muted: '#A9C9C1', primary: '#FF4F9A', accent: '#FFD166' },
    ],
    variants: { nav: ['bar', 'split'], hero: ['bigtype', 'overlay'], features: ['tiles'], services: ['grid', 'alternate'], about: ['quote'], cta: ['band'], footer: ['big'], products: ['cards'] },
    art: 'stripes',
    footerMode: 'deep',
    marquee: true,
    moods: { audacieux: 3, urbain: 1, fun: 1, moderne: 1 },
    sectors: ['sport', 'evenementiel', 'mode', 'tech', 'auto', 'photo'],
    css: `
.a-audacieux .svc-card{background:var(--surface);border:0}
.a-audacieux .hero-bigtype h1{max-width:none}
.a-audacieux .feat-tiles .feature:nth-child(3n+2){background:var(--accent);color:var(--on-accent)}
.a-audacieux .feat-tiles .feature:nth-child(3n){background:var(--surface);color:var(--text)}
.a-audacieux .about-quote blockquote{text-transform:uppercase;font-weight:800;letter-spacing:-.02em}`,
  },
  {
    id: 'doux',
    name: 'Doux & bien-être',
    pitch: 'Doux et rassurant : couleurs poudrées, arches, beaucoup de rondeur et de calme.',
    fonts: { display: gf('Marcellus', '400'), body: gf('Mulish', '400;600;700') },
    tokens: { radius: '24px', radiusLg: '40px', btnRadius: '999px', iconRadius: '50%', displayWeight: 400, tracking: '0em', case: 'none', lh: 1.12, h1: 'clamp(2.4rem, 5.2vw, 4.4rem)', h1Big: 'clamp(2.8rem, 7vw, 6rem)', bodySize: '17px', sectionPad: 'clamp(72px, 8.5vw, 124px)' },
    palettes: [
      { bg: '#FCF6F3', surface: '#F5E7E1', text: '#3A2E33', muted: '#77666C', primary: '#B4606F', accent: '#7FA393' },
      { bg: '#F5F7FA', surface: '#E8ECF4', text: '#262B3A', muted: '#5F6578', primary: '#5E6FB0', accent: '#D99A84' },
    ],
    variants: { nav: ['center', 'pill'], hero: ['centered', 'split'], features: ['icons'], services: ['grid', 'alternate'], about: ['split', 'quote'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
    art: 'soft',
    footerMode: 'surface',
    moods: { zen: 3, chaleureux: 1, luxe: 1, nature: 1 },
    sectors: ['beaute', 'sante', 'evenementiel', 'education', 'mode'],
    css: `
.a-doux .hero-visual,.a-doux .about-visual,.a-doux .alt-visual{border-radius:999px 999px var(--radius) var(--radius)!important}
.a-doux .svc-card{background:var(--bg);border:0;box-shadow:0 10px 40px -18px rgba(80,40,50,.25)}
.a-doux .cta-boxed .cta-box{background:linear-gradient(135deg,var(--primary-soft),var(--accent-soft))}`,
  },
];

export const ARCHETYPE_MAP = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]));

export const MOODS = [
  { id: 'moderne', label: 'Moderne' },
  { id: 'luxe', label: 'Élégant & luxe' },
  { id: 'chaleureux', label: 'Chaleureux' },
  { id: 'minimaliste', label: 'Minimaliste' },
  { id: 'fun', label: 'Coloré & fun' },
  { id: 'nature', label: 'Nature & bio' },
  { id: 'pro', label: 'Professionnel' },
  { id: 'audacieux', label: 'Audacieux' },
  { id: 'retro', label: 'Rétro / vintage' },
  { id: 'zen', label: 'Doux & zen' },
  { id: 'urbain', label: 'Urbain / brut' },
  { id: 'tech', label: 'Tech / innovant' },
];
