import { build } from 'esbuild';
import { cp, mkdir, readdir, rm, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
await rm('dist', { recursive: true, force: true });
await mkdir('dist/engine', { recursive: true });
await mkdir('dist/licenses', { recursive: true });
await mkdir('dist/fonts', { recursive: true });
await Promise.all([
  build({ entryPoints: ['src/content.js', 'src/engine.js', 'src/popup.js', 'src/offscreen.js'], bundle: true,
    outdir: 'dist', format: 'iife', target: 'chrome110', legalComments: 'eof', loader: { '.css': 'text' } }),
  build({ entryPoints: ['src/background.js'], bundle: true,
    outdir: 'dist', format: 'iife', globalName: 'StockfishLensCommands', target: 'chrome110', legalComments: 'eof' })
]);
for (const name of ['manifest.json', 'engine.html', 'offscreen.html', 'popup.html', 'popup.css', 'theme.css']) {
  await cp(name, `dist/${name}`);
}
await cp('assets/icons', 'dist/icons', { recursive: true });
const files = await readdir('node_modules/stockfish/bin');
const loader = files.find(name => /^stockfish-.*-lite-single\.js$/.test(name));
if (!loader) throw new Error('Build lite-single do Stockfish não encontrado.');
await cp(`node_modules/stockfish/bin/${loader}`, `dist/engine/${loader}`);
await cp(`node_modules/stockfish/bin/${loader.replace(/\.js$/, '.wasm')}`,
  `dist/engine/${loader.replace(/\.js$/, '.wasm')}`);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile('dist/engine-config.json', JSON.stringify({ loader: `engine/${loader}`, version }));
await cp('LICENSE', 'dist/licenses/GPL-3.0.txt');
await cp('assets/engine/CC0-1.0.txt', 'dist/licenses/NNUE-CC0-1.0.txt');
await cp('node_modules/chess.js/LICENSE', 'dist/licenses/chess.js-LICENSE');
await cp('NOTICE.txt', 'dist/NOTICE.txt');
for (const [pkg, file, name] of [
  ['@fontsource-variable/manrope', 'manrope-latin-wght-normal.woff2', 'Manrope'],
  ['@fontsource/lora', 'lora-latin-500-normal.woff2', 'Lora'],
  ['@fontsource/noto-sans-symbols-2', 'noto-sans-symbols-2-symbols-400-normal.woff2', 'ChessSymbols']
]) {
  await cp(`node_modules/${pkg}/files/${file}`, `dist/fonts/${name}.woff2`);
  await cp(`node_modules/${pkg}/LICENSE`, `dist/licenses/${name}-OFL.txt`);
}
const engineFiles = [loader, loader.replace(/\.js$/, '.wasm')];
await writeFile('dist/BUILD-INFO.json', JSON.stringify({ extensionVersion: version,
  enginePackage: 'stockfish@19.0.1', engineVariant: 'lite-single',
  engineSource: 'https://github.com/nmrugg/stockfish.js/tree/v19.0.1',
  engineSourceCommit: '0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6',
  sha256: Object.fromEntries(await Promise.all(engineFiles.map(async file =>
    [file, createHash('sha256').update(await readFile(`dist/engine/${file}`)).digest('hex')])) )
}, null, 2) + '\n');
console.log(`Extensão pronta em dist/ (${loader}).`);
