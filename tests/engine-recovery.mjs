import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { parseHTML } from 'linkedom';
import { readPosition } from '../src/position.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const extension = fileURLToPath(new URL('../dist', import.meta.url));
const html = await readFile('tests/fixtures/chesscom.html', 'utf8');
const context = await chromium.launchPersistentContext('', {
  headless: true, channel: process.env.CHROMIUM_PATH ? undefined : 'chromium',
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-sandbox']
});
await context.route('https://www.chess.com/**', route => route.fulfill({ body: html, contentType: 'text/html' }));
const sf = (page, selector) => page.locator(`#stockfish-lens ${selector}`);
const state = (page, expected) => page.waitForFunction(expected =>
  document.querySelector('#stockfish-lens')?.shadowRoot.querySelector('.panel').dataset.state === expected, expected, { timeout: process.env.ENGINE_SCENARIO ? 7000 : 30000 });
const protocol = page => sf(page, '.protocol').evaluate(el => { el.open = true; });

let currentPage;
try {
  // Faults affect only startup; recovery must use the actual packaged WASM.
  for (const scenario of (process.env.ENGINE_SCENARIO ? [process.env.ENGINE_SCENARIO] : ['transient', 'persistent', 'constructor', 'config', 'wasm-disabled', 'late-config', 'opaque-worker'])) {
    const page = currentPage = await context.newPage();
    await page.addInitScript(scenario => {
      if (location.protocol !== 'chrome-extension:') return;
      const NativeWorker = window.Worker, nativeFetch = window.fetch.bind(window);
      const initial = scenario === 'transient' || scenario === 'constructor' ? 1 : 2;
      const remaining = () => Number(sessionStorage.getItem('testFaults') ?? initial);
      const consume = () => sessionStorage.setItem('testFaults', remaining() - 1);
      if (scenario === 'wasm-disabled') Object.defineProperty(window, 'WebAssembly', { value: undefined });
      if (scenario === 'late-config') {
        const nativeTimeout = window.setTimeout.bind(window);
        let first = true, fetches = 0;
        window.setTimeout = (fn, ms, ...args) => {
          if (ms === 30000 && first) { first = false; ms = 30; }
          return nativeTimeout(fn, ms, ...args);
        };
        window.fetch = async (...args) => {
          const response = await nativeFetch(...args);
          if (String(args[0]) === 'engine-config.json' && fetches++ === 0) {
            await new Promise(resolve => nativeTimeout(resolve, 1800));
          }
          return response;
        };
      }
      if (scenario === 'config') window.fetch = (...args) => {
        if (String(args[0]) === 'engine-config.json' && remaining() > 0) {
          consume(); return Promise.resolve(new Response('', { status: 503 }));
        }
        return nativeFetch(...args);
      };
      window.Worker = class {
        constructor(url, options) {
          sessionStorage.setItem('testWorkers', Number(sessionStorage.getItem('testWorkers') || 0) + 1);
          if (['transient', 'persistent', 'constructor', 'opaque-worker'].includes(scenario) && remaining() > 0) {
            consume();
            if (scenario === 'constructor') throw new DOMException('Worker bloqueado no teste', 'SecurityError');
            this.failed = true; return;
          }
          return window.testLiveWorker = new NativeWorker(url, options);
        }
        postMessage(line) {
          if (line === 'uci' && this.failed) queueMicrotask(() => this.onerror?.(scenario === 'opaque-worker' ? new Event('error', { cancelable: true }) : new ErrorEvent('error', {
            message: 'Falha de carregamento simulada', filename: 'engine/stockfish-test.js', lineno: 12, cancelable: true
          })));
        }
        terminate() { this.failed = false; }
      };
    }, scenario);
    await page.goto(`https://www.chess.com/game/engine-${scenario}`);
    await sf(page, '.panel').waitFor(); await sf(page, '.collapse').click();
    if (['persistent', 'config', 'wasm-disabled'].includes(scenario)) {
      await state(page, 'error'); await protocol(page);
      const detail = scenario === 'persistent' ? 'Falha de carregamento simulada' : scenario === 'config' ? 'HTTP 503' : 'WebAssembly não está disponível';
      await sf(page, '.uci-log').filter({ hasText: detail }).waitFor();
      const starts = () => sf(page, '.uci-log').textContent().then(log => (log.match(/\[motor\] Inicialização/g) || []).length);
      assert.equal(await starts(), scenario === 'wasm-disabled' ? 1 : 2);
      assert.equal(await sf(page, '.refresh').textContent(), 'Tentar novamente');
      assert(await sf(page, '.refresh').isEnabled());
      assert.equal(await sf(page, '.move').getAttribute('data-san'), null);
      await sf(page, '.board-overlay').waitFor({ state: 'hidden' });
      let changedFen;
      if (scenario === 'persistent') {
        const game = new Chess();
        const { document } = parseHTML(html);
        for (const uci of readPosition(document.querySelector('wc-chess-board'), document).moves) {
          game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
        }
        game.move(game.moves()[0]);
        const history = game.history();
        changedFen = game.fen();
        const pieces = game.board().flat().filter(Boolean).map(piece =>
          `piece ${piece.color}${piece.type} square-${piece.square.charCodeAt(0) - 96}${piece.square[1]}`);
        await page.evaluate(({ history, pieces }) => {
          const board = document.querySelector('wc-chess-board');
          board.querySelectorAll('.piece').forEach(el => el.remove());
          for (const css of pieces) { const el = document.createElement('div'); el.className = css; board.append(el); }
          document.querySelector('wc-simple-move-list').replaceChildren(...history.map((san, i) => {
            const el = document.createElement('div'); el.dataset.node = `0-${i}`;
            el.textContent = san; el.className = i === history.length - 1 ? 'node selected' : 'node'; return el;
          }));
        }, { history, pieces });
      }
      await page.waitForTimeout(3300); // Board mutations and periodic scans must preserve the failure and retry action.
      assert.equal(await sf(page, '.panel').getAttribute('data-state'), 'error');
      assert.equal(await starts(), scenario === 'wasm-disabled' ? 1 : 2);
      if (scenario !== 'wasm-disabled') {
        await sf(page, '.refresh').click(); await state(page, 'ready');
        assert(await sf(page, '.move').getAttribute('data-san'));
        if (changedFen) assert.equal(await sf(page, '.panel').getAttribute('data-fen'), changedFen);
      }
      console.log(`PASS: ${scenario} records the cause, stops retrying and ${scenario === 'wasm-disabled' ? 'explains the unavailable runtime' : 'recovers through manual retry with real WASM'}`);
    } else {
      await state(page, 'ready'); await protocol(page);
      assert(await sf(page, '.move').getAttribute('data-san'));
      await sf(page, '.uci-log').filter({ hasText: scenario === 'opaque-worker' ? 'documento interno da extensão (offscreen)' : '[motor] Inicialização 2' }).waitFor();
      if (scenario === 'opaque-worker') {
        const worker = context.serviceWorkers().find(worker => worker.url().endsWith('/background.js'));
        const hosts = await worker.evaluate(() => chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }));
        assert.equal(hosts.filter(host => host.documentUrl.endsWith('/offscreen.html')).length, 1);
        assert.equal(await sf(page, 'iframe').count(), 0);
        const second = await context.newPage();
        await second.addInitScript(() => {
          if (location.protocol !== 'chrome-extension:') return;
          window.Worker = class {
            postMessage(line) { if (line === 'uci') queueMicrotask(() => this.onerror?.(new Event('error', { cancelable: true }))); }
            terminate() {}
          };
        });
        await second.goto('https://www.chess.com/game/engine-isolation');
        await state(second, 'ready'); await sf(second, '.collapse').click();
        const originalFen = await sf(page, '.panel').getAttribute('data-fen');
        const manualFen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';
        await sf(second, '.fen-options').evaluate(el => el.open = true);
        await sf(second, '#sf-fen').fill(manualFen); await sf(second, 'button[type="submit"]').click();
        await state(second, 'ready');
        assert.equal(await sf(second, '.panel').getAttribute('data-fen'), manualFen);
        assert.equal(await sf(page, '.panel').getAttribute('data-fen'), originalFen);
        assert(new Chess(manualFen).move(await sf(second, '.move').getAttribute('data-san')));
        await second.close();
        await worker.evaluate(async () => {
          for (let i = 0; i < 30; i++) {
            const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
            if (contexts.filter(context => context.documentUrl.includes('/engine.html#')).length === 1) return;
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          throw new Error('Closed tab left an engine session behind.');
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send('ServiceWorker.enable');
        await cdp.send('ServiceWorker.stopAllWorkers');
        await cdp.detach();
        await sf(page, '.refresh').click(); await state(page, 'ready');
        console.log('PASS: offscreen sessions isolate two tabs/FENs, release closed tabs and keep analyzing after the service worker stops');
        assert.equal(new Chess(await sf(page, '.panel').getAttribute('data-fen')).move(await sf(page, '.move').getAttribute('data-san')).san, await sf(page, '.move').getAttribute('data-san'));
      }
      if (scenario === 'late-config') {
        await page.waitForTimeout(2000);
        const frame = page.frames().find(frame => frame.url().startsWith('chrome-extension:'));
        assert.equal(await frame.evaluate(() => Number(sessionStorage.getItem('testWorkers'))), 1);
        assert.equal(await sf(page, '.panel').getAttribute('data-state'), 'ready');
      }
      if (scenario === 'transient') {
        // An asynchronous crash after successful startup must resume the current position.
        await sf(page, '.refresh').click(); await state(page, 'searching');
        const frame = page.frames().find(frame => frame.url().startsWith('chrome-extension:'));
        await frame.evaluate(() => window.testLiveWorker.dispatchEvent(new ErrorEvent('error', {
          message: 'Falha durante pesquisa', cancelable: true
        })));
        // This iframe has already spent its one automatic retry, so allow a manual one.
        await state(page, 'error'); await sf(page, '.refresh').click(); await state(page, 'ready');
      }
      console.log(`PASS: ${scenario} recovers automatically with real WASM${scenario === 'late-config' ? ' and ignores the expired fetch' : ''}`);
    }
    await page.close();
  }
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await protocol(currentPage).catch(() => {});
    await currentPage.waitForTimeout(300);
    console.error('Engine failure:', await currentPage.evaluate(() => {
      const root = document.querySelector('#stockfish-lens')?.shadowRoot;
      return { status: root?.querySelector('.status').textContent, log: root?.querySelector('.uci-log').textContent };
    }));
    const worker = context.serviceWorkers().find(worker => worker.url().endsWith('/background.js'));
    if (worker) console.error('Contexts:', await worker.evaluate(() => chrome.runtime.getContexts({})).catch(() => []));
  }
  throw error;
} finally { await context.close(); }
