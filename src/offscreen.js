const origin = location.origin;
const extensionId = location.hostname;
const sessions = new Map();
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'stockfish-engine' || port.sender?.id !== extensionId ||
      !/^https:\/\/(www\.)?chess\.com\//.test(port.sender?.url || '')) return;
  const channel = crypto.randomUUID();
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.src = new URL('engine.html', location.href).href + '#' + new URLSearchParams({ origin, channel });
  sessions.set(channel, { frame, port, ready: false });
  port.onMessage.addListener(data => {
    if (sessions.get(channel)?.ready && ['analyze', 'cancel'].includes(data?.type))
      frame.contentWindow.postMessage({ ...data, channel }, origin);
  });
  port.onDisconnect.addListener(() => { sessions.delete(channel); frame.remove(); });
  document.body.append(frame);
});
window.addEventListener('message', event => {
  const session = sessions.get(event.data?.channel);
  if (!session || (event.source && event.source !== session.frame.contentWindow) || event.origin !== origin) return;
  if (event.data.type === 'ready') session.ready = true;
  else if (['error', 'restarting'].includes(event.data.type)) session.ready = false;
  try { session.port.postMessage(event.data); }
  catch { sessions.delete(event.data.channel); session.frame.remove(); }
});
