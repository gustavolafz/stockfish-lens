import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { createHash } from 'node:crypto';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
assert.equal(manifest.version, pkg.version);
assert(manifest.permissions.includes('offscreen'));
const files = unzipSync(await readFile(`release/stockfish-lens-${pkg.version}.zip`));
assert.equal(JSON.parse(new TextDecoder().decode(files['manifest.json'])).version, pkg.version);
for (const path of ['content.js', 'engine.js', 'offscreen.js', 'offscreen.html', 'popup.js', 'background.js', 'NOTICE.txt', 'licenses/GPL-3.0.txt']) assert(files[path], path);
for (const [size, path] of Object.entries(manifest.icons)) {
  const bytes = files[path]; assert(bytes, path);
  assert.equal(Buffer.from(bytes.subarray(1, 4)).toString(), 'PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(16), Number(size)); assert.equal(view.getUint32(20), Number(size));
}
assert(Object.keys(files).some(path => path.endsWith('.wasm')));
const buildInfo = JSON.parse(new TextDecoder().decode(files['BUILD-INFO.json']));
assert.equal(buildInfo.extensionVersion, pkg.version);
for (const [file, hash] of Object.entries(buildInfo.sha256))
  assert.equal(createHash('sha256').update(files[`engine/${file}`]).digest('hex'), hash);
for (const line of (await readFile('release/SHA256SUMS.txt', 'utf8')).trim().split('\n')) {
  const [hash, file] = line.split('  ');
  assert.equal(createHash('sha256').update(await readFile(`release/${file}`)).digest('hex'), hash);
}
assert(!Object.keys(files).some(path => path.startsWith('node_modules/') || path.includes('/.git')));
const source = unzipSync(await readFile(`release/stockfish-lens-${pkg.version}-source.zip`));
for (const path of ['LICENSE', 'package-lock.json', 'offscreen.html', 'src/offscreen.js', 'src/engine-host.js', 'src/content.js', 'vendor/stockfish.js/src/search.cpp', 'vendor/stockfish.js/build.js'])
  assert(source[`stockfish-lens/${path}`], path);
const network = source['stockfish-lens/assets/engine/nn-61e7af4bb97d.nnue'];
assert(network);
assert(createHash('sha256').update(network).digest('hex').startsWith('61e7af4bb97d'));
assert(!Object.keys(source).some(path => /(^|\/)\.git(\/|$)|(^|\/)\.env($|\.)/.test(path)));
console.log(`Pacotes ${pkg.version} verificados: manifesto, motor, ícones, licenças e fontes.`);
