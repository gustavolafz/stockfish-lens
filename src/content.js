import { Chess } from 'chess.js';
import { BOARD_SELECTOR, readPosition, placementFromBoard, squarePoint, isFlipped } from './position.js';
import { SearchAnalysis, formatScore, hideUnfavorableAlternative, evaluationBarPercent } from './analysis.js';
import { DEFAULTS, normalizeSettings, ARROW_SETTINGS, arrowPreference, FONT_SCALES, ARROW_SCALES } from './settings.js';
import { renderSan, renderLine } from './notation.js';
import { renderPiece } from './pieces.js';
import { attachPanelLayout } from './panel-layout.js';
import theme from '../theme.css';
import css from './panel.css';

if (!document.getElementById('stockfish-lens')) main();

async function main() {
  const extensionId = chrome.runtime.id;
  const extensionBase = chrome.runtime.getURL('/');
  const extensionOrigin = new URL(extensionBase).origin;
  const extensionVersion = chrome.runtime.getManifest().version;
  const resourceURL = path => new URL(path, extensionBase).href;
  let settings = { ...DEFAULTS };
  try { settings = normalizeSettings(await chrome.storage.local.get(DEFAULTS)); } catch { /* defaults */ }
  for (const [name, file, weight] of [['SFManrope', 'Manrope', '200 800'], ['SFLora', 'Lora', '500'], ['SFChess', 'ChessSymbols', '400']]) {
    const face = new FontFace(name, `url("${resourceURL(`fonts/${file}.woff2`)}")`, { weight });
    document.fonts.add(face);
    face.load().catch(() => {});
  }
  const host = document.createElement('div');
  host.id = 'stockfish-lens';
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${theme}\n${css}</style>
    <svg class="overlay" aria-hidden="true"><svg class="board-overlay" viewBox="0 0 100 100" overflow="visible">
      <defs>${['#7aebba', '#f3c77a', '#9ac6ff'].map((color, i) => `<marker id="sf-arrow-head-${i + 1}" markerUnits="strokeWidth" markerWidth="4" markerHeight="4" refX="2.8" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="${color}"/></marker>`).join('')}</defs>
      ${[3, 2, 1].map(rank => `<g class="arrow-group rank-${rank}" data-rank="${rank}"><line class="${rank === 1 ? 'arrow' : 'variant-arrow'}" marker-end="url(#sf-arrow-head-${rank})"/><text class="arrow-label" text-anchor="middle" dominant-baseline="central">${rank}</text></g>`).join('')}
    </svg></svg>
    <section class="panel collapsed" aria-label="Stockfish Lens">
      <header><div><span class="logo">♞</span><strong>Stockfish <span>Lens</span></strong></div><div class="header-actions"><button class="restart-engine" title="Reiniciar motor" aria-label="Reiniciar motor">↻</button><button class="collapse" title="Expandir painel" aria-expanded="false">+</button></div></header>
      <div class="body">
        <section class="best-card" aria-label="Melhor lance">
        <div class="source-row"><div class="eyebrow">O STOCKFISH JOGARIA</div><span class="source-badge">Tabuleiro</span></div>
        <div class="result"><strong class="move">—</strong><div class="score-block" title="Avaliação para as brancas. Valores negativos favorecem as pretas."><span class="score">—</span><small>Pelas brancas</small></div></div>
        <div class="squares">Aguardando o tabuleiro</div>
        <div class="divider"><div class="eval-bar" role="img" hidden><span class="eval-white"></span><span class="eval-center"></span></div></div>
        <div class="meta"><span class="turn">Posição não identificada</span><span class="depth">Prof. —</span></div>
        <p class="status" role="status" aria-live="polite">Carregando motor local…</p>
        <p class="premove-note section-note" role="status" hidden>Pré-movimento marcado. Analisando a posição real; setas temporariamente ocultas.</p>
        <div class="manual-banner" hidden><span>Posição manual ativa</span><button class="return-board" type="button">Usar tabuleiro</button></div>
        <div class="pv-preview"><span class="minor-label">Continuação principal</span><p class="pv"></p></div>
        </section>
        <details class="variants" open><summary><h2>Melhores variantes</h2></summary><p class="variant-empty section-note">As variantes aparecem após a análise da posição.</p><ol class="lines"></ol></details>
        <details class="statistics" open><summary><h2>Dados da pesquisa</h2></summary>
          <p class="section-note">Tempo e desempenho desta análise.</p>
          <p class="metrics-empty section-note">Os dados aparecem quando o motor começa a pesquisar.</p><dl class="metrics"></dl><div class="wdl"></div><p class="ponder"></p>
        </details>
        <details class="appearance-options"><summary><h2>Aparência</h2></summary>
          <button class="reset-layout" type="button">Restaurar posição e tamanho</button>
          <div class="font-control"><label for="sf-font-scale">Tamanho das fontes</label>
            <select id="sf-font-scale" aria-describedby="sf-font-scale-hint">${FONT_SCALES.map(size => `<option value="${size}">${size}%${size === 100 ? ' (padrão)' : size === 80 ? ' (menor)' : size === 150 ? ' (maior)' : ''}</option>`).join('')}</select>
            <p id="sf-font-scale-hint" class="field-hint">Ajusta todos os textos do painel e do popup, incluindo os lances.</p>
          </div>
          <div class="font-control"><label for="sf-arrow-scale">Tamanho das setas</label>
            <select id="sf-arrow-scale" aria-describedby="sf-arrow-scale-hint">${ARROW_SCALES.map(size => `<option value="${size}">${size}%${size === 100 ? ' (padrão)' : size === 50 ? ' (menor)' : size === 200 ? ' (maior)' : ''}</option>`).join('')}</select>
            <p id="sf-arrow-scale-hint" class="field-hint">Ajusta a espessura e as pontas das três setas.</p>
          </div>
        </details>
        <details class="notation-options"><summary><h2>Notação dos lances</h2></summary>
          <label class="arrow-master"><span><strong>Símbolo + letra da peça</strong><small>Inclui K, Q, R, B e N nos lances.</small></span><input type="checkbox" data-notation-setting="showPieceLetters"></label>
        </details>
        <details class="arrow-options"><summary><h2>Setas no tabuleiro</h2></summary>
          <label class="arrow-master"><span><strong>Mostrar setas</strong><small>Escolha os lances que quer acompanhar.</small></span><input type="checkbox" data-setting="showArrows"></label>
          <div class="arrow-choices">
            <label class="rank-1"><span class="swatch"></span>1º lance<input type="checkbox" data-setting="arrowBest"></label>
            <label class="rank-2"><span class="swatch"></span>2º lance<input type="checkbox" data-setting="arrowSecond"></label>
            <label class="rank-3"><span class="swatch"></span>3º lance<input type="checkbox" data-setting="arrowThird"></label>
          </div>
          <label class="arrow-master"><span><strong>Ocultar alternativas desfavoráveis</strong><small>Filtra o 2º e o 3º lances que favorecem o adversário. A melhor sugestão permanece disponível.</small></span><input type="checkbox" data-filter-setting="hideUnfavorableArrows"></label>
          <p class="arrow-hint section-note"></p>
        </details>
        <details class="fen-options"><summary><h2>Analisar uma posição</h2></summary><form novalidate>
          <label for="sf-fen">Posição em FEN</label><p id="sf-fen-hint" class="field-hint">Cole os seis campos da posição. Ela ficará ativa até você voltar ao tabuleiro.</p>
          <textarea id="sf-fen" rows="3" spellcheck="false" autocapitalize="off" aria-describedby="sf-fen-hint sf-fen-error" placeholder="Cole o FEN completo aqui"></textarea>
          <p id="sf-fen-error" class="field-error" role="alert"></p>
          <div class="form-actions"><button type="submit" class="primary">Analisar FEN</button><button class="copy-fen" type="button">Copiar posição atual</button><button class="automatic" type="button">Usar tabuleiro</button></div>
        </form></details>
        <details class="protocol"><summary><h2>Motor e registros</h2></summary>
          <p class="engine-name">Stockfish local</p><p class="section-note">Log UCI completo: últimas 3.000 mensagens, incluindo comandos, opções e respostas do motor.</p>
          <div class="protocol-actions"><button class="export-log" type="button">Baixar log (.txt)</button></div>
          <pre class="uci-log"></pre>
        </details>
        <footer><span>Lens ${extensionVersion}</span><span>Stockfish 19 · local</span></footer>
      </div>
      <div class="actionbar"><p class="notice" role="status" aria-live="polite"></p><div class="controls"><button class="toggle" type="button">Pausar</button><button class="refresh primary" type="button">Analisar agora</button></div></div>
      <button class="resize-handle" aria-label="Redimensionar painel" title="Arraste para redimensionar. Com foco, use as setas do teclado."></button>
    </section>`;
  document.documentElement.append(host);
  const $ = selector => root.querySelector(selector);
  $('.logo').replaceChildren(renderPiece(document, 'N', 'w'));
  const syncCollapse = () => {
    const collapsed = $('.panel').classList.contains('collapsed');
    $('.collapse').textContent = collapsed ? '+' : '−';
    $('.collapse').setAttribute('aria-expanded', String(!collapsed));
    $('.collapse').title = collapsed ? 'Expandir painel' : 'Recolher painel';
  };
  const panelLayout = await attachPanelLayout($('.panel'), { onReset: syncCollapse });
  syncCollapse();
  let board = null, position = null, lastFen = '', manualFen = null, move = null;
  let contextLost = false, searchTimer;
  const STARTUP_TIMEOUT = 15000;
  let enginePort = null, offscreenMode = false, offscreenStarting = false, engineStartTimer, connectionAttempt = 0;
  let frame = null, channel = '', engineReady = false, engineFailed = false, id = 0;
  let timer, animationTimer, previousPlacement = '', stableSince = 0;
  const log = [];
  let analysis = null;
  let logTimer, noticeTimer;
  const filteredArrow = (entry, rank) => settings.hideUnfavorableArrows &&
    hideUnfavorableAlternative(entry, rank, analysis?.turn);
  function syncActions() {
    const state = $('.panel').dataset.state;
    const busy = settings.enabled && ['loading', 'searching'].includes(state);
    $('.refresh').disabled = !contextLost && ((!position && !engineFailed) || state === 'complete');
    $('.refresh').textContent = contextLost ? 'Atualizar página' : busy ? 'Reiniciar motor' : engineFailed ? 'Tentar novamente' : settings.enabled ? state === 'ready' ? 'Reanalisar' : 'Analisar' : 'Retomar análise';
    $('.toggle').disabled = contextLost;
    $('.toggle').textContent = settings.enabled ? 'Pausar' : 'Retomar';
    $('.toggle').setAttribute('aria-label', settings.enabled ? 'Pausar análise' : 'Retomar análise');
    $('.best-card').setAttribute('aria-busy', String(busy));
    $('.restart-engine').title = contextLost ? 'Atualizar página para reconectar a extensão' : 'Reiniciar motor';
    $('.restart-engine').setAttribute('aria-label', $('.restart-engine').title);
    if (contextLost) for (const control of root.querySelectorAll('input, select, textarea, form button')) control.disabled = true;
    $('.copy-fen').disabled = !position || $('.panel').dataset.fen !== position.fen;
    $('.export-log').disabled = log.length === 0;
    $('.automatic').disabled = !manualFen;
    $('.manual-banner').hidden = !manualFen;
    $('.source-badge').textContent = manualFen ? 'FEN manual' : position?.premove ? 'Posição real' : 'Tabuleiro';
    $('.premove-note').hidden = !position?.premove || Boolean(manualFen);
    $('.variant-empty').textContent = state === 'complete' ? 'Não há variantes para jogar nesta posição.' : busy ? 'Calculando as melhores continuações…' : !settings.enabled ? 'Retome a análise para ver as variantes.' : 'Abra um tabuleiro ou informe uma posição em FEN.';
    const filtered = (analysis?.lines || []).slice(1, 3).filter((entry, index) =>
      settings[index === 0 ? 'arrowSecond' : 'arrowThird'] && filteredArrow(entry, index + 2)).length;
    $('.arrow-hint').textContent = !settings.enabled ? 'Análise pausada. Retome para ver as setas.' :
      settings.mode === 'panel' ? 'Modo só painel. Selecionar uma seta volta a exibi-la no tabuleiro.' :
      !settings.showArrows ? 'Setas ocultas. Selecione um lance para mostrar sua seta.' :
      !position ? 'Abra um tabuleiro para ver as setas.' :
      position.premove ? 'As setas voltam quando o tabuleiro mostrar a posição real. A análise continua no painel.' :
      filtered ? `${filtered === 1 ? '1 seta de alternativa oculta' : `${filtered} setas de alternativas ocultas`} pelo filtro. Todos os lances continuam no painel.` :
      'As cores e os números correspondem às variantes acima.';
  }
  const status = (text, state = 'idle') => {
    $('.status').textContent = text;
    $('.panel').dataset.state = state;
    syncActions();
  };
  function notify(text, error = false) {
    clearTimeout(noticeTimer);
    $('.notice').textContent = text;
    $('.notice').dataset.error = String(error);
    noticeTimer = setTimeout(() => { $('.notice').textContent = ''; }, 3500);
  }
  function runtimeAlive() {
    try { return chrome.runtime.id === extensionId && Boolean(chrome.runtime.getManifest()); }
    catch { return false; }
  }
  function disposeEngine() {
    connectionAttempt++;
    clearTimeout(engineStartTimer); clearTimeout(searchTimer);
    engineReady = false; offscreenStarting = false;
    const previous = enginePort; enginePort = null;
    try { previous?.disconnect(); } catch { /* already disconnected */ }
    frame?.remove(); frame = null; channel = '';
  }
  function disconnected() {
    if (contextLost) return;
    contextLost = true; settings.enabled = false; id++;
    disposeEngine(); engineFailed = true; lastFen = ''; clearResult();
    status('A conexão com a extensão foi perdida. Atualize esta página para reconectar.', 'disconnected');
  }
  function checkRuntime() {
    if (contextLost) return false;
    if (runtimeAlive()) return true;
    disconnected(); return false;
  }
  async function saveSettings(patch) {
    if (!checkRuntime()) return;
    const before = settings;
    settings = normalizeSettings({ ...settings, ...patch });
    applySettings(['enabled', 'ms', 'multipv'].some(key => settings[key] !== before[key]));
    if (contextLost) return;
    try { await chrome.storage.local.set(patch); }
    catch {
      if (!runtimeAlive()) disconnected();
      else notify('A alteração vale nesta aba; não foi possível salvá-la.', true);
    }
  }
  const send = data => {
    if (!engineReady || !checkRuntime()) return;
    try {
      if (enginePort) enginePort.postMessage(data);
      else frame?.contentWindow?.postMessage({ channel, ...data }, extensionOrigin);
    } catch (error) {
      if (!runtimeAlive()) disconnected();
      else engineError(`A conexão com o motor falhou: ${error.message}. Clique em Reiniciar motor.`);
    }
  };
  function renderEvaluationBar(info) {
    const bar = $('.eval-bar');
    const percent = evaluationBarPercent(info);
    bar.hidden = percent === null;
    if (percent === null) {
      bar.style.removeProperty('--sf-eval-white');
      bar.removeAttribute('aria-label'); bar.removeAttribute('title');
      return;
    }
    bar.style.setProperty('--sf-eval-white', `${percent}%`);
    bar.setAttribute('aria-label', `Avaliação pelas brancas: ${$('.score').textContent}. Brancas à esquerda; pretas à direita.`);
    bar.title = `${info.bound ? 'Limite da avaliação' : 'Avaliação'}: ${$('.score').textContent} pelas brancas. Escala visual, não representa chances de vitória.`;
  }
  const clearResult = () => {
    clearTimeout(searchTimer);
    renderEvaluationBar(null);
    move = null;
    $('.move').textContent = $('.score').textContent = '—';
    $('.squares').textContent = '—';
    $('.turn').textContent = settings.enabled ? 'Posição em atualização' : 'Atualização pausada';
    delete $('.move').dataset.san;
    delete $('.panel').dataset.fen;
    $('.pv').textContent = '';
    $('.depth').textContent = 'Prof. —';
    analysis = null; $('.lines').replaceChildren(); $('.metrics').replaceChildren();
    $('.wdl').textContent = $('.ponder').textContent = '';
    draw();
  };

  function engineError(message) {
    disposeEngine();
    engineFailed = true; engineReady = false; offscreenStarting = false;
    id++; lastFen = ''; clearResult(); status(message, 'error');
  }
  function watchStartup(attempt) {
    clearTimeout(engineStartTimer);
    engineStartTimer = setTimeout(() => {
      if (attempt !== connectionAttempt || engineReady || !checkRuntime()) return;
      if (offscreenMode) engineError('O motor interno não respondeu. Clique em Tentar novamente.');
      else internalEngine('O motor embutido não iniciou em 15 segundos.');
    }, STARTUP_TIMEOUT);
  }
  async function loadOffscreenEngine() {
    if (offscreenStarting || (enginePort && !engineFailed)) return;
    const attempt = ++connectionAttempt;
    const previous = enginePort; enginePort = null; previous?.disconnect();
    offscreenStarting = true; engineReady = engineFailed = false;
    watchStartup(attempt);
    try {
      const result = await chrome.runtime.sendMessage({ type: 'ensure-stockfish-host' });
      if (attempt !== connectionAttempt) return;
      if (!result?.ok) throw new Error(result?.message || 'Não foi possível abrir o motor interno.');
      const current = enginePort = chrome.runtime.connect({ name: 'stockfish-engine' });
      current.onMessage.addListener(data => { if (enginePort === current) handleEngineMessage(data); });
      current.onDisconnect.addListener(() => {
        let reason; try { reason = chrome.runtime.lastError?.message; } catch { /* invalidated context */ }
        if (enginePort !== current) return;
        if (!runtimeAlive()) { disconnected(); return; }
        enginePort = null;
        engineError(reason || 'A conexão com o motor interno foi encerrada. Clique em Tentar novamente.');
      });
      handleEngineMessage({ type: 'uci', direction: '!', line: '[motor] Usando documento interno da extensão (offscreen).' });
    } catch (error) {
      if (attempt === connectionAttempt) {
        if (!runtimeAlive()) disconnected();
        else engineError(`Não foi possível iniciar o motor interno: ${error.message}. Clique em Reiniciar motor.`);
      }
    }
  }
  function loadEngine() {
    if (offscreenMode) { loadOffscreenEngine(); return; }
    if (frame && !engineFailed) return;
    frame?.remove();
    engineReady = engineFailed = false;
    channel = crypto.randomUUID();
    frame = document.createElement('iframe');
    frame.hidden = true;
    frame.title = 'Motor Stockfish local';
    frame.src = resourceURL('engine.html') + '#' + new URLSearchParams({ channel, origin: location.origin });
    const attempt = ++connectionAttempt;
    watchStartup(attempt);
    frame.onerror = () => { if (attempt === connectionAttempt && checkRuntime()) internalEngine('Falha ao carregar a página do motor.'); };
    root.append(frame);
  }

  function internalEngine(reason) {
    disposeEngine(); offscreenMode = true; engineFailed = false;
    lastFen = ''; clearResult();
    handleEngineMessage({ type: 'uci', direction: '!', line: `[motor] ${reason} Tentando documento interno.` });
    status('Iniciando motor interno da extensão…', 'loading');
    loadOffscreenEngine();
  }
  function restartEngine() {
    if (!checkRuntime()) { location.reload(); return; }
    disposeEngine(); engineFailed = false; id++; lastFen = ''; clearResult();
    if (!settings.enabled) saveSettings({ enabled: true });
    else scan(true);
  }
  function analyze(force = false) {
    if (!settings.enabled || (engineFailed && !force)) return;
    if (!position) return;
    if (!force && lastFen === position.fen) return;
    clearResult();
    lastFen = position.fen;
    $('.panel').dataset.fen = position.fen;
    id++;
    const game = new Chess(position.fen);
    $('.turn').textContent = `Vez das ${game.turn() === 'w' ? 'brancas' : 'pretas'}`;
    $('.squares').textContent = manualFen ? 'FEN manual' : position.source;
    if (game.isGameOver()) {
      send({ type: 'cancel' });
      if (contextLost) return;
      $('.move').textContent = game.isCheckmate() ? 'Mate' : 'Empate';
      $('.score').textContent = game.isCheckmate() ? (game.turn() === 'w' ? '−M0' : '+M0') : '0.00';
      renderEvaluationBar({ score: game.isCheckmate() && game.turn() === 'w' ? -0 : 0, mate: game.isCheckmate() });
      status(game.isCheckmate() ? 'Xeque-mate. Não há lance legal.' : 'Posição encerrada pelas regras do xadrez.', 'complete');
      return;
    }
    loadEngine();
    if (!engineReady) { status('Carregando Stockfish local…', 'loading'); return; }
    analysis = new SearchAnalysis(position.fen);
    status(`Analisando · ${(settings.ms / 1000).toLocaleString('pt-BR')} s`, 'searching');
    const request = id;
    searchTimer = setTimeout(() => {
      if (id === request && settings.enabled && checkRuntime())
        engineError('A análise não terminou no tempo esperado. Clique em Reiniciar motor.');
    }, settings.ms + 10000);
    send({ type: 'analyze', id, fen: position.fen, moves: position.moves, ms: settings.ms, multipv: settings.multipv });
  }

  function draw() {
    const layer = $('.board-overlay');
    const visible = settings.enabled && settings.showArrows && settings.mode !== 'panel' && board?.isConnected && analysis?.primary && position;
    if (!visible) { layer.style.display = 'none'; return; }
    try {
      if (placementFromBoard(board) !== position.fen.split(' ')[0]) { layer.style.display = 'none'; return; }
    } catch { layer.style.display = 'none'; return; }
    const rect = board.getBoundingClientRect();
    layer.style.display = '';
    layer.setAttribute('x', rect.x);
    layer.setAttribute('y', rect.y);
    layer.setAttribute('width', rect.width);
    layer.setAttribute('height', rect.height);
    const entries = analysis.lines;
    const arrowScale = settings.arrowScale / 100;
    let any = false;
    for (const [index, key] of ['arrowBest', 'arrowSecond', 'arrowThird'].entries()) {
      const group = $(`.arrow-group[data-rank="${index + 1}"]`);
      const entry = entries[index];
      const show = settings[key] && entry && !filteredArrow(entry, index + 1);
      group.style.display = show ? '' : 'none';
      group.style.visibility = show ? 'visible' : 'hidden';
      if (!show) continue;
      any = true;
      const uci = entry.pv[0]; group.dataset.uci = uci;
      const [x1, y1] = squarePoint(uci.slice(0, 2), isFlipped(board));
      const [x2, y2] = squarePoint(uci.slice(2, 4), isFlipped(board));
      const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy);
      const arrow = group.querySelector('line'), label = group.querySelector('text');
      for (const [attr, val] of Object.entries({ x1, y1, x2: x2 - dx / length * 2 * arrowScale, y2: y2 - dy / length * 2 * arrowScale })) arrow.setAttribute(attr, val);
      label.setAttribute('x', x1 + dx * .55 - dy / length * 2.5 * arrowScale);
      label.setAttribute('y', y1 + dy * .55 + dx / length * 2.5 * arrowScale);
    }
    if (!any) layer.style.display = 'none';
  }

  const resizeObserver = new ResizeObserver(draw);
  function scan(force = false) {
    if (!checkRuntime()) return;
    if (engineFailed && !force) return;
    clearTimeout(animationTimer);
    const next = [...document.querySelectorAll(BOARD_SELECTOR)].find(el => el.getBoundingClientRect().width > 0) || null;
    if (next !== board) {
      if (board) resizeObserver.unobserve(board);
      board = next;
      previousPlacement = '';
      lastFen = '';
      if (board) resizeObserver.observe(board);
    }
    if (!settings.enabled) { draw(); return; }
    if (manualFen) { position = { fen: manualFen, source: 'FEN manual' }; analyze(force); draw(); return; }
    if (!board) {
      if (position) { id++; send({ type: 'cancel' }); }
      position = null; lastFen = ''; clearResult();
      $('.turn').textContent = 'Posição não identificada';
      $('.squares').textContent = 'Abra um tabuleiro no Chess.com';
      status('Aguardando um tabuleiro…', 'waiting'); return;
    }
    try {
      const placement = placementFromBoard(board);
      let nextPosition, positionError;
      try { nextPosition = readPosition(board); } catch (error) { positionError = error; }
      // A queued move changes the artwork, not the game. Preserve the current
      // search when its validated FEN is unchanged, including queue cancellation.
      if (nextPosition && (nextPosition.premove || nextPosition.fen === position?.fen && lastFen === nextPosition.fen)) {
        previousPlacement = placement;
        position = nextPosition;
        analyze(force); syncActions(); draw(); return;
      }
      if (previousPlacement !== placement) {
        previousPlacement = placement; stableSince = Date.now();
        id++; lastFen = ''; send({ type: 'cancel' }); clearResult();
        status('Aguardando o tabuleiro estabilizar…', 'loading');
      }
      if (Date.now() - stableSince < 250) {
        animationTimer = setTimeout(() => scan(force), 260); return;
      }
      if (positionError) throw positionError;
      position = nextPosition;
      analyze(force);
      syncActions();
      draw();
    } catch (error) {
      id++; send({ type: 'cancel' }); position = null; lastFen = ''; clearResult();
      $('.squares').textContent = 'Posição não confirmada';
      status(error.message, error.message.includes('animação') ? 'loading' : 'error');
      if (error.message.includes('animação')) animationTimer = setTimeout(() => scan(), 300);
    }
  }

  function renderAnalysis() {
    const info = analysis?.primary;
    if (!info) return;
    move = info.pv[0];
    $('.move').dataset.san = info.san[0];
    $('.move').replaceChildren(renderSan(document, info.san[0], analysis.turn));
    $('.score').textContent = formatScore(info);
    renderEvaluationBar(info);
    $('.score').title = info.bound ? 'Limite estimado durante a pesquisa; a avaliação exata não foi concluída.' : '';
    $('.depth').textContent = `Prof. ${info.depth ?? '—'}`;
    $('.squares').textContent = `${move.slice(0, 2)} → ${move.slice(2, 4)}${move[4] ? ` · promoção: ${move[4].toUpperCase()}` : ''}`;
    $('.pv').replaceChildren(renderLine(document, position.fen, info.san.slice(0, 8)));
    $('.lines').replaceChildren(...analysis.lines.map((entry, rank) => {
      const li = document.createElement('li');
      li.dataset.rank = rank + 1; li.dataset.uci = entry.pv[0];
      const heading = document.createElement('div'); heading.className = 'variation-heading';
      const badge = document.createElement('span'); badge.className = `variation-rank rank-${rank + 1}`; badge.textContent = rank + 1;
      const leading = document.createElement('strong'); leading.append(renderSan(document, entry.san[0], analysis.turn));
      const score = document.createElement('span'); score.className = 'variation-score'; score.textContent = formatScore(entry);
      const depth = document.createElement('span'); depth.className = 'variation-depth'; depth.textContent = `prof. ${entry.depth ?? '—'}`;
      heading.append(badge, leading, score, depth);
      const continuation = document.createElement('div'); continuation.className = 'variation-line';
      continuation.append(renderLine(document, position.fen, entry.san));
      li.append(heading, continuation); return li;
    }));
    const labels = { seldepth: 'Profundidade seletiva', multipv: 'Variante', nodes: 'Posições pesquisadas', nps: 'Posições / segundo', hashfull: 'Uso do hash', tbhits: 'Consultas a finais', time: 'Tempo do motor', cpuload: 'Uso de CPU', currmovenumber: 'Índice do lance atual' };
    const descriptions = { seldepth: 'Maior profundidade alcançada em uma linha da pesquisa.', nodes: 'Quantidade de posições examinadas pelo motor.', nps: 'Velocidade de pesquisa: posições examinadas por segundo.', hashfull: 'Fração usada da memória de posições do motor.', time: 'Tempo gasto nesta pesquisa, em milissegundos.' };
    $('.metrics').replaceChildren(...Object.entries(info.metrics).flatMap(([key, value]) => {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = labels[key] || key;
      if (descriptions[key]) dt.title = descriptions[key];
      dd.textContent = key === 'hashfull' || key === 'cpuload' ? `${(value / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : key === 'time' ? `${value.toLocaleString('pt-BR')} ms` : value.toLocaleString('pt-BR');
      return [dt, dd];
    }));
    if (info.currmove) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = 'Lance pesquisado'; dd.textContent = info.currmove; $('.metrics').append(dt, dd);
    }
    $('.wdl').replaceChildren();
    if (info.wdl) {
      const context = document.createElement('p'); context.className = 'wdl-context';
      context.textContent = `Chances estimadas para as ${analysis.turn === 'w' ? 'brancas' : 'pretas'}`;
      const bar = document.createElement('div'); bar.className = 'wdl-bar'; bar.setAttribute('aria-hidden', 'true');
      const values = document.createElement('div'); values.className = 'wdl-values';
      for (const [i, [name, key]] of [['Vitória', 'win'], ['Empate', 'draw'], ['Derrota', 'loss']].entries()) {
        const segment = document.createElement('span'); segment.className = `wdl-${key}`; segment.style.width = `${info.wdl[i] / 10}%`; bar.append(segment);
        const item = document.createElement('div'); item.className = `wdl-value wdl-${key}`;
        const label = document.createElement('span'); label.textContent = name;
        const percent = document.createElement('strong'); percent.textContent = `${(info.wdl[i] / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
        item.append(label, percent); values.append(item);
      }
      $('.wdl').append(context, bar, values);
    }
    $('.ponder').replaceChildren();
    if (analysis.ponder) $('.ponder').append('Resposta esperada: ', renderSan(document, analysis.ponder.san, analysis.turn === 'w' ? 'b' : 'w'));
    syncActions();
    draw();
  }

  window.addEventListener('message', event => {
    if (event.source !== frame?.contentWindow || event.origin !== extensionOrigin || event.data?.channel !== channel) return;
    handleEngineMessage(event.data);
  });
  function handleEngineMessage(data) {
    if (data.type === 'uci') {
      log.push(`${new Date().toISOString()} ${data.direction} ${data.line}`);
      $('.export-log').disabled = false;
      if (log.length > 3000) log.shift();
      if (data.line.startsWith('id name ')) $('.engine-name').textContent = data.line.slice(8);
      if ($('.protocol').open && !logTimer) logTimer = setTimeout(() => {
        logTimer = null; $('.uci-log').textContent = log.join('\n');
      }, 250);
      return;
    }
    if (data.type === 'ready') { clearTimeout(engineStartTimer); offscreenStarting = false; engineReady = true; engineFailed = false; scan(true); }
    else if (data.type === 'restarting') {
      if (engineReady) watchStartup(connectionAttempt);
      engineReady = false; lastFen = ''; clearResult(); status(data.message, 'loading');
    }
    else if (data.type === 'error') {
      if (data.code === 'worker-load' && !offscreenMode) {
        internalEngine('O Worker do motor embutido não carregou.');
      } else engineError(data.message);
    }
    else if (data.id === id && settings.enabled && position) {
      if (data.type === 'info') {
        if (analysis?.update(data.line)) renderAnalysis();
      } else if (data.type === 'done') {
        clearTimeout(searchTimer);
        if (!data.move || data.move === '(none)' || data.move === '0000') {
          clearResult(); status('Sem lance legal nesta posição.', 'complete');
        } else if (analysis?.finish(data.move, data.ponder)) {
          renderAnalysis();
          status(manualFen ? 'Análise do FEN concluída.' : 'Análise concluída · atualização automática', 'ready');
        } else {
          clearResult(); status('Não foi possível confirmar o lance final do motor. Clique em Analisar.', 'error');
        }
      }
    }
  }

  function applySettings(reanalyze = true) {
    host.style.setProperty('--sf-font-scale', settings.fontScale / 100);
    $('#sf-font-scale').value = settings.fontScale;
    host.style.setProperty('--sf-arrow-scale', settings.arrowScale / 100);
    $('#sf-arrow-scale').value = settings.arrowScale;
    $('.panel').hidden = settings.mode === 'arrow';
    $('.panel').classList.toggle('symbols-only', !settings.showPieceLetters);
    $('[data-notation-setting="showPieceLetters"]').checked = settings.showPieceLetters;
    $('[data-filter-setting="hideUnfavorableArrows"]').checked = settings.hideUnfavorableArrows;
    $('.toggle').textContent = settings.enabled ? 'Pausar' : 'Retomar';
    for (const key of ARROW_SETTINGS) $(`[data-setting="${key}"]`).checked = settings[key];
    syncActions();
    if (!reanalyze) { draw(); return; }
    id++; lastFen = ''; clearResult(); send({ type: 'cancel' });
    if (contextLost) return;
    if (!settings.enabled) { disposeEngine(); status('Análise pausada.', 'paused'); }
    else scan(true);
  }
  $('.collapse').onclick = () => {
    panelLayout.setCollapsed(!$('.panel').classList.contains('collapsed'));
    syncCollapse();
  };
  $('.reset-layout').onclick = async () => {
    try { await panelLayout.reset(); notify('Posição e tamanho restaurados.'); }
    catch { if (!runtimeAlive()) disconnected(); else notify('Layout restaurado nesta aba.', true); }
  };
  $('.restart-engine').onclick = restartEngine;
  $('.toggle').onclick = () => saveSettings({ enabled: !settings.enabled });
  $('[data-notation-setting="showPieceLetters"]').onchange = event => saveSettings({ showPieceLetters: event.target.checked });
  $('#sf-font-scale').onchange = event => saveSettings({ fontScale: Number(event.target.value) });
  $('#sf-arrow-scale').onchange = event => saveSettings({ arrowScale: Number(event.target.value) });
  $('[data-filter-setting="hideUnfavorableArrows"]').onchange = event => saveSettings({ hideUnfavorableArrows: event.target.checked });
  for (const input of root.querySelectorAll('[data-setting]')) {
    input.onchange = () => saveSettings(arrowPreference(settings, input.dataset.setting, input.checked));
  }
  $('.refresh').onclick = () => {
    if (!checkRuntime()) { location.reload(); return; }
    if (['loading', 'searching'].includes($('.panel').dataset.state) || engineFailed) restartEngine();
    else if (!settings.enabled) saveSettings({ enabled: true });
    else scan(true);
  };
  $('form').onsubmit = event => {
    event.preventDefault();
    try {
      const game = new Chess($('#sf-fen').value.trim());
      $('#sf-fen-error').textContent = ''; $('#sf-fen').removeAttribute('aria-invalid');
      manualFen = game.fen(); lastFen = ''; id++; send({ type: 'cancel' }); clearResult();
      if (!settings.enabled) saveSettings({ enabled: true });
      else scan(true);
    } catch { $('#sf-fen-error').textContent = 'FEN inválido. Confira os seis campos, os reis e a vez de jogar.'; $('#sf-fen').setAttribute('aria-invalid', 'true'); $('#sf-fen').focus(); }
  };
  $('#sf-fen').oninput = () => { $('#sf-fen-error').textContent = ''; $('#sf-fen').removeAttribute('aria-invalid'); };
  const useBoard = () => { manualFen = null; lastFen = ''; scan(true); syncActions(); };
  $('.automatic').onclick = useBoard;
  $('.return-board').onclick = useBoard;
  $('.protocol').addEventListener('toggle', () => { if ($('.protocol').open) $('.uci-log').textContent = log.join('\n'); });
  $('.export-log').onclick = () => {
    const url = URL.createObjectURL(new Blob([log.join('\n')], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = 'stockfish-uci.txt'; link.click();
    notify('Log UCI baixado.');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('.copy-fen').onclick = async () => {
    if (!position) { notify('Nenhuma posição confirmada para copiar.', true); return; }
    try { await navigator.clipboard.writeText(position.fen); notify('FEN copiado.'); }
    catch { $('#sf-fen').value = position.fen; $('details:has(form)').open = true; $('#sf-fen').select(); notify('Selecione e copie o FEN no campo de posição.'); }
  };
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || contextLost) return;
      const next = { ...settings };
      for (const key of Object.keys(DEFAULTS)) if (changes[key]) next[key] = changes[key].newValue ?? DEFAULTS[key];
      const normalized = normalizeSettings(next);
      const changed = Object.keys(DEFAULTS).filter(key => normalized[key] !== settings[key]);
      if (!changed.length) return;
      settings = normalized;
      applySettings(changed.some(key => ['enabled', 'ms', 'multipv'].includes(key)));
    });
  } catch { disconnected(); }
  new MutationObserver(records => {
    // Ignore clock tick text and our own panel. Do not postpone indefinitely on frequent updates.
    const relevant = records.some(record => !host.contains(record.target) &&
      (record.target.closest?.(`${BOARD_SELECTOR}, wc-simple-move-list, .move-list`) ||
       [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 &&
         (node.matches?.(`${BOARD_SELECTOR}, wc-simple-move-list, .move-list`) || node.querySelector?.(`${BOARD_SELECTOR}, wc-simple-move-list, .move-list`)))));
    if (relevant) { draw(); if (!timer) timer = setTimeout(() => { timer = null; scan(); }, 60); }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true,
    attributeFilter: ['class', 'data-node', 'style'] });
  window.addEventListener('resize', draw);
  document.addEventListener('scroll', draw, true);
  document.addEventListener('fullscreenchange', () => {
    (document.fullscreenElement || document.documentElement).append(host); draw();
  });
  // Also catches SPA route changes and lazy mounting without a page reload.
  setInterval(() => { if (!host.isConnected) document.documentElement.append(host); scan(); }, 1500);
  if (checkRuntime()) applySettings();
}
