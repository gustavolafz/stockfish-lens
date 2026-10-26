import { readFile, readdir, writeFile, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const excluded = new Set(['.git', 'node_modules', 'dist', 'artifacts', 'release']);
async function collect(directory, prefix = '') {
  const files = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.endsWith('.zip')) continue;
    const source = `${directory}/${entry.name}`, target = prefix + entry.name;
    if (entry.isDirectory()) Object.assign(files, await collect(source, target + '/'));
    else if (entry.isFile()) files[target] = new Uint8Array(await readFile(source));
  }
  return files;
}
await readFile('vendor/stockfish.js/src/search.cpp');
await mkdir('release', { recursive: true });
const install = `stockfish-lens-${version}.zip`, sourceName = `stockfish-lens-${version}-source.zip`;
await writeFile(`release/${install}`, zipSync(await collect('dist')));
const source = {};
for (const directory of ['src', 'scripts', 'tests', 'assets', 'docs', '.github', 'vendor'])
  Object.assign(source, await collect(directory, `stockfish-lens/${directory}/`));
for (const file of ['package.json', 'package-lock.json', 'manifest.json', 'popup.html', 'popup.css', 'theme.css', 'engine.html',
  'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'PRIVACY.md', 'LICENSE', 'NOTICE.txt', 'AGENTS.md', '.gitignore', '.gitmodules', '.gitattributes', '.nvmrc'])
  source[`stockfish-lens/${file}`] = new Uint8Array(await readFile(file));
await writeFile(`release/${sourceName}`, zipSync(source));
const sums = [];
for (const file of [install, sourceName]) sums.push(`${createHash('sha256').update(await readFile(`release/${file}`)).digest('hex')}  ${file}`);
await writeFile('release/SHA256SUMS.txt', sums.join('\n') + '\n');
// Preserve existing local download links while release assets use versioned names.
await cp(`release/${install}`, 'stockfish-lens.zip');
await cp(`release/${sourceName}`, 'stockfish-lens-source.zip');
console.log(`Entrega ${version} pronta em release/: extensão, fontes completos e SHA256SUMS.txt.`);
