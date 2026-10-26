import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const source = `import { renderPiece } from './src/pieces.js';
import { renderLine } from './src/notation.js';
const names = { K:'Rei', Q:'Dama', R:'Torre', B:'Bispo', N:'Cavalo' };
for (const side of ['w','b']) {
  const row = document.querySelector('[data-side="'+side+'"]');
  for (const [piece,name] of Object.entries(names)) {
    const card=document.createElement('article');
    const large=document.createElement('div'); large.className='large'; large.append(renderPiece(document,piece,side));
    const small=document.createElement('div'); small.className='sizes';
    for (const size of [32,20]) { const icon=renderPiece(document,piece,side); icon.style.width=icon.style.height=size+'px'; small.append(icon); }
    const label=document.createElement('p'); label.textContent=name+' · '+piece;
    card.append(large,small,label); row.append(card);
  }
}
document.querySelector('.example').append(renderLine(document,'8/8/8/8/8/8/8/8 w - - 0 15',['O-O','Qxb2','Nd2','Nf5','e8=Q+']));`;
const bundled = await build({ stdin: { contents: source, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife' });
const css = await readFile('src/panel.css', 'utf8');
const theme = await readFile('theme.css', 'utf8');
const fonts = await Promise.all(['Manrope','Lora'].map(async name => {
  const bytes = await readFile(`dist/fonts/${name}.woff2`);
  return `@font-face{font-family:SF${name};src:url(data:font/woff2;base64,${bytes.toString('base64')});font-weight:${name==='Manrope'?'200 800':'500'};}`;
}));
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Stockfish Lens · Peças</title><style>
${fonts.join('\n')} ${theme} ${css}
body{margin:0;background:#101714;color:#eff3eb;font:500 14px SFManrope,sans-serif;padding:44px}
main{max-width:940px;margin:auto}h1{font-size:30px;letter-spacing:-1px;margin:8px 0 12px}h1 span{color:#9eafa4;font-weight:500}h2{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#a8bbaf;margin:28px 0 14px}
.intro{color:#9eb3a5;line-height:1.7;margin:0 0 26px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
article{border:1px solid #35483c;border-radius:15px;background:linear-gradient(145deg,#203027,#18221d);text-align:center;padding:16px}
.large{display:flex;justify-content:center;margin-bottom:12px}.large svg{width:76px;height:76px;filter:drop-shadow(0 3px 3px #0005)}
.sizes{display:flex;align-items:flex-end;justify-content:center;gap:18px;min-height:32px}article p{font-size:11px;color:#a8bcae;margin:12px 0 0}
.sample{background:#19251f;border:1px solid #344b3d;border-radius:15px;padding:22px}.example{font:500 21px/2 SFLora,Georgia,serif;margin:0}.footnote{font-size:11px;color:#829b8c;margin-top:18px}
</style><main><h1>Stockfish <span>Lens</span> · Novas peças</h1><p class="intro">Desenhos vetoriais com formas clássicas, acabamento em marfim e grafite<br>e detalhes que continuam legíveis nos lances.</p>
<h2>Brancas</h2><div class="grid" data-side="w"></div><h2>Pretas</h2><div class="grid" data-side="b"></div>
<h2>Na notação</h2><div class="sample"><p class="example"></p></div><p class="footnote">Cada peça aparece em 76, 32 e 20 px. As letras podem ser ocultadas nas preferências.</p></main>
<script>${bundled.outputFiles[0].text}</script></html>`;
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/piece-icons.html', html);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1060, height: 900 }, deviceScaleFactor: 2 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'artifacts/piece-icons.png', fullPage: true });
} finally { await browser.close(); }
console.log('Prévia: artifacts/piece-icons.png');
