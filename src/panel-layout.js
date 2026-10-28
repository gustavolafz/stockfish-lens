const GAP = 12;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 220;

function validLayout(value) {
  if (!value || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(value[key])) || value.width <= 0 || value.height <= 0) return null;
  return { x: value.x, y: value.y, width: value.width, height: value.height };
}

export function resetPanelLayout() {
  // The revision also resets an unsaved/collapsed panel when the layout is null.
  return chrome.storage.local.set({ panelLayout: null, panelLayoutReset: Date.now() });
}

export async function attachPanelLayout(panel, { onReset = () => {} } = {}) {
  const header = panel.querySelector('header');
  const handle = panel.querySelector('.resize-handle');
  let layout = null, gesture = null;
  let startupDocked = panel.classList.contains('collapsed');
  try { layout = validLayout((await chrome.storage.local.get('panelLayout')).panelLayout); } catch { /* defaults */ }
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const bounds = () => ({ width: Math.max(1, innerWidth - GAP * 2), height: Math.max(1, innerHeight - GAP * 2) });
  const rect = () => {
    const box = panel.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  };

  function apply() {
    // Always start the minimized panel at the CSS bottom/right anchor. A saved
    // layout is applied when expanded, so prior size/position choices survive.
    if (startupDocked && panel.classList.contains('collapsed')) {
      for (const key of ['left', 'top', 'right', 'bottom', 'width', 'height']) panel.style.removeProperty(key);
      if (layout) panel.style.width = `${clamp(layout.width, Math.min(MIN_WIDTH, bounds().width), bounds().width)}px`;
      return;
    }
    if (!layout) {
      for (const key of ['left', 'top', 'right', 'bottom', 'width', 'height']) panel.style.removeProperty(key);
      return;
    }
    const max = bounds();
    const width = clamp(layout.width, Math.min(MIN_WIDTH, max.width), max.width);
    const expandedHeight = clamp(layout.height, Math.min(MIN_HEIGHT, max.height), max.height);
    const collapsed = panel.classList.contains('collapsed');
    const visibleHeight = collapsed ? Math.min(header.getBoundingClientRect().height + 2, max.height) : expandedHeight;
    const x = clamp(layout.x, GAP, Math.max(GAP, innerWidth - GAP - width));
    const y = clamp(layout.y, GAP, Math.max(GAP, innerHeight - GAP - visibleHeight));
    Object.assign(panel.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto', width: `${width}px`, height: collapsed ? 'auto' : `${expandedHeight}px` });
  }

  function remember() {
    if (!layout) return;
    const box = rect();
    layout = { ...box, height: panel.classList.contains('collapsed') ? layout.height : box.height };
    try { chrome.storage.local.set({ panelLayout: layout }).catch(() => {}); } catch { /* disconnected context: keep local layout */ }
  }

  function start(event, kind) {
    if (event.button !== 0 || gesture || (kind === 'move' && event.target.closest('button'))) return;
    if (kind === 'resize' && panel.classList.contains('collapsed')) return;
    apply();
    event.preventDefault();
    event.stopPropagation();
    const box = rect();
    const before = layout;
    const beforeDocked = startupDocked;
    startupDocked = false;
    layout = { ...box, height: panel.classList.contains('collapsed') ? layout?.height || bounds().height : box.height };
    apply();
    gesture = { pointer: event.pointerId, element: event.currentTarget, kind, startX: event.clientX, startY: event.clientY,
      box: rect(), expandedHeight: layout.height, before, beforeDocked };
    panel.classList.add('is-interacting');
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event) {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    event.stopPropagation();
    const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
    const { box, kind } = gesture;
    layout = kind === 'move' ? { ...box, x: box.x + dx, y: box.y + dy, height: gesture.expandedHeight } :
      { ...box, width: box.width + dx, height: box.height + dy };
    if (kind === 'resize') {
      const max = bounds();
      layout.width = clamp(layout.width, Math.min(MIN_WIDTH, max.width), Math.max(Math.min(MIN_WIDTH, max.width), innerWidth - GAP - box.x));
      layout.height = clamp(layout.height, Math.min(MIN_HEIGHT, max.height), Math.max(Math.min(MIN_HEIGHT, max.height), innerHeight - GAP - box.y));
    }
    apply();
  }

  function finish(event) {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    event.stopPropagation();
    const previous = gesture;
    gesture = null;
    panel.classList.remove('is-interacting');
    if (event.type === 'pointercancel') { layout = previous.before; startupDocked = previous.beforeDocked; apply(); }
    else remember();
    if (previous.element.hasPointerCapture(event.pointerId)) previous.element.releasePointerCapture(event.pointerId);
  }

  function keyboard(event, kind) {
    if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    apply();
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 40 : 10;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    const box = rect();
    startupDocked = false;
    layout = kind === 'move' ? { ...box, x: box.x + dx, y: box.y + dy, height: panel.classList.contains('collapsed') ? layout?.height || bounds().height : box.height } :
      { ...box, width: box.width + dx, height: box.height + dy };
    apply(); remember();
  }

  header.tabIndex = 0;
  header.title = 'Arraste para mover o painel. Com foco aqui, use as setas do teclado.';
  for (const [element, kind] of [[header, 'move'], [handle, 'resize']]) {
    element.addEventListener('pointerdown', event => start(event, kind));
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', finish);
    element.addEventListener('lostpointercapture', finish);
    element.addEventListener('keydown', event => keyboard(event, kind));
  }
  window.addEventListener('resize', apply);
  document.addEventListener('fullscreenchange', apply);
  try { chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || gesture || (!changes.panelLayout && !changes.panelLayoutReset)) return;
    layout = changes.panelLayout ? validLayout(changes.panelLayout.newValue) : layout;
    if (changes.panelLayoutReset || changes.panelLayout?.newValue === null) {
      layout = null; startupDocked = false; panel.classList.remove('collapsed'); onReset();
    }
    apply();
  }); } catch { /* layout remains usable until the page is reloaded */ }
  apply();
  return {
    setCollapsed(collapsed) {
      if (!layout && !panel.classList.contains('collapsed')) layout = rect();
      startupDocked = false;
      panel.classList.toggle('collapsed', collapsed);
      apply();
    },
    async reset() {
      layout = null; startupDocked = false; panel.classList.remove('collapsed'); onReset(); apply();
      await resetPanelLayout();
    }
  };
}
