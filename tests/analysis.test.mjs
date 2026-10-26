import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SearchAnalysis, formatScore, hideUnfavorableAlternative, evaluationBarPercent } from '../src/analysis.js';

const fen = 'r2q1rk1/pp2ppbp/2n1bnp1/3p4/3P4/1BP2N1P/PP2QPP1/RNB2RK1 b - - 0 10';
const trace = JSON.parse(readFileSync(new URL('fixtures/bestmove-trace.json', import.meta.url), 'utf8'));

test('replays captured Qb6 / Qc7 divergence and commits a single coherent final result', () => {
  const search = new SearchAnalysis(fen);
  let sawQb6 = false;
  for (const line of trace) {
    if (line.startsWith('info ')) {
      search.update(line);
      if (search.primary?.san[0] === 'Qb6') sawQb6 = true;
      if (search.primary) assert.equal(search.lines[0], search.primary);
      assert.equal(new Set(search.lines.map(entry => entry.pv[0])).size, search.lines.length);
    } else {
      assert.equal(line, 'bestmove d8c7 ponder f1e1');
      assert.equal(search.finish('d8c7', 'f1e1'), true);
    }
  }
  assert(sawQb6);
  assert.equal(search.primary.san[0], 'Qc7');
  assert.equal(search.primary.pv[0], 'd8c7');
  assert.equal(formatScore(search.primary), '≥+0.56');
  assert.equal(search.primary.depth, 15);
  assert.equal(search.primary.metrics.time, 1219);
  assert.equal(search.primary.metrics.nodes, 272137);
  assert.deepEqual(search.primary.wdl, [2, 855, 143]);
  assert.deepEqual(search.ponder, { san: 'Re1', uci: 'f1e1' });
  assert.deepEqual(search.lines.map(entry => entry.san[0]), ['Qc7', 'Qb6', 'Rc8']);
});

test('final bestmove can select a previous alternative and carries its own score and PV', () => {
  const search = new SearchAnalysis(fen);
  search.update('info depth 12 multipv 1 score cp -53 pv d8b6 b1d2');
  search.update('info depth 12 multipv 2 score cp -56 pv d8c7 f1e1');
  search.finish('d8c7', 'f1e1');
  assert.equal(search.primary.pv[0], 'd8c7');
  assert.equal(search.primary.score, 56);
  assert.equal(search.primary.san.join(' '), 'Qc7 Re1');
  assert.equal(search.primary.metrics.multipv, 1);
  assert.equal(search.lines[0], search.primary);
});

test('an unseen bestmove clears unrelated scores and continuations', () => {
  const search = new SearchAnalysis(fen);
  search.update('info depth 12 multipv 1 score cp -53 pv d8b6 b1d2');
  search.finish('d8c7', 'f1e1');
  assert.equal(formatScore(search.primary), '—');
  assert.equal(search.primary.depth, null);
  assert.deepEqual(search.primary.san, ['Qc7', 'Re1']);
  assert.deepEqual(search.primary.metrics, {});
  assert.equal(search.primary.wdl, null);
});

test('incomplete MultiPV updates do not duplicate a root move at different ranks', () => {
  const search = new SearchAnalysis(fen);
  search.update('info depth 12 multipv 1 score cp -56 pv d8c7 f1e1');
  search.update('info depth 12 multipv 2 score cp -53 pv d8b6 b1d2');
  search.update('info depth 13 multipv 1 score cp -53 pv d8b6 b1d2');
  assert.equal(search.lines.length, 1);
  assert.equal(search.lines[0].san[0], 'Qb6');
});

test('finished analysis ignores late info and rejects invalid bestmoves', () => {
  const search = new SearchAnalysis(fen);
  search.update('info depth 12 multipv 1 score cp -53 pv d8b6 b1d2');
  assert.equal(search.finish('d8c2'), false);
  assert.equal(search.finish('d8b6'), true);
  assert.equal(search.update('info depth 13 multipv 1 score cp -56 pv d8c7 f1e1'), false);
  assert.equal(search.primary.san[0], 'Qb6');
});

test('bounded scores invert the inequality together with the side-to-move score', () => {
  const search = new SearchAnalysis(fen);
  search.update('info depth 15 multipv 1 score cp -56 upperbound pv d8c7 f1e1');
  assert.equal(formatScore(search.primary), '≥+0.56');
  search.update('info depth 15 multipv 1 score cp -50 lowerbound pv d8b6 b1d2');
  assert.equal(formatScore(search.primary), '≤+0.50');
});

test('unfavorable arrow filter follows the side to move and keeps neutral alternatives', () => {
  const scores = [31, 24, -8].map(score => ({ score, bound: null }));
  assert.deepEqual(scores.map((entry, i) => hideUnfavorableAlternative(entry, i + 1, 'w')), [false, false, true]);
  assert.deepEqual(scores.map((entry, i) => hideUnfavorableAlternative(entry, i + 1, 'b')), [false, true, false]);
  for (const turn of ['w', 'b']) assert.equal(hideUnfavorableAlternative({ score: 0 }, 3, turn), false);
});

test('filter preserves the primary move in losing positions and handles mate signs', () => {
  for (const [turn, score] of [['w', -8], ['b', 8]]) {
    for (const mate of [false, true]) {
      assert.equal(hideUnfavorableAlternative({ score, mate }, 1, turn), false);
      assert.equal(hideUnfavorableAlternative({ score, mate }, 2, turn), true);
      assert.equal(hideUnfavorableAlternative({ score: -score, mate }, 3, turn), false);
    }
  }
});

test('filter does not infer a disadvantage from unknown scores or inconclusive bounds', () => {
  for (const score of [null, undefined, NaN, Infinity]) {
    for (const turn of ['w', 'b']) assert.equal(hideUnfavorableAlternative({ score }, 2, turn), false);
  }
  assert.equal(hideUnfavorableAlternative({ score: -8, bound: 'lowerbound' }, 2, 'w'), false);
  assert.equal(hideUnfavorableAlternative({ score: -8, bound: 'upperbound' }, 2, 'w'), true);
  assert.equal(hideUnfavorableAlternative({ score: 8, bound: 'upperbound' }, 3, 'b'), false);
  assert.equal(hideUnfavorableAlternative({ score: 8, bound: 'lowerbound' }, 3, 'b'), true);
});

test('filtering arrows preserves all analyzed candidates and their original ranking', () => {
  const search = new SearchAnalysis(fen);
  for (const [rank, score, pv] of [[1, 31, 'd8c7 f1e1'], [2, -8, 'd8b6 b1d2'], [3, 24, 'a8c8 f1e1']]) {
    search.update(`info depth 14 multipv ${rank} score cp ${score} pv ${pv}`);
  }
  const visible = search.lines.flatMap((entry, index) =>
    hideUnfavorableAlternative(entry, index + 1, search.turn) ? [] : [index + 1]);
  assert.deepEqual(visible, [1, 3]);
  assert.deepEqual(search.lines.map(entry => entry.pv[0]), ['d8c7', 'd8b6', 'a8c8']);
});


test('mini evaluation bar is symmetric and monotonic with White-relative advantage', () => {
  assert.equal(evaluationBarPercent({ score: 0 }), 50);
  let previous = 50;
  for (const score of [29, 100, 200, 600, 10000]) {
    const white = evaluationBarPercent({ score });
    const black = evaluationBarPercent({ score: -score });
    assert(white >= previous && white > 50 && white < 100);
    assert(black > 0 && black < 50);
    assert(Math.abs(white + black - 100) < .0001);
    previous = white;
  }
});

test('mini evaluation bar reserves the endpoints for mate and rejects missing evaluations', () => {
  for (const info of [null, undefined, {}, { score: null }, { score: NaN }, { score: Infinity }])
    assert.equal(evaluationBarPercent(info), null);
  for (const score of [0, 1, 20]) assert.equal(evaluationBarPercent({ score, mate: true }), 100);
  for (const score of [-0, -1, -20]) assert.equal(evaluationBarPercent({ score, mate: true }), 0);
});
