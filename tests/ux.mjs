import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { squarePoint } from '../src/position.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const extension = fileURLToPath(new URL('../dist', import.meta.url));
const html = await readFile('tests/fixtures/chesscom.html', 'utf8');
const context = await chromium.launchPersistentContext('', {
  channel: process.env.CHROMIUM_PATH ? undefined : 'chromium',
  executablePath: process.env.CHROMIUM_PATH || undefined, headless: true,
  viewport: { width: 1366, height: 1000 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-sandbox']
});
await context.route('https://www.chess.com/**', route => route.fulfill({ body: html, contentType: 'text/html' }));
const page = await context.newPage(), errors = [], report = {};
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const sf = selector => page.locator(`#stockfish-lens ${selector}`);
const ready = async () => {
  await page.waitForFunction(() => document.querySelector('#stockfish-lens').shadowRoot.querySelector('.panel').dataset.state === 'ready');
  if (await sf('.panel').evaluate(el => el.classList.contains('collapsed'))) await sf('.collapse').click();
};
try {
  await mkdir('artifacts', { recursive: true });
  await page.goto('https://www.chess.com/game/ux-review'); await ready();
  await page.evaluate(() => document.fonts.ready);
  report.typography = await page.evaluate(() => {
    const root = document.querySelector('#stockfish-lens').shadowRoot;
    const title = getComputedStyle(root.querySelector('.statistics summary'));
    const label = getComputedStyle(root.querySelector('.metrics dt'));
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(value => {
      const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const bg = getComputedStyle(root.querySelector('.statistics')).backgroundColor;
    const titleBg = getComputedStyle(root.querySelector('.statistics summary')).backgroundColor;
    const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
    return { titleSize: parseFloat(title.fontSize), labelSize: parseFloat(label.fontSize), titleWeight: +title.fontWeight,
      labelWeight: +label.fontWeight, titleContrast: contrast(title.color, titleBg), labelContrast: contrast(label.color, bg),
      headingHeight: root.querySelector('.statistics summary').getBoundingClientRect().height };
  });
  assert(report.typography.titleSize >= report.typography.labelSize + 2);
  assert(report.typography.titleWeight > report.typography.labelWeight);
  assert(report.typography.titleContrast >= 4.5 && report.typography.labelContrast >= 4.5);
  assert(report.typography.headingHeight >= 44);
  await sf('.panel').screenshot({ path: 'artifacts/ux-panel-refined.png' });
  await sf('.statistics summary').focus(); await page.keyboard.press('Enter');
  assert.equal(await sf('.statistics').getAttribute('open'), null);
  await page.keyboard.press('Enter');
  assert.notEqual(await sf('.statistics').getAttribute('open'), null);
  await sf('.statistics').evaluate(section => {
    const scroller = section.closest('.body');
    scroller.scrollTop += section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
  });
  const panel = await sf('.panel').boundingBox(), controls = await sf('.controls').boundingBox();
  assert(controls.y + controls.height <= panel.y + panel.height);
  assert(await sf('.toggle').isVisible() && await sf('.refresh').isVisible());
  assert.equal(await sf('.wdl-value').count(), 3);
  assert((await sf('.wdl-context').textContent()).includes('brancas'));
  await sf('.panel').screenshot({ path: 'artifacts/ux-stats-refined.png' });
  console.log('PASS: title hierarchy, measured contrast, keyboard accordion, persistent actions and explicit WDL labels');

  const previousMove = await sf('.move').getAttribute('data-san');
  await sf('.fen-options summary').click();
  await sf('#sf-fen').fill('posição inválida'); await sf('button[type="submit"]').click();
  await sf('#sf-fen-error').filter({ hasText: 'FEN inválido' }).waitFor();
  assert.equal(await sf('#sf-fen').getAttribute('aria-invalid'), 'true');
  assert.equal(await sf('.move').getAttribute('data-san'), previousMove);
  assert.equal(await sf('.panel').getAttribute('data-state'), 'ready');
  await sf('.panel').screenshot({ path: 'artifacts/ux-form-error.png' });
  const fen = '2r2rk1/pp3pp1/4p2p/3pP3/1q4BP/1P6/P3QPP1/2bR2K1 w - - 2 22';
  await sf('#sf-fen').fill(fen); await sf('button[type="submit"]').click(); await ready();
  assert.equal(await sf('#sf-fen-error').textContent(), '');
  assert.equal(await sf('.source-badge').textContent(), 'FEN manual');
  assert(await sf('.manual-banner').isVisible());
  await sf('.return-board').click(); await ready();
  assert.equal(await sf('.source-badge').textContent(), 'Tabuleiro');
  await sf('.toggle').click();
  await page.waitForFunction(() => document.querySelector('#stockfish-lens').shadowRoot.querySelector('.panel').dataset.state === 'paused');
  assert.equal(await sf('.refresh').textContent(), 'Retomar análise');
  assert.equal(await sf('.squares').textContent(), '—');
  assert(await sf('.refresh').isEnabled());
  await sf('.refresh').click();
  await page.waitForFunction(() => document.querySelector('#stockfish-lens').shadowRoot.querySelector('.panel').dataset.state === 'searching');
  assert(await sf('.refresh').isDisabled()); assert(await sf('.toggle').isEnabled());
  await ready(); assert(await sf('.refresh').isEnabled());
  console.log('PASS: inline FEN validation preserves current analysis, explicit manual position and pause/search/ready feedback');

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 600 });
  await popup.goto(new URL('popup.html', await sf('iframe').getAttribute('src')).href);
  await popup.locator('#mode').waitFor(); await popup.evaluate(() => document.fonts.ready);
  await popup.locator('body').screenshot({ path: 'artifacts/ux-popup-refined.png' });
  report.popup = await popup.evaluate(() => ({ width: document.body.scrollWidth,
    viewport: innerWidth, titleSize: parseFloat(getComputedStyle(document.querySelector('h2')).fontSize),
    labelSize: parseFloat(getComputedStyle(document.querySelector('.field label')).fontSize) }));
  assert(report.popup.width <= report.popup.viewport);
  assert(report.popup.titleSize > report.popup.labelSize);
  await popup.locator('#showPieceLetters').uncheck();
  await popup.locator('#saved').filter({ hasText: 'Preferências salvas' }).waitFor();
  await popup.locator('#showPieceLetters').check();
  const panelFonts = () => page.evaluate(() => {
    const root = document.querySelector('#stockfish-lens').shadowRoot;
    return Object.fromEntries(['.panel', 'header strong', '.move', '.pv', '.move-number',
      '.variation-heading strong', '.variation-line', '.statistics summary', '.metrics dt', '.metrics dd',
      '.arrow-master strong', '.arrow-master small', '.controls button', 'textarea', '.uci-log',
      '.arrow-label', 'footer'].map(selector => [selector, parseFloat(getComputedStyle(root.querySelector(selector)).fontSize)]));
  });
  const popupFonts = () => popup.evaluate(() => Object.fromEntries([
    'h1', 'h2', '.field label', 'select', '.switch strong', '.switch small', 'kbd', 'button', 'footer'
  ].map(selector => [selector, parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)])));
  const baselinePanelFonts = await panelFonts(), baselinePopupFonts = await popupFonts();
  const assertScale = (sizes, baseline, factor) => {
    for (const [selector, size] of Object.entries(sizes))
      assert(Math.abs(size - baseline[selector] * factor) < .02, `${selector}: ${size}, expected ${baseline[selector] * factor}`);
  };
  const currentMove = await sf('.move').getAttribute('data-san');
  await popup.locator('#fontScale').selectOption('150');
  await page.waitForFunction(() => document.querySelector('#stockfish-lens').style.getPropertyValue('--sf-font-scale') === '1.5');
  assertScale(await panelFonts(), baselinePanelFonts, 1.5);
  assertScale(await popupFonts(), baselinePopupFonts, 1.5);
  assert.equal(await sf('.move').getAttribute('data-san'), currentMove);
  assert.equal(await sf('.panel').getAttribute('data-state'), 'ready');
  // Repaint the board tab after changing fonts from the popup tab. Headless
  // Chromium can defer screenshot frames for a background tab after a resize.
  await page.bringToFront();
  await sf('.appearance-options summary').click();
  report.fontPanelRects = await page.evaluate(async () => {
    const panel = document.querySelector('#stockfish-lens').shadowRoot.querySelector('.panel'), frames = [];
    for (let i = 0; i < 8; i++) {
      await new Promise(requestAnimationFrame);
      const { x, y, width, height } = panel.getBoundingClientRect(); frames.push({ x, y, width, height });
    }
    return frames;
  });
  assert(report.fontPanelRects.every(rect => JSON.stringify(rect) === JSON.stringify(report.fontPanelRects[0])), JSON.stringify(report.fontPanelRects));
  await page.screenshot({ path: 'artifacts/font-size-150.png', clip: report.fontPanelRects[0] });
  await popup.bringToFront();
  await popup.locator('body').screenshot({ path: 'artifacts/font-size-popup-150.png' });
  await page.reload(); await ready();
  assertScale(await panelFonts(), baselinePanelFonts, 1.5);
  await sf('.appearance-options summary').click();
  await sf('#sf-font-scale').selectOption('80');
  await popup.waitForFunction(() => document.querySelector('#fontScale').value === '80');
  assertScale(await panelFonts(), baselinePanelFonts, .8);
  assertScale(await popupFonts(), baselinePopupFonts, .8);
  await popup.reload();
  await popup.waitForFunction(() => document.querySelector('#fontScale').value === '80');
  assertScale(await popupFonts(), baselinePopupFonts, .8);
  await sf('#sf-font-scale').selectOption('100');
  await popup.waitForFunction(() => document.querySelector('#fontScale').value === '100');
  assertScale(await panelFonts(), baselinePanelFonts, 1);
  assertScale(await popupFonts(), baselinePopupFonts, 1);
  console.log('PASS: all sampled fonts scale to 80% / 150%, both controls sync, settings persist across panel/popup reloads and 100% restores the baseline');
  await popup.locator('#hideUnfavorableArrows').uncheck();
  await popup.locator('#arrowSecond').check(); await popup.locator('#arrowThird').check();
  for (const rank of [1, 2, 3]) await sf(`.arrow-group[data-rank="${rank}"]`).waitFor({ state: 'visible' });
  const arrowGeometry = () => page.evaluate(() => {
    const root = document.querySelector('#stockfish-lens').shadowRoot;
    return [...root.querySelectorAll('.arrow-group')].map(group => {
      const line = group.querySelector('line'), label = group.querySelector('text');
      const marker = root.querySelector(`#sf-arrow-head-${group.dataset.rank}`);
      const width = parseFloat(getComputedStyle(line).strokeWidth);
      return { rank: Number(group.dataset.rank), uci: group.dataset.uci, width,
        headSize: marker.markerWidth.baseVal.value * width, markerUnits: marker.getAttribute('markerUnits'),
        from: ['x1', 'y1'].map(key => Number(line.getAttribute(key))),
        to: ['x2', 'y2'].map(key => Number(line.getAttribute(key))),
        labelFont: parseFloat(getComputedStyle(label).fontSize) };
    });
  });
  const baselineArrows = await arrowGeometry();
  const assertArrows = async scale => {
    for (const arrow of await arrowGeometry()) {
      const baseline = baselineArrows.find(item => item.rank === arrow.rank);
      assert(Math.abs(arrow.width - baseline.width * scale) < .001);
      assert(Math.abs(arrow.headSize - baseline.headSize * scale) < .001);
      assert.equal(arrow.markerUnits, 'strokeWidth');
      assert.deepEqual(arrow.from, squarePoint(arrow.uci.slice(0, 2), false));
      const target = squarePoint(arrow.uci.slice(2, 4), false);
      assert(Math.abs(Math.hypot(arrow.to[0] - target[0], arrow.to[1] - target[1]) - 2 * scale) < .001);
    }
  };
  await sf('#sf-arrow-scale').selectOption('200');
  await popup.waitForFunction(() => document.querySelector('#arrowScale').value === '200');
  await assertArrows(2);
  assert.deepEqual((await arrowGeometry()).map(item => item.labelFont), baselineArrows.map(item => item.labelFont));
  assert.equal(await sf('.panel').getAttribute('data-state'), 'ready');
  await page.reload(); await ready();
  await assertArrows(2);
  await popup.reload(); await popup.waitForFunction(() => document.querySelector('#arrowScale').value === '200');
  await popup.locator('#arrowScale').selectOption('50');
  await page.waitForFunction(() => document.querySelector('#stockfish-lens').style.getPropertyValue('--sf-arrow-scale') === '0.5');
  await assertArrows(.5);
  await sf('.appearance-options summary').click();
  assert.equal(await sf('#sf-arrow-scale').inputValue(), '50');
  await popup.locator('#arrowScale').selectOption('100');
  await page.waitForFunction(() => document.querySelector('#stockfish-lens').style.getPropertyValue('--sf-arrow-scale') === '1');
  await assertArrows(1);
  console.log('PASS: three arrows and heads resize to 50% / 200%, destination alignment is preserved, controls sync and settings persist independently of font size');
  report.viewports = [];
  for (const size of [
    { width: 1366, height: 1000, panelWidth: 392, panelHeight: 900 },
    { width: 900, height: 720, panelWidth: 340, panelHeight: 620 },
    { width: 390, height: 844, panelWidth: 280, panelHeight: 700 },
    { width: 320, height: 568, panelWidth: 280, panelHeight: 520 }
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await popup.evaluate(size => chrome.storage.local.set({ panelLayout: { x: 12, y: 12, width: size.panelWidth, height: size.panelHeight } }), size);
    await page.waitForFunction(width => Math.abs(document.querySelector('#stockfish-lens').shadowRoot.querySelector('.panel').getBoundingClientRect().width - width) < 1, size.panelWidth);
    await sf('.arrow-options').evaluate(el => el.open = true);
    const geometry = await page.evaluate(() => {
      const root = document.querySelector('#stockfish-lens').shadowRoot, box = root.querySelector('.panel').getBoundingClientRect();
      const body = root.querySelector('.body'), header = root.querySelector('header');
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom,
        viewportWidth: innerWidth, viewportHeight: innerHeight, bodyOverflow: body.scrollWidth - body.clientWidth,
        headerOverflow: header.scrollWidth - header.clientWidth };
    });
    assert(geometry.left >= 0 && geometry.top >= 0 && geometry.right <= size.width && geometry.bottom <= size.height);
    assert(geometry.bodyOverflow <= 1 && geometry.headerOverflow <= 1, JSON.stringify({ size, geometry }));
    assert(await sf('.refresh').isVisible());
    const enlarged = [];
    for (const scale of ['150', '80']) {
      await popup.locator('#fontScale').selectOption(scale);
      await popup.locator('#arrowScale').selectOption(scale === '150' ? '200' : '50');
      await page.waitForFunction(scale => document.querySelector('#stockfish-lens').style.getPropertyValue('--sf-font-scale') === String(Number(scale) / 100), scale);
      const overflow = await page.evaluate(() => {
        const root = document.querySelector('#stockfish-lens').shadowRoot;
        return Object.fromEntries(['.body', 'header', '.controls', '.metrics', '.arrow-choices', '.appearance-options']
          .map(selector => { const el = root.querySelector(selector); return [selector, el.scrollWidth - el.clientWidth]; }));
      });
      for (const [selector, width] of Object.entries(overflow)) assert(width <= 1, JSON.stringify({ size, scale, selector, width }));
      const popupOverflow = await popup.evaluate(() => document.body.scrollWidth - innerWidth);
      await assertArrows(scale === '150' ? 2 : .5);
      assert(popupOverflow <= 1);
      assert(await sf('.refresh').isVisible());
      enlarged.push({ scale, overflow, popupOverflow });
    }
    await popup.locator('#fontScale').selectOption('100');
    await popup.locator('#arrowScale').selectOption('100');
    await page.waitForFunction(() => document.querySelector('#stockfish-lens').style.getPropertyValue('--sf-font-scale') === '1');
    assert(await sf('.eval-bar').isVisible());
    report.viewports.push({ ...size, ...geometry, fontSizes: enlarged });
  }
  await sf('.statistics').evaluate(section => {
    const scroller = section.closest('.body'); scroller.scrollTop += section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
  });
  await sf('.panel').screenshot({ path: 'artifacts/ux-mobile-refined.png' });
  await popup.locator('#fontScale').selectOption('100');
  await page.setViewportSize({ width: 1366, height: 1000 });
  await popup.locator('#resetLayout').click();
  await sf('.fen-options summary').click();
  await sf('#sf-fen').fill('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  await sf('button[type="submit"]').click(); await ready();
  await page.bringToFront();
  await sf('.body').evaluate(el => el.scrollTop = 0);
  const bar = await sf('.eval-bar').boundingBox();
  assert(bar.height <= 10 && bar.width > 200);
  assert(await sf('.eval-bar').evaluate(el => parseFloat(el.style.getPropertyValue('--sf-eval-white')) > 50));
  await sf('.best-card').screenshot({ path: 'artifacts/mini-eval-bar.png' });
  await popup.close();
  assert.deepEqual(errors, []);
  await writeFile('artifacts/ux-review.json', JSON.stringify(report, null, 2));
  console.log('PASS: popup hierarchy and save feedback; no clipping at four viewport/panel sizes, including 280px panel width');
} catch (error) {
  await page.screenshot({ path: 'artifacts/ux-failure.png', fullPage: true });
  console.error('UX browser errors:', errors);
  throw error;
} finally { await context.close(); }
