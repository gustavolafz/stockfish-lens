import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { sanTokens, numberedMoves, renderSan, renderLine } from '../src/notation.js';

test('all pieces have symbols for both sides, while pawns and castling stay as text', () => {
  for (const turn of ['w', 'b']) {
    for (const piece of 'KQRBN') {
      assert.equal(sanTokens(`${piece}f3`, turn).filter(t => t.kind === 'piece').length, 1);
    }
    for (const san of ['e4', 'exd5', 'O-O', 'O-O-O']) {
      assert.equal(sanTokens(san, turn).filter(t => t.kind === 'piece').length, 0);
    }
  }
  assert.equal(sanTokens('Qxb2', 'b').map(t => t.text).join(''), '♛×b2');
  assert.equal(sanTokens('R1f2', 'w').map(t => t.text).join(''), '♖1f2');
  assert.equal(sanTokens('a8=Q+', 'w').map(t => t.text).join(''), 'a8=♕+');
});

test('move numbering starts at the real FEN fullmove and handles a black starting move', () => {
  const white = numberedMoves('8/8/8/8/8/8/8/8 w - - 0 15', ['O-O', 'Qxb2', 'Nd2', 'Nf5', 'Nb3']);
  assert.deepEqual(white.map(m => m.label), ['15.', '', '16.', '', '17.']);
  assert.deepEqual(white.map(m => m.turn), ['w','b','w','b','w']);
  const black = numberedMoves('8/8/8/8/8/8/8/8 b - - 0 15', ['Qxb2', 'Nd2', 'Nf5', 'Nb3']);
  assert.deepEqual(black.map(m => m.label), ['15…', '16.', '', '17.']);
});

test('rendering retains SAN for accessibility and synchronization while styling capture separately', () => {
  const { document } = parseHTML('<main></main>');
  const move = renderSan(document, 'Qxb2+', 'b');
  assert.equal(move.dataset.san, 'Qxb2+');
  assert.equal(move.getAttribute('aria-label'), 'Qxb2+');
  assert.equal(move.querySelector('.notation-piece').textContent, '♛');
  assert.equal(move.querySelector('.notation-capture').textContent, '×');
  assert.equal(move.querySelector('.notation-check').textContent, '+');
  const target = document.querySelector('main');
  target.append(renderLine(document, '8/8/8/8/8/8/8/8 b - - 0 15', ['Qxb2', 'Nd2', 'Nf5']));
  assert.deepEqual([...target.querySelectorAll('.move-number')].map(el => el.textContent), ['15…', '16.']);
  assert.deepEqual([...target.querySelectorAll('.san-move')].map(el => el.dataset.san), ['Qxb2', 'Nd2', 'Nf5']);
});

test('capture, promotion, check and mate remain separate and preserve the complete move', () => {
  const { document } = parseHTML('<main></main>');
  const promotion = renderSan(document, 'exd8=Q#', 'w');
  assert.equal(promotion.textContent, 'e×d8=♕Q#');
  assert.equal(promotion.dataset.san, 'exd8=Q#');
  assert.equal(promotion.querySelector('.notation-promotion').title, 'Promoção do peão');
  assert.equal(promotion.querySelector('.notation-promoted-piece').textContent, '♕');
  assert.equal(promotion.querySelector('.notation-mate').title, 'Xeque-mate');
  assert.equal(promotion.querySelector('.notation-check'), null);
  assert.equal(renderSan(document, 'e8=Q+', 'w').querySelector('.notation-check').title, 'Xeque');
  assert.equal(renderSan(document, 'Qe8#', 'w').querySelector('.notation-origin'), null);
});

test('origin disambiguation is distinct from the destination, and castling keeps its original text', () => {
  const { document } = parseHTML('<main></main>');
  for (const [san, origin] of [['Rae1', 'a'], ['R1e2', '1'], ['Nb1d2', 'b1'], ['Nfxd2+', 'f']]) {
    const move = renderSan(document, san, 'w');
    assert.equal(move.querySelector('.notation-origin').textContent, origin, san);
    assert.equal(move.dataset.san, san);
  }
  for (const san of ['Qe8#', 'Nf3', 'e4', 'exd5', 'a8=Q']) {
    assert.equal(renderSan(document, san, 'w').querySelector('.notation-origin'), null, san);
  }
  for (const san of ['O-O', 'O-O-O+']) {
    const move = renderSan(document, san, 'b');
    assert.equal(move.textContent, san);
    assert.equal(move.querySelector('.notation-piece'), null);
    assert(move.querySelector('.notation-castle'));
  }
});
