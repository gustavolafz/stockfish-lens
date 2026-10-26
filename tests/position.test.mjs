import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { Chess } from 'chess.js';
import { readPosition, placementFromBoard, sanFromNode, squarePoint, isFlipped, parseInfo, variation } from '../src/position.js';
import { normalizeSettings } from '../src/settings.js';
const fixture = readFileSync(new URL('fixtures/chesscom.html', import.meta.url), 'utf8');
const load = () => {
  const { document } = parseHTML(fixture);
  return { document, board: document.querySelector('wc-chess-board') };
};
function place(board, fen) {
  board.querySelectorAll('.piece').forEach(el => el.remove());
  const game = new Chess(fen);
  for (const row of game.board()) for (const piece of row) if (piece) {
    const el = board.ownerDocument.createElement('div');
    el.className = `piece ${piece.color}${piece.type} square-${piece.square.charCodeAt(0) - 96}${piece.square[1]}`;
    board.append(el);
  }
}

const loadPremove = name => {
  const { document } = parseHTML(readFileSync(new URL(`fixtures/chesscom-premove-${name}.html`, import.meta.url), 'utf8'));
  return { document, board: document.querySelector('wc-chess-board') };
};

test('both supplied premove snapshots recover the exact official FEN and history', () => {
  for (const [name, fen, ply, from, to] of [
    ['capture', 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 2, 'd5', 'e4'],
    ['pawn', 'rnbqkb1r/p3pppp/2p2n2/8/8/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 5', 8, 'e7', 'e5']
  ]) {
    const { document, board } = loadPremove(name);
    const position = readPosition(board, document);
    assert.equal(position.fen, fen);
    assert.equal(position.ply, ply);
    assert.equal(position.moves.length, ply);
    assert.deepEqual(position.premove, { from, to });
    assert.notEqual(position.placement, fen.split(' ')[0]);
    place(board, fen);
    assert.equal(readPosition(board, document).fen, fen);
    assert.equal(readPosition(board, document).premove, undefined);
  }
});

test('premove recovery requires complete legal history and the latest selected position', () => {
  for (const mode of ['missing', 'truncated', 'illegal', 'historical']) {
    const { document, board } = loadPremove('pawn');
    if (mode === 'missing') document.querySelector('wc-simple-move-list').remove();
    if (mode === 'truncated') document.querySelector('[data-node="0-2"]').remove();
    if (mode === 'illegal') document.querySelector('[data-node="0-2"]').textContent = 'Qh8';
    if (mode === 'historical') {
      document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
      document.querySelector('[data-node="0-1"]').classList.add('selected');
    }
    assert.throws(() => readPosition(board, document), /confirmar a posição/, mode);
  }
});

test('an empty move list allows a verified premove before the first actual move', () => {
  for (const [piece, from, to] of [['bp', '57', '55'], ['bn', '78', '66']]) {
    const { document, board } = load();
    document.querySelector('wc-simple-move-list').replaceChildren();
    place(board, new Chess().fen());
    board.querySelectorAll('.highlight').forEach(el => el.remove());
    board.querySelector(`.piece.${piece}.square-${from}`).classList.replace(`square-${from}`, `square-${to}`);
    for (const square of [from, to]) {
      const marker = document.createElement('div'); marker.className = `highlight square-${square}`;
      marker.style.backgroundColor = 'rgb(244, 42, 50)'; board.append(marker);
    }
    const position = readPosition(board, document);
    assert.equal(position.fen, new Chess().fen());
    assert.equal(position.ply, 0); assert.deepEqual(position.moves, []);
    assert(position.premove);
    document.querySelector('wc-simple-move-list').remove();
    assert.throws(() => readPosition(board, document), /confirmar a posição/);
  }
});

test('ordinary highlights or additional unexplained piece changes do not enable premove recovery', () => {
  for (const mode of ['no markers', 'last move color', 'one marker', 'extra piece change', 'wrong side']) {
    const { document, board } = loadPremove('pawn');
    const red = [...board.querySelectorAll('.highlight')].filter(el => el.style.backgroundColor.includes('244'));
    if (mode === 'no markers') red.forEach(el => el.remove());
    if (mode === 'last move color') red.forEach(el => el.style.backgroundColor = 'rgb(255, 255, 51)');
    if (mode === 'one marker') red[0].remove();
    if (mode === 'extra piece change') board.querySelector('.piece.bn.square-28').classList.replace('square-28', 'square-36');
    if (mode === 'wrong side') {
      const official = readPosition(board, document).fen;
      place(board, official);
      board.querySelector('.piece.wn.square-71').classList.replace('square-71', 'square-63');
      red[0].className = 'highlight square-71'; red[1].className = 'highlight square-63';
    }
    assert.throws(() => readPosition(board, document), /confirmar a posição|animação/, mode);
  }
});

test('a queued castle recovers both relocated pieces without changing official castling rights', () => {
  const { document, board } = load();
  const history = ['Nf3', 'Nf6', 'g3', 'g6', 'Bg2', 'Bg7', 'd3'];
  const game = new Chess(); history.forEach(move => game.move(move));
  const list = document.querySelector('wc-simple-move-list'); list.replaceChildren();
  history.forEach((san, i) => {
    const node = document.createElement('div'); node.dataset.node = `0-${i}`; node.textContent = san;
    if (i === history.length - 1) node.className = 'selected'; list.append(node);
  });
  place(board, game.fen()); board.querySelectorAll('.highlight').forEach(el => el.remove());
  board.querySelector('.piece.wk.square-51').classList.replace('square-51', 'square-71');
  board.querySelector('.piece.wr.square-81').classList.replace('square-81', 'square-61');
  for (const square of ['51', '71']) {
    const marker = document.createElement('div'); marker.className = `highlight square-${square}`;
    marker.style.backgroundColor = 'rgb(244, 42, 50)'; board.append(marker);
  }
  const position = readPosition(board, document);
  assert.equal(position.fen, game.fen());
  assert.equal(position.fen.split(' ')[2], 'KQkq');
  assert.deepEqual(position.premove, { from: 'e1', to: 'g1' });
});

test('queued promotions retain the real pawn, turn and counters in the engine position', () => {
  for (const type of ['q', 'r', 'b', 'n']) {
    const { document } = parseHTML(readFileSync(new URL('fixtures/chesscom-promotion-pt.html', import.meta.url), 'utf8'));
    const board = document.querySelector('wc-chess-board'), game = new Chess();
    const nodes = [...document.querySelectorAll('[data-node]')];
    nodes.slice(0, 83).forEach(node => game.move(sanFromNode(node)));
    nodes.slice(83).forEach(node => node.remove());
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    nodes[82].classList.add('selected');
    place(board, game.fen());
    board.querySelector('.piece.wp.square-17').className = `piece w${type} square-18`;
    board.querySelectorAll('.highlight').forEach(el => el.remove());
    for (const square of ['17', '18']) {
      const marker = document.createElement('div'); marker.className = `highlight square-${square}`;
      marker.style.backgroundColor = 'rgb(244, 42, 50)'; board.append(marker);
    }
    const position = readPosition(board, document);
    assert.equal(position.fen, game.fen());
    assert.equal(position.ply, 83);
    assert.deepEqual(position.premove, { from: 'a7', to: 'a8' });
  }
});

test('replays all 42 plies from the supplied Chess.com HTML and matches every piece', () => {
  const { document, board } = load();
  const position = readPosition(board, document);
  assert.equal(position.ply, 42);
  assert.equal(position.fen, '2r2rk1/pp3pp1/4p2p/3pP3/1q4BP/1P6/P3QPP1/2bR2K1 w - - 2 22');
  assert.equal(position.moves.length, 42);
  assert.equal(position.moves.at(-1), 'd4b4');
});

test('figurines with no text are converted to SAN, including promotion', () => {
  const { document } = parseHTML('<div><span class="node-highlight-content"><span data-figurine="N"></span> xf7+?!</span></div>');
  assert.equal(sanFromNode(document.querySelector('div')), 'Nxf7+');
  document.querySelector('div').innerHTML = '<span class="node-highlight-content">e8=<span data-figurine="Q"></span>+</span>';
  assert.equal(sanFromNode(document.querySelector('div')), 'e8=Q+');
});

test('Portuguese promotion notation is converted without changing English SAN', () => {
  const { document } = parseHTML('<div class="node-highlight-content"></div>');
  const node = document.querySelector('div');
  for (const [localized, san] of [
    ['a8=D', 'a8=Q'], ['bxa8=D+?!', 'bxa8=Q+'], ['e1=T#', 'e1=R#'],
    ['e8=C+', 'e8=N+'], ['e1=B', 'e1=B'], ['a8=Q', 'a8=Q'],
    ['a8=R+', 'a8=R+'], ['a8=N', 'a8=N'], ['Rcf5', 'Rcf5'], ['O-O', 'O-O']
  ]) {
    node.textContent = localized;
    assert.equal(sanFromNode(node), san, localized);
  }
});

test('replays all 87 plies of the reported game, including 43. a8=D and following moves', () => {
  const { document } = parseHTML(readFileSync(new URL('fixtures/chesscom-promotion-pt.html', import.meta.url), 'utf8'));
  const board = document.querySelector('wc-chess-board');
  const position = readPosition(board, document);
  assert.equal(position.ply, 87);
  assert.equal(position.fen, 'Q5R1/8/8/7p/6Pk/1r6/R5PK/8 b - - 0 44');
  assert.equal(position.moves[84], 'a7a8q');
  assert.equal(position.moves[86], 'h3g4');
});

test('historical navigation restores exact castling rights and turn', () => {
  const { document, board } = load();
  document.querySelector('.selected').classList.remove('selected');
  const game = new Chess(); game.move('e4'); game.move('c6');
  document.querySelector('[data-node="0-1"]').classList.add('selected');
  place(board, game.fen());
  const position = readPosition(board, document);
  assert.equal(position.fen, game.fen());
  assert.equal(position.ply, 2);
  assert.equal(position.fen.split(' ')[2], 'KQkq');
});

test('duplicate squares during animation are rejected', () => {
  const { board } = load();
  board.append(board.querySelector('.piece').cloneNode());
  assert.throws(() => placementFromBoard(board), /animação/);
});

test('missing, truncated or illegal history never invents a FEN', () => {
  for (const mode of ['missing', 'truncated', 'illegal']) {
    const { document, board } = load();
    if (mode === 'missing') document.querySelector('wc-simple-move-list').remove();
    if (mode === 'truncated') document.querySelector('[data-node="0-2"]').remove();
    if (mode === 'illegal') document.querySelector('[data-node="0-2"]').textContent = 'Qh8';
    assert.throws(() => readPosition(board, document), /confirmar a posição/);
  }
});

test('initial board without history is recognized', () => {
  const { document, board } = load();
  document.querySelector('wc-simple-move-list').remove();
  place(board, new Chess().fen());
  assert.equal(readPosition(board, document).fen, new Chess().fen());
});

test('coordinates follow white and black orientation', () => {
  assert.deepEqual(squarePoint('a1'), [6.25, 93.75]);
  assert.deepEqual(squarePoint('h8', true), [6.25, 93.75]);
  const { board } = load(); assert.equal(isFlipped(board), false);
  board.classList.add('flipped'); assert.equal(isFlipped(board), true);
});

test('UCI parser exposes MultiPV, WDL and all search counters with white-relative scores', () => {
  const info = parseInfo('info depth 18 seldepth 25 multipv 2 score cp 83 wdl 400 550 50 nodes 120000 nps 80000 hashfull 12 tbhits 0 time 1500 pv e7e5 g1f3', 'b');
  assert.equal(info.score, -83); assert.equal(info.multipv, 2);
  assert.deepEqual(info.wdl, [400, 550, 50]);
  assert.equal(info.metrics.nps, 80000); assert.equal(info.metrics.time, 1500);
  assert.equal(parseInfo('info depth 3 score cp 20 lowerbound pv e2e4', 'w').bound, 'lowerbound');
  assert.equal(parseInfo('info depth 3 score cp 20 lowerbound pv e2e4', 'b').bound, 'upperbound');
  assert.equal(parseInfo('info string NNUE loaded', 'w'), null);
  assert.equal(parseInfo('info depth 8 score mate -2 pv e2e4', 'b').score, 2);
});

test('PV accepts legal moves and promotions and stops at an illegal continuation', () => {
  assert.deepEqual(variation(new Chess().fen(), ['e2e4', 'e7e5', 'e4e8']), ['e4', 'e5']);
  assert.deepEqual(variation('7k/P7/8/8/8/8/8/7K w - - 0 1', ['a7a8q']), ['a8=Q+']);
});

test('settings reject unsupported values', () => {
  assert.deepEqual(normalizeSettings({ enabled: false, ms: -1, mode: 'bad', multipv: 999 }),
    { enabled: false, mode: 'both', ms: 1200, multipv: 3,
      fontScale: 100, arrowScale: 100, showArrows: true, arrowBest: true, arrowSecond: false, arrowThird: false, hideUnfavorableArrows: true, showPieceLetters: true });
  assert.equal(normalizeSettings({ hideUnfavorableArrows: false }).hideUnfavorableArrows, false);
  for (const fontScale of [80, 90, 100, 110, 120, 130, 140, 150])
    assert.equal(normalizeSettings({ fontScale: String(fontScale) }).fontScale, fontScale);
  for (const fontScale of [null, 'bad', -1, 0, 79, 151, Infinity])
    assert.equal(normalizeSettings({ fontScale }).fontScale, 100);
  for (const arrowScale of [50, 75, 100, 125, 150, 175, 200])
    assert.equal(normalizeSettings({ arrowScale: String(arrowScale) }).arrowScale, arrowScale);
  for (const arrowScale of [null, 'bad', -1, 0, 49, 201, Infinity])
    assert.equal(normalizeSettings({ arrowScale }).arrowScale, 100);
});
