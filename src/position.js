import { Chess } from 'chess.js';

export const BOARD_SELECTOR = 'wc-chess-board, chess-board';

export function placementFromBoard(board) {
  const squares = new Map();
  for (const el of board.querySelectorAll('.piece')) {
    const piece = [...el.classList].find(c => /^[wb][prnbqk]$/.test(c));
    const square = [...el.classList].find(c => /^square-[1-8][1-8]$/.test(c));
    if (!piece || !square) continue;
    const key = square.slice(7);
    if (squares.has(key)) throw new Error('Aguardando a animação das peças…');
    squares.set(key, piece[0] === 'w' ? piece[1].toUpperCase() : piece[1]);
  }
  const ranks = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '', empty = 0;
    for (let file = 1; file <= 8; file++) {
      const piece = squares.get(`${file}${rank}`);
      if (!piece) empty++;
      else { if (empty) row += empty; empty = 0; row += piece; }
    }
    if (empty) row += empty;
    ranks.push(row);
  }
  return ranks.join('/');
}

export function sanFromNode(node) {
  const content = node.querySelector('.node-highlight-content') || node;
  const copy = content.cloneNode(true);
  for (const icon of copy.querySelectorAll('[data-figurine]')) {
    icon.replaceWith(icon.getAttribute('data-figurine'));
  }
  for (const annotation of copy.querySelectorAll('.annotation, .move-time, [data-move-list-el="timestamp"]')) annotation.remove();
  return copy.textContent.replace(/\s+/g, '').replace(/[!?]+/g, '').replace(/0/g, 'O')
    // Chess.com renders promotion letters as text in Portuguese, even when other
    // pieces use language-independent data-figurine icons. Normalize only the
    // promotion suffix so English SAN and file/rank disambiguation stay intact.
    .replace(/=([DTC])(?=[+#]*$)/, (_, piece) => '=' + ({ D: 'Q', T: 'R', C: 'N' })[piece]);
}

// In the supplied Chess.com DOM, queued moves relocate pieces immediately and
// mark their origin/destination red. Validate that exact visual projection of
// the complete history; never use the projected position as an engine FEN.
function confirmedPremove(board, game, placement) {
  const squares = [...new Set([...board.querySelectorAll('.highlight')]
    .filter(el => el.style.backgroundColor?.replace(/\s/g, '') === 'rgb(244,42,50)')
    .map(el => [...el.classList].find(c => /^square-[1-8][1-8]$/.test(c)))
    .filter(Boolean).map(css => String.fromCharCode(96 + Number(css[7])) + css[8]))];
  if (squares.length !== 2) return null;
  for (const [from, to] of [squares, [...squares].reverse()]) {
    const piece = game.get(from), target = game.get(to);
    if (!piece || piece.color === game.turn() || target?.color === piece.color || target?.type === 'k') continue;
    const projected = new Chess(game.fen());
    projected.remove(from); projected.remove(to);
    const promotion = piece.type === 'p' && to[1] === (piece.color === 'w' ? '8' : '1');
    const types = promotion ? ['p', 'q', 'r', 'b', 'n'] : [piece.type];
    if (piece.type === 'k' && from === `e${piece.color === 'w' ? '1' : '8'}` &&
        ['c', 'g'].some(file => to === file + from[1])) {
      const kingSide = to[0] === 'g';
      const right = piece.color === 'w' ? kingSide ? 'K' : 'Q' : kingSide ? 'k' : 'q';
      const rookFrom = (kingSide ? 'h' : 'a') + from[1], rookTo = (kingSide ? 'f' : 'd') + from[1];
      const rook = game.get(rookFrom);
      if (!game.fen().split(' ')[2].includes(right) || rook?.type !== 'r' || rook.color !== piece.color || game.get(rookTo)) continue;
      projected.remove(rookFrom); projected.put(rook, rookTo);
    }
    for (const type of types) {
      projected.put({ type, color: piece.color }, to);
      if (projected.fen().split(' ')[0] === placement) return { from, to };
    }
  }
  return null;
}

// Use the real move history: piece placement alone cannot establish castling or en passant.
export function readPosition(board, doc = document) {
  const placement = placementFromBoard(board);
  const list = [...doc.querySelectorAll('wc-simple-move-list, .move-list')]
    .find(el => !el.getAttribute('board-id') || el.getAttribute('board-id') === board.id);
  const nodes = list ? [...list.querySelectorAll('[data-node]')]
    .filter(el => /^0-\d+$/.test(el.getAttribute('data-node')))
    .sort((a, b) => +a.getAttribute('data-node').slice(2) - +b.getAttribute('data-node').slice(2)) : [];
  const selected = nodes.findIndex(node => node.matches('.selected, [aria-current="true"]') || node.querySelector('.selected'));
  const game = new Chess();
  const moves = [];
  const candidates = [];
  const add = ply => {
    if (game.fen().split(' ')[0] === placement) candidates.push({ fen: game.fen(), ply, moves: [...moves] });
  };
  add(0);
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].getAttribute('data-node') !== `0-${i}`) break;
    try {
      const move = game.move(sanFromNode(nodes[i]));
      moves.push(move.from + move.to + (move.promotion || ''));
    } catch { break; }
    add(i + 1);
  }
  let match;
  if (selected >= 0) match = candidates.find(c => c.ply === selected + 1);
  else match = candidates.at(-1);
  if (!match && list && moves.length === nodes.length &&
      (selected < 0 || selected === nodes.length - 1)) {
    const premove = confirmedPremove(board, game, placement);
    if (premove) return { fen: game.fen(), ply: moves.length, moves,
      source: 'Posição real · pré-movimento ignorado', placement, premove };
  }
  if (!match) throw new Error('Não foi possível confirmar a posição pelo histórico. Abra a lista completa de lances ou informe um FEN.');
  return { ...match, source: 'Tabuleiro + histórico', placement };
}

export function squarePoint(square, flipped = false) {
  const file = square.charCodeAt(0) - 97, rank = Number(square[1]) - 1;
  return [(flipped ? 7 - file : file) * 12.5 + 6.25,
    (flipped ? rank : 7 - rank) * 12.5 + 6.25];
}

export function isFlipped(board) {
  if (board.classList.contains('flipped')) return true;
  const coordinates = [...board.querySelectorAll('.coordinates text')];
  const firstRank = coordinates.find(el => /^[1-8]$/.test(el.textContent.trim()));
  return firstRank?.textContent.trim() === '1';
}

export function variation(fen, uciMoves, limit = 8) {
  const game = new Chess(fen), result = [];
  for (const uci of uciMoves.slice(0, limit)) {
    try {
      const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      result.push(move.san);
    } catch { break; }
  }
  return result;
}

export function parseInfo(line, turn) {
  const depth = /\bdepth (\d+)/.exec(line);
  const score = /\bscore (cp|mate) (-?\d+)/.exec(line);
  const pv = /\bpv (.+)/.exec(line);
  if (!depth || !score || !pv) return null;
  const whiteScore = Number(score[2]) * (turn === 'w' ? 1 : -1);
  const rawBound = /\b(lowerbound|upperbound)\b/.exec(line)?.[1];
  const bound = !rawBound ? null : turn === 'w' ? rawBound : rawBound === 'lowerbound' ? 'upperbound' : 'lowerbound';
  const metrics = {};
  for (const key of ['seldepth', 'multipv', 'nodes', 'nps', 'hashfull', 'tbhits', 'time', 'cpuload', 'currmovenumber']) {
    const found = new RegExp(`\\b${key} (\\d+)`).exec(line);
    if (found) metrics[key] = Number(found[1]);
  }
  const wdl = /\bwdl (\d+) (\d+) (\d+)/.exec(line);
  const currmove = /\bcurrmove (\S+)/.exec(line);
  return { depth: +depth[1], score: whiteScore, bound, mate: score[1] === 'mate', pv: pv[1].trim().split(/\s+/),
    multipv: metrics.multipv || 1, metrics, wdl: wdl ? wdl.slice(1).map(Number) : null, currmove: currmove?.[1] };
}
