// The offscreen page owns its ports directly; an idle service worker can sleep.
let creating;
async function ensureEngineHost() {
  if (creating) return creating;
  creating = (async () => {
    const url = chrome.runtime.getURL('offscreen.html');
    const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (pages.some(page => page.url === url)) return;
    await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['WORKERS'],
      justification: 'Executar o Stockfish local quando o navegador impede Workers na iframe do site.' });
  })();
  try { await creating; } finally { creating = null; }
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'ensure-stockfish-host') return;
  if (sender.id !== chrome.runtime.id || !/^https:\/\/(www\.)?chess\.com\//.test(sender.url || '')) {
    reply({ ok: false, message: 'Origem inválida para iniciar o motor.' }); return;
  }
  ensureEngineHost().then(() => reply({ ok: true }), error =>
    reply({ ok: false, message: error.message || String(error) }));
  return true;
});
