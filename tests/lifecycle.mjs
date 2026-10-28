import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const extension = fileURLToPath(new URL('../dist', import.meta.url));
const html = await readFile('tests/fixtures/chesscom.html', 'utf8');
const context = await chromium.launchPersistentContext('', {
  headless: true, channel: process.env.CHROMIUM_PATH ? undefined : 'chromium',
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-sandbox']
});
await context.route('https://www.chess.com/**', route => route.fulfill({ body: html, contentType: 'text/html' }));
// A development extension must remain enabled when Chrome reloads it.
const setup = await context.newPage();
await setup.goto('chrome://extensions/');
await setup.evaluate(() => chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }));
await setup.close();
const sf = (page, selector) => page.locator(`#stockfish-lens ${selector}`);
const state = (page, expected, timeout = 25000) => page.waitForFunction(expected =>
  document.querySelector('#stockfish-lens')?.shadowRoot.querySelector('.panel').dataset.state === expected, expected, { timeout });
async function expand(page) {
  await sf(page, '.panel').waitFor();
  if (await sf(page, '.panel').evaluate(el => el.classList.contains('collapsed'))) await sf(page, '.collapse').click();
}
async function freezeBoot(page, once = false) {
  await page.addInitScript(once => {
    if (location.protocol !== 'chrome-extension:' || !location.pathname.endsWith('/engine.html')) return;
    const fetchFile = window.fetch.bind(window);
    window.fetch = (...args) => {
      if (String(args[0]) === 'engine-config.json' && (!once || !sessionStorage.getItem('frozenBoot'))) {
        sessionStorage.setItem('frozenBoot', '1'); return new Promise(() => {});
      }
      return fetchFile(...args);
    };
  }, once);
}
let page;
try {
  page = await context.newPage(); await freezeBoot(page, true);
  await page.goto('https://www.chess.com/game/pause-boot'); await expand(page);
  await state(page, 'loading');
  await sf(page, 'iframe').waitFor({ state: 'attached' });
  assert(await sf(page, '.refresh').isEnabled());
  assert.equal(await sf(page, '.restart-engine').getAttribute('aria-label'), 'Reiniciar motor');
  await sf(page, '.toggle').click(); await state(page, 'paused', 1500);
  assert.equal(await sf(page, 'iframe').count(), 0);
  await page.waitForTimeout(15500); // The canceled startup deadline must not revive the engine.
  assert.equal(await sf(page, '.panel').getAttribute('data-state'), 'paused');
  await sf(page, '.refresh').click(); await state(page, 'ready');
  console.log('PASS: pause cancels a hung initialization immediately, survives the old deadline and resumes with real WASM');

  // Inject a storage failure into the real content-script world, not the page world.
  const cdp = await context.newCDPSession(page), worlds = [];
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context));
  await cdp.send('Runtime.enable');
  const world = worlds.find(world => world.name === 'Stockfish Lens' && !world.auxData?.isDefault);
  assert(world, JSON.stringify(worlds.map(world => ({ name: world.name, origin: world.origin }))));
  const injected = await cdp.send('Runtime.evaluate', { contextId: world.id, returnByValue: true,
    expression: `globalThis.originalStorageSet = chrome.storage.local.set;
      globalThis.stalledStorageSet = () => new Promise(() => {});
      chrome.storage.local.set = globalThis.stalledStorageSet;
      chrome.storage.local.set === globalThis.stalledStorageSet` });
  assert.equal(injected.result.value, true);
  await sf(page, '.toggle').click(); await state(page, 'paused', 1500);
  assert.equal(await sf(page, '.move').getAttribute('data-san'), null);
  assert.equal(await sf(page, 'iframe').count(), 0);
  await cdp.send('Runtime.evaluate', { contextId: world.id, expression: 'chrome.storage.local.set = globalThis.originalStorageSet' });
  await cdp.detach();
  await sf(page, '.toggle').click(); await state(page, 'ready');
  console.log('PASS: pause takes effect even when chrome.storage.local.set never resolves; resume does not depend on a storage change echo');

  // Real extension reload invalidates the content-script context still attached to the page.
  const worker = context.serviceWorkers().find(worker => worker.url().endsWith('/background.js'));
  const nextWorker = context.waitForEvent('serviceworker', { predicate: candidate => candidate !== worker, timeout: 10000 }).catch(() => null);
  await worker.evaluate(() => chrome.runtime.reload()).catch(() => {});
  await state(page, 'disconnected', 7000);
  assert.equal(await sf(page, '.refresh').textContent(), 'Atualizar página');
  assert(await sf(page, '.refresh').isEnabled());
  assert(await sf(page, '.toggle').isDisabled());
  assert.equal(await sf(page, '.move').getAttribute('data-san'), null);
  await nextWorker;
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), sf(page, '.refresh').click()]);
  await state(page, 'ready', 7000); await expand(page);
  assert.equal(await sf(page, '.panel').count(), 1);
  console.log('PASS: a real extension reload becomes an explicit reconnect state; the page reload button restores a single working panel');
  await page.close();

  page = await context.newPage(); await freezeBoot(page);
  await page.goto('https://www.chess.com/game/outer-startup-deadline'); await expand(page);
  await state(page, 'ready');
  await sf(page, '.protocol').evaluate(el => el.open = true);
  await sf(page, '.uci-log').filter({ hasText: 'não iniciou em 15 segundos' }).waitFor();
  assert.equal(await sf(page, 'iframe').count(), 0);
  assert(await sf(page, '.move').getAttribute('data-san'));
  console.log('PASS: the parent deadline recovers an iframe whose configuration fetch never resolves, using the real offscreen engine');
  await page.close();

  page = await context.newPage();
  await page.addInitScript(() => {
    if (location.protocol !== 'chrome-extension:') return;
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(line) {
        if (String(line).startsWith('go ') && !sessionStorage.getItem('frozenSearch')) {
          sessionStorage.setItem('frozenSearch', '1'); return;
        }
        super.postMessage(line);
      }
    };
  });
  await page.goto('https://www.chess.com/game/outer-search-deadline'); await expand(page);
  await state(page, 'searching');
  assert(await sf(page, '.refresh').isEnabled());
  await state(page, 'error', 17000);
  assert((await sf(page, '.status').textContent()).includes('não terminou'));
  assert(await sf(page, '.refresh').isEnabled());
  const bounds = await sf(page, '.panel').boundingBox();
  await sf(page, '.restart-engine').click(); await state(page, 'ready');
  const restored = await sf(page, '.panel').boundingBox();
  assert.equal(restored.x, bounds.x); assert.equal(restored.y, bounds.y);
  assert(await sf(page, '.move').getAttribute('data-san'));
  console.log('PASS: a lost search result reaches a recoverable error; the header restarts the engine while preserving panel layout');
  await page.close();

  page = await context.newPage();
  await page.addInitScript(() => {
    if (location.protocol !== 'chrome-extension:') return;
    const NativeWorker = window.Worker, fetchFile = window.fetch.bind(window);
    window.fetch = (...args) => String(args[0]) === 'engine-config.json' && sessionStorage.getItem('frozenRetry')
      ? new Promise(() => {}) : fetchFile(...args);
    window.Worker = class extends NativeWorker {
      postMessage(line) {
        if (String(line).startsWith('go ') && !sessionStorage.getItem('frozenRetry')) {
          sessionStorage.setItem('frozenRetry', '1');
          queueMicrotask(() => this.dispatchEvent(new ErrorEvent('error', { message: 'Simulated crash before retry', cancelable: true })));
          return;
        }
        super.postMessage(line);
      }
    };
  });
  await page.goto('https://www.chess.com/game/frozen-retry'); await expand(page);
  await state(page, 'ready');
  await sf(page, '.protocol').evaluate(el => el.open = true);
  await sf(page, '.uci-log').filter({ hasText: 'Simulated crash before retry' }).waitFor();
  await sf(page, '.uci-log').filter({ hasText: 'não iniciou em 15 segundos' }).waitFor();
  assert.equal(await sf(page, 'iframe').count(), 0);
  assert(await sf(page, '.move').getAttribute('data-san'));
  console.log('PASS: a hung automatic retry also has an independent deadline and recovers with real offscreen WASM');
} catch (error) {
  if (page && !page.isClosed()) {
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/lifecycle-failure.png' });
    console.error('Lifecycle state:', await sf(page, '.status').textContent().catch(() => ''));
    console.error('Workers:', context.serviceWorkers().map(worker => worker.url()));
    const manager = await context.newPage();
    try {
      await manager.goto('chrome://extensions/');
      console.error('Extensions:', await manager.evaluate(() => new Promise(resolve => chrome.developerPrivate.getExtensionsInfo({ includeDisabled: true, includeTerminated: true }, resolve))).then(items => items.map(item => ({ id: item.id, name: item.name, state: item.state, disableReasons: item.disableReasons, manifestErrors: item.manifestErrors }))));
    } catch (inspectError) { console.error('Inspection:', inspectError.message); }

  }
  throw error;
} finally { await context.close(); }
