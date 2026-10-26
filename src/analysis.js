import { Chess } from 'chess.js';
import { parseInfo, variation } from './position.js';

export function formatScore(info) {
  if (info.score === null) return '—';
  const bound = info.bound === 'lowerbound' ? '≥' : info.bound === 'upperbound' ? '≤' : '';
  const score = info.mate ? `${info.score < 0 ? '−' : '+'}M${Math.abs(info.score)}` :
    `${info.score >= 0 ? '+' : '−'}${(Math.abs(info.score) / 100).toFixed(2)}`;
  return bound + score;
}

// A compact visual scale, not a win probability. Reserve the endpoints for mate.
export function evaluationBarPercent(info) {
  if (!Number.isFinite(info?.score)) return null;
  if (info.mate) return info.score < 0 || Object.is(info.score, -0) ? 0 : 100;
  return Math.max(1, Math.min(99, 50 + 50 * Math.tanh(info.score / 400)));
}

// Scores and bounds are stored from White's perspective. Keep the primary move
// available even in losing positions; only filter alternatives known to favor
// the opponent. A lower bound below zero is still inconclusive for White (and
// an upper bound above zero is inconclusive for Black).
export function hideUnfavorableAlternative(entry, rank, turn) {
  if (rank === 1 || !entry || !Number.isFinite(entry.score)) return false;
  if (turn === 'w') return entry.score < 0 && entry.bound !== 'lowerbound';
  if (turn === 'b') return entry.score > 0 && entry.bound !== 'upperbound';
  return false;
}

// One state supplies the headline, score, coordinates, PV and arrow. The final
// bestmove is authoritative, even when the last search iteration is incomplete.
export class SearchAnalysis {
  constructor(fen) {
    this.fen = fen;
    this.turn = new Chess(fen).turn();
    this.ranks = new Map();
    this.byMove = new Map();
    this.primary = null;
    this.ponder = null;
    this.finished = false;
  }

  update(line) {
    if (this.finished) return false;
    const info = parseInfo(line, this.turn);
    if (!info) return false;
    const san = variation(this.fen, info.pv, info.pv.length);
    if (!san.length) return false;
    const entry = { ...info, san };
    this.ranks.set(info.multipv, entry);
    this.byMove.set(info.pv[0], entry);
    if (info.multipv === 1) this.primary = entry;
    return true;
  }

  finish(move, ponder) {
    if (this.finished) return false;
    const san = variation(this.fen, [move]);
    if (!san.length) return false;
    const entry = this.byMove.get(move);
    this.primary = entry ? { ...entry, multipv: 1, metrics: { ...entry.metrics, multipv: 1 } } : {
      pv: [move], san, score: null, bound: null, depth: null, metrics: {}, wdl: null, multipv: 1
    };
    const reply = ponder && variation(this.fen, [move, ponder])[1];
    this.ponder = reply ? { uci: ponder, san: reply } : null;
    if (reply && this.primary.pv[1] !== ponder) {
      this.primary = { ...this.primary, pv: [move, ponder], san: [san[0], reply] };
    }
    this.finished = true;
    return true;
  }

  get lines() {
    if (!this.primary) return [];
    const seen = new Set();
    return [this.primary, ...[...this.ranks.entries()].sort(([a], [b]) => a - b).map(([, entry]) => entry)]
      .filter(entry => {
        const move = entry.pv[0];
        if (seen.has(move)) return false;
        seen.add(move);
        return true;
      }).slice(0, Math.max(1, this.ranks.size));
  }
}
