import { Chess } from 'chess.js';

async function main() {
const params = new URLSearchParams(location.hash.slice(1));
const origin = params.get('origin');
const channel = params.get('channel');
const allowed = ['https://www.chess.com', 'https://chess.com', location.origin];
if (!allowed.includes(origin) || !channel) throw new Error('Origem inválida.');
const send = data => parent.postMessage({ channel, ...data }, origin);
let worker, ready = false, active = null, pending = null, stopping = false;
let watchdog, restartTimer, failed = false, restarts = 0, generation = 0;
const command = line => { send({ type: 'uci', direction: '→', line }); worker.postMessage(line); };

function fail(message, error, retry = true, code) {
  if (failed) return;
  failed = true;
  clearTimeout(watchdog);
  clearTimeout(restartTimer);
  ready = false;
  active = pending = null;
  const previousWorker = worker;
  worker = null;
  previousWorker?.terminate();
  const detail = [error?.message || (error?.type ? `${error.constructor.name}: ${error.type}` : error ? String(error) : 'Sem detalhe informado pelo navegador.'),
    error?.filename && `${error.filename}:${error.lineno || 0}:${error.colno || 0}`].filter(Boolean).join(' · ');
  send({ type: 'uci', direction: '!', line: `[motor] ${message} ${detail}` });
  if (retry && restarts < 1) {
    restarts++;
    send({ type: 'restarting', message: 'Falha no motor local. Tentando reiniciar…' });
    restartTimer = setTimeout(boot, 750);
  } else {
    send({ type: 'error', code, message: `${message} Clique em Tentar novamente. Detalhes em Motor e registros.` });
  }
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
  watchdog = setTimeout(() => fail('O motor não respondeu.', new Error('Tempo limite durante a pesquisa.')), active.ms + 20000);
}

window.addEventListener('message', event => {
  const internalMessage = origin === location.origin && event.source === null;
  if ((!internalMessage && event.source !== parent) || event.origin !== origin || event.data?.channel !== channel) return;
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

async function boot() {
  const attempt = ++generation;
  failed = false;
  stopping = false;
  send({ type: 'uci', direction: '!', line: `[motor] Inicialização ${restarts + 1} · ${navigator.userAgent}` });
  try {
    if (typeof WebAssembly !== 'object') {
      fail('WebAssembly indisponível neste navegador.', new Error('WebAssembly não está disponível neste contexto.'), false);
      return;
    }
    watchdog = setTimeout(() => fail('Não foi possível iniciar o Stockfish.', new Error('Tempo limite de inicialização (30 s).')), 30000);
    const response = await fetch('engine-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`engine-config.json: HTTP ${response.status}`);
    const { loader, version } = await response.json();
    send({ type: 'uci', direction: '!', line: `[motor] Stockfish Lens ${version || 'local'}` });
    if (typeof loader !== 'string' || !/^engine\/stockfish-[\w.-]+-lite-single\.js$/.test(loader)) {
      throw new Error('Caminho do motor inválido em engine-config.json.');
    }
    // A response from a timed-out attempt must never create a second worker.
    if (failed || attempt !== generation) return;
    const current = worker = new Worker(loader);
    current.onerror = event => {
      event.preventDefault();
      if (worker === current) fail('Erro ao executar o Stockfish local.', event, Boolean(event.message), event.message ? undefined : 'worker-load');
    };
    current.onmessageerror = () => {
      if (worker === current) fail('Erro na comunicação com o Stockfish local.', new Error('Não foi possível ler a mensagem do Worker.'));
    };
    current.onmessage = event => {
      if (worker !== current || failed) return;
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
  } catch (error) {
    if (attempt !== generation) return;
    fail('Não foi possível carregar os arquivos do motor local.', error);
  }
}
boot();
}
main();
