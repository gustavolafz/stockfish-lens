import { Chess } from 'chess.js';

async function main() {
const params = new URLSearchParams(location.hash.slice(1));
const origin = params.get('origin');
const channel = params.get('channel');
const allowed = ['https://www.chess.com', 'https://chess.com'];
if (!allowed.includes(origin) || !channel) throw new Error('Origem inválida.');
const send = data => parent.postMessage({ channel, ...data }, origin);
let worker, ready = false, active = null, pending = null, stopping = false;
let watchdog;
const command = line => { send({ type: 'uci', direction: '→', line }); worker.postMessage(line); };

function fail(message) {
  clearTimeout(watchdog);
  ready = false;
  active = pending = null;
  worker?.terminate();
  send({ type: 'error', message });
}

function startNext() {
  if (!ready || active || !pending) return;
  active = pending;
  pending = null;
  stopping = false;
  // Keep the history as well as the FEN when available to preserve repetition detection.
  command(`setoption name MultiPV value ${active.multipv}`);
  command(active.position || `position fen ${active.fen}`);
  command(`go movetime ${active.ms}`);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => fail('O motor não respondeu. Clique em Analisar para reiniciar.'), active.ms + 20000);
}

window.addEventListener('message', event => {
  if (event.source !== parent || event.origin !== origin || event.data?.channel !== channel) return;
  const data = event.data;
  if (data.type === 'cancel') {
    pending = null;
    if (active && !stopping) { stopping = true; command('stop'); }
  } else if (data.type === 'analyze') {
    try { new Chess(data.fen); } catch { send({ type: 'error', message: 'FEN inválido.' }); return; }
    let position;
    if (Array.isArray(data.moves) && data.moves.length <= 2000) {
      try {
        const game = new Chess();
        for (const move of data.moves) game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
        if (game.fen() === data.fen) position = `position startpos moves ${data.moves.join(' ')}`;
      } catch { /* use validated FEN */ }
    }
    pending = { id: data.id, fen: data.fen, position, multipv: [1, 3, 5].includes(data.multipv) ? data.multipv : 3,
      ms: Math.min(10000, Math.max(200, Number(data.ms) || 1200)) };
    if (active && !stopping) { stopping = true; command('stop'); }
    else startNext();
  }
});

try {
  const { loader } = await (await fetch('engine-config.json')).json();
  worker = new Worker(loader);
  watchdog = setTimeout(() => fail('Não foi possível iniciar o Stockfish.'), 30000);
  worker.onerror = () => fail('Erro ao carregar o Stockfish local. Recarregue a extensão e a página.');
  worker.onmessage = event => {
    for (const line of String(event.data).split('\n')) {
      if (line) send({ type: 'uci', direction: '←', line });
      if (line === 'uciok') {
        command('setoption name Hash value 32');
        command('setoption name UCI_ShowWDL value true');
        command('isready');
      } else if (line === 'readyok' && !ready) {
        ready = true;
        clearTimeout(watchdog);
        send({ type: 'ready' });
        startNext();
      } else if (line.startsWith('info ') && active && !stopping) {
        send({ type: 'info', id: active.id, line });
      } else if (line.startsWith('bestmove ') && active) {
        clearTimeout(watchdog);
        if (!stopping) send({ type: 'done', id: active.id, move: line.split(' ')[1], ponder: /\bponder (\S+)/.exec(line)?.[1] });
        active = null;
        stopping = false;
        startNext();
      }
    }
  };
  command('uci');
} catch {
  fail('Não foi possível carregar os arquivos do motor. Reinstale a pasta dist completa.');
}
}
main();
