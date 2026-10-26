import { renderPiece } from './pieces.js';

const SYMBOLS = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' }
};

export function sanTokens(san, turn = 'w') {
  const tokens = [];
  const castle = /^(?:O-O-O|O-O)/.exec(san)?.[0];
  const origin = /^[KQRBN]([a-h]?[1-8]?)(?=x?[a-h][1-8])/.exec(san)?.[1] || '';
  for (let i = 0; i < san.length; i++) {
    const char = san[i];
    if (i === 0 && castle) {
      tokens.push({ kind: 'castle', text: castle, title: castle === 'O-O' ? 'Roque curto' : 'Roque longo' });
      i += castle.length - 1;
    } else if ((i === 0 || san[i - 1] === '=') && SYMBOLS[turn][char]) {
      tokens.push({ kind: 'piece', text: SYMBOLS[turn][char], letter: char, promoted: san[i - 1] === '=' });
    } else if (char === 'x') tokens.push({ kind: 'capture', text: '×', title: 'Captura' });
    else if (char === '=') tokens.push({ kind: 'promotion', text: char, title: 'Promoção do peão' });
    else if (char === '+') tokens.push({ kind: 'check', text: char, title: 'Xeque' });
    else if (char === '#') tokens.push({ kind: 'mate', text: char, title: 'Xeque-mate' });
    else if (i === 1 && origin) {
      tokens.push({ kind: 'origin', text: origin, title: `Origem da peça: ${origin}` });
      i += origin.length - 1;
    }
    else tokens.push({ kind: 'text', text: char });
  }
  return tokens;
}

export function numberedMoves(fen, moves) {
  const fields = fen.split(' ');
  let turn = fields[1], number = Number(fields[5]);
  return moves.map((san, index) => {
    const result = { san, turn, number, label: turn === 'w' ? `${number}.` : index === 0 ? `${number}…` : '' };
    if (turn === 'b') number++;
    turn = turn === 'w' ? 'b' : 'w';
    return result;
  });
}

export function renderSan(doc, san, turn) {
  const el = doc.createElement('span');
  el.className = 'san-move';
  el.dataset.san = san;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', san);
  el.title = san;
  for (const token of sanTokens(san, turn)) {
    if (token.kind === 'text') el.append(doc.createTextNode(token.text));
    else {
      const span = doc.createElement('span');
      span.className = `notation-${token.kind}${token.promoted ? ' notation-promoted-piece' : ''}`;
      if (token.kind === 'piece') {
        span.append(renderPiece(doc, token.letter, turn));
        const text = doc.createElement('span');
        text.className = 'piece-text';
        text.textContent = token.text;
        span.append(text);
      } else span.textContent = token.text;
      if (token.title) span.title = token.title;
      span.setAttribute('aria-hidden', 'true');
      el.append(span);
      if (token.letter) {
        const letter = doc.createElement('span');
        letter.className = `notation-letter${token.promoted ? ' notation-promoted-letter' : ''}`;
        letter.textContent = token.letter;
        letter.setAttribute('aria-hidden', 'true');
        el.append(letter);
      }
    }
  }
  return el;
}

export function renderLine(doc, fen, moves) {
  const fragment = doc.createDocumentFragment();
  for (const entry of numberedMoves(fen, moves)) {
    const token = doc.createElement('span'); token.className = 'move-token';
    if (entry.label) {
      const number = doc.createElement('span'); number.className = 'move-number';
      number.textContent = entry.label; token.append(number, doc.createTextNode(' '));
    }
    token.append(renderSan(doc, entry.san, entry.turn));
    fragment.append(token, doc.createTextNode(' '));
  }
  return fragment;
}
