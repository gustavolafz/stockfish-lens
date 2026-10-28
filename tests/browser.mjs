import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { squarePoint } from '../src/position.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const extension = fileURLToPath(new URL('../dist', import.meta.url));
const html = await readFile('tests/fixtures/chesscom.html', 'utf8');
const promotionHtml = await readFile('tests/fixtures/chesscom-promotion-pt.html', 'utf8');
const bestmoveHtml = await readFile('tests/fixtures/chesscom-bestmove.html', 'utf8');
const premoveCaptureHtml = await readFile('tests/fixtures/chesscom-premove-capture.html', 'utf8');
const premovePawnHtml = await readFile('tests/fixtures/chesscom-premove-pawn.html', 'utf8');
const bestmoveTrace = JSON.parse(await readFile('tests/fixtures/bestmove-trace.json', 'utf8'));
const bestmoveFen = 'r2q1rk1/pp2ppbp/2n1bnp1/3p4/3P4/1BP2N1P/PP2QPP1/RNB2RK1 b - - 0 10';
const options = {
  headless: true,
  channel: process.env.CHROMIUM_PATH ? undefined : 'chromium',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-sandbox'],
  viewport: { width: 1366, height: 1000 }
};
if (process.env.CHROMIUM_PATH) options.executablePath = process.env.CHROMIUM_PATH;
const context = await chromium.launchPersistentContext('', options);
await context.route('https://www.chess.com/**', route => route.fulfill({ contentType: 'text/html',
  body: route.request().url().includes('premove-capture-fixture') ? premoveCaptureHtml :
    route.request().url().includes('premove-pawn-fixture') ? premovePawnHtml :
    route.request().url().includes('bestmove-fixture') ? bestmoveHtml :
    route.request().url().includes('promotion-fixture') ? promotionHtml : html }));
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
const sf = selector => page.locator(`#stockfish-lens ${selector}`);
async function completed() {
  await sf('.panel').waitFor();
  if (await sf('.panel').evaluate(el => el.classList.contains('collapsed'))) await sf('.collapse').click();
  await sf('.status').filter({ hasText: /Análise concluída|Análise do FEN concluída/ }).waitFor({ timeout: 60000 });
}
async function assertStartup() {
  await page.waitForFunction(() => document.querySelector('#stockfish-lens')?.shadowRoot.querySelector('.panel').dataset.state);
  assert(await sf('.panel').evaluate(el => el.classList.contains('collapsed')));
  assert.equal(await sf('.collapse').getAttribute('aria-expanded'), 'false');
  assert.equal(await sf('.collapse').textContent(), '+');
  const box = await sf('.panel').boundingBox(), size = page.viewportSize();
  assert(Math.abs(size.width - box.x - box.width - 12) < 1);
  assert(Math.abs(size.height - box.y - box.height - 12) < 1);
  assert(box.height < 100);
  assert(await sf('.body').isHidden());
}
async function suggestedSan() {
  return await sf('.move').getAttribute('data-san') || await sf('.move').textContent();
}
async function dragPanel(dx, dy, resize = false) {
  const box = await sf(resize ? '.resize-handle' : '.panel header').boundingBox();
  const x = resize ? box.x + box.width / 2 : box.x + 90;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
}
async function assertSynchronized(fen) {
  const state = await page.evaluate(() => {
    const root = document.querySelector('#stockfish-lens').shadowRoot;
    const line = root.querySelector('.arrow');
    return { move: root.querySelector('.move').dataset.san, squares: root.querySelector('.squares').textContent,
      score: root.querySelector('.score').textContent, barLabel: root.querySelector('.eval-bar').getAttribute('aria-label'), barHidden: root.querySelector('.eval-bar').hidden, pv: root.querySelector('.pv .san-move')?.dataset.san,
      first: root.querySelector('.lines li .san-move')?.dataset.san,
      firstScore: root.querySelector('.lines li .variation-score')?.textContent,
      arrow: Object.fromEntries(['x1','y1','x2','y2'].map(key => [key, Number(line.getAttribute(key))])),
      flipped: document.querySelector('wc-chess-board').classList.contains('flipped') };
  });
  assert(!state.barHidden); assert(state.barLabel.includes(state.score));
  const selected = new Chess(fen).move(state.move);
  assert.equal(state.squares, `${selected.from} → ${selected.to}${selected.promotion ? ` · promoção: ${selected.promotion.toUpperCase()}` : ''}`);
  assert.equal(state.first, state.move, JSON.stringify(state));
  assert.equal(state.firstScore, state.score, JSON.stringify(state));
  assert.equal(state.pv, state.move, JSON.stringify(state));
  const [x1,y1] = squarePoint(selected.from, state.flipped), [x2,y2] = squarePoint(selected.to, state.flipped);
  const length = Math.hypot(x2-x1,y2-y1);
  for (const [key, expected] of Object.entries({x1,y1,x2:x2-(x2-x1)/length*2,y2:y2-(y2-y1)/length*2})) {
    assert(Math.abs(state.arrow[key]-expected)<0.001, `${key}: ${JSON.stringify(state)}`);
  }
}
async function setBoard(fen, { selected = null, moves = [] } = {}) {
  const game = new Chess(fen);
  const pieces = game.board().flat().filter(Boolean).map(p => ({ css: `${p.color}${p.type}`, square: `${p.square.charCodeAt(0) - 96}${p.square[1]}` }));
  await page.evaluate(({ pieces, selected, moves }) => {
    const board = document.querySelector('wc-chess-board');
    board.querySelectorAll('.piece').forEach(el => el.remove());
    for (const p of pieces) { const el = document.createElement('div'); el.className = `piece ${p.css} square-${p.square}`; board.append(el); }
    if (selected !== null) {
      document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
      document.querySelector(`[data-node="0-${selected}"]`).classList.add('selected');
    } else {
      const list = document.querySelector('wc-simple-move-list');
      list.replaceChildren(...moves.map((san, i) => {
        const el = document.createElement('div'); el.dataset.node = `0-${i}`; el.className = 'node'; el.textContent = san;
        if (i === moves.length - 1) el.classList.add('selected'); return el;
      }));
    }
  }, { pieces, selected, moves });
  await page.waitForFunction(expected => document.querySelector('#stockfish-lens').shadowRoot.querySelector('.panel').dataset.fen === expected, fen);
}
try {
  await page.goto('https://www.chess.com/game/test-fixture');
  await sf('.panel').waitFor();
  await assertStartup();
  await page.waitForFunction(() => document.querySelector('#stockfish-lens').shadowRoot.querySelector('.panel').dataset.state === 'ready');
  await assertStartup();
  console.log('PASS: panel starts minimized at bottom right and the engine finishes analyzing while minimized');
  await completed();
  const result = await suggestedSan();
  const legal = new Chess('2r2rk1/pp3pp1/4p2p/3pP3/1q4BP/1P6/P3QPP1/2bR2K1 w - - 2 22').moves();
  assert(legal.includes(result), `Illegal engine suggestion: ${result}`);
  assert.equal(await sf('.lines li').count(), 3);
  assert(await sf('.eval-bar').isVisible());
  assert(await sf('.eval-bar').evaluate(el => parseFloat(el.style.getPropertyValue('--sf-eval-white')) < 50));
  assert((await sf('.wdl').textContent()).includes('Vitória'));
  assert((await sf('.metrics').textContent()).includes('Posições pesquisadas'));
  await sf('.protocol summary').click();

  await page.waitForFunction(() => ['SFManrope', 'SFLora', 'SFChess'].every(name =>
    [...document.fonts].some(face => face.family === name && face.status === 'loaded')));
  assert.equal(await sf('.pv .move-number').first().textContent(), '22.');
  const families = await page.evaluate(() => {
    const root = document.querySelector('#stockfish-lens').shadowRoot;
    return ['.panel', '.pv'].map(selector => getComputedStyle(root.querySelector(selector)).fontFamily);
  });
  assert(families[0].includes('SFManrope')); assert(families[1].includes('SFLora'));
  console.log('PASS: bundled fonts load, interface / notation use different families, and variations start at the real move number');
  await sf('.uci-log').filter({ hasText: /bestmove/ }).waitFor();
  const log = await sf('.uci-log').textContent();
  assert(log.includes('option name MultiPV'));
  assert(log.includes('position startpos moves e2e4 c7c6'));
  assert(log.includes('Stockfish 19'));
  console.log('PASS: real installed extension + bundled WASM + supplied HTML: legal best move, 3 PVs, WDL, metrics, UCI log');
  await sf('.protocol summary').click();

  // Test that the overlay shares the board geometry and survives responsive resizing.
  for (const size of [{ width: 1366, height: 1000 }, { width: 900, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(100);
    const geometry = await page.evaluate(() => {
      const board = document.querySelector('wc-chess-board').getBoundingClientRect();
      const layer = document.querySelector('#stockfish-lens').shadowRoot.querySelector('.board-overlay');
      const overlay = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number(layer.getAttribute(key))]));
      const arrow = layer.querySelector('.arrow');
      const p = new DOMPoint(Number(arrow.getAttribute('x1')), Number(arrow.getAttribute('y1')));
      const screen = p.matrixTransform(arrow.getScreenCTM());
      const rendered = Math.abs(screen.x - (board.x+p.x*board.width/100)) + Math.abs(screen.y-(board.y+p.y*board.height/100));
      return { delta: Math.abs(board.x-overlay.x)+Math.abs(board.y-overlay.y)+Math.abs(board.width-overlay.width)+Math.abs(board.height-overlay.height)+rendered };
    });
    assert(geometry.delta < 2, `Overlay misaligned: ${JSON.stringify(geometry)}`);
  }
  console.log('PASS: overlay alignment at 1366, 900 and 390px');
  await page.setViewportSize({ width: 1366, height: 1000 });
  const before = await sf('.arrow').getAttribute('x1');
  await page.evaluate(() => document.querySelector('wc-chess-board').classList.add('flipped'));
  await page.waitForFunction(old => document.querySelector('#stockfish-lens').shadowRoot.querySelector('.arrow').getAttribute('x1') !== old, before);
  await page.evaluate(() => document.querySelector('wc-chess-board').classList.remove('flipped'));
  console.log('PASS: flipped board changes arrow orientation');

  await page.evaluate(() => {
    const button = document.createElement('button'); button.id = 'fullscreen-test'; button.textContent = 'Fullscreen';
    button.onclick = () => document.querySelector('main').requestFullscreen(); document.body.append(button);
  });
  await page.locator('#fullscreen-test').click();
  await page.waitForFunction(() => document.fullscreenElement?.contains(document.querySelector('#stockfish-lens')));
  assert(await sf('.board-overlay').isVisible());
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.fullscreenElement);
  console.log('PASS: overlay and panel survive fullscreen entry / exit');

  await sf('.toggle').click();
  await sf('.status').filter({ hasText: 'pausada' }).waitFor();
  assert(await sf('.eval-bar').isHidden());
  assert.equal(await sf('.board-overlay').evaluate(el => el.style.display), 'none');
  await sf('.toggle').click(); await completed();
  assert(await sf('.eval-bar').isVisible());
  console.log('PASS: pause / resume clears and restores hints');

  const engineUrl = await sf('iframe').getAttribute('src');
  const popup = await context.newPage();
  await popup.goto(new URL('popup.html', engineUrl).href);
  const worker = context.serviceWorkers().find(item => item.url().endsWith('/background.js')) || await context.waitForEvent('serviceworker');
  const commands = await popup.evaluate(() => chrome.commands.getAll());
  for (const [name, shortcut] of Object.entries({ 'toggle-arrow-1':'Alt+Shift+1', 'toggle-arrow-2':'Alt+Shift+2',
    'toggle-arrow-3':'Alt+Shift+3', 'toggle-all-arrows':'Alt+Shift+0' })) {
    assert.equal(commands.find(command => command.name === name)?.shortcut, shortcut);
  }
  assert(await worker.evaluate(() => chrome.commands.onCommand.hasListener(StockfishLensCommands.handleCommand)));
  const command = name => worker.evaluate(async name => {
    await StockfishLensCommands.handleCommand(name);
  }, name);
  // Headless key injection does not trigger native browser accelerators. Invoke
  // the registered handler to check the real worker → storage → content path.
  await command('toggle-all-arrows');
  await completed();
  assert(await popup.locator('#hideUnfavorableArrows').isChecked());
  assert(await sf('.arrow-group[data-rank="1"]').isVisible());
  for (const rank of [2, 3]) {
    assert((await sf(`.lines li[data-rank="${rank}"] .variation-score`).textContent()).includes('−'));
    await sf(`.arrow-group[data-rank="${rank}"]`).waitFor({ state: 'hidden' });
  }
  assert.equal(await sf('.lines li').count(), 3);
  assert((await sf('.arrow-hint').textContent()).includes('2 setas'));
  const beforeFilterLog = await sf('.uci-log').textContent();
  await popup.locator('#hideUnfavorableArrows').uncheck();
  for (const rank of [1, 2, 3]) await sf(`.arrow-group[data-rank="${rank}"]`).waitFor({ state: 'visible' });
  await sf('.arrow-options summary').click();
  await sf('[data-filter-setting="hideUnfavorableArrows"]').check();
  await sf('.arrow-group[data-rank="2"]').waitFor({ state: 'hidden' });
  assert(await popup.locator('#hideUnfavorableArrows').isChecked());
  await sf('[data-filter-setting="hideUnfavorableArrows"]').uncheck();
  for (const rank of [1, 2, 3]) await sf(`.arrow-group[data-rank="${rank}"]`).waitFor({ state: 'visible' });
  assert.equal(await sf('.uci-log').textContent(), beforeFilterLog);
  await sf('.arrow-options summary').click();
  console.log('PASS: default filter hides losing alternatives, preserves primary and all panel variants, syncs popup/panel and toggles without restarting analysis');
  await completed();
  await command('toggle-all-arrows');
  await sf('.board-overlay').waitFor({ state: 'hidden' });
  await command('toggle-arrow-2');
  await sf('.arrow-group[data-rank="2"]').waitFor({ state: 'visible' });
  await sf('.arrow-group[data-rank="1"]').waitFor({ state: 'hidden' });
  await sf('.arrow-group[data-rank="3"]').waitFor({ state: 'hidden' });
  await command('toggle-arrow-2');
  await sf('.board-overlay').waitFor({ state: 'hidden' });
  await command('toggle-arrow-3'); await command('toggle-arrow-1');
  await sf('.arrow-group[data-rank="3"]').waitFor({ state: 'visible' });
  await sf('.arrow-group[data-rank="1"]').waitFor({ state: 'visible' });
  await command('toggle-all-arrows');
  await worker.evaluate(async () => {
    const { handleCommand } = StockfishLensCommands;
    await Promise.all([handleCommand('toggle-arrow-1'), handleCommand('toggle-arrow-1'), handleCommand('toggle-arrow-1')]);
  });
  await sf('.arrow-group[data-rank="1"]').waitFor({ state: 'hidden' });
  await popup.locator('#arrowBest').check();
  await popup.locator('#arrowSecond').uncheck(); await popup.locator('#arrowThird').uncheck();
  await sf('.arrow-group[data-rank="1"]').waitFor({ state: 'visible' });
  await popup.locator('.shortcut-options summary').click();
  assert.equal(await popup.locator('#shortcutList kbd').count(), 4);
  const shortcutsPagePromise = context.waitForEvent('page');
  await popup.locator('#customizeShortcuts').click();
  const shortcutsPage = await shortcutsPagePromise;
  await shortcutsPage.waitForURL('chrome://extensions/shortcuts'); await shortcutsPage.close();
  await popup.locator('.shortcut-options summary').click();
  console.log('PASS: four registered shortcuts, listener wiring, actual worker/storage/UI toggles, rapid repeated commands and shortcut customization page');
  await sf('.notation-letter').first().waitFor({ state: 'visible' });
  await popup.locator('#showPieceLetters').uncheck();
  await sf('.notation-letter').first().waitFor({ state: 'hidden' });
  await sf('.notation-options summary').click();
  await sf('[data-notation-setting="showPieceLetters"]').check();
  await sf('.notation-letter').first().waitFor({ state: 'visible' });
  assert(await popup.locator('#showPieceLetters').isChecked());
  await sf('.notation-options summary').click();
  console.log('PASS: symbol + SAN letter notation is the default and can be toggled from the popup and panel');
  await popup.locator('#mode').selectOption('arrow');
  await sf('.panel').waitFor({ state: 'hidden' });
  await popup.locator('#mode').selectOption('panel');
  await sf('.panel').waitFor({ state: 'visible' }); await completed();
  assert.equal(await sf('.board-overlay').evaluate(el => el.style.display), 'none');
  await popup.locator('#mode').selectOption('both');
  await popup.locator('#ms').selectOption('500');
  await popup.locator('#multipv').selectOption('5');
  await page.waitForFunction(() => document.querySelector('#stockfish-lens').shadowRoot.querySelectorAll('.lines li').length === 5);
  await completed();
  await popup.locator('#arrowSecond').check();
  await popup.locator('#arrowThird').check();
  for (const rank of [1, 2, 3]) {
    const group = sf(`.arrow-group[data-rank="${rank}"]`);
    await group.waitFor({ state: 'visible' });
    assert.equal(await group.getAttribute('data-uci'), await sf(`.lines li[data-rank="${rank}"]`).getAttribute('data-uci'));
  }
  await popup.locator('#arrowBest').uncheck();
  await sf('.arrow-group[data-rank="1"]').waitFor({ state: 'hidden' });
  assert(await sf('.arrow-group[data-rank="2"]').isVisible());
  assert(await sf('.arrow-group[data-rank="3"]').isVisible());
  await popup.locator('#showArrows').uncheck();
  await sf('.board-overlay').waitFor({ state: 'hidden' });
  await popup.locator('#showArrows').check();
  await sf('.arrow-group[data-rank="2"]').waitFor({ state: 'visible' });
  await sf('.arrow-options summary').click();
  await sf('[data-setting="arrowBest"]').check();
  await sf('.arrow-group[data-rank="1"]').waitFor({ state: 'visible' });
  await popup.locator('#arrowBest').waitFor({ state: 'visible' });
  assert(await popup.locator('#arrowBest').isChecked());
  await mkdir('artifacts', { recursive: true });
  await popup.locator('#multipv').selectOption('3');
  await page.waitForFunction(() => document.querySelector('#stockfish-lens').shadowRoot.querySelectorAll('.lines li').length === 3);
  await completed();
  await popup.locator('body').screenshot({ path: 'artifacts/preferences.png' });
  await sf('.statistics summary').click();
  await page.setViewportSize({ width: 1366, height: 1200 });
  await sf('.body').evaluate(el => el.scrollTop = 0);
  await page.screenshot({ path: 'artifacts/typography.png', fullPage: true });
  await popup.locator('#arrowSecond').uncheck();
  await popup.locator('#arrowThird').uncheck();
  await sf('.arrow-group[data-rank="2"]').waitFor({ state: 'hidden' });
  await sf('.arrow-group[data-rank="3"]').waitFor({ state: 'hidden' });
  await popup.close();
  console.log('PASS: popup and panel control arrows 1/2/3 independently, master visibility and per-variant destinations');

  const game = new Chess(); game.move('e4'); game.move('c6');
  await setBoard(game.fen(), { selected: 1 }); await completed();
  assert.equal(await sf('.turn').textContent(), 'Vez das brancas');
  assert(game.moves().includes(await suggestedSan()));
  console.log('PASS: historical navigation reconstructs the selected position');

  // Rapid updates cancel old analysis and only show results for the latest position.
  for (const san of ['Nf3', 'd5', 'exd5']) {
    game.move(san);
    await setBoard(game.fen(), { moves: game.history() });
    await page.waitForTimeout(350);
  }
  await completed();
  assert.equal(await sf('.turn').textContent(), 'Vez das pretas');
  assert(game.moves().includes(await suggestedSan()));
  console.log('PASS: rapid position changes discard stale analysis');

  await page.evaluate(() => document.querySelector('wc-simple-move-list').replaceChildren());
  await sf('.status').filter({ hasText: /confirmar a posição/ }).waitFor();
  assert.equal(await suggestedSan(), '—');
  assert.equal(await sf('.board-overlay').evaluate(el => el.style.display), 'none');
  console.log('PASS: missing history clears suggestions instead of guessing FEN');

  // Explicit FEN enables positions not reconstructable from a site history.
  await sf('details:has(form) summary').click();
  await sf('#sf-fen').fill('7k/P7/6K1/8/8/8/8/8 w - - 0 1');
  await sf('button[type="submit"]').click(); await completed();
  assert((await suggestedSan()).includes('='));
  assert.equal(await sf('.move .notation-promotion').textContent(), '=');
  assert(await sf('.move .notation-promoted-piece').count() === 1);
  assert.equal(await sf('.board-overlay').evaluate(el => el.style.display), 'none');
  console.log('PASS: manual FEN promotion, no unrelated board arrow');

  await sf('#sf-fen').fill('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
  await sf('button[type="submit"]').click();
  await sf('.move[data-san$="#"]').waitFor(); await completed();
  assert.equal(await sf('.move .notation-mate').textContent(), '#');
  assert.equal(await sf('.move .notation-check').count(), 0);
  assert.equal(await sf('.move .notation-mate').getAttribute('title'), 'Xeque-mate');
  console.log('PASS: promotion and mating bestmove have separate semantic highlights');

  await sf('#sf-fen').fill('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1');
  await sf('button[type="submit"]').click();
  await sf('.move').filter({ hasText: 'Mate' }).waitFor();
  assert.equal(await sf('.score').textContent(), '+M0');
  assert.equal(await sf('.eval-bar').evaluate(el => el.style.getPropertyValue('--sf-eval-white')), '100%');
  console.log('PASS: checkmate produces no move and reports the winning color');

  await sf('#sf-fen').fill('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1');
  await sf('button[type="submit"]').click();
  await sf('.move').filter({ hasText: 'Empate' }).waitFor();
  assert.equal(await sf('.eval-bar').evaluate(el => el.style.getPropertyValue('--sf-eval-white')), '50%');
  await sf('#sf-fen').fill('8/8/8/8/8/5k2/6q1/7K w - - 0 1');
  await sf('button[type="submit"]').click();
  await sf('.move').filter({ hasText: 'Mate' }).waitFor();
  assert.equal(await sf('.score').textContent(), '−M0');
  assert.equal(await sf('.eval-bar').evaluate(el => el.style.getPropertyValue('--sf-eval-white')), '0%');
  console.log('PASS: mini evaluation bar handles White / Black mate, stalemate, pause and synchronized scores');

  await page.goto('https://www.chess.com/game/promotion-fixture'); await completed();
  const promotionFinal = new Chess('Q5R1/8/8/7p/6Pk/1r6/R5PK/8 b - - 0 44');
  assert(promotionFinal.moves().includes(await suggestedSan()));
  assert.equal(await sf('.turn').textContent(), 'Vez das pretas');
  await sf('.protocol summary').click();
  await sf('.uci-log').filter({ hasText: /a7a8q b1b3 h3g4/ }).waitFor();
  await sf('.protocol summary').click();
  console.log('PASS: reported HTML after 43. a8=D loads and searches the exact position with full history');

  const promotionGame = new Chess('6R1/P7/8/7p/6pk/1P5P/R5PK/1r6 w - - 0 43');
  let selected = 83;
  for (const san of [null, 'a8=Q', 'Rxb3', 'hxg4']) {
    if (san) { promotionGame.move(san); selected++; }
    await setBoard(promotionGame.fen(), { selected });
    // The side alternates at every step. Wait for the new position rather than
    // a transient "searching" status: a forced mate can finish immediately.
    await sf('.turn').filter({ hasText: `Vez das ${promotionGame.turn() === 'w' ? 'brancas' : 'pretas'}` }).waitFor();
    await completed();
    assert(promotionGame.moves().includes(await suggestedSan()));
    assert.equal(await sf('.turn').textContent(), `Vez das ${promotionGame.turn() === 'w' ? 'brancas' : 'pretas'}`);
    assert(await sf('.board-overlay').isVisible());
  }
  console.log('PASS: automatic analysis continues before, during and after the localized promotion');

  await page.goto('https://www.chess.com/game/bestmove-fixture'); await completed();
  await assertSynchronized(bestmoveFen);
  console.log('PASS: real engine output agrees across move, coordinates, first PV, score and flipped arrow on reported board');
  assert.deepEqual(errors, [], `Browser errors: ${errors.join('\n')}`);
  await mkdir('artifacts', { recursive: true });
  await page.goto('https://www.chess.com/game/test-fixture'); await completed();
  await page.screenshot({ path: 'artifacts/extension.png', fullPage: true });
  console.log('PASS: zero console/page errors. Screenshot: artifacts/extension.png');

  const beforeLayout = await suggestedSan();
  const originalBox = await sf('.panel').boundingBox();
  await dragPanel(-40, -400, true);
  const smaller = await sf('.panel').boundingBox();
  assert(smaller.width < originalBox.width - 25 && smaller.height < originalBox.height - 250);
  const headerBox = await sf('.panel header').boundingBox();
  await dragPanel(80 - headerBox.x, 110 - headerBox.y);
  const moved = await sf('.panel').boundingBox();
  assert(Math.abs(moved.x - 80) < 2 && Math.abs(moved.y - 110) < 2);
  await dragPanel(180, 100, true);
  const larger = await sf('.panel').boundingBox();
  assert(larger.width > moved.width + 120 && larger.height > moved.height + 80);
  assert.equal(await suggestedSan(), beforeLayout);
  const layoutPopup = await context.newPage();
  await layoutPopup.goto(new URL('popup.html', await sf('iframe').getAttribute('src')).href);
  await layoutPopup.waitForFunction(async width => Math.abs((await chrome.storage.local.get('panelLayout')).panelLayout.width - width) < 2, larger.width);
  await page.screenshot({ path: 'artifacts/panel-layout.png', fullPage: true });
  await page.reload(); await assertStartup(); await completed();
  const restored = await sf('.panel').boundingBox();
  for (const key of ['x','y','width','height']) assert(Math.abs(restored[key] - larger[key]) < 2);
  await sf('.collapse').click();
  assert((await sf('.panel').boundingBox()).height < 100);
  await sf('.collapse').click();
  assert(Math.abs((await sf('.panel').boundingBox()).height - larger.height) < 2);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForFunction(() => {
    const box = document.querySelector('#stockfish-lens').shadowRoot.querySelector('.panel').getBoundingClientRect();
    return box.x >= 0 && box.y >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
  });
  await page.setViewportSize({ width: 1366, height: 1200 });
  await sf('.panel header').focus(); await page.keyboard.press('ArrowRight');
  assert(Math.abs((await sf('.panel').boundingBox()).x - (larger.x + 10)) < 2);
  await sf('.resize-handle').focus(); await page.keyboard.press('ArrowLeft');
  assert(Math.abs((await sf('.panel').boundingBox()).width - (larger.width - 10)) < 2);
  await sf('.appearance-options').evaluate(el => el.open = true);
  await sf('.reset-layout').click();
  assert.equal(await sf('.panel').evaluate(el => el.style.width), '');
  await dragPanel(-300, 0); await sf('.collapse').click();
  await layoutPopup.locator('#resetLayout').click();
  await page.waitForFunction(() => {
    const panel = document.querySelector('#stockfish-lens').shadowRoot.querySelector('.panel');
    return !panel.classList.contains('collapsed') && panel.style.left === '' && panel.style.height === '';
  });
  await layoutPopup.close();
  console.log('PASS: drag, shrink / enlarge, persistence after reload, collapse / expand, viewport bounds, keyboard controls and both reset buttons');

  for (const [name, officialFen, extraMoves, history] of [
    ['capture', 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', ['Nc3', 'dxe4'], ['e4', 'd5']],
    ['pawn', 'rnbqkb1r/p3pppp/2p2n2/8/8/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 5', ['Nf3', 'e5'], ['e4', 'd5', 'exd5', 'Nf6', 'd3', 'c6', 'dxc6', 'bxc6']]
  ]) {
    await page.goto(`https://www.chess.com/game/premove-${name}-fixture`); await completed();
    assert.equal(await sf('.panel').getAttribute('data-fen'), officialFen);
    assert(new Chess(officialFen).moves().includes(await suggestedSan()));
    assert(await sf('.premove-note').isVisible());
    assert.equal(await sf('.source-badge').textContent(), 'Posição real');
    await sf('.board-overlay').waitFor({ state: 'hidden' });
    await sf('.protocol summary').click();
    const official = new Chess(); history.forEach(san => official.move(san));
    const uci = official.history({ verbose: true }).map(move => move.from + move.to + (move.promotion || ''));
    await sf('.uci-log').filter({ hasText: `position startpos moves ${uci.join(' ')}` }).waitFor();
    await sf('.protocol summary').click();
    const previousMove = await suggestedSan();
    await page.evaluate(() => {
      window.premoveCommands = [];
      window.addEventListener('message', event => {
        if (event.data?.type === 'uci' && event.data.direction === '→') window.premoveCommands.push(event.data.line);
      });
    });
    // Canceling the queue restores the board without restarting the same FEN.
    await setBoard(officialFen, { selected: history.length - 1 });
    await sf('.premove-note').waitFor({ state: 'hidden' });
    await sf('.board-overlay').waitFor({ state: 'visible' });
    assert.equal(await suggestedSan(), previousMove);
    await assertSynchronized(officialFen);
    assert.deepEqual(await page.evaluate(() => window.premoveCommands), []);

    if (name === 'capture') {
      // Queue a capture during an active real-engine search, before it finishes.
      await sf('.refresh').click();
      await page.waitForFunction(() => document.querySelector('#stockfish-lens').shadowRoot.querySelector('.panel').dataset.state === 'searching');
      await page.evaluate(() => {
        const board = document.querySelector('wc-chess-board');
        board.querySelector('.piece.wp.square-54').remove();
        board.querySelector('.piece.bp.square-45').classList.replace('square-45', 'square-54');
      });
      await sf('.premove-note').waitFor({ state: 'visible' }); await completed();
      await page.waitForTimeout(1700); // Exercise the periodic scan while queued.
      const commands = await page.evaluate(() => window.premoveCommands);
      assert.equal(commands.filter(line => line.startsWith('go ')).length, 1);
      assert(!commands.includes('stop'), JSON.stringify(commands));
      assert.equal(await sf('.panel').getAttribute('data-fen'), officialFen);
      await sf('.board-overlay').waitFor({ state: 'hidden' });
      await page.screenshot({ path: 'artifacts/premove-analysis.png' });
    }
    // The opponent moves, the queued move executes, and automatic analysis advances.
    const game = new Chess(officialFen); extraMoves.forEach(san => game.move(san));
    await page.evaluate(() => document.querySelectorAll('wc-chess-board .highlight').forEach(el => el.remove()));
    await setBoard(game.fen(), { moves: [...history, ...extraMoves] }); await completed();
    await sf('.premove-note').waitFor({ state: 'hidden' });
    assert(new Chess(game.fen()).moves().includes(await suggestedSan()));
    await sf('.board-overlay').waitFor({ state: 'visible' });
    await assertSynchronized(game.fen());
  }
  assert.deepEqual(errors, []);
  console.log('PASS: both supplied premove snapshots analyze the official history; cancellation, queue creation during search and execution recover automatically without stale arrows or extra searches');

  // Replay the exact UCI output from the user's attachment. Mock only the worker
  // so the installed extension, message bridge and DOM rendering run unchanged.
  await context.addInitScript(trace => {
    if (location.protocol !== 'chrome-extension:') return;
    window.Worker = class {
      postMessage(command) {
        const emit = line => this.onmessage?.({ data: line });
        if (command === 'uci') queueMicrotask(() => { emit('id name Stockfish recorded trace'); emit('uciok'); });
        if (command === 'isready') queueMicrotask(() => emit('readyok'));
        if (command.startsWith('go ')) queueMicrotask(() => trace.forEach(emit));
      }
      terminate() {}
    };
  }, bestmoveTrace);
  await page.goto('https://www.chess.com/game/bestmove-fixture-replay'); await completed();
  await assertSynchronized(bestmoveFen);
  assert.equal(await suggestedSan(), 'Qc7');
  assert.equal(await sf('.score').textContent(), '≥+0.56');
  assert.equal(await sf('.move .notation-piece').textContent(), '♛');
  assert.equal(await sf('.move .chess-piece-svg').getAttribute('data-piece'), 'Q');
  assert.equal(await sf('.move .chess-piece-svg').getAttribute('data-side'), 'b');
  const icon = await sf('.move .chess-piece-svg').boundingBox();
  assert(icon.width > 30 && icon.height > 30);
  assert.equal(await sf('.pv .move-number').first().textContent(), '10…');
  assert(await sf('.notation-capture').count() > 0);
  console.log('PASS: exact captured trace with bounded final PV keeps bestmove Qc7, evaluation, continuation and arrow synchronized');
} catch (error) {
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/failure.png', fullPage: true });
  console.error('State:', await sf('.status').textContent().catch(() => ''), 'Errors:', errors);
  throw error;
} finally { await context.close(); }
