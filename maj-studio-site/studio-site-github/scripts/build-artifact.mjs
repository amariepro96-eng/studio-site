// Construit la démo autonome (une seule page HTML) publiée sur claude.ai
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GLOBALS = { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM', jszip: 'JSZip' };

const globalsPlugin = {
  name: 'globals',
  setup(b) {
    b.onResolve({ filter: /^(react|react-dom|react-dom\/client|jszip)$/ }, (a) => ({ path: a.path, namespace: 'global' }));
    b.onLoad({ filter: /.*/, namespace: 'global' }, (a) => ({ contents: `module.exports = window.${GLOBALS[a.path]};`, loader: 'js' }));
  },
};

const result = await build({
  entryPoints: [path.join(root, 'src/artifact/entry.jsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  target: ['es2019'],
  legalComments: 'none',
  plugins: [globalsPlugin],
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const css = fs.readFileSync(path.join(root, 'src/ui/styles.css'), 'utf8');

const html = `<title>Studio Site</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script>${js}</script>
`;

const out = path.join(root, 'dist', 'studio-site-demo.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('Démo construite :', out, Math.round(html.length / 1024) + ' Ko');
